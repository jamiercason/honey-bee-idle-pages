import { CONFIG } from '../config/config.js';

var stateRef = null;

export function setBoostsRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
}

export function getRoyalRushStacks() {
  return stateRef.royalRushTimer > 0 ? stateRef.royalRushStacks : 0;
}

export function getRoyalRushWorkMultiplier() {
  return 1 + getRoyalRushStacks() * CONFIG.ROYAL_RUSH_WORK_BONUS_PER_STACK;
}

export function getRoyalRushGatherLoadMultiplier() {
  return 1 + getRoyalRushStacks() * CONFIG.ROYAL_RUSH_GATHER_LOAD_BONUS_PER_STACK;
}

export function getRoyalRushTravelMultiplier() {
  return 1 + getRoyalRushStacks() * CONFIG.ROYAL_RUSH_TRAVEL_BONUS_PER_STACK;
}

export function getRoyalRushConversionMultiplier() {
  return 1 + getRoyalRushStacks() * CONFIG.ROYAL_RUSH_CONVERSION_BONUS_PER_STACK;
}

export function getBeeMergeSurgeMultiplier(bee) {
  return (bee && bee.mergeSurgeTimer > 0) ? (1 + CONFIG.MERGE_SURGE_WORK_BONUS) : 1;
}

export function getBeeRoyalJellyMultiplier(bee, bonus) {
  return (bee && bee.royalJellyTimer > 0) ? (1 + bonus) : 1;
}

export function registerRoyalRush() {
  stateRef.royalRushStacks = Math.min(CONFIG.ROYAL_RUSH_MAX_STACKS, Math.max(0, stateRef.royalRushStacks) + 1);
  stateRef.royalRushTimer = CONFIG.ROYAL_RUSH_DURATION;
}

export function updateRoyalRush(rawDt) {
  if (stateRef.royalRushTimer > 0) {
    stateRef.royalRushTimer = Math.max(0, stateRef.royalRushTimer - rawDt);
    if (stateRef.royalRushTimer <= 0) {
      stateRef.royalRushStacks = 0;
    }
  }
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    if (stateRef.bees[bi].mergeSurgeTimer > 0) {
      stateRef.bees[bi].mergeSurgeTimer = Math.max(0, stateRef.bees[bi].mergeSurgeTimer - rawDt);
    }
    if (stateRef.bees[bi].royalJellyTimer > 0) {
      stateRef.bees[bi].royalJellyTimer = Math.max(0, stateRef.bees[bi].royalJellyTimer - rawDt);
    }
  }
}
