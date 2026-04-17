import { getSelectedBee } from '../bees/beeQueries.js';
import { setBeeGathererRole } from '../bees/beeAssignments.js';
import { enterDragging, enterPostDragSlowmo, enterRecover } from '../scene/cameraController.js';
import { clearBoostGhost } from '../ui/summonBar.js';
import {
  BEE_LOCK_MOVE_PX,
  BEE_LOCK_TIME_MS,
  CAMERA_LOCK_MOVE_PX,
  CAMERA_TREND_MOVE_PX,
  DRAG_THRESHOLD_PX,
  HIGH_CONFIDENCE_PICKUP_SCORE,
  IMMEDIATE_BEE_LOCK_MAX_MOVE_PX,
  LONG_PRESS_MAX_MOVE_PX,
  LONG_PRESS_MS,
  MIN_BEE_PICKUP_SCORE,
  PENDING_INTENT_TIMEOUT_MS,
  POINTER_INTENT_STATE,
  TAP_MAX_MOVE_PX
} from '../config/inputConfig.js';
import { longPressState, pointer } from './inputState.js';
import { pickFreshBeeCandidate } from './targeting.js';
import { applyBoostDragDrop, applySelectedBeeDragDrop, onTap, updateBeeDragInteraction, updateBoostDragInteraction } from './interactions.js';

var stateRef = null;
var selectBeeRef = function() {};
var setBuildingToastRef = function() {};
var pointerControllerInstalled = false;
var pendingIntentTimer = null;

export function setPointerControllerRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  selectBeeRef = runtime && runtime.selectBee ? runtime.selectBee : selectBeeRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
}

function getNowMs() {
  return globalThis.performance && globalThis.performance.now ? globalThis.performance.now() : Date.now();
}

function getPointerDriftPx(x, y) {
  var dx = x - pointer.startX;
  var dy = y - pointer.startY;
  return Math.sqrt(dx * dx + dy * dy);
}

function cancelLongPress() {
  if (longPressState.timer !== null) {
    clearTimeout(longPressState.timer);
    longPressState.timer = null;
  }
}

function cancelPendingIntentTimer() {
  if (pendingIntentTimer !== null) {
    clearTimeout(pendingIntentTimer);
    pendingIntentTimer = null;
  }
}

function resetPointerState() {
  pointer.active = false;
  pointer.moved = false;
  pointer.intentState = POINTER_INTENT_STATE.IDLE;
  pointer.dragMode = null;
  pointer.dragHoverBeeId = null;
  pointer.dragHoverCellId = null;
  pointer.dragHoverTargetKind = null;
  pointer.dragVisualPos = null;
  pointer.dragMinRadius = 0;
  pointer.dragPlaneDepth = 0;
  pointer.dragBoostType = null;
  pointer.resolvedDragTarget = null;
  pointer.downBeeId = null;
  pointer.downBeeWasSelected = false;
  pointer.downTimeMs = 0;
  pointer.tapEligible = false;
  pointer.pendingBeeCandidateId = null;
  pointer.pendingBeeCandidateScore = 0;
  pointer.pendingBeeCandidateVersion = 0;
  pointer.pendingIntentDriftPx = 0;
  pointer.edgeRotateDir = 0;
  pointer.edgeRotateTimer = 0;
  pointer.deltaX = 0;
  pointer.deltaY = 0;
}

function refreshPendingBeeCandidate(screenX, screenY) {
  var candidate = pickFreshBeeCandidate(screenX, screenY, null);
  pointer.pendingBeeCandidateVersion += 1;
  pointer.pendingBeeCandidateId = candidate ? candidate.bee.id : null;
  pointer.pendingBeeCandidateScore = candidate ? candidate.score : 0;
  return candidate;
}

function onLongPress(x, y) {
  var candidate = pickFreshBeeCandidate(x, y, null);
  var hitBee = candidate ? candidate.bee : null;
  if (!hitBee) { return; }

  if (hitBee.isWorker) {
    setBeeGathererRole(hitBee, true);
    setBuildingToastRef('Bee switched to gatherer', 1.8);
  } else {
    setBuildingToastRef('Tap an active hex to assign this bee', 1.8);
  }
  selectBeeRef(null);
}

function scheduleLongPress() {
  cancelLongPress();
  longPressState.timer = setTimeout(function() {
    longPressState.timer = null;
    if (!pointer.active || pointer.intentState !== POINTER_INTENT_STATE.PENDING_INTENT) { return; }
    if (pointer.pendingIntentDriftPx > LONG_PRESS_MAX_MOVE_PX || pointer.pendingIntentDriftPx > CAMERA_TREND_MOVE_PX) { return; }
    onLongPress(longPressState.x, longPressState.y);
    cancelPointerGesture();
  }, LONG_PRESS_MS);
}

function lockBeeDrag(bee, x, y) {
  if (!bee) { return false; }
  cancelLongPress();
  cancelPendingIntentTimer();
  var selectedBee = getSelectedBee();
  pointer.intentState = POINTER_INTENT_STATE.LOCKED_BEE_DRAG;
  pointer.dragMode = 'bee_assign';
  pointer.downBeeId = bee.id;
  pointer.downBeeWasSelected = !!(selectedBee && selectedBee.id === bee.id);
  selectBeeRef(bee);
  updateBeeDragInteraction(bee, x, y);
  return true;
}

function lockCameraDrag() {
  cancelLongPress();
  cancelPendingIntentTimer();
  pointer.intentState = POINTER_INTENT_STATE.LOCKED_CAMERA;
  pointer.dragMode = 'camera';
  enterDragging();
}

