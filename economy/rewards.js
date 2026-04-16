import { HIVE } from '../config/hiveConfig.js';
import { BOOST_TYPE, CELL_STATE, CELL_TYPE } from '../data/enums.js';

var stateRef = null;
var getCellWorldPosRef = function() { return null; };
var refreshCellMaterialRef = function() {};
var ensureActiveCellLabelRef = function() {};
var activateDormantCellRef = function() {};
var isRequiredStructureCellRef = function() { return false; };

export function setRewardsRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  getCellWorldPosRef = runtime && runtime.getCellWorldPos ? runtime.getCellWorldPos : getCellWorldPosRef;
  refreshCellMaterialRef = runtime && runtime.refreshCellMaterial ? runtime.refreshCellMaterial : refreshCellMaterialRef;
  ensureActiveCellLabelRef = runtime && runtime.ensureActiveCellLabel ? runtime.ensureActiveCellLabel : ensureActiveCellLabelRef;
  activateDormantCellRef = runtime && runtime.activateDormantCell ? runtime.activateDormantCell : activateDormantCellRef;
  isRequiredStructureCellRef = runtime && runtime.isRequiredStructureCell ? runtime.isRequiredStructureCell : isRequiredStructureCellRef;
  spawnRewardBurstRef = runtime && runtime.spawnRewardBurst ? runtime.spawnRewardBurst : spawnRewardBurstRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
}

var spawnRewardBurstRef = function() {};
var setBuildingToastRef = function() {};

export function grantCellReward(cell) {
  if (!cell || cell.rewardCollected) { return null; }
  if (!cell.rewardTable || cell.rewardTable.length === 0) {
    cell.rewardCollected = true;
    return null;
  }
  cell.rewardCollected = true;
  var pos = new globalThis.THREE.Vector3(
    Math.cos(cell.theta) * (HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + 0.5),
    cell.worldPos.y,
    Math.sin(cell.theta) * (HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + 0.5)
  );

  var honeyGranted = 0;
  var nectarGranted = 0;
  var jellyGranted = 0;
  var primaryRewardType = cell.rewardType || 'honey';
  var primaryRewardAmount = cell.rewardAmount || 0;

  for (var ri = 0; ri < cell.rewardTable.length; ri++) {
    var entry = cell.rewardTable[ri];
    if (!entry || !entry.type || !entry.amount) { continue; }
    if (ri === 0) {
      primaryRewardType = entry.type;
      primaryRewardAmount = entry.amount;
    }
    if (entry.type === 'honey') {
      stateRef.honey += entry.amount;
      honeyGranted += entry.amount;
    } else if (entry.type === 'nectar') {
      nectarGranted += entry.amount;
      routeNectarToActiveCells(pos, entry.amount, null, 'reward');
    } else if (entry.type === BOOST_TYPE.ROYAL_JELLY) {
      stateRef.boosts.royal_jelly += entry.amount;
      jellyGranted += entry.amount;
    }
  }

  cell.rewardType = primaryRewardType;
  cell.rewardAmount = primaryRewardAmount;
  var rewardParts = [];
  if (honeyGranted > 0) { rewardParts.push('+' + honeyGranted + ' HONEY'); }
  if (nectarGranted > 0) { rewardParts.push('+' + nectarGranted + ' NECTAR'); }
  if (jellyGranted > 0) { rewardParts.push('+' + jellyGranted + ' JELLY'); }
  if (rewardParts.length > 0) {
    setBuildingToastRef(rewardParts.join('  '), 2.8);
    spawnRewardBurstRef(pos, primaryRewardType, primaryRewardAmount);
  }
  refreshCellMaterialRef(cell);
  return {
    honey: honeyGranted,
    nectar: nectarGranted,
    royalJelly: jellyGranted,
    primaryType: primaryRewardType,
    primaryAmount: primaryRewardAmount
  };
}

export function getActiveProducerCells() {
  var cells = [];
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    if (cell.state === CELL_STATE.ACTIVE && cell.cellType === CELL_TYPE.OPEN) { cells.push(cell); }
  }
  return cells;
}

