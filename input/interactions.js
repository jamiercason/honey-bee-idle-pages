import { BEE_ROLE, BEE_STATE, BOOST_TYPE, CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { getCellById } from '../board/boardQueries.js';
import { isWorkerSeatCell, removeCellOccupant } from '../board/cellState.js';
import { getRoyalRushStacks, registerRoyalRush } from '../economy/boosts.js';
import { grantCellReward } from '../economy/rewards.js';
import { tryBuildOrUpgrade } from '../economy/buildings.js';
import { evaluateGateConditions } from '../economy/gates.js';
import { getSelectedBee } from '../bees/beeQueries.js';
import { assignBeeToCell, releaseWorkTarget } from '../bees/beeAssignments.js';
import { mergeBees } from '../bees/beeMerging.js';
import { refreshCellMaterial } from '../scene/materials.js';
import { updateBoostGhost } from '../ui/summonBar.js';
import { HIVE } from '../config/hiveConfig.js';
import { BOOST_TARGET_TOLERANCE_PX, POINTER_INTENT_STATE } from '../config/inputConfig.js';
import { longPressState, pointer } from './inputState.js';
import { getBeeNearScreen, getCellAtScreen, getScreenRay } from './raycast.js';
import { pickFreshBeeCandidate, resolveActiveDragTargets, resolveReleaseTarget } from './targeting.js';

var THREE = globalThis.THREE;

var stateRef = null;
var getCameraRef = function() { return null; };
var setBuildingToastRef = function() {};
var selectBeeRef = function() {};
var rejectShakeRef = function() {};
var flashCellRef = function() {};
var markCameraInteractionRef = function() {};
var applyRoyalJellyToBeeRef = function() { return false; };

var dragPreviewCandidate = new THREE.Vector3();
var dragPreviewFallback = new THREE.Vector3();
var dragPreviewCameraDir = new THREE.Vector2();
var dragPreviewPointDir = new THREE.Vector2();
var dragPreviewPlaneNormal = new THREE.Vector3();
var dragPreviewPlane = new THREE.Plane();

var DRAG_PREVIEW_FRONT_DOT_MIN = 0.08;

function dropBeeAtWorldPos(bee, worldPos) {
  if (!bee || !worldPos) { return; }
  releaseWorkTarget(bee);
  if (bee.seatCellId !== null) {
    var seatedCell = getCellById(bee.seatCellId);
    if (seatedCell) { removeCellOccupant(seatedCell, bee.id); }
  }
  bee.role = BEE_ROLE.GATHERER;
  bee.isWorker = false;
  bee.seatCellId = null;
  bee.targetCellId = null;
  bee.workTargetCellId = null;
  bee.forcedWorkTarget = null;
  bee.landedTheta = null;
  bee.gatherPhase = 'released';
  bee.state = BEE_STATE.IDLE;
  bee.pos.copy(worldPos);
  bee.origin.copy(worldPos);
  bee.targetPos.copy(worldPos);
  bee.travelT = 1.0;
  bee.travelDur = 0.0001;
  bee.idleTimer = 0.3;
}

function getDragPreviewSurfaceRadius(bee) {
  var bodyRadius = (bee && bee.interactionRadius) ? bee.interactionRadius : 0.34;
  return HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + Math.max(0.26, bodyRadius * 0.95) + 0.10;
}

function getCameraFrontDir(camera) {
  dragPreviewCameraDir.set(camera.position.x, camera.position.z);
  if (dragPreviewCameraDir.lengthSq() < 0.0001) {
    dragPreviewCameraDir.set(0, 1);
  } else {
    dragPreviewCameraDir.normalize();
  }
  return dragPreviewCameraDir;
}

function clampPreviewDirToFrontFace(dir, camera) {
  getCameraFrontDir(camera);
  if (dir.lengthSq() < 0.0001) {
    dir.set(dragPreviewCameraDir.x, dragPreviewCameraDir.y);
    return dir;
  }
  dir.normalize();
  var dot = dir.dot(dragPreviewCameraDir);
  if (dot >= DRAG_PREVIEW_FRONT_DOT_MIN) { return dir; }

  var side = (dragPreviewCameraDir.x * dir.y) - (dragPreviewCameraDir.y * dir.x);
  var tangentSign = side < 0 ? -1 : 1;
  var tangentX = -dragPreviewCameraDir.y;
  var tangentY = dragPreviewCameraDir.x;
  var tangentScale = Math.sqrt(Math.max(0, 1 - DRAG_PREVIEW_FRONT_DOT_MIN * DRAG_PREVIEW_FRONT_DOT_MIN)) * tangentSign;
  dir.set(
    dragPreviewCameraDir.x * DRAG_PREVIEW_FRONT_DOT_MIN + tangentX * tangentScale,
    dragPreviewCameraDir.y * DRAG_PREVIEW_FRONT_DOT_MIN + tangentY * tangentScale
  );
  return dir.normalize();
}

function isValidDragPreviewPos(pos, camera, dragRadius) {
  if (!pos || !camera) { return false; }
  var radial = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  if (radial < dragRadius - 0.0001) { return false; }
  dragPreviewPointDir.set(pos.x, pos.z);
  if (dragPreviewPointDir.lengthSq() < 0.0001) { return false; }
  dragPreviewPointDir.normalize();
  return dragPreviewPointDir.dot(getCameraFrontDir(camera)) >= DRAG_PREVIEW_FRONT_DOT_MIN;
}

function projectToVisibleDragSurface(sourcePos, camera, dragRadius, out) {
  var y = sourcePos ? sourcePos.y : 0;
  getCameraFrontDir(camera);
  if (sourcePos) {
    dragPreviewPointDir.set(sourcePos.x, sourcePos.z);
  } else {
    dragPreviewPointDir.set(dragPreviewCameraDir.x, dragPreviewCameraDir.y);
  }
  if (dragPreviewPointDir.lengthSq() < 0.0001) {
    dragPreviewPointDir.set(dragPreviewCameraDir.x, dragPreviewCameraDir.y);
  } else {
    dragPreviewPointDir.normalize();
  }
  clampPreviewDirToFrontFace(dragPreviewPointDir, camera);
  out.set(dragPreviewPointDir.x * dragRadius, y, dragPreviewPointDir.y * dragRadius);
  return out;
}

function constrainDragPreviewToFrontFace(pos, camera, dragRadius, out) {
  if (!pos || !camera || !out) { return false; }
  out.copy(pos);
  getCameraFrontDir(camera);
  var radial = Math.sqrt(out.x * out.x + out.z * out.z);
  if (radial < dragRadius - 0.0001) {
    if (radial < 0.0001) {
      out.x = dragPreviewCameraDir.x * dragRadius;
      out.z = dragPreviewCameraDir.y * dragRadius;
      radial = dragRadius;
    } else {
      var radialScale = dragRadius / radial;
      out.x *= radialScale;
      out.z *= radialScale;
      radial = dragRadius;
    }
  }
  dragPreviewPointDir.set(out.x, out.z);
  if (dragPreviewPointDir.lengthSq() < 0.0001) {
    dragPreviewPointDir.set(dragPreviewCameraDir.x, dragPreviewCameraDir.y);
  } else {
    dragPreviewPointDir.normalize();
  }
  clampPreviewDirToFrontFace(dragPreviewPointDir, camera);
  out.x = dragPreviewPointDir.x * radial;
  out.z = dragPreviewPointDir.y * radial;
  return true;
}

function projectRayToDragPlane(ray, camera, planeDepth, dragRadius, out) {
  if (!ray || !camera || !out || planeDepth <= 0.0001) { return false; }
  camera.getWorldDirection(dragPreviewPlaneNormal);
  if (dragPreviewPlaneNormal.lengthSq() < 0.0001) { return false; }
  dragPreviewFallback.copy(camera.position).addScaledVector(dragPreviewPlaneNormal.normalize(), planeDepth);
  dragPreviewPlane.setFromNormalAndCoplanarPoint(dragPreviewPlaneNormal, dragPreviewFallback);
  if (!ray.intersectPlane(dragPreviewPlane, out)) { return false; }
  return constrainDragPreviewToFrontFace(out, camera, dragRadius, out);
}

function intersectPreviewCylinder(ray, dragRadius, out) {
  var dx = ray.direction.x;
  var dz = ray.direction.z;
  var ox = ray.origin.x;
  var oz = ray.origin.z;
  var a = dx * dx + dz * dz;
  if (a < 0.000001) { return false; }
  var b = 2 * (ox * dx + oz * dz);
  var c = ox * ox + oz * oz - dragRadius * dragRadius;
  var disc = b * b - 4 * a * c;
  if (disc < 0) { return false; }

  var sqrtDisc = Math.sqrt(disc);
  var invDenom = 1 / (2 * a);
  var t0 = (-b - sqrtDisc) * invDenom;
  var t1 = (-b + sqrtDisc) * invDenom;
  var t = Infinity;

  if (t0 > 0.0001) { t = t0; }
  if (t1 > 0.0001 && t1 < t) { t = t1; }
  if (!isFinite(t)) { return false; }

  out.copy(ray.origin).addScaledVector(ray.direction, t);
  return true;
}

export function setInteractionsRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getCameraRef = runtime && runtime.getCamera ? runtime.getCamera : getCameraRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
  selectBeeRef = runtime && runtime.selectBee ? runtime.selectBee : selectBeeRef;
  rejectShakeRef = runtime && runtime.rejectShake ? runtime.rejectShake : rejectShakeRef;
  flashCellRef = runtime && runtime.flashCell ? runtime.flashCell : flashCellRef;
  markCameraInteractionRef = runtime && runtime.markCameraInteraction ? runtime.markCameraInteraction : markCameraInteractionRef;
  applyRoyalJellyToBeeRef = runtime && runtime.applyRoyalJellyToBee ? runtime.applyRoyalJellyToBee : applyRoyalJellyToBeeRef;
}

