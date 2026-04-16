import { CONFIG } from '../config/config.js';
import { CAM, CAM_CONTEXT } from '../config/cameraConfig.js';
import { CAMERA_MODE, CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { cellThetaToCameraTheta, lerpAngle, shortestAngleDelta } from '../utils/angles.js';
import { clamp01, inverseLerp, lerp, smoothstep } from '../utils/math.js';
import { getBoardRows } from '../board/boardQueries.js';
import { cellHasAssignableSeat, hasCellOccupants, isWorkerSeatCell } from '../board/cellState.js';
import { isRequiredStructureCell } from '../economy/buildings.js';

var stateRef = null;
var getPointerRef = function() { return null; };
var getCameraRef = function() { return null; };
var getCamStateRef = function() { return null; };
var getCamTargetRef = function() { return null; };
var getSelectedBeeIdRef = function() { return null; };
var getSelectedBeeRef = function() { return null; };
var updateBeeDragInteractionRef = function() {};
var getLastInteractYRef = function() { return 0; };
var getLastInteractYTimerRef = function() { return 0; };
var beeDragEdgeRotateZoneFracRef = 0.14;
var beeDragEdgeRotateDwellRef = 0.14;
var beeDragEdgeRotateSpeedMaxRef = 1.45;

export function setCameraControllerRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getPointerRef = runtime && runtime.getPointer ? runtime.getPointer : getPointerRef;
  getCameraRef = runtime && runtime.getCamera ? runtime.getCamera : getCameraRef;
  getCamStateRef = runtime && runtime.getCamState ? runtime.getCamState : getCamStateRef;
  getCamTargetRef = runtime && runtime.getCamTarget ? runtime.getCamTarget : getCamTargetRef;
  getSelectedBeeIdRef = runtime && runtime.getSelectedBeeId ? runtime.getSelectedBeeId : getSelectedBeeIdRef;
  getSelectedBeeRef = runtime && runtime.getSelectedBee ? runtime.getSelectedBee : getSelectedBeeRef;
  updateBeeDragInteractionRef = runtime && runtime.updateBeeDragInteraction ? runtime.updateBeeDragInteraction : updateBeeDragInteractionRef;
  getLastInteractYRef = runtime && runtime.getLastInteractY ? runtime.getLastInteractY : getLastInteractYRef;
  getLastInteractYTimerRef = runtime && runtime.getLastInteractYTimer ? runtime.getLastInteractYTimer : getLastInteractYTimerRef;
  beeDragEdgeRotateZoneFracRef = runtime && runtime.beeDragEdgeRotateZoneFrac !== undefined ? runtime.beeDragEdgeRotateZoneFrac : beeDragEdgeRotateZoneFracRef;
  beeDragEdgeRotateDwellRef = runtime && runtime.beeDragEdgeRotateDwell !== undefined ? runtime.beeDragEdgeRotateDwell : beeDragEdgeRotateDwellRef;
  beeDragEdgeRotateSpeedMaxRef = runtime && runtime.beeDragEdgeRotateSpeedMax !== undefined ? runtime.beeDragEdgeRotateSpeedMax : beeDragEdgeRotateSpeedMaxRef;
}

export function applyOpeningCameraPose() {
  var camState = getCamStateRef();
  var camTarget = getCamTargetRef();
  camState.theta = getOpeningFocusTheta();
  camState.phi = CAM.POLAR_ANGLE;
  camState.radius = CAM.OPENING_RADIUS;
  camState.railY = CAM.OPENING_RAIL_Y;
  camState.momentumTheta = 0;
  camState.momentumPhi = 0;
  camState.momentumRailY = 0;
  camTarget.y = CAM.OPENING_TARGET_Y + CAM.OPENING_RAIL_Y * CAM.RAIL_TARGET_FOLLOW;
}

