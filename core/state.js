import { CONFIG } from '../config/config.js';
import { CAMERA_MODE } from '../data/enums.js';

function createInitialBoostInventory() {
  return { royal_jelly: 0 };
}

export function createInitialState(currentStage) {
  return {
    stageId: currentStage.id,
    honey: currentStage.startingHoney,
    summonsPurchased: 0,
    bees: [],
    cells: [],
    selectedBeeId: null,
    focusMode: false,
    gameTimeScale: CONFIG.BASE_GAME_TIME_SCALE,
    cameraMode: CAMERA_MODE.AUTOROTATE,
    slowmoTimer: 0,
    boosts: createInitialBoostInventory(),
    royalRushStacks: 0,
    royalRushTimer: 0,
    levelComplete: false,
    gateReady: false
  };
}
