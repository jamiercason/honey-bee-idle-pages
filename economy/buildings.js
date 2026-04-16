import { CONFIG } from '../config/config.js';
import { CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { getCellById } from '../board/boardQueries.js';

var stateRef = null;
var getOpenCellLabelMapRef = function() { return {}; };
var getCellWorldPosRef = function() { return null; };
var routeNectarToActiveCellsRef = function() { return 0; };
var refreshCellMaterialRef = function() {};
var flashCellRef = function() {};
var markCameraInteractionRef = function() {};
var syncGateWorkRequirementRef = function() {};
var invalidateGateLabelCacheRef = function() {};

var baseSpawnTimer = 0;
var hatcheryTimer = 0;

export function setBuildingsRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  getOpenCellLabelMapRef = runtime && runtime.getOpenCellLabelMap ? runtime.getOpenCellLabelMap : getOpenCellLabelMapRef;
  getCellWorldPosRef = runtime && runtime.getCellWorldPos ? runtime.getCellWorldPos : getCellWorldPosRef;
  routeNectarToActiveCellsRef = runtime && runtime.routeNectarToActiveCells ? runtime.routeNectarToActiveCells : routeNectarToActiveCellsRef;
  refreshCellMaterialRef = runtime && runtime.refreshCellMaterial ? runtime.refreshCellMaterial : refreshCellMaterialRef;
  flashCellRef = runtime && runtime.flashCell ? runtime.flashCell : flashCellRef;
  markCameraInteractionRef = runtime && runtime.markCameraInteraction ? runtime.markCameraInteraction : markCameraInteractionRef;
  syncGateWorkRequirementRef = runtime && runtime.syncGateWorkRequirement ? runtime.syncGateWorkRequirement : syncGateWorkRequirementRef;
  invalidateGateLabelCacheRef = runtime && runtime.invalidateGateLabelCache ? runtime.invalidateGateLabelCache : invalidateGateLabelCacheRef;
}

export function applyBuildingEffects() {
  var ci;
  var cell;
  var ni;
  var nid;
  var ncell;
  for (ci = 0; ci < stateRef.cells.length; ci++) {
    stateRef.cells[ci].productionRate = stateRef.cells[ci].baseProductionRate || 0;
    stateRef.cells[ci].conversionRate = stateRef.cells[ci].productionRate;
  }
  for (ci = 0; ci < stateRef.cells.length; ci++) {
    cell = stateRef.cells[ci];
    if (cell.cellType !== CELL_TYPE.PROCESSOR || !cell.buildingConstructed) { continue; }
    var bonus = CONFIG.PROCESSOR_RATE_BONUS[cell.buildingLevel] || 0;
    if (bonus <= 0) { continue; }
    for (ni = 0; ni < cell.neighborIds.length; ni++) {
      nid = cell.neighborIds[ni];
      ncell = getCellById(nid);
      if (ncell && ncell.state === CELL_STATE.ACTIVE && ncell.cellType === CELL_TYPE.OPEN) {
        ncell.productionRate += bonus;
        ncell.conversionRate = ncell.productionRate;
      }
    }
  }
}

export function getHatcheryNectarInterval(level) {
  return CONFIG.HATCHERY_NECTAR_INTERVAL[Math.max(0, Math.min(CONFIG.HATCHERY_MAX_LEVEL, level || 0))] || 0;
}

export function getHatcheryNectarYield(level) {
  return CONFIG.HATCHERY_NECTAR_YIELD[Math.max(0, Math.min(CONFIG.HATCHERY_MAX_LEVEL, level || 0))] || 0;
}

export function tryBuildOrUpgrade(cell) {
  if (cell.state !== CELL_STATE.ACTIVE) { return null; }
  var isHatchery = (cell.cellType === CELL_TYPE.HATCHERY);
  var isProcessor = (cell.cellType === CELL_TYPE.PROCESSOR);
  var isBuildingLot = (cell.cellType === CELL_TYPE.BUILDING_LOT);

  if (!isHatchery && !isProcessor && !isBuildingLot) { return null; }

  var maxLevel = isHatchery ? CONFIG.HATCHERY_MAX_LEVEL : CONFIG.PROCESSOR_MAX_LEVEL;
  var costs = isHatchery ? CONFIG.HATCHERY_BUILD_COST : CONFIG.PROCESSOR_BUILD_COST;

  if (isBuildingLot) {
    if (cell.buildingConstructed) { return 'Honey Pot active  +' + CONFIG.BUILDING_LOT_EXIT_BONUS + ' exit'; }
    if (stateRef.honey < CONFIG.BUILDING_LOT_CLAIM_COST) { return 'Need ' + CONFIG.BUILDING_LOT_CLAIM_COST + ' honey'; }
    stateRef.honey -= CONFIG.BUILDING_LOT_CLAIM_COST;
    cell.buildingConstructed = true;
    cell.buildingType = 'honey_pot';
    cell.buildingLevel = 1;
    refreshCellMaterialRef(cell);
    flashCellRef(cell.id, 0x4488ff);
    markCameraInteractionRef(cell);
    return 'Honey Pot active  +' + CONFIG.BUILDING_LOT_EXIT_BONUS + ' exit';
  }

  if (!cell.buildingConstructed) {
    var cost1 = costs[1];
    if (stateRef.honey < cost1) { return 'Need ' + cost1 + ' honey'; }
    stateRef.honey -= cost1;
    cell.buildingConstructed = true;
    cell.buildingType = cell.cellType;
    cell.buildingLevel = 1;
    applyBuildingEffects();
    refreshCellMaterialRef(cell);
    flashCellRef(cell.id, isHatchery ? 0x4488ff : 0x44ffaa);
    var olbl = getOpenCellLabelMapRef()[cell.id];
    if (olbl) { olbl.lastNectar = -1; }
    markCameraInteractionRef(cell);
    return 'BUILT Lv.1';
  }

  var nextLevel = cell.buildingLevel + 1;
  if (nextLevel > maxLevel) { return 'MAX LEVEL'; }
  var upgCost = costs[nextLevel];
  if (stateRef.honey < upgCost) { return 'Need ' + upgCost + ' honey'; }
  stateRef.honey -= upgCost;
  cell.buildingLevel = nextLevel;
  applyBuildingEffects();
  refreshCellMaterialRef(cell);
  flashCellRef(cell.id, 0xffffff);
  var olbl2 = getOpenCellLabelMapRef()[cell.id];
  if (olbl2) { olbl2.lastNectar = -1; }
  markCameraInteractionRef(cell);
  return 'UPGRADED to Lv.' + nextLevel;
}