function applyResolvedDragHover(resolved) {
  pointer.resolvedDragTarget = resolved;
  pointer.dragHoverBeeId = resolved && resolved.mergeCandidate ? resolved.mergeCandidate.bee.id : null;
  if (resolved && resolved.cellCandidate) {
    pointer.dragHoverCellId = resolved.cellCandidate.cell.id;
  } else if (resolved && resolved.directFallback) {
    pointer.dragHoverCellId = resolved.directFallback.cell.id;
  } else {
    pointer.dragHoverCellId = null;
  }

  if (resolved && resolved.mergeCandidate) {
    pointer.dragHoverTargetKind = 'merge';
  } else if (resolved && resolved.cellCandidate) {
    pointer.dragHoverTargetKind = 'cell';
  } else if (resolved && resolved.directFallback) {
    pointer.dragHoverTargetKind = 'direct_cell';
  } else {
    pointer.dragHoverTargetKind = null;
  }
}

export function beginBoostDrag(boostType, x, y) {
  if (boostType === BOOST_TYPE.ROYAL_JELLY && (!stateRef.boosts || stateRef.boosts.royal_jelly <= 0)) { return; }
  if (longPressState.timer !== null) {
    clearTimeout(longPressState.timer);
    longPressState.timer = null;
  }
  pointer.active = true;
  pointer.moved = true;
  pointer.intentState = POINTER_INTENT_STATE.LOCKED_BOOST_DRAG;
  pointer.dragMode = 'boost_drag';
  pointer.dragBoostType = boostType;
  pointer.dragHoverBeeId = null;
  pointer.dragHoverCellId = null;
  pointer.dragHoverTargetKind = null;
  pointer.dragVisualPos = null;
  pointer.dragMinRadius = 0;
  pointer.dragPlaneDepth = 0;
  pointer.resolvedDragTarget = null;
  pointer.edgeRotateDir = 0;
  pointer.edgeRotateTimer = 0;
  pointer.startX = x;
  pointer.startY = y;
  pointer.lastX = x;
  pointer.lastY = y;
  pointer.deltaX = 0;
  pointer.deltaY = 0;
  updateBoostDragInteraction(x, y);
}

