import { CONFIG } from '../config/config.js';
import { HIVE } from '../config/hiveConfig.js';
import { CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { getCurrentStageDef } from '../board/boardBuilder.js';

var stateRef = null;
var gateLabelMapRef = null;
var refreshCellMaterialRef = function() {};
var spawnLevelCompleteBurstRef = function() {};
var spawnRewardBurstRef = function() {};
var setBuildingToastRef = function() {};
var isRequiredStructureCellRef = function() { return false; };

export function setGatesRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  gateLabelMapRef = runtime && runtime.gateLabelMap ? runtime.gateLabelMap : gateLabelMapRef;
  refreshCellMaterialRef = runtime && runtime.refreshCellMaterial ? runtime.refreshCellMaterial : refreshCellMaterialRef;
  spawnLevelCompleteBurstRef = runtime && runtime.spawnLevelCompleteBurst ? runtime.spawnLevelCompleteBurst : spawnLevelCompleteBurstRef;
  spawnRewardBurstRef = runtime && runtime.spawnRewardBurst ? runtime.spawnRewardBurst : spawnRewardBurstRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
  isRequiredStructureCellRef = runtime && runtime.isRequiredStructureCell ? runtime.isRequiredStructureCell : isRequiredStructureCellRef;
}

function isStageProgressCell(cell) {
  return !!(cell && cell.cellType !== CELL_TYPE.GATE && cell.row > 0);
}

export function getStageCompletionStats() {
  var totalCells = 0;
  var clearedCells = 0;
  var remainingCells = 0;
  var builtStructures = 0;
  var honeyPotCount = 0;

  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    if (!isStageProgressCell(cell)) { continue; }
    totalCells += 1;
    var isCleared = (cell.state !== CELL_STATE.LOCKED && cell.state !== CELL_STATE.OBSTACLE);
    if (isCleared) { clearedCells += 1; }
    else { remainingCells += 1; }

    if (cell.state === CELL_STATE.ACTIVE && cell.buildingConstructed &&
        (cell.cellType === CELL_TYPE.HATCHERY || cell.cellType === CELL_TYPE.PROCESSOR || cell.cellType === CELL_TYPE.BUILDING_LOT)) {
      builtStructures += 1;
      if (cell.cellType === CELL_TYPE.BUILDING_LOT) { honeyPotCount += 1; }
    }
  }

  return {
    totalCells: totalCells,
    clearedCells: clearedCells,
    remainingCells: remainingCells,
    builtStructures: builtStructures,
    honeyPotCount: honeyPotCount,
    clearRatio: totalCells > 0 ? (clearedCells / totalCells) : 1,
    fullClear: remainingCells === 0
  };
}

export function getStageExitBonus() {
  var stats = getStageCompletionStats();
  var clearBonus = Math.floor(stats.clearRatio * CONFIG.STAGE_EXIT_CLEAR_BONUS_MAX);
  var structureBonus = stats.builtStructures * CONFIG.STAGE_EXIT_STRUCTURE_BONUS;
  var honeyPotBonus = stats.honeyPotCount * CONFIG.BUILDING_LOT_EXIT_BONUS;
  var fullClearBonus = stats.fullClear ? CONFIG.STAGE_EXIT_FULL_CLEAR_BONUS : 0;
  var honey = clearBonus + structureBonus + honeyPotBonus + fullClearBonus;
  return {
    honey: honey,
    clearBonus: clearBonus,
    structureBonus: structureBonus,
    honeyPotBonus: honeyPotBonus,
    fullClearBonus: fullClearBonus,
    extraForFullClear: stats.fullClear ? 0 : CONFIG.STAGE_EXIT_FULL_CLEAR_BONUS,
    stats: stats
  };
}