export function getOpeningFocusTheta() {
  var sumSin = 0;
  var sumCos = 0;
  var sampleCount = 0;

  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    var isOpeningSeat = (isWorkerSeatCell(cell) && cellHasAssignableSeat(cell));
    var isOpeningObstacle = (cell.state === CELL_STATE.OBSTACLE);
    if (!isOpeningSeat && !isOpeningObstacle) { continue; }
    sumSin += Math.sin(cell.theta);
    sumCos += Math.cos(cell.theta);
    sampleCount += 1;
  }

  if (sampleCount === 0) { return 0; }
  return cellThetaToCameraTheta(Math.atan2(sumSin, sumCos));
}

export function getCameraContextState() {
  var camState = getCamStateRef();
  var fallbackY = CAM.TARGET_Y;
  var openingTheta = getOpeningFocusTheta();
  var lastInteractY = getLastInteractYRef();
  var lastInteractYTimer = getLastInteractYTimerRef();
  if (!stateRef.cells || stateRef.cells.length === 0) {
    return {
      focusTheta: openingTheta,
      dwell: 0,
      rotateSpeedMult: 1,
      desiredTargetY: fallbackY
    };
  }

  var playableCount = 0;
  var openedCount = 0;
  var weightedSin = 0;
  var weightedCos = 0;
  var weightTotal = 0;
  var unlockedMaxY = -Infinity;
  var unlockedMaxRow = 0;
  var gateSumY = 0;
  var gateSumRow = 0;
  var gateCount = 0;
  var gateExposed = false;
  var gateUnlockedCount = 0;
  var gateObstacleCount = 0;

  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    if (cell.cellType !== CELL_TYPE.GATE) { playableCount += 1; }
    if (cell.state !== CELL_STATE.LOCKED && cell.cellType !== CELL_TYPE.GATE) {
      openedCount += 1;
      unlockedMaxY = Math.max(unlockedMaxY, cell.worldPos.y);
      unlockedMaxRow = Math.max(unlockedMaxRow, cell.row);
    }

    if (cell.cellType === CELL_TYPE.GATE && (cell.state === CELL_STATE.OBSTACLE || cell.state === CELL_STATE.ACTIVE || cell.gateUnlocked)) {
      gateExposed = true;
      gateSumY += cell.worldPos.y;
      gateSumRow += cell.row;
      gateCount += 1;
      gateUnlockedCount += 1;
      if (cell.state === CELL_STATE.OBSTACLE) { gateObstacleCount += 1; }
    }

    var weight = 0;
    if (cell.cellType === CELL_TYPE.GATE && cell.state === CELL_STATE.OBSTACLE) {
      weight = 8;
    } else if (cell.cellType === CELL_TYPE.GATE && cell.state === CELL_STATE.ACTIVE) {
      weight = 4;
    } else if (cell.state === CELL_STATE.OBSTACLE) {
      weight = 3.2;
    } else if (isWorkerSeatCell(cell) && hasCellOccupants(cell)) {
      weight = 4.0;
    } else if (isWorkerSeatCell(cell)) {
      weight = 2.6;
    } else if (cell.state === CELL_STATE.DORMANT) {
      weight = 2.0;
    } else if (cell.state === CELL_STATE.ACTIVE && cell.cellType === CELL_TYPE.OPEN && (cell.nectarStored > 0 || cell.honeyStored > 0)) {
      weight = 2.8;
    } else if (cell.state === CELL_STATE.ACTIVE && isRequiredStructureCell(cell)) {
      weight = 2.3;
    } else if (cell.state !== CELL_STATE.LOCKED) {
      weight = 1.0;
    }

    if (weight > 0) {
      weightedSin += Math.sin(cell.theta) * weight;
      weightedCos += Math.cos(cell.theta) * weight;
      weightTotal += weight;
    }
  }

  var openFrac = playableCount > 0 ? (openedCount / playableCount) : 1;
  var dwell = CAM_CONTEXT.ENABLED
    ? CAM_CONTEXT.DWELL_STRENGTH * (1.0 - smoothstep(CAM_CONTEXT.DWELL_FADE_START, CAM_CONTEXT.DWELL_FADE_END, openFrac))
    : 0;
  var dynamicFocusTheta = weightTotal > 0 ? cellThetaToCameraTheta(Math.atan2(weightedSin, weightedCos)) : openingTheta;
  var openingAnchor = CAM_CONTEXT.ENABLED
    ? CAM_CONTEXT.OPENING_ANCHOR * (1.0 - smoothstep(CAM_CONTEXT.DWELL_FADE_START, CAM_CONTEXT.DWELL_FADE_END, openFrac))
    : 0;
  var focusTheta = lerpAngle(dynamicFocusTheta, openingTheta, openingAnchor);
  var gateAvgY = gateCount > 0 ? (gateSumY / gateCount) : fallbackY;
  var gateAvgRow = gateCount > 0 ? (gateSumRow / gateCount) : Math.max(0, getBoardRows() - 1);
  var rowTrackProg = clamp01(inverseLerp(0, Math.max(1, gateAvgRow), unlockedMaxRow + 0.35));
  var gateRevealProg = gateCount > 0 ? (gateUnlockedCount / gateCount) : 0;
  var gateWorkProg = gateCount > 0 ? (gateObstacleCount / gateCount) : 0;
  var verticalProg = Math.max(
    smoothstep(0, 1, rowTrackProg),
    gateRevealProg * 0.48,
    gateWorkProg > 0 ? 1.0 : 0
  );
  var desiredTargetY = lerp(CAM.TARGET_Y, gateAvgY - CAM_CONTEXT.GATE_Y_OFFSET, verticalProg * CAM_CONTEXT.Y_TRACK_STRENGTH);
  if (lastInteractYTimer > 0) {
    var interactBlend = Math.min(1.0, lastInteractYTimer / Math.max(0.001, CAM_CONTEXT.INTERACT_Y_HOLD));
    var gateSuppression = 1.0 - gateWorkProg * 0.78;
    desiredTargetY = lerp(desiredTargetY, lastInteractY, CAM_CONTEXT.INTERACT_Y_BIAS * interactBlend * gateSuppression);
  }
  desiredTargetY = Math.max(-6, Math.min(6, desiredTargetY));

  var focusDeltaAbs = Math.abs(shortestAngleDelta(camState.theta, focusTheta));
  var slowBandArc = lerp(CAM_CONTEXT.OPENING_SLOW_ARC, 0.95, smoothstep(CAM_CONTEXT.DWELL_FADE_START, CAM_CONTEXT.DWELL_FADE_END, openFrac));
  var slowCenter = 1.0 - smoothstep(0, slowBandArc, focusDeltaAbs);
  var fastOuter = smoothstep(slowBandArc * 0.9, Math.PI * 0.72, focusDeltaAbs);
  var rotateSlow = 1.0 - dwell * slowCenter;
  var rotateFast = 1.0 + CAM_CONTEXT.DWELL_BACKSIDE_BOOST * dwell * fastOuter;

  return {
    focusTheta: focusTheta,
    dwell: dwell,
    rotateSpeedMult: Math.max(0.12, rotateSlow * rotateFast),
    desiredFocusY: desiredTargetY,
    verticalProg: verticalProg
  };
}