export function updateBeeDragPreviewPos(bee, screenX, screenY) {
  if (!bee) {
    pointer.dragVisualPos = null;
    return null;
  }

  var camera = getCameraRef();
  var dragRadius = getDragPreviewSurfaceRadius(bee);
  var screenRay = getScreenRay(screenX, screenY);
  var dragSourcePos = pointer.dragVisualPos || (bee.mesh ? bee.mesh.position : null) || bee.pos;
  if (!pointer.dragPlaneDepth) {
    camera.getWorldDirection(dragPreviewPlaneNormal);
    pointer.dragPlaneDepth = Math.max(0.0001, dragSourcePos.clone().sub(camera.position).dot(dragPreviewPlaneNormal.normalize()));
  }
  if (!pointer.dragVisualPos) { pointer.dragVisualPos = new THREE.Vector3(); }

  // Keep the selected bee on a single stable camera-depth plane for the
  // entire drag so it does not snap back toward the hive shell.
  if (projectRayToDragPlane(screenRay, camera, pointer.dragPlaneDepth, dragRadius, dragPreviewCandidate)) {
    pointer.dragVisualPos.copy(dragPreviewCandidate);
    return pointer.dragVisualPos;
  }

  if (intersectPreviewCylinder(screenRay, dragRadius, dragPreviewFallback) &&
      isValidDragPreviewPos(dragPreviewFallback, camera, dragRadius)) {
    pointer.dragVisualPos.copy(dragPreviewFallback);
    return pointer.dragVisualPos;
  }

  if (pointer.dragVisualPos) {
    return pointer.dragVisualPos;
  }

  projectToVisibleDragSurface(dragSourcePos, camera, dragRadius, dragPreviewFallback);
  pointer.dragVisualPos.copy(dragPreviewFallback);
  return pointer.dragVisualPos;
}

