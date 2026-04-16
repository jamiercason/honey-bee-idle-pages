import { HIVE } from '../config/hiveConfig.js';
import { BEE_STATE } from '../data/enums.js';
import { getCellById } from '../board/boardQueries.js';

var THREE = globalThis.THREE;
var stateRef = null;
var sceneRef = null;
var queueBurstCallbackRef = function() {};
var getSimTimeRef = function() { return 0; };
var getWorkerDebugDrawRef = function() { return false; };
var getUseBeePoseSystemRef = function() { return false; };
var getCellWorldPosRef = function() { return null; };
var computeWorkerBeeFrameRef = function() { return null; };
var getCellSurfaceNormalRef = function() { return new THREE.Vector3(0, 1, 0); };
var beeBodyRef = null;

var workEdgeMap = {};
var workerDebugMap = {};
var _dbgNormalMat = null;
var _dbgForwardMat = null;
var _dbgTargetMat = null;
var _dbgAnchorMat = null;
var _drawLineMats = {};

var WORK_EDGE_HALF = 0.52;
var LINE_LEN = 0.55;

export function setDebugDrawRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  queueBurstCallbackRef = runtime && runtime.queueBurstCallback ? runtime.queueBurstCallback : queueBurstCallbackRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
  getWorkerDebugDrawRef = runtime && runtime.getWorkerDebugDraw ? runtime.getWorkerDebugDraw : getWorkerDebugDrawRef;
  getUseBeePoseSystemRef = runtime && runtime.getUseBeePoseSystem ? runtime.getUseBeePoseSystem : getUseBeePoseSystemRef;
  getCellWorldPosRef = runtime && runtime.getCellWorldPos ? runtime.getCellWorldPos : getCellWorldPosRef;
  computeWorkerBeeFrameRef = runtime && runtime.computeWorkerBeeFrame ? runtime.computeWorkerBeeFrame : computeWorkerBeeFrameRef;
  getCellSurfaceNormalRef = runtime && runtime.getCellSurfaceNormal ? runtime.getCellSurfaceNormal : getCellSurfaceNormalRef;
  beeBodyRef = runtime && runtime.beeBody ? runtime.beeBody : beeBodyRef;
}

function _getOrCreateEdge(bee) {
  if (workEdgeMap[bee.id]) { return workEdgeMap[bee.id]; }
  var mat = new THREE.LineBasicMaterial({ color: 0xf5c842, depthTest: false, depthWrite: false, transparent: true, opacity: 1.0 });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  var line = new THREE.Line(geo, mat);
  line.renderOrder = 998;
  sceneRef.add(line);
  workEdgeMap[bee.id] = { line: line, mat: mat, lastTargetId: null };
  return workEdgeMap[bee.id];
}

function _removeEdge(beeId) {
  var e = workEdgeMap[beeId];
  if (!e) { return; }
  sceneRef.remove(e.line);
  e.line.geometry.dispose();
  e.mat.dispose();
  delete workEdgeMap[beeId];
}

export function updateWorkEdges() {
  var bi;
  var bee;
  var seatCell;
  var targetCell;
  var entry;
  var aliveIds = {};
  for (bi = 0; bi < stateRef.bees.length; bi++) {
    bee = stateRef.bees[bi];
    aliveIds[bee.id] = true;
    if (bee.state !== BEE_STATE.WORKING || !bee.seatCellId || !bee.workTargetCellId) {
      if (workEdgeMap[bee.id]) { workEdgeMap[bee.id].line.visible = false; }
      continue;
    }
    seatCell = getCellById(bee.seatCellId);
    targetCell = getCellById(bee.workTargetCellId);
    if (!seatCell || !targetCell) {
      if (workEdgeMap[bee.id]) { workEdgeMap[bee.id].line.visible = false; }
      continue;
    }

    entry = _getOrCreateEdge(bee);
    entry.line.visible = true;
    var seatPos = getCellWorldPosRef(seatCell);
    var targetPos = getCellWorldPosRef(targetCell);
    var midX = (seatPos.x + targetPos.x) * 0.5;
    var midY = (seatPos.y + targetPos.y) * 0.5;
    var midZ = (seatPos.z + targetPos.z) * 0.5;
    var midR = Math.sqrt(midX * midX + midZ * midZ);
    if (midR > 0.001) {
      var liftR = HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + 0.04;
      midX = midX / midR * liftR;
      midZ = midZ / midR * liftR;
    }
    var frame = computeWorkerBeeFrameRef(seatCell, targetCell);
    var rx = frame.right.x * WORK_EDGE_HALF;
    var ry = frame.right.y * WORK_EDGE_HALF;
    var rz = frame.right.z * WORK_EDGE_HALF;
    var arr = entry.line.geometry.attributes.position.array;
    arr[0] = midX - rx;
    arr[1] = midY - ry;
    arr[2] = midZ - rz;
    arr[3] = midX + rx;
    arr[4] = midY + ry;
    arr[5] = midZ + rz;
    entry.line.geometry.attributes.position.needsUpdate = true;
    entry.mat.opacity = 0.55 + 0.45 * Math.abs(Math.sin(getSimTimeRef() * 3.5 + bee.id * 1.3));
  }
  for (var id in workEdgeMap) {
    if (!aliveIds[id]) { _removeEdge(id); }
  }
}

