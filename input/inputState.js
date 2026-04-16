import {
  BEE_DRAG_EDGE_ROTATE_DWELL_S,
  BEE_DRAG_EDGE_ROTATE_SPEED_MAX,
  BEE_DRAG_EDGE_ROTATE_ZONE_FRAC,
  BEE_MERGE_SNAP_TOLERANCE_PX,
  BEE_PICKUP_TOLERANCE_PX,
  BOOST_TARGET_TOLERANCE_PX,
  DRAG_THRESHOLD_PX,
  LONG_PRESS_MS,
  POINTER_INTENT_STATE
} from '../config/inputConfig.js';

export {
  BEE_DRAG_EDGE_ROTATE_DWELL_S,
  BEE_DRAG_EDGE_ROTATE_SPEED_MAX,
  BEE_DRAG_EDGE_ROTATE_ZONE_FRAC,
  BEE_MERGE_SNAP_TOLERANCE_PX,
  BEE_PICKUP_TOLERANCE_PX,
  BOOST_TARGET_TOLERANCE_PX,
  DRAG_THRESHOLD_PX,
  LONG_PRESS_MS
} from '../config/inputConfig.js';

export var pointer = {
  active: false,
  moved: false,
  intentState: POINTER_INTENT_STATE.IDLE,
  dragMode: null,
  dragHoverBeeId: null,
  dragHoverCellId: null,
  dragHoverTargetKind: null,
  dragVisualPos: null,
  dragBoostType: null,
  dragGhostX: 0,
  dragGhostY: 0,
  resolvedDragTarget: null,
  downBeeId: null,
  downBeeWasSelected: false,
  downTimeMs: 0,
  tapEligible: false,
  pendingBeeCandidateId: null,
  pendingBeeCandidateScore: 0,
  pendingBeeCandidateVersion: 0,
  pendingIntentDriftPx: 0,
  edgeRotateDir: 0,
  edgeRotateTimer: 0,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  deltaX: 0,
  deltaY: 0
};

export var pinch = { active: false, lastDist: 0 };

export var longPressState = {
  timer: null,
  x: 0,
  y: 0
};
