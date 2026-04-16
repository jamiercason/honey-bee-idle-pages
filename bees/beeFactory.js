import { HIVE } from '../config/hiveConfig.js';
import { MERGE_FREEZE_S } from '../config/inputConfig.js';
import { BEE_ROLE, BEE_STATE, CELL_STATE } from '../data/enums.js';
import { buildCellIndex, getCellById } from '../board/boardQueries.js';
import { removeCellOccupant } from '../board/cellState.js';
import { getBeeGatherRestDuration, getBeeWorkRateForLevel } from './beeQueries.js';
import { bankPosition, randomOffset } from './beeMovement.js';

var stateRef = null;
var beeConfigRef = null;
var beeVisRef = null;
var sceneRef = null;
var buildBeeFxRef = function() {};
var addBeeLabelForRef = function() {};
var removeBeeFxRef = function() {};
var removeBeeLabelForRef = function() {};
var selectBeeRef = function() {};
var getSelectedBeeIdRef = function() { return null; };
var getMeshUuidToBeeIdRef = function() { return {}; };
var getCellMeshMapRef = function() { return {}; };
var registerCellMeshRef = function() {};

var beeIdCounter = 0;

export function setBeeFactoryRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : beeConfigRef;
  beeVisRef = runtime && runtime.beeVis ? runtime.beeVis : beeVisRef;
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  buildBeeFxRef = runtime && runtime.buildBeeFx ? runtime.buildBeeFx : buildBeeFxRef;
  addBeeLabelForRef = runtime && runtime.addBeeLabelFor ? runtime.addBeeLabelFor : addBeeLabelForRef;
  removeBeeFxRef = runtime && runtime.removeBeeFx ? runtime.removeBeeFx : removeBeeFxRef;
  removeBeeLabelForRef = runtime && runtime.removeBeeLabelFor ? runtime.removeBeeLabelFor : removeBeeLabelForRef;
  selectBeeRef = runtime && runtime.selectBee ? runtime.selectBee : selectBeeRef;
  getSelectedBeeIdRef = runtime && runtime.getSelectedBeeId ? runtime.getSelectedBeeId : getSelectedBeeIdRef;
  getMeshUuidToBeeIdRef = runtime && runtime.getMeshUuidToBeeId ? runtime.getMeshUuidToBeeId : getMeshUuidToBeeIdRef;
  getCellMeshMapRef = runtime && runtime.getCellMeshMap ? runtime.getCellMeshMap : getCellMeshMapRef;
  registerCellMeshRef = runtime && runtime.registerCellMesh ? runtime.registerCellMesh : registerCellMeshRef;
}

