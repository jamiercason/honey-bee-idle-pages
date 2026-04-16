import { CONFIG } from '../config/config.js';
import { STAGE_DEFS, CURRENT_STAGE_ID } from '../data/stageDefs.js';
import { TARGET_MODE, CELL_STATE, OBSTACLE_CLASS, CELL_TYPE } from '../data/enums.js';
import { stageCellKey, buildCellIndex } from './boardQueries.js';
import { buildLogicalHexGraph } from './boardGraph.js';
import {
  getDefaultObstacleClass,
  getObstacleClassActivationScale,
  buildRewardTableForCell,
  getDefaultNectarRequirement,
  getDefaultProductionRate,
  getCellPrimaryReward,
  resolveSeatTargetIdsFromSpec,
  resolveDirectionIds
} from './cellState.js';
import { validateBoardGraph, validateStageAuthoring } from './stageValidation.js';

var stateRef = null;
var currentStageRef = null;
var cylinderCellPositionRef = null;

export function setBoardBuilderRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  currentStageRef = runtime && runtime.currentStage ? runtime.currentStage : null;
  cylinderCellPositionRef = runtime && runtime.cylinderCellPosition ? runtime.cylinderCellPosition : null;
}

export function getCurrentStageDef() {
  return STAGE_DEFS[CURRENT_STAGE_ID];
}

export function buildStageSeatGraph(cells, stageDef) {
  var byCoord = {};
  for (var ci = 0; ci < cells.length; ci++) {
    var cell = cells[ci];
    cell.seats = [];
    cell.seat = null;
    byCoord[stageCellKey(cell.row, cell.col)] = cell;
  }

  var authoredSeats = stageDef.seats || [];
  for (var si = 0; si < authoredSeats.length; si++) {
    var seatSpec = authoredSeats[si];
    var parentCell = byCoord[stageCellKey(seatSpec.parentRow, seatSpec.parentCol)] || null;
    if (!parentCell) {
      throw new Error('Seat ' + (seatSpec.seatId || ('#' + si)) + ' points to missing parent cell at row=' + seatSpec.parentRow + ' col=' + seatSpec.parentCol + '.');
    }

    var seat = {
      seatId: seatSpec.seatId || ('seat-' + parentCell.id + '-' + si),
      parentCellId: parentCell.id,
      targetMode: seatSpec.targetMode || TARGET_MODE.CUSTOM,
      seatTargetIds: resolveSeatTargetIdsFromSpec(parentCell, seatSpec)
    };

    parentCell.seats.push(seat);
    if (!parentCell.seat) { parentCell.seat = seat; }
  }
}

