export var POINTER_INTENT_STATE = {
  IDLE: 'idle',
  PENDING_INTENT: 'pending_intent',
  LOCKED_CAMERA: 'locked_camera',
  LOCKED_BEE_DRAG: 'locked_bee_drag',
  LOCKED_BOOST_DRAG: 'locked_boost_drag'
};

export var TAP_MAX_MOVE_PX = 8;
export var DRAG_THRESHOLD_PX = 5;
export var LONG_PRESS_MS = 500;
export var LONG_PRESS_MAX_MOVE_PX = 6;
export var CAMERA_TREND_MOVE_PX = 10;
export var CAMERA_LOCK_MOVE_PX = 14;
export var BEE_LOCK_MOVE_PX = 10;
export var IMMEDIATE_BEE_LOCK_MAX_MOVE_PX = 3;
export var BEE_LOCK_TIME_MS = 70;
export var PENDING_INTENT_TIMEOUT_MS = 140;

export var MIN_BEE_PICKUP_SCORE = 0.52;
export var HIGH_CONFIDENCE_PICKUP_SCORE = 0.82;
export var FRESH_PICKUP_RADIUS_PX = 42;
export var BEE_PICKUP_TOLERANCE_PX = FRESH_PICKUP_RADIUS_PX;
export var MERGE_SNAP_RADIUS_PX = 84;
export var BEE_MERGE_SNAP_TOLERANCE_PX = MERGE_SNAP_RADIUS_PX;
export var CELL_SNAP_RADIUS_PX = 92;
export var WORKER_SNAP_RADIUS_PX = 118;
export var BOOST_TARGET_TOLERANCE_PX = 92;
export var EDGE_PENALTY_ZONE_FRAC = 0.12;
export var MERGE_FREEZE_S = 0.18;

export var BEE_DRAG_EDGE_ROTATE_ZONE_FRAC = 0.14;
export var BEE_DRAG_EDGE_ROTATE_DWELL_S = 0.14;
export var BEE_DRAG_EDGE_ROTATE_SPEED_MAX = 1.45;