export function createBeeMesh(level) {
  var THREE = globalThis.THREE;
  var document = globalThis.document;
  var group = new THREE.Group();
  var R = beeConfigRef.BODY_R;
  var lvl = (level && level >= 1) ? level : 1;
  var levelColors = [0x0055ff, 0x00ccff, 0x00dd44, 0xffcc00, 0xff6600, 0xff0022];
  var levelColor = levelColors[Math.min(lvl - 1, 5)];
  var wingColors = [0x88bbff, 0x88eeff, 0x88ffbb, 0xffee88, 0xffbb66, 0xff8888];
  var wingColor = wingColors[Math.min(lvl - 1, 5)];
  var wingEmiColors = [0x002288, 0x007799, 0x006622, 0x886600, 0x883300, 0x880011];
  var wingEmi = wingEmiColors[Math.min(lvl - 1, 5)];

  var texSize = 256;
  var stripeCount = Math.min(lvl, 6);
  var bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = texSize;
  bodyCanvas.height = texSize;
  var bCtx = bodyCanvas.getContext('2d');
  var darkStripe = '#120a00';
  var amberBand = 'rgba(245,172,0,';

  if (stripeCount > 0) {
    bCtx.fillStyle = darkStripe;
    bCtx.fillRect(0, 0, texSize, texSize);
    var beltStart = 0.12;
    var beltEnd = 0.88;
    var beltSpan = (beltEnd - beltStart) * texSize;
    var totalSlots = stripeCount * 2 + 1;
    var slotH = beltSpan / totalSlots;
    for (var si = 0; si < stripeCount; si++) {
      var bandY = (beltStart * texSize) + (si * 2 + 1) * slotH;
      var grad = bCtx.createLinearGradient(0, bandY, 0, bandY + slotH);
      grad.addColorStop(0.0, amberBand + '0.0)');
      grad.addColorStop(0.12, amberBand + '1.0)');
      grad.addColorStop(0.88, amberBand + '1.0)');
      grad.addColorStop(1.0, amberBand + '0.0)');
      bCtx.fillStyle = grad;
      bCtx.fillRect(0, bandY, texSize, slotH);
    }
    var topFade = bCtx.createLinearGradient(0, 0, 0, beltStart * texSize);
    topFade.addColorStop(0.0, amberBand + '1.0)');
    topFade.addColorStop(1.0, amberBand + '0.0)');
    bCtx.fillStyle = topFade;
    bCtx.fillRect(0, 0, texSize, beltStart * texSize);
    var botFade = bCtx.createLinearGradient(0, beltEnd * texSize, 0, texSize);
    botFade.addColorStop(0.0, amberBand + '0.0)');
    botFade.addColorStop(1.0, amberBand + '1.0)');
    bCtx.fillStyle = botFade;
    bCtx.fillRect(0, beltEnd * texSize, texSize, texSize * (1 - beltEnd));
  } else {
    bCtx.fillStyle = '#f5ac00';
    bCtx.fillRect(0, 0, texSize, texSize);
  }
  var bodyTex = new THREE.CanvasTexture(bodyCanvas);

  var bodyMat = new THREE.MeshStandardMaterial({ map: bodyTex, emissive: 0x3a1400, emissiveIntensity: 0.34, roughness: 0.88, metalness: 0.0 });
  var headMat = new THREE.MeshStandardMaterial({ color: 0xf5ac00, emissive: 0x381600, emissiveIntensity: 0.30, roughness: 0.88, metalness: 0.0 });
  var accentMat = new THREE.MeshStandardMaterial({ color: levelColor, emissive: levelColor, emissiveIntensity: 1.2, roughness: 0.55, metalness: 0.0 });
  var accentMatSoft = new THREE.MeshStandardMaterial({ color: levelColor, emissive: levelColor, emissiveIntensity: 0.9, roughness: 0.82, metalness: 0.0 });
  var wingMat = new THREE.MeshStandardMaterial({ color: wingColor, emissive: wingEmi, emissiveIntensity: 0.95, roughness: 0.45, metalness: 0.0, transparent: true, opacity: 0.68, side: THREE.DoubleSide });
  var eyeMat = new THREE.MeshStandardMaterial({ color: 0x060402, roughness: 0.04, metalness: 0.15 });

  var abdGeo = new THREE.SphereGeometry(R, 32, 24);
  abdGeo.rotateX(Math.PI / 2);
  abdGeo.scale(1.0, 0.90, 1.20);
  var abdomen = new THREE.Mesh(abdGeo, bodyMat);
  abdomen.position.set(0, 0, -R * 0.08);
  group.add(abdomen);

  var bodyAnchor = new THREE.Object3D();
  bodyAnchor.name = 'bodyAnchor';
  bodyAnchor.position.copy(abdomen.position);
  group.add(bodyAnchor);

  var interactionAnchor = new THREE.Object3D();
  interactionAnchor.name = 'interactionAnchor';
  interactionAnchor.position.set(0, R * 0.08, -R * 0.02);
  group.add(interactionAnchor);

  var stingBase = new THREE.Mesh(new THREE.SphereGeometry(R * 0.15, 10, 8), accentMat.clone());
  stingBase.position.set(0, -R * 0.05, -R * 1.22);
  group.add(stingBase);
  var stingGeo = new THREE.ConeGeometry(R * 0.10, R * 0.40, 8);
  var sting = new THREE.Mesh(stingGeo, accentMat.clone());
  sting.rotation.x = -Math.PI / 2;
  sting.position.set(0, -R * 0.05, -R * 1.45);
  group.add(sting);
  var glowGeo = new THREE.SphereGeometry(R * 0.09, 8, 8);
  var glowMat = new THREE.MeshStandardMaterial({ color: levelColor, emissive: levelColor, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.9 });
  var glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, -R * 0.05, -R * 1.68);
  group.add(glow);

  var headGeo = new THREE.SphereGeometry(R * 0.64, 14, 12);
  var head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, R * 0.10, R * 1.10);
  group.add(head);

  var eyeOffsets = [{ x: -R * 0.30, z: R * 0.40 }, { x: R * 0.30, z: R * 0.40 }];
  for (var ei = 0; ei < eyeOffsets.length; ei++) {
    var eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 12, 12), eyeMat.clone());
    eye.position.set(eyeOffsets[ei].x, head.position.y + R * 0.05, head.position.z + eyeOffsets[ei].z);
    group.add(eye);
  }

  var antSides = [-1, 1];
  for (var ai = 0; ai < antSides.length; ai++) {
    var sd = antSides[ai];
    var rootX = sd * R * 0.30;
    var rootY = head.position.y + R * 0.50;
    var rootZ = head.position.z + R * 0.10;
    var stalkLen = R * 0.85;
    var tipX = sd * R * 0.62;
    var tipY = rootY + R * 0.70;
    var tipZ = head.position.z + R * 0.72;
    var dx = tipX - rootX;
    var dy = tipY - rootY;
    var dz = tipZ - rootZ;
    var antRoot = new THREE.Group();
    antRoot.position.set(rootX, rootY, rootZ);
    group.add(antRoot);
    antRoot.rotation.order = 'ZXY';
    antRoot.rotation.z = -Math.atan2(dx, Math.sqrt(dy * dy + dz * dz));
    antRoot.rotation.x = Math.atan2(dz, dy);
    var stalkGeo = new THREE.CylinderGeometry(R * 0.016, R * 0.026, stalkLen, 7);
    var stalk = new THREE.Mesh(stalkGeo, accentMatSoft.clone());
    stalk.position.set(0, stalkLen * 0.5, 0);
    antRoot.add(stalk);
    var ball = new THREE.Mesh(new THREE.SphereGeometry(R * 0.12, 9, 9), accentMat.clone());
    ball.position.set(0, stalkLen, 0);
    antRoot.add(ball);
  }

  function makeWingShape(scale) {
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(-scale * 0.25, scale * 0.65, -scale * 1.2, scale * 0.95, -scale * 1.45, scale * 0.15);
    s.bezierCurveTo(-scale * 1.2, -scale * 0.38, -scale * 0.25, -scale * 0.22, 0, 0);
    return s;
  }
  var wr = R * 0.48;
  var wL = new THREE.Mesh(new THREE.ShapeGeometry(makeWingShape(R * 1.05), 18), wingMat.clone());
  wL.name = 'wingL';
  wL.position.set(-R * 0.26, R * 0.50, wr);
  wL.rotation.set(-0.46, -0.08, 0.14);
  group.add(wL);
  var wRGeo = new THREE.ShapeGeometry(makeWingShape(R * 1.05), 18);
  wRGeo.scale(-1, 1, 1);
  var wR = new THREE.Mesh(wRGeo, wingMat.clone());
  wR.name = 'wingR';
  wR.position.set(R * 0.26, R * 0.50, wr);
  wR.rotation.set(-0.46, 0.08, -0.14);
  group.add(wR);
  var hLGeo = new THREE.ShapeGeometry(makeWingShape(R * 0.60), 12);
  var hL = new THREE.Mesh(hLGeo, wingMat.clone());
  hL.position.set(-R * 0.22, R * 0.32, wr - R * 0.18);
  hL.rotation.set(-0.36, -0.05, 0.09);
  group.add(hL);
  var hRGeo = new THREE.ShapeGeometry(makeWingShape(R * 0.60), 12);
  hRGeo.scale(-1, 1, 1);
  var hR = new THREE.Mesh(hRGeo, wingMat.clone());
  hR.position.set(R * 0.22, R * 0.32, wr - R * 0.18);
  hR.rotation.set(-0.36, 0.05, -0.09);
  group.add(hR);

  var contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.92, 22),
    new THREE.MeshBasicMaterial({ color: 0x140903, transparent: true, opacity: 0.26, depthWrite: false, depthTest: true })
  );
  contactShadow.name = 'contactShadow';
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, -R * 0.42, -R * 0.10);
  contactShadow.renderOrder = -2;
  group.add(contactShadow);

  var bodyHalo = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.10, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0c2, transparent: true, opacity: 0.0, depthWrite: false, depthTest: true })
  );
  bodyHalo.name = 'bodyHalo';
  bodyHalo.rotation.x = -Math.PI / 2;
  bodyHalo.position.set(0, -R * 0.38, 0);
  bodyHalo.renderOrder = -1;
  group.add(bodyHalo);

  var roleNode = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.16, 10, 10),
    new THREE.MeshStandardMaterial({ color: beeVisRef.ROLE_GATHERER_COLOR, emissive: beeVisRef.ROLE_GATHERER_EMI, emissiveIntensity: 1.2, roughness: 0.35, metalness: 0.0 })
  );
  roleNode.name = 'roleNode';
  roleNode.position.set(0, R * 0.92, -R * 0.08);
  group.add(roleNode);

  var cargoOrb = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.20, 10, 10),
    new THREE.MeshStandardMaterial({ color: beeVisRef.CARGO_COLOR, emissive: beeVisRef.CARGO_EMI, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.82 })
  );
  cargoOrb.name = 'cargoOrb';
  cargoOrb.position.set(0, -R * 0.12, -R * 0.88);
  cargoOrb.visible = false;
  group.add(cargoOrb);

  var boostHalo = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.02, R * 0.06, 8, 24),
    new THREE.MeshStandardMaterial({ color: beeVisRef.BOOST_COLOR, emissive: beeVisRef.BOOST_EMI, emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.0, depthWrite: false })
  );
  boostHalo.name = 'boostHalo';
  boostHalo.rotation.x = Math.PI / 2;
  boostHalo.position.set(0, R * 0.06, 0);
  boostHalo.visible = false;
  group.add(boostHalo);

  group.userData.roleNode = roleNode;
  group.userData.cargoOrb = cargoOrb;
  group.userData.boostHalo = boostHalo;
  group.userData.contactShadow = contactShadow;
  group.userData.bodyHalo = bodyHalo;
  group.userData.bodyAnchor = bodyAnchor;
  group.userData.interactionAnchor = interactionAnchor;

  return group;
}