export function enterDragging() {
  var camState = getCamStateRef();
  stateRef.cameraMode = CAMERA_MODE.DRAGGING;
  stateRef.gameTimeScale = CONFIG.BASE_GAME_TIME_SCALE;
  stateRef.slowmoTimer = 0;
  camState.momentumTheta = 0;
  camState.momentumPhi = 0;
  camState.momentumRailY = 0;
}

export function enterPostDragSlowmo() {
  var pointer = getPointerRef();
  var camState = getCamStateRef();
  stateRef.cameraMode = CAMERA_MODE.POST_DRAG_SLOWMO;
  stateRef.gameTimeScale = CONFIG.SLOWMO_SCALE;
  stateRef.slowmoTimer = CONFIG.SLOWMO_DURATION_MIN + Math.random() * (CONFIG.SLOWMO_DURATION_MAX - CONFIG.SLOWMO_DURATION_MIN);
  camState.momentumTheta = pointer.deltaX * CAM.DRAG_SENSITIVITY_X * 5;
  camState.momentumPhi = 0;
  camState.momentumRailY = -pointer.deltaY * CAM.RAIL_DRAG_SENSITIVITY_Y * 2.5;
}

export function enterRecover() {
  stateRef.cameraMode = CAMERA_MODE.RECOVER;
  stateRef.slowmoTimer = 0;
}