export function evaluateGateConditions() {
  var structuresTotal = 0;
  var structuresReady = 0;
  var gatesTotal = 0;
  var gatesLocked = 0;
  var gatesOpen = 0;
  var gatesCleared = 0;

  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var c = stateRef.cells[ci];
    if (isRequiredStructureCellRef(c)) {
      structuresTotal += 1;
      if (c.state === CELL_STATE.ACTIVE && c.buildingConstructed) { structuresReady += 1; }
    }
    if (c.cellType === CELL_TYPE.GATE) {
      gatesTotal += 1;
      if (c.state === CELL_STATE.LOCKED) { gatesLocked += 1; }
      else if (c.state === CELL_STATE.OBSTACLE) { gatesOpen += 1; }
      else if (c.state === CELL_STATE.ACTIVE) { gatesCleared += 1; }
    }
  }

  var structuresOk = (structuresTotal === 0) ? true : (structuresReady >= structuresTotal);
  var gatesUnlocked = (gatesOpen > 0 || gatesCleared > 0);
  var allGatesCleared = (gatesTotal > 0 && gatesCleared >= gatesTotal);
  var ready = structuresOk;
  var detail = '';
  if (!structuresOk) {
    detail = (structuresTotal - structuresReady) + ' structure cells still need claiming';
  } else if (!gatesUnlocked) {
    detail = 'gate cells will unlock now';
  } else if (!allGatesCleared) {
    detail = (gatesTotal - gatesCleared) + ' gate cells still need clearing';
  } else {
    detail = 'all gate cells cleared';
  }

  return {
    ready: ready,
    structuresOk: structuresOk,
    structuresTotal: structuresTotal,
    structuresReady: structuresReady,
    gatesTotal: gatesTotal,
    gatesLocked: gatesLocked,
    gatesOpen: gatesOpen,
    gatesCleared: gatesCleared,
    gatesUnlocked: gatesUnlocked,
    allGatesCleared: allGatesCleared,
    detail: detail
  };
}

export function updateGate() {
  if (stateRef.levelComplete) { return; }
  var conds = evaluateGateConditions();
  var wasReady = stateRef.gateReady;
  stateRef.gateReady = conds.ready;

  if (conds.ready && !wasReady) {
    for (var ci = 0; ci < stateRef.cells.length; ci++) {
      var c = stateRef.cells[ci];
      if (c.cellType === CELL_TYPE.GATE && c.state === CELL_STATE.LOCKED) {
        c.state = CELL_STATE.OBSTACLE;
        c.gateUnlocked = true;
        c.activationRequired = CONFIG.GATE_WORK_REQUIRED;
        c.activationProgress = 0;
        refreshCellMaterialRef(c);
      }
    }
    setBuildingToastRef('Gate cells exposed - work them down', 4.0);
  }
}

export function completeLevel(gateCell) {
  if (stateRef.levelComplete) { return; }
  var exitBonus = getStageExitBonus();
  stateRef.levelComplete = true;
  stateRef.honey += exitBonus.honey;

  var gp = new globalThis.THREE.Vector3(Math.cos(gateCell.theta) * (HIVE.CYLINDER_RADIUS + 0.5), gateCell.worldPos.y, Math.sin(gateCell.theta) * (HIVE.CYLINDER_RADIUS + 0.5));
  spawnLevelCompleteBurstRef(gp);
  if (exitBonus.honey > 0) { spawnRewardBurstRef(gp, 'honey', exitBonus.honey); }

  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var c = stateRef.cells[ci];
    if (c.cellType === CELL_TYPE.GATE) {
      c.state = CELL_STATE.ACTIVE;
      c.gateUnlocked = true;
      refreshCellMaterialRef(c);
    }
  }
  setBuildingToastRef('LEVEL COMPLETE!  +' + exitBonus.honey + ' honey exit bonus', 6.0);
}

export function invalidateGateLabelCache() {
  for (var gid in gateLabelMapRef) {
    var glbl = gateLabelMapRef[gid];
    if (!glbl) { continue; }
    glbl.lastGateReady = !stateRef.gateReady;
    glbl.lastLevelComplete = !stateRef.levelComplete;
    glbl.lastBonusHoney = -99999;
    glbl.lastBonusExtra = -99999;
    glbl.lastGateState = '__dirty__';
    glbl.lastGateProgress = -99999;
  }
}

export function syncGateWorkRequirement(value) {
  var hp = Math.max(1, Math.round(value));
  CONFIG.GATE_WORK_REQUIRED = hp;
  var stageDef = getCurrentStageDef();
  if (stageDef && stageDef.cells) {
    for (var si = 0; si < stageDef.cells.length; si++) {
      if (stageDef.cells[si].cellType === CELL_TYPE.GATE) {
        stageDef.cells[si].activationRequired = hp;
      }
    }
  }
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    if (cell.cellType === CELL_TYPE.GATE) {
      cell.activationRequired = hp;
    }
  }
  invalidateGateLabelCache();
}