export function updateBeeDragInteraction(bee, screenX, screenY) {
  if (!bee) {
    pointer.dragHoverBeeId = null;
    pointer.dragHoverCellId = null;
    pointer.dragHoverTargetKind = null;
    pointer.resolvedDragTarget = null;
    pointer.edgeRotateDir = 0;
    pointer.edgeRotateTimer = 0;
    pointer.dragVisualPos = null;
    pointer.dragMinRadius = 0;
    pointer.dragPlaneDepth = 0;
    return;
  }

  applyResolvedDragHover(resolveActiveDragTargets(bee, screenX, screenY));
  updateBeeDragPreviewPos(bee, screenX, screenY);
}

export function updateBoostDragInteraction(screenX, screenY) {
  pointer.dragHoverCellId = null;
  pointer.dragHoverTargetKind = null;
  var hoverBee = getBeeNearScreen(screenX, screenY, null, BOOST_TARGET_TOLERANCE_PX);
  pointer.dragHoverBeeId = hoverBee ? hoverBee.id : null;
  pointer.dragGhostX = screenX;
  pointer.dragGhostY = screenY;
  updateBoostGhost(screenX, screenY);
}

export function applyBoostDragDrop(screenX, screenY) {
  if (pointer.dragBoostType === BOOST_TYPE.ROYAL_JELLY) {
    var hitBee = getBeeNearScreen(screenX, screenY, null, BOOST_TARGET_TOLERANCE_PX);
    if (hitBee) {
      applyRoyalJellyToBeeRef(hitBee);
      return;
    }
    setBuildingToastRef('Drop jelly on a bee', 1.5);
  }
}

export function applySelectedBeeDragDrop(screenX, screenY) {
  var selectedBee = getSelectedBee();
  if (!selectedBee) { return; }

  var resolvedTarget = resolveReleaseTarget(selectedBee, screenX, screenY);
  pointer.resolvedDragTarget = resolvedTarget;

  if (resolvedTarget && resolvedTarget.kind === 'merge') {
    if (resolvedTarget.bee.level === selectedBee.level) {
      mergeBees(selectedBee, resolvedTarget.bee);
      return;
    }
    rejectShakeRef(selectedBee);
    setBuildingToastRef('Merge requires matching levels', 1.6);
    return;
  }

  if (resolvedTarget && (resolvedTarget.kind === 'cell' || resolvedTarget.kind === 'direct_cell')) {
    assignBeeToCell(selectedBee, resolvedTarget.cell);
    return;
  }

  if (pointer.dragVisualPos) {
    var wasWorker = selectedBee.isWorker;
    dropBeeAtWorldPos(selectedBee, pointer.dragVisualPos);
    setBuildingToastRef(wasWorker ? 'Bee released off seat' : 'Bee repositioned', 1.4);
    selectBeeRef(null);
    return;
  }

  rejectShakeRef(selectedBee);
  setBuildingToastRef('Drop on a seat, obstacle, or matching bee', 1.6);
}