export function enterAutorotate() {
  var camState = getCamStateRef();
  stateRef.cameraMode = CAMERA_MODE.AUTOROTATE;
  stateRef.gameTimeScale = CONFIG.BASE_GAME_TIME_SCALE;
  stateRef.slowmoTimer = 0;
  camState.momentumTheta = 0;
  camState.momentumPhi = 0;
  camState.momentumRailY = 0;
}

export function updateTimeScale(rawDt) {
  if (getSelectedBeeIdRef() !== null) {
    stateRef.gameTimeScale = CONFIG.BEE_SELECTION_SCALE;
    return;
  }
  if (stateRef.cameraMode === CAMERA_MODE.POST_DRAG_SLOWMO) {
    stateRef.slowmoTimer -= rawDt;
    if (stateRef.slowmoTimer <= 0) { enterRecover(); }
  } else if (stateRef.cameraMode === CAMERA_MODE.RECOVER) {
    stateRef.gameTimeScale += (CONFIG.BASE_GAME_TIME_SCALE - stateRef.gameTimeScale) * 0.04;
    if (Math.abs(stateRef.gameTimeScale - CONFIG.BASE_GAME_TIME_SCALE) < 0.005) {
      stateRef.gameTimeScale = CONFIG.BASE_GAME_TIME_SCALE;
      enterAutorotate();
    }
  }
}