function _ensureDebugMaterials() {
  if (_dbgNormalMat) { return; }
  _dbgNormalMat  = new THREE.LineBasicMaterial({ color: 0x00ff44, depthTest: false, depthWrite: false });
  _dbgForwardMat = new THREE.LineBasicMaterial({ color: 0x4488ff, depthTest: false, depthWrite: false });
  _dbgTargetMat  = new THREE.LineBasicMaterial({ color: 0xff2222, depthTest: false, depthWrite: false });
  _dbgAnchorMat  = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });
}

function _makeLine(mat) {
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  var line = new THREE.Line(geo, mat);
  line.renderOrder = 999;
  sceneRef.add(line);
  return line;
}

function _setLine(line, ax, ay, az, bx, by, bz) {
  var arr = line.geometry.attributes.position.array;
  arr[0] = ax;
  arr[1] = ay;
  arr[2] = az;
  arr[3] = bx;
  arr[4] = by;
  arr[5] = bz;
  line.geometry.attributes.position.needsUpdate = true;
}

export function drawLine(a, b, color) {
  if (!_drawLineMats[color]) {
    _drawLineMats[color] = new THREE.LineBasicMaterial({ color: color, depthTest: false, depthWrite: false });
  }
  var line = _makeLine(_drawLineMats[color]);
  _setLine(line, a.x, a.y, a.z, b.x, b.y, b.z);
  queueBurstCallbackRef(function() {
    sceneRef.remove(line);
    line.geometry.dispose();
  });
}

function _ensureDebugEntry(bee) {
  if (workerDebugMap[bee.id]) { return workerDebugMap[bee.id]; }
  _ensureDebugMaterials();
  var entry = {
    normalLine: _makeLine(_dbgNormalMat),
    forwardLine: _makeLine(_dbgForwardMat),
    targetLine: _makeLine(_dbgTargetMat),
    anchor: (function() {
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), _dbgAnchorMat);
      m.renderOrder = 999;
      sceneRef.add(m);
      return m;
    })()
  };
  workerDebugMap[bee.id] = entry;
  return entry;
}

function _removeDebugEntry(beeId) {
  var entry = workerDebugMap[beeId];
  if (!entry) { return; }
  sceneRef.remove(entry.normalLine);
  sceneRef.remove(entry.forwardLine);
  sceneRef.remove(entry.targetLine);
  sceneRef.remove(entry.anchor);
  entry.normalLine.geometry.dispose();
  entry.forwardLine.geometry.dispose();
  entry.targetLine.geometry.dispose();
  entry.anchor.geometry.dispose();
  delete workerDebugMap[beeId];
}

function _hideDebugEntry(entry) {
  entry.normalLine.visible = false;
  entry.forwardLine.visible = false;
  entry.targetLine.visible = false;
  entry.anchor.visible = false;
}