export function spawnBee(level, atPos, options) {
  if (stateRef.bees.length >= beeConfigRef.MAX_COUNT) { return null; }
  var lvl = (level && level >= 1) ? level : 1;
  var spawnOptions = options || {};
  var id = beeIdCounter++;
  var shouldRandomize = spawnOptions.randomizeOffset !== false;
  var startPos = atPos ? atPos.clone() : bankPosition(id);
  if (shouldRandomize) { startPos.add(randomOffset()); }
  var bodyRadius = beeConfigRef.BODY_R || 0.34;

  var bee = {
    id: id,
    level: lvl,
    workRate: getBeeWorkRateForLevel(lvl),
    targetPreference: 'lowest_progress',
    role: BEE_ROLE.GATHERER,
    state: BEE_STATE.IDLE,
    pos: startPos.clone(),
    targetPos: startPos.clone(),
    origin: startPos.clone(),
    travelT: 1,
    travelDur: 1,
    idleTimer: getBeeGatherRestDuration(lvl) * (0.65 + Math.random() * 0.35),
    targetCellId: null,
    seatCellId: null,
    workTargetCellId: null,
    forcedWorkTarget: null,
    isWorker: false,
    gatherPhase: 'resting',
    workPhase: Math.random() * Math.PI * 2,
    carryNectar: 0,
    mergeSurgeTimer: 0,
    royalJellyTimer: 0,
    wingPhase: Math.random() * Math.PI * 2,
    selected: false,
    poseT: 0.0,
    exitReverse: 0.0,
    landedTheta: null,
    arcLane: 0.85 + Math.random() * 0.30,
    arcAlt: (Math.random() - 0.5) * 1.2,
    gatherRouteRadius: 0,
    gatherRouteHeight: 0,
    gatherRouteBump: 1.0,
    gatherRouteSide: 0,
    gatherRouteCurve: 0,
    poseAnchor: null,
    poseForward: null,
    poseRight: null,
    poseUp: null,
    poseDirIndex: -1,
    poseSeatCellId: null,
    poseTargetCellId: null,
    lastFlightPos: startPos.clone(),
    interactionRadius: bodyRadius * 1.22,
    interactionHeightBias: bodyRadius * 0.08,
    mergeFreezeTimer: 0,
    mergeAnchorPos: startPos.clone(),
    mergePendingAssignment: null,
    mesh: null
  };

  var mesh = createBeeMesh(lvl);
  var levelScale = 1.0 + (lvl - 1) * 0.06;
  bee.baseScale = levelScale;
  mesh.scale.setScalar(levelScale);
  mesh.position.copy(bee.pos);
  sceneRef.add(mesh);
  bee.mesh = mesh;
  stateRef.bees.push(bee);
  buildBeeFxRef(bee);
  setTimeout(function() { addBeeLabelForRef(bee); }, 0);
  return bee;
}