export function updateCamera(rawDt, dt) {
  var pointer = getPointerRef();
  var camera = getCameraRef();
  var camState = getCamStateRef();
  var camTarget = getCamTargetRef();
  var mode = stateRef.cameraMode;
  var decay = Math.pow(CAM.MOMENTUM_DECAY, rawDt * 60);
  var camContext = getCameraContextState();
  var baseRotateSpeed = camState.autoRotateSpeed * camContext.rotateSpeedMult;

  if (mode === CAMERA_MODE.DRAGGING) {
    camState.theta -= pointer.deltaX * CAM.DRAG_SENSITIVITY_X;
    camState.railY -= pointer.deltaY * CAM.RAIL_DRAG_SENSITIVITY_Y;
    camState.momentumTheta = pointer.deltaX * CAM.DRAG_SENSITIVITY_X * 5;
    camState.momentumPhi = 0;
    camState.momentumRailY = -pointer.deltaY * CAM.RAIL_DRAG_SENSITIVITY_Y * 2.5;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
  }

  if (mode === CAMERA_MODE.POST_DRAG_SLOWMO) {
    camState.momentumTheta *= decay;
    camState.momentumRailY *= decay;
    if (Math.abs(camState.momentumTheta) < CAM.MOMENTUM_MIN) { camState.momentumTheta = 0; }
    if (Math.abs(camState.momentumRailY) < CAM.MOMENTUM_MIN) { camState.momentumRailY = 0; }
    camState.theta -= camState.momentumTheta;
    camState.railY += camState.momentumRailY;
  }

  if (mode === CAMERA_MODE.RECOVER) {
    camState.momentumTheta *= decay;
    camState.theta -= camState.momentumTheta;
    if (Math.abs(camState.momentumTheta) < CAM.MOMENTUM_MIN) { camState.momentumTheta = 0; }
    camState.theta += baseRotateSpeed * dt * 0.5;
  }

  if (mode === CAMERA_MODE.AUTOROTATE) { camState.theta += baseRotateSpeed * dt; }

  if (CAM_CONTEXT.ENABLED && (mode === CAMERA_MODE.AUTOROTATE || mode === CAMERA_MODE.RECOVER)) {
    camState.theta += shortestAngleDelta(camState.theta, camContext.focusTheta) * camContext.dwell * CAM_CONTEXT.THETA_PULL * dt;
  }

  if (pointer.dragMode === 'bee_assign' && pointer.active && pointer.moved) {
    var selectedBee = getSelectedBeeRef();
    if (selectedBee) {
      var leftZone = window.innerWidth * beeDragEdgeRotateZoneFracRef;
      var rightZoneStart = window.innerWidth * (1.0 - beeDragEdgeRotateZoneFracRef);
      var edgeDir = 0;
      var edgeStrength = 0;

      if (pointer.lastX <= leftZone) {
        edgeDir = -1;
        edgeStrength = 1.0 - (pointer.lastX / Math.max(1, leftZone));
      } else if (pointer.lastX >= rightZoneStart) {
        edgeDir = 1;
        edgeStrength = (pointer.lastX - rightZoneStart) / Math.max(1, window.innerWidth - rightZoneStart);
      }

      if (edgeDir === 0) {
        pointer.edgeRotateDir = 0;
        pointer.edgeRotateTimer = 0;
      } else if (pointer.edgeRotateDir !== edgeDir) {
        pointer.edgeRotateDir = edgeDir;
        pointer.edgeRotateTimer = 0;
      } else {
        pointer.edgeRotateTimer += rawDt;
        if (pointer.edgeRotateTimer >= beeDragEdgeRotateDwellRef) {
          camState.theta += edgeDir * edgeStrength * beeDragEdgeRotateSpeedMaxRef * rawDt;
          updateBeeDragInteractionRef(selectedBee, pointer.lastX, pointer.lastY);
        }
      }
    }
  }

  if (camState.phi < CAM.POLAR_MIN) { camState.phi = CAM.POLAR_MIN; }
  if (camState.phi > CAM.POLAR_MAX) { camState.phi = CAM.POLAR_MAX; }
  if (camState.railY < CAM.RAIL_Y_MIN) { camState.railY = CAM.RAIL_Y_MIN; }
  if (camState.railY > CAM.RAIL_Y_MAX) { camState.railY = CAM.RAIL_Y_MAX; }

  var sp = Math.sin(camState.phi);
  var cp = Math.cos(camState.phi);
  var baseCamY = camState.radius * cp;
  var flatTrackBlend = clamp01(camContext.verticalProg || 0);
  var trackDeltaY = (camContext.desiredFocusY - CAM.TARGET_Y) * CAM_CONTEXT.CAMERA_TRACK_Y * flatTrackBlend;
  var trackedCamY = baseCamY + camState.railY + trackDeltaY + CAM_CONTEXT.CAMERA_TRACK_OFFSET * flatTrackBlend;
  var desiredAimY = CAM.TARGET_Y + camState.railY * CAM.RAIL_TARGET_FOLLOW;
  if (CAM_CONTEXT.ENABLED && (mode === CAMERA_MODE.AUTOROTATE || mode === CAMERA_MODE.RECOVER)) {
    desiredAimY = lerp(CAM.TARGET_Y, camContext.desiredFocusY, CAM_CONTEXT.AIM_TRACK_Y) + camState.railY * CAM.RAIL_TARGET_FOLLOW;
  }
  var aimBlend = 1.0 - Math.exp(-rawDt * CAM_CONTEXT.Y_BLEND_SPEED);
  camTarget.y = lerp(camTarget.y, desiredAimY, aimBlend);
  camera.position.set(
    camState.radius * sp * Math.sin(camState.theta),
    trackedCamY,
    camState.radius * sp * Math.cos(camState.theta)
  );
  camera.lookAt(camTarget);
}