export function updateWorkerDebug() {
  if (!getWorkerDebugDrawRef()) {
    for (var k in workerDebugMap) { _hideDebugEntry(workerDebugMap[k]); }
    return;
  }
  var aliveIds = {};
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var bee = stateRef.bees[bi];
    aliveIds[bee.id] = true;
    if (bee.state !== BEE_STATE.IDLE_ON_SEAT && bee.state !== BEE_STATE.WORKING) {
      if (workerDebugMap[bee.id]) { _hideDebugEntry(workerDebugMap[bee.id]); }
      continue;
    }
    var seatCell = bee.seatCellId ? getCellById(bee.seatCellId) : null;
    if (!seatCell) {
      if (workerDebugMap[bee.id]) { _hideDebugEntry(workerDebugMap[bee.id]); }
      continue;
    }

    var targetCell = (bee.state === BEE_STATE.WORKING && bee.workTargetCellId) ? getCellById(bee.workTargetCellId) : null;
    var frame;
    if (targetCell) {
      frame = computeWorkerBeeFrameRef(seatCell, targetCell);
    } else {
      var dbgN = getCellSurfaceNormalRef(seatCell);
      var dbgF = new THREE.Vector3(-Math.sin(seatCell.theta), 0, Math.cos(seatCell.theta));
      var dbgR = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dbgF).normalize();
      var dbgO = getCellWorldPosRef(seatCell).clone().addScaledVector(dbgN, beeBodyRef.SEAT_SURFACE_LIFT).addScaledVector(dbgF, -beeBodyRef.BODY_CENTER_BACKSET);
      frame = { origin: dbgO, normal: dbgN, forward: dbgF, right: dbgR };
    }

    var entry = _ensureDebugEntry(bee);
    entry.normalLine.visible = true;
    entry.forwardLine.visible = true;
    entry.targetLine.visible = true;
    entry.anchor.visible = true;
    var ox = frame.origin.x;
    var oy = frame.origin.y;
    var oz = frame.origin.z;

    _setLine(entry.normalLine, ox, oy, oz, ox + frame.normal.x * LINE_LEN, oy + frame.normal.y * LINE_LEN, oz + frame.normal.z * LINE_LEN);
    _setLine(entry.forwardLine, ox, oy, oz, ox + frame.forward.x * LINE_LEN, oy + frame.forward.y * LINE_LEN, oz + frame.forward.z * LINE_LEN);
    if (targetCell) {
      var tpos = getCellWorldPosRef(targetCell);
      _setLine(entry.targetLine, ox, oy, oz, tpos.x, tpos.y, tpos.z);
    } else {
      _setLine(entry.targetLine, ox, oy, oz, ox, oy, oz);
    }
    entry.anchor.position.set(ox, oy, oz);
  }
  for (var id in workerDebugMap) {
    if (!aliveIds[id]) { _removeDebugEntry(id); }
  }
}

export function updateBeePoseDebug() {
  if (!getWorkerDebugDrawRef() || !getUseBeePoseSystemRef()) {
    for (var k in workerDebugMap) { _hideDebugEntry(workerDebugMap[k]); }
    return;
  }
  var aliveIds = {};
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var bee = stateRef.bees[bi];
    aliveIds[bee.id] = true;
    if ((bee.state !== BEE_STATE.IDLE_ON_SEAT && bee.state !== BEE_STATE.WORKING) || !bee.poseAnchor || !bee.poseForward) {
      if (workerDebugMap[bee.id]) { _hideDebugEntry(workerDebugMap[bee.id]); }
      continue;
    }
    var entry = _ensureDebugEntry(bee);
    entry.normalLine.visible = true;
    entry.forwardLine.visible = true;
    entry.targetLine.visible = true;
    entry.anchor.visible = true;
    var anchor = bee.poseAnchor;
    var forward = bee.poseForward;
    var up = bee.poseUp || new THREE.Vector3(0, 1, 0);
    _setLine(entry.forwardLine, anchor.x, anchor.y, anchor.z, anchor.x + forward.x * LINE_LEN, anchor.y + forward.y * LINE_LEN, anchor.z + forward.z * LINE_LEN);
    _setLine(entry.normalLine, anchor.x, anchor.y, anchor.z, anchor.x + up.x * LINE_LEN, anchor.y + up.y * LINE_LEN, anchor.z + up.z * LINE_LEN);
    if (bee.poseTargetCellId) {
      var targetCell = getCellById(bee.poseTargetCellId);
      var targetPos = targetCell ? getCellWorldPosRef(targetCell) : anchor;
      _setLine(entry.targetLine, anchor.x, anchor.y, anchor.z, targetPos.x, targetPos.y, targetPos.z);
    } else {
      _setLine(entry.targetLine, anchor.x, anchor.y, anchor.z, anchor.x, anchor.y, anchor.z);
    }
    entry.anchor.position.copy(anchor);
  }
  for (var id in workerDebugMap) {
    if (!aliveIds[id]) { _removeDebugEntry(id); }
  }
}