export function onTap(screenX, screenY) {
  var candidate = pickFreshBeeCandidate(screenX, screenY, null);
  var hitBee = candidate ? candidate.bee : null;
  if (hitBee) {
    var selBee = getSelectedBee();
    if (selBee && selBee.id !== hitBee.id) {
      if (selBee.level === hitBee.level) {
        mergeBees(selBee, hitBee);
        return;
      }
      rejectShakeRef(selBee);
      setBuildingToastRef('Merge requires matching levels', 1.6);
      return;
    }
    if (selBee && selBee.id === hitBee.id) { selectBeeRef(null); } else { selectBeeRef(hitBee); }
    return;
  }

  var hitCell = getCellAtScreen(screenX, screenY);
  if (hitCell) {
    var selectedBee = getSelectedBee();
    if (selectedBee) {
      var resolvedTapTarget = resolveReleaseTarget(selectedBee, screenX, screenY);
      if (resolvedTapTarget && (resolvedTapTarget.kind === 'cell' || resolvedTapTarget.kind === 'direct_cell')) {
        assignBeeToCell(selectedBee, resolvedTapTarget.cell);
      } else {
        rejectShakeRef(selectedBee);
      }
    } else if (hitCell.state === CELL_STATE.DORMANT) {
      setBuildingToastRef(
        isWorkerSeatCell(hitCell)
          ? 'Seat is live - gatherers feed nectar to start honey'
          : 'Gatherers activate dormant cells by depositing nectar',
        1.8
      );
    } else if (hitCell.cellType === CELL_TYPE.GATE) {
      var conds = evaluateGateConditions();
      if (stateRef.levelComplete) {
        setBuildingToastRef('Level already complete!', 1.5);
      } else if (hitCell.state === CELL_STATE.OBSTACLE) {
        setBuildingToastRef('Assign more bees to clear this gate', 1.8);
      } else if (hitCell.state === CELL_STATE.ACTIVE && !conds.allGatesCleared) {
        setBuildingToastRef('Other gate cells still need clearing', 1.8);
      } else {
        setBuildingToastRef(conds.detail, 2.4);
      }
    } else if (hitCell.cellType === CELL_TYPE.REWARD_BLOCKER && hitCell.state === CELL_STATE.ACTIVE && !hitCell.rewardCollected) {
      grantCellReward(hitCell);
    } else if (hitCell.state === CELL_STATE.ACTIVE && (hitCell.cellType === CELL_TYPE.HATCHERY || hitCell.cellType === CELL_TYPE.PROCESSOR || hitCell.cellType === CELL_TYPE.BUILDING_LOT)) {
      var result = tryBuildOrUpgrade(hitCell);
      if (result) { setBuildingToastRef(result, 2.5); }
    } else if (hitCell.state === CELL_STATE.ACTIVE && hitCell.cellType === CELL_TYPE.OPEN && hitCell.isReadyToCollect) {
      var collectedHoney = hitCell.honeyStored;
      stateRef.honey += hitCell.honeyStored;
      hitCell.honeyStored = 0;
      hitCell.isReadyToCollect = false;
      hitCell.conversionProgress = 0;
      refreshCellMaterial(hitCell);
      flashCellRef(hitCell.id, 0xffee44);
      markCameraInteractionRef(hitCell);
      registerRoyalRush();
      setBuildingToastRef('+' + Math.floor(collectedHoney) + ' honey  •  rush x' + getRoyalRushStacks(), 1.8);
    }
    return;
  }

  if (getSelectedBee()) {
    selectBeeRef(null);
  }
}