export function updateBuildings(dt) {
  baseSpawnTimer = 0;
  hatcheryTimer = 0;
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    if (cell.state !== CELL_STATE.ACTIVE || cell.cellType !== CELL_TYPE.HATCHERY || !cell.buildingConstructed) { continue; }

    var interval = getHatcheryNectarInterval(cell.buildingLevel);
    var yieldAmt = getHatcheryNectarYield(cell.buildingLevel);
    if (interval <= 0 || yieldAmt <= 0) { continue; }

    if (!(cell.buildingCooldown > 0)) { cell.buildingCooldown = interval; }
    cell.buildingCooldown -= dt;

    while (cell.buildingCooldown <= 0) {
      cell.buildingCooldown += interval;
      cell.buildingStoredNectar = Math.min(CONFIG.HATCHERY_NECTAR_BUFFER, (cell.buildingStoredNectar || 0) + yieldAmt);
    }

    if ((cell.buildingStoredNectar || 0) > 0) {
      var sourcePos = getCellWorldPosRef(cell);
      var deposited = routeNectarToActiveCellsRef(sourcePos, cell.buildingStoredNectar, null, 'hatchery');
      cell.buildingStoredNectar = Math.max(0, cell.buildingStoredNectar - deposited);
    }

    hatcheryTimer += cell.buildingStoredNectar || 0;
  }
}

export function buildingActionLabel(cell) {
  if (!cell.buildingConstructed) {
    var isH = (cell.cellType === CELL_TYPE.HATCHERY);
    var isP = (cell.cellType === CELL_TYPE.PROCESSOR);
    if (isH) { return 'BUILD Hatchery (' + CONFIG.HATCHERY_BUILD_COST[1] + ' honey, nectar source)'; }
    if (isP) { return 'BUILD Booster (' + CONFIG.PROCESSOR_BUILD_COST[1] + ' honey)'; }
    return 'CLAIM Honey Pot (' + CONFIG.BUILDING_LOT_CLAIM_COST + ' honey, +' + CONFIG.BUILDING_LOT_EXIT_BONUS + ' exit)';
  }
  var isHatchery = (cell.cellType === CELL_TYPE.HATCHERY);
  if (cell.cellType === CELL_TYPE.BUILDING_LOT) {
    return 'Honey Pot active (+' + CONFIG.BUILDING_LOT_EXIT_BONUS + ' exit bonus)';
  }
  var costs = isHatchery ? CONFIG.HATCHERY_BUILD_COST : CONFIG.PROCESSOR_BUILD_COST;
  var maxL = isHatchery ? CONFIG.HATCHERY_MAX_LEVEL : CONFIG.PROCESSOR_MAX_LEVEL;
  var next = cell.buildingLevel + 1;
  if (next > maxL) { return 'Lv.' + cell.buildingLevel + ' (MAX)'; }
  return 'UPGRADE to Lv.' + next + ' (' + costs[next] + ' honey' + (isHatchery ? ', more nectar' : '') + ')';
}

export function isRequiredStructureCell(cell) {
  return !!(cell && (cell.cellType === CELL_TYPE.HATCHERY || cell.cellType === CELL_TYPE.PROCESSOR || cell.cellType === CELL_TYPE.BUILDING_LOT));
}

export function invalidateBuildingLabelCache() {
  var openCellLabelMap = getOpenCellLabelMapRef();
  for (var oid in openCellLabelMap) {
    var olbl = openCellLabelMap[oid];
    if (!olbl) { continue; }
    olbl.lastNectar = -99999;
    olbl.lastHoney = -99999;
    olbl.lastReady = null;
    olbl.lastRate = -99999;
  }
}

export function refreshM6TuningState() {
  applyBuildingEffects();
  syncGateWorkRequirementRef(CONFIG.GATE_WORK_REQUIRED);
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    if (cell.cellType === CELL_TYPE.HATCHERY && cell.buildingConstructed) {
      var maxInterval = getHatcheryNectarInterval(cell.buildingLevel);
      if (maxInterval > 0 && cell.buildingCooldown > maxInterval) {
        cell.buildingCooldown = maxInterval;
      }
      cell.buildingStoredNectar = Math.min(CONFIG.HATCHERY_NECTAR_BUFFER, cell.buildingStoredNectar || 0);
    }
  }
  invalidateBuildingLabelCache();
  invalidateGateLabelCacheRef();
}