export function applyStageDefinition(cells, stageDef) {
  var overrideMap = {};
  var i;
  for (i = 0; i < stageDef.cells.length; i++) {
    var authored = stageDef.cells[i];
    var cellKey = stageCellKey(authored.row, authored.col);
    overrideMap[cellKey] = Object.assign({}, overrideMap[cellKey] || {}, authored);
  }

  for (i = 0; i < cells.length; i++) {
    var cell = cells[i];
    var authoredCell = overrideMap[stageCellKey(cell.row, cell.col)] || null;

    cell.state = authoredCell && authoredCell.state ? authoredCell.state : CELL_STATE.LOCKED;
    cell.cellType = authoredCell && authoredCell.cellType ? authoredCell.cellType : CELL_TYPE.BLOCKER;
    cell.obstacleClass = authoredCell && authoredCell.obstacleClass ? authoredCell.obstacleClass : getDefaultObstacleClass(cell.cellType);
    var activationScale = authoredCell && authoredCell.activationScale ? authoredCell.activationScale : getObstacleClassActivationScale(cell.obstacleClass);
    cell.rewardTable = buildRewardTableForCell(authoredCell, cell.cellType, cell.row, cell.obstacleClass);
    var primaryReward = getCellPrimaryReward(cell);
    cell.productiveState = 'none';
    cell.rewardType = primaryReward ? primaryReward.type : null;
    cell.rewardAmount = primaryReward ? primaryReward.amount : 0;
    cell.rewardCollected = false;
    cell.buildingConstructed = authoredCell && authoredCell.buildingConstructed ? true : false;
    cell.buildingType = cell.buildingConstructed ? cell.cellType : null;
    cell.buildingLevel = authoredCell && authoredCell.buildingLevel ? authoredCell.buildingLevel : 0;
    cell.buildingStoredNectar = authoredCell && authoredCell.buildingStoredNectar !== undefined ? authoredCell.buildingStoredNectar : 0;
    cell.buildingCooldown = authoredCell && authoredCell.buildingCooldown !== undefined ? authoredCell.buildingCooldown : 0;
    cell.gateCondition = authoredCell && authoredCell.gateCondition ? authoredCell.gateCondition : null;
    cell.nectarRequired = authoredCell && authoredCell.nectarRequired !== undefined
      ? authoredCell.nectarRequired
      : getDefaultNectarRequirement(cell.row, cell.obstacleClass, cell.cellType);
    cell.nectarStored = authoredCell && authoredCell.nectarStored !== undefined ? authoredCell.nectarStored : 0;
    cell.activationProgress = 0;
    cell.activationRequired = authoredCell && authoredCell.activationRequired !== undefined
      ? authoredCell.activationRequired
      : ((cell.cellType === CELL_TYPE.GATE)
        ? 9999
        : CONFIG.BASE_ACTIVATION_REQUIRED * Math.pow(1.6, cell.row) * activationScale);
    cell.baseProductionRate = authoredCell && authoredCell.productionRate !== undefined
      ? authoredCell.productionRate
      : getDefaultProductionRate(cell.row, cell.cellType);
    cell.productionRate = cell.baseProductionRate;
    cell.conversionRate = cell.baseProductionRate;
    cell.nectarToHoneyRatio = authoredCell && authoredCell.nectarToHoneyRatio !== undefined
      ? authoredCell.nectarToHoneyRatio
      : CONFIG.NECTAR_TO_HONEY_RATIO;
    if (cell.state === CELL_STATE.DORMANT) {
      cell.activationProgress = Math.min(cell.nectarRequired, cell.nectarStored);
    }

    if (authoredCell && authoredCell.revealTargetDirections) {
      cell.revealTargetIds = resolveDirectionIds(cell, authoredCell.revealTargetDirections);
    }
    if (authoredCell && authoredCell.revealTargetIds) {
      cell.revealTargetIds = authoredCell.revealTargetIds.slice();
    }
  }
}

export function initHive() {
  var stageDef = currentStageRef || getCurrentStageDef();
  var cells = [];
  var row;
  var col;
  var pos;
  var cell;

  for (row = 0; row < stageDef.rows; row++) {
    for (col = 0; col < stageDef.cols; col++) {
      pos = cylinderCellPositionRef(row, col);
      cell = {
        id: 'c-' + row + '-' + col,
        row: row,
        col: col,
        directionMap: {},
        neighborIds: [],
        seat: null,
        state: CELL_STATE.LOCKED,
        cellType: CELL_TYPE.BLOCKER,
        obstacleClass: OBSTACLE_CLASS.COMMON,
        productiveState: 'none',
        occupantBeeIds: [],
        activationProgress: 0,
        activationRequired: CONFIG.BASE_ACTIVATION_REQUIRED * Math.pow(1.6, row),
        nectarRequired: 0,
        baseProductionRate: 0,
        productionRate: 0,
        worldPos: { x: pos.x, y: pos.y, z: pos.z },
        theta: pos.theta,
        nectarStored: 0,
        nectarCapacity: CONFIG.NECTAR_CAPACITY,
        nectarType: null,
        honeyStored: 0,
        honeyCapacity: CONFIG.HONEY_CAPACITY,
        conversionProgress: 0,
        conversionRate: 0,
        nectarToHoneyRatio: CONFIG.NECTAR_TO_HONEY_RATIO,
        isReadyToCollect: false,
        rewardTable: [],
        rewardType: null,
        rewardAmount: 0,
        rewardCollected: false,
        buildingConstructed: false,
        buildingType: null,
        buildingLevel: 0,
        buildingStoredNectar: 0,
        buildingCooldown: 0,
        gateUnlocked: false,
        gateCondition: null
      };
      cells.push(cell);
    }
  }

  buildLogicalHexGraph(cells);
  applyStageDefinition(cells, stageDef);
  buildStageSeatGraph(cells, stageDef);
  validateBoardGraph(cells, stageDef);
  stateRef.cells = cells;
  buildCellIndex();
  validateStageAuthoring(cells, stageDef);

  return cells;
}