export function spawnMergedBee(level, anchorPos, mergeOptions) {
  var newBee = spawnBee(level, anchorPos, {
    randomizeOffset: false
  });
  if (!newBee) { return null; }
  newBee.mergeFreezeTimer = mergeOptions && mergeOptions.freezeTimer !== undefined ? mergeOptions.freezeTimer : MERGE_FREEZE_S;
  if (anchorPos) {
    newBee.mergeAnchorPos.copy(anchorPos);
    newBee.pos.copy(anchorPos);
    newBee.origin.copy(anchorPos);
    newBee.targetPos.copy(anchorPos);
  }
  if (mergeOptions && mergeOptions.pendingAssignment) {
    newBee.mergePendingAssignment = mergeOptions.pendingAssignment;
  }
  registerBeeMeshes(newBee);
  return newBee;
}

export function spawnAtHive(level) {
  if (stateRef.bees.length >= beeConfigRef.MAX_COUNT) { return null; }
  var topRowCells = [];
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    if (stateRef.cells[ci].row === 0 && stateRef.cells[ci].state === CELL_STATE.ACTIVE) { topRowCells.push(stateRef.cells[ci]); }
  }
  var spawnPos;
  if (topRowCells.length > 0) {
    var sc = topRowCells[Math.floor(Math.random() * topRowCells.length)];
    var outward = HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + beeConfigRef.FLY_HEIGHT_EXTRA + 0.5;
    spawnPos = new globalThis.THREE.Vector3(Math.cos(sc.theta) * outward, sc.worldPos.y, Math.sin(sc.theta) * outward).add(randomOffset());
  } else {
    spawnPos = bankPosition(beeIdCounter).add(randomOffset());
  }
  var newBee = spawnBee(level || 1, spawnPos);
  if (newBee) { registerBeeMeshes(newBee); }
  return newBee;
}