function resolvePendingIntent(screenX, screenY, forceTimeout) {
  if (!pointer.active || pointer.intentState !== POINTER_INTENT_STATE.PENDING_INTENT) { return; }
  var driftPx = getPointerDriftPx(screenX, screenY);
  pointer.pendingIntentDriftPx = driftPx;
  pointer.tapEligible = driftPx <= TAP_MAX_MOVE_PX;
  if (driftPx > CAMERA_TREND_MOVE_PX) { cancelLongPress(); }
  if (driftPx > LONG_PRESS_MAX_MOVE_PX) { cancelLongPress(); }

  var candidate = refreshPendingBeeCandidate(screenX, screenY);
  var elapsedMs = getNowMs() - pointer.downTimeMs;

  if (!forceTimeout &&
      driftPx > 0 &&
      driftPx <= IMMEDIATE_BEE_LOCK_MAX_MOVE_PX &&
      candidate &&
      candidate.score >= HIGH_CONFIDENCE_PICKUP_SCORE) {
    lockBeeDrag(candidate.bee, screenX, screenY);
    return;
  }

  if (!forceTimeout && driftPx >= CAMERA_LOCK_MOVE_PX) {
    pointer.moved = true;
    lockCameraDrag();
    return;
  }

  if (!forceTimeout &&
      candidate &&
      candidate.score >= MIN_BEE_PICKUP_SCORE &&
      driftPx <= BEE_LOCK_MOVE_PX &&
      elapsedMs >= BEE_LOCK_TIME_MS) {
    lockBeeDrag(candidate.bee, screenX, screenY);
    return;
  }

  if (forceTimeout) {
    if (candidate && candidate.score >= MIN_BEE_PICKUP_SCORE && driftPx <= BEE_LOCK_MOVE_PX) {
      lockBeeDrag(candidate.bee, screenX, screenY);
      return;
    }
    pointer.moved = driftPx > DRAG_THRESHOLD_PX;
    lockCameraDrag();
  }
}

function schedulePendingIntentTimeout() {
  cancelPendingIntentTimer();
  pendingIntentTimer = setTimeout(function() {
    pendingIntentTimer = null;
    if (!pointer.active || pointer.intentState !== POINTER_INTENT_STATE.PENDING_INTENT) { return; }
    resolvePendingIntent(pointer.lastX, pointer.lastY, true);
  }, PENDING_INTENT_TIMEOUT_MS);
}

export function cancelPointerGesture() {
  cancelLongPress();
  cancelPendingIntentTimer();
  resetPointerState();
  clearBoostGhost();
}

export function onPointerDown(x, y) {
  resetPointerState();
  pointer.active = true;
  pointer.intentState = POINTER_INTENT_STATE.PENDING_INTENT;
  pointer.startX = x;
  pointer.startY = y;
  pointer.lastX = x;
  pointer.lastY = y;
  pointer.downTimeMs = getNowMs();
  pointer.tapEligible = true;
  pointer.pendingIntentDriftPx = 0;
  longPressState.x = x;
  longPressState.y = y;

  var selectedBee = getSelectedBee();
  var candidate = refreshPendingBeeCandidate(x, y);
  pointer.downBeeId = candidate ? candidate.bee.id : null;
  pointer.downBeeWasSelected = !!(selectedBee && candidate && selectedBee.id === candidate.bee.id);

  scheduleLongPress();
  schedulePendingIntentTimeout();
}

export function onPointerMove(x, y) {
  if (!pointer.active) { return; }
  pointer.deltaX = x - pointer.lastX;
  pointer.deltaY = y - pointer.lastY;
  pointer.lastX = x;
  pointer.lastY = y;

  var driftPx = getPointerDriftPx(x, y);
  pointer.pendingIntentDriftPx = driftPx;
  if (!pointer.moved && driftPx > DRAG_THRESHOLD_PX) { pointer.moved = true; }

  if (pointer.intentState === POINTER_INTENT_STATE.PENDING_INTENT) {
    resolvePendingIntent(x, y, false);
    return;
  }

  if (pointer.intentState === POINTER_INTENT_STATE.LOCKED_BEE_DRAG && pointer.dragMode === 'bee_assign') {
    updateBeeDragInteraction(getSelectedBee(), x, y);
    return;
  }

  if (pointer.dragMode === 'boost_drag') {
    updateBoostDragInteraction(x, y);
  }
}

export function onPointerUp() {
  cancelLongPress();
  cancelPendingIntentTimer();
  if (!pointer.active) { return; }

  if (pointer.dragMode === 'boost_drag') {
    applyBoostDragDrop(pointer.lastX, pointer.lastY);
  } else if (pointer.intentState === POINTER_INTENT_STATE.LOCKED_BEE_DRAG) {
    if (pointer.moved) {
      applySelectedBeeDragDrop(pointer.lastX, pointer.lastY);
    } else {
      enterRecover();
    }
  } else if (pointer.intentState === POINTER_INTENT_STATE.LOCKED_CAMERA) {
    if (pointer.moved) { enterPostDragSlowmo(); } else { enterRecover(); }
  } else if (pointer.intentState === POINTER_INTENT_STATE.PENDING_INTENT) {
    if (pointer.pendingIntentDriftPx <= TAP_MAX_MOVE_PX) {
      onTap(pointer.startX, pointer.startY);
      enterRecover();
    } else {
      enterRecover();
    }
  }

  resetPointerState();
  clearBoostGhost();
}

export function installPointerController(rendererDomElement) {
  if (pointerControllerInstalled) { return; }
  pointerControllerInstalled = true;

  rendererDomElement.addEventListener('mousedown', function(e) { onPointerDown(e.clientX, e.clientY); });
  window.addEventListener('mousemove', function(e) { if (pointer.active) { onPointerMove(e.clientX, e.clientY); } });
  window.addEventListener('mouseup', function() { onPointerUp(); });
}
