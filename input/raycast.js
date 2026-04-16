import { getCellById } from '../board/boardQueries.js';
import { getBeeById } from '../bees/beeQueries.js';

var THREE = globalThis.THREE;

var stateRef = null;
var getCameraRef = function() { return null; };
var getCellMeshMapRef = function() { return {}; };
var getCoreOccluderRef = function() { return null; };
var getMeshUuidToBeeIdRef = function() { return {}; };
var getMeshUuidToCellIdRef = function() { return {}; };

var raycaster = new THREE.Raycaster();
var tapNDC = new THREE.Vector2();
var beeScreenPos = new THREE.Vector3();
var beeCenterWorld = new THREE.Vector3();
var beeScaleWorld = new THREE.Vector3();
var sphereHitWorld = new THREE.Vector3();
var projectedWorld = new THREE.Vector3();
var sphere = new THREE.Sphere();

export function setRaycastRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getCameraRef = runtime && runtime.getCamera ? runtime.getCamera : getCameraRef;
  getCellMeshMapRef = runtime && runtime.getCellMeshMap ? runtime.getCellMeshMap : getCellMeshMapRef;
  getCoreOccluderRef = runtime && runtime.getCoreOccluder ? runtime.getCoreOccluder : getCoreOccluderRef;
  getMeshUuidToBeeIdRef = runtime && runtime.getMeshUuidToBeeId ? runtime.getMeshUuidToBeeId : getMeshUuidToBeeIdRef;
  getMeshUuidToCellIdRef = runtime && runtime.getMeshUuidToCellId ? runtime.getMeshUuidToCellId : getMeshUuidToCellIdRef;
}

export function setScreenRay(screenX, screenY) {
  tapNDC.x = (screenX / window.innerWidth) * 2 - 1;
  tapNDC.y = -(screenY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(tapNDC, getCameraRef());
  return raycaster;
}

export function getScreenRay(screenX, screenY) {
  return setScreenRay(screenX, screenY).ray;
}

export function projectWorldToScreen(worldPos) {
  var camera = getCameraRef();
  projectedWorld.copy(worldPos).project(camera);
  return {
    x: (projectedWorld.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projectedWorld.y * 0.5 + 0.5) * window.innerHeight,
    z: projectedWorld.z,
    visible: projectedWorld.z >= -1.0 && projectedWorld.z <= 1.0
  };
}

export function getProjectedDistancePx(screenX, screenY, worldPos) {
  var projected = projectWorldToScreen(worldPos);
  if (!projected.visible) { return Infinity; }
  var dx = projected.x - screenX;
  var dy = projected.y - screenY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getBeeInteractionWorldPos(bee, out) {
  var target = out || new THREE.Vector3();
  if (!bee || !bee.mesh) { return target.set(0, 0, 0); }
  if (bee.mesh.userData && bee.mesh.userData.interactionAnchor) {
    bee.mesh.userData.interactionAnchor.getWorldPosition(target);
  } else {
    target.copy(bee.mesh.position);
    target.y += bee.interactionHeightBias || 0;
  }
  return target;
}

export function getBeeInteractionRadius(bee) {
  if (!bee || !bee.mesh) { return 0; }
  bee.mesh.getWorldScale(beeScaleWorld);
  var scale = Math.max(beeScaleWorld.x, beeScaleWorld.y, beeScaleWorld.z);
  return (bee.interactionRadius || 0) * scale;
}

export function intersectBeeInteractionColliders(screenX, screenY, excludeBeeId) {
  if (!stateRef || !stateRef.bees) { return []; }
  setScreenRay(screenX, screenY);
  var hits = [];
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var bee = stateRef.bees[bi];
    if (!bee || !bee.mesh || bee.id === excludeBeeId) { continue; }
    getBeeInteractionWorldPos(bee, beeCenterWorld);
    sphere.center.copy(beeCenterWorld);
    sphere.radius = getBeeInteractionRadius(bee);
    if (sphere.radius <= 0.0001) { continue; }
    if (!raycaster.ray.intersectSphere(sphere, sphereHitWorld)) { continue; }
    hits.push({
      bee: bee,
      point: sphereHitWorld.clone(),
      center: beeCenterWorld.clone(),
      distance: raycaster.ray.origin.distanceTo(sphereHitWorld),
      radius: sphere.radius
    });
  }
  hits.sort(function(a, b) {
    if (Math.abs(a.distance - b.distance) > 0.0001) { return a.distance - b.distance; }
    return a.bee.id - b.bee.id;
  });
  return hits;
}

export function getFrontmostBeeColliderHit(screenX, screenY, excludeBeeId) {
  var hits = intersectBeeInteractionColliders(screenX, screenY, excludeBeeId);
  return hits.length > 0 ? hits[0] : null;
}

export function getBeeAtScreen(screenX, screenY) {
  var hit = getFrontmostBeeColliderHit(screenX, screenY, null);
  return hit ? hit.bee : null;
}

export function getBeeNearScreen(screenX, screenY, excludeBeeId, tolerancePx) {
  var frontmostHit = getFrontmostBeeColliderHit(screenX, screenY, excludeBeeId);
  if (frontmostHit) { return frontmostHit.bee; }

  var bestBee = null;
  var bestDistSq = tolerancePx * tolerancePx;
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var bee = stateRef.bees[bi];
    if (!bee || !bee.mesh || bee.id === excludeBeeId) { continue; }
    getBeeInteractionWorldPos(bee, beeCenterWorld);
    beeScreenPos.copy(beeCenterWorld).project(getCameraRef());
    if (beeScreenPos.z < -1.0 || beeScreenPos.z > 1.0) { continue; }
    var beeX = (beeScreenPos.x * 0.5 + 0.5) * window.innerWidth;
    var beeY = (-beeScreenPos.y * 0.5 + 0.5) * window.innerHeight;
    var dx = beeX - screenX;
    var dy = beeY - screenY;
    var distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      bestBee = bee;
    }
  }
  return bestBee;
}

export function getDirectCellHit(screenX, screenY) {
  setScreenRay(screenX, screenY);
  var cellObjects = [];
  var cellMeshMap = getCellMeshMapRef();
  for (var cid in cellMeshMap) { cellObjects.push(cellMeshMap[cid]); }
  var cellHits = raycaster.intersectObjects(cellObjects, false);
  if (cellHits.length === 0) { return null; }
  var hit = cellHits[0];
  var hitCellId = getMeshUuidToCellIdRef()[hit.object.uuid];
  var hitCell = (hitCellId !== undefined) ? getCellById(hitCellId) : null;
  if (!hitCell) { return null; }
  return {
    cell: hitCell,
    distance: hit.distance,
    point: hit.point.clone(),
    object: hit.object
  };
}

export function getCellAtScreen(screenX, screenY) {
  var hit = getDirectCellHit(screenX, screenY);
  return hit ? hit.cell : null;
}

export function getTrunkOccluderHit(screenX, screenY) {
  var coreOccluder = getCoreOccluderRef();
  if (!coreOccluder) { return null; }
  setScreenRay(screenX, screenY);
  var hits = raycaster.intersectObject(coreOccluder, false);
  if (!hits || hits.length === 0) { return null; }
  return {
    distance: hits[0].distance,
    point: hits[0].point.clone(),
    object: hits[0].object
  };
}

export function getBeeByMeshUuid(uuid) {
  var beeId = getMeshUuidToBeeIdRef()[uuid];
  return beeId !== undefined ? getBeeById(beeId) : null;
}