export function routeNectarToActiveCells(sourcePos, nectarAmount, preferredCellId, nectarType) {
  var remaining = nectarAmount || 0;
  if (remaining <= 0) { return 0; }

  var candidates = getActiveProducerCells();
  candidates.sort(function(a, b) {
    if (preferredCellId && a.id === preferredCellId) { return -1; }
    if (preferredCellId && b.id === preferredCellId) { return 1; }
    var ap = getCellWorldPosRef(a);
    var bp = getCellWorldPosRef(b);
    return sourcePos.distanceTo(ap) - sourcePos.distanceTo(bp);
  });

  var deposited = 0;
  for (var i = 0; i < candidates.length && remaining > 0; i++) {
    var cell = candidates[i];
    var space = Math.max(0, cell.nectarCapacity - cell.nectarStored);
    if (space <= 0) { continue; }
    var give = Math.min(remaining, space);
    cell.nectarStored += give;
    if (!cell.nectarType) { cell.nectarType = nectarType || 'wildflower'; }
    deposited += give;
    remaining -= give;
    refreshCellMaterialRef(cell);
    ensureActiveCellLabelRef(cell);
  }
  return deposited;
}

export function depositNectarToActiveCell(cell, nectarAmount, nectarType) {
  if (!cell || cell.state !== CELL_STATE.ACTIVE || cell.cellType !== CELL_TYPE.OPEN || nectarAmount <= 0) {
    return { used: 0, leftover: nectarAmount || 0 };
  }

  var space = Math.max(0, cell.nectarCapacity - cell.nectarStored);
  var used = Math.min(space, nectarAmount);
  cell.nectarStored += used;
  if (!cell.nectarType) { cell.nectarType = nectarType || 'wildflower'; }
  refreshCellMaterialRef(cell);
  ensureActiveCellLabelRef(cell);
  return { used: used, leftover: nectarAmount - used };
}

export function depositNectarToDormantCell(cell, nectarAmount, nectarType) {
  if (!cell || cell.state !== CELL_STATE.DORMANT || nectarAmount <= 0) { return { used: 0, leftover: nectarAmount || 0, activated: false }; }

  var space = Math.max(0, cell.nectarCapacity - cell.nectarStored);
  var used = Math.min(space, nectarAmount);
  cell.nectarStored += used;
  cell.activationProgress = Math.min(cell.nectarRequired, cell.nectarStored);
  if (!cell.nectarType) { cell.nectarType = nectarType || 'wildflower'; }

  var activated = false;
  if (cell.nectarStored >= cell.nectarRequired) {
    activateDormantCellRef(cell);
    activated = true;
  } else {
    refreshCellMaterialRef(cell);
  }

  return { used: used, leftover: nectarAmount - used, activated: activated };
}

export function chooseGathererDepositTarget(bee) {
  if (!bee) { return null; }
  var fromPos = bee.pos.clone();
  var dormantCells = [];
  var dormantStructureCells = [];
  var activeCells = [];
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    if (cell.state === CELL_STATE.DORMANT) {
      dormantCells.push(cell);
      if (isRequiredStructureCellRef(cell)) { dormantStructureCells.push(cell); }
    }
    else if (cell.state === CELL_STATE.ACTIVE && cell.cellType === CELL_TYPE.OPEN) { activeCells.push(cell); }
  }

  if (dormantStructureCells.length > 0) {
    dormantStructureCells.sort(function(a, b) {
      var needA = Math.max(0, a.nectarRequired - a.nectarStored);
      var needB = Math.max(0, b.nectarRequired - b.nectarStored);
      var scoreA = needA + fromPos.distanceTo(getCellWorldPosRef(a)) * 0.35;
      var scoreB = needB + fromPos.distanceTo(getCellWorldPosRef(b)) * 0.35;
      return scoreA - scoreB;
    });
    return dormantStructureCells[0];
  }

  var preferDormantChance = Math.min(0.85, 0.12 + (bee.level - 1) * 0.18);
  if (dormantCells.length > 0 && Math.random() < preferDormantChance) {
    dormantCells.sort(function(a, b) {
      return fromPos.distanceTo(getCellWorldPosRef(a)) - fromPos.distanceTo(getCellWorldPosRef(b));
    });
    return dormantCells[0];
  }

  if (activeCells.length === 0) {
    if (dormantCells.length === 0) { return null; }
    dormantCells.sort(function(a, b) {
      return fromPos.distanceTo(getCellWorldPosRef(a)) - fromPos.distanceTo(getCellWorldPosRef(b));
    });
    return dormantCells[0];
  }

  activeCells.sort(function(a, b) {
    var distA = fromPos.distanceTo(getCellWorldPosRef(a));
    var distB = fromPos.distanceTo(getCellWorldPosRef(b));
    var scoreA = distA - a.row * (bee.level - 1) * 0.45;
    var scoreB = distB - b.row * (bee.level - 1) * 0.45;
    return scoreA - scoreB;
  });
  return activeCells[0];
}