export function removeBee(bee) {
  if (!bee) { return; }
  if (getSelectedBeeIdRef() === bee.id) { selectBeeRef(null); }
  removeBeeFxRef(bee);
  removeBeeLabelForRef(bee);
  if (bee.targetCellId !== null) {
    var tc = getCellById(bee.targetCellId);
    if (tc) { removeCellOccupant(tc, bee.id); }
  }
  if (bee.seatCellId !== null) {
    var sc = getCellById(bee.seatCellId);
    if (sc) { removeCellOccupant(sc, bee.id); }
  }
  if (bee.workTargetCellId !== null) {
    var wc = getCellById(bee.workTargetCellId);
    if (wc) { removeCellOccupant(wc, bee.id); }
  }
  bee.mesh.traverse(function(obj) {
    if (obj.isMesh && !obj.userData.isLabel) { delete getMeshUuidToBeeIdRef()[obj.uuid]; }
  });
  bee.mesh.traverse(function(obj) {
    if (obj.isMesh) {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  });
  sceneRef.remove(bee.mesh);
  var idx = stateRef.bees.indexOf(bee);
  if (idx !== -1) { stateRef.bees.splice(idx, 1); }
}

export function initBees(count) {
  buildCellIndex();
  var cellMeshMap = getCellMeshMapRef();
  for (var cid in cellMeshMap) { registerCellMeshRef(cid, cellMeshMap[cid]); }
  for (var si = 0; si < count; si++) {
    var b = spawnBee();
    if (b) { registerBeeMeshes(b); }
  }
}

export function registerBeeMeshes(bee) {
  bee.mesh.traverse(function(obj) {
    if (obj.isMesh && !obj.userData.isLabel) { getMeshUuidToBeeIdRef()[obj.uuid] = bee.id; }
  });
}
