import { CONFIG } from '../config/config.js';
import { getBeeMergeSurgeMultiplier, getBeeRoyalJellyMultiplier, getRoyalRushGatherLoadMultiplier, getRoyalRushTravelMultiplier, getRoyalRushWorkMultiplier } from '../economy/boosts.js';

var stateRef = null;
var getSelectedBeeIdRef = function() { return null; };

export function setBeeQueriesRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  getSelectedBeeIdRef = runtime && runtime.getSelectedBeeId ? runtime.getSelectedBeeId : getSelectedBeeIdRef;
}

export function getBeeById(id) {
  if (!stateRef) { return null; }
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    if (stateRef.bees[bi].id === id) { return stateRef.bees[bi]; }
  }
  return null;
}

export function getSelectedBee() {
  var selectedBeeId = getSelectedBeeIdRef();
  if (selectedBeeId === null || !stateRef) { return null; }
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    if (stateRef.bees[bi].id === selectedBeeId) { return stateRef.bees[bi]; }
  }
  return null;
}

export function getBeeWorkRateForLevel(level) {
  var lvl = Math.max(1, level || 1);
  return CONFIG.BEE_WORK_RATE_BASE * Math.pow(CONFIG.BEE_WORK_RATE_GROWTH, lvl - 1);
}

export function getBeeGatherLoadForLevel(level) {
  var lvl = Math.max(1, level || 1);
  return CONFIG.GATHER_NECTAR_BASE + (lvl - 1) * CONFIG.GATHER_NECTAR_PER_LEVEL;
}

export function getBeeGatherRestDuration(level) {
  var lvl = Math.max(1, level || 1);
  return Math.max(1.2, CONFIG.GATHER_REST_BASE - (lvl - 1) * CONFIG.GATHER_REST_REDUCTION_PER_LEVEL);
}

export function getBeeGatherTravelMultiplier(level) {
  var lvl = Math.max(1, level || 1);
  return CONFIG.GATHER_TRAVEL_SPEED_BASE + (lvl - 1) * CONFIG.GATHER_TRAVEL_SPEED_PER_LEVEL;
}

export function getBeeEffectiveWorkRate(bee) {
  if (!bee) { return 0; }
  return bee.workRate * getBeeMergeSurgeMultiplier(bee) * getBeeRoyalJellyMultiplier(bee, CONFIG.ROYAL_JELLY_WORK_BONUS) * getRoyalRushWorkMultiplier();
}

export function getBeeEffectiveGatherLoad(bee) {
  if (!bee) { return 0; }
  var base = getBeeGatherLoadForLevel(bee.level);
  var surge = (bee.mergeSurgeTimer > 0) ? (1 + CONFIG.MERGE_SURGE_GATHER_LOAD_BONUS) : 1;
  return Math.max(base, Math.round(base * surge * getBeeRoyalJellyMultiplier(bee, CONFIG.ROYAL_JELLY_GATHER_LOAD_BONUS) * getRoyalRushGatherLoadMultiplier()));
}

export function getBeeEffectiveGatherTravelMultiplier(bee) {
  if (!bee) { return 1; }
  var base = getBeeGatherTravelMultiplier(bee.level);
  var surge = (bee.mergeSurgeTimer > 0) ? (1 + CONFIG.MERGE_SURGE_TRAVEL_BONUS) : 1;
  return base * surge * getBeeRoyalJellyMultiplier(bee, CONFIG.ROYAL_JELLY_TRAVEL_BONUS) * getRoyalRushTravelMultiplier();
}
