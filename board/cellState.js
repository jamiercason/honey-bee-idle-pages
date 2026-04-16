import { CONFIG } from '../config/config.js';
import { TARGET_MODE, BOOST_TYPE, CELL_STATE, OBSTACLE_CLASS, CELL_TYPE } from '../data/enums.js';
import { BOARD_DIRECTIONS } from './boardGraph.js';

export function getDefaultObstacleClass(cellType) {
  if (cellType === CELL_TYPE.REWARD_BLOCKER) { return OBSTACLE_CLASS.TREASURE; }
  if (cellType === CELL_TYPE.HATCHERY || cellType === CELL_TYPE.PROCESSOR || cellType === CELL_TYPE.BUILDING_LOT) { return OBSTACLE_CLASS.STRUCTURE; }
  return OBSTACLE_CLASS.COMMON;
}

export function getObstacleClassActivationScale(obstacleClass) {
  switch (obstacleClass) {
    case OBSTACLE_CLASS.HEAVY: return 1.35;
    case OBSTACLE_CLASS.TREASURE: return 1.10;
    case OBSTACLE_CLASS.STRUCTURE: return 1.20;
    case OBSTACLE_CLASS.COMMON:
    default: return 1.0;
  }
}

export function buildRewardTableForCell(authoredCell, cellType, row, obstacleClass) {
  if (cellType === CELL_TYPE.OPEN || cellType === CELL_TYPE.GATE) { return []; }
  if (authoredCell && authoredCell.rewardTable) {
    return authoredCell.rewardTable.map(function(entry) {
      return { type: entry.type, amount: entry.amount };
    });
  }
  if (authoredCell && authoredCell.rewardType && authoredCell.rewardAmount) {
    return [{ type: authoredCell.rewardType, amount: authoredCell.rewardAmount }];
  }

  var baseByRow = 4 + row * 2;
  switch (obstacleClass) {
    case OBSTACLE_CLASS.HEAVY:
      return [{ type: 'honey', amount: 8 + row * 3 }];
    case OBSTACLE_CLASS.TREASURE:
      return [
        { type: 'honey', amount: 12 + row * 4 },
        { type: BOOST_TYPE.ROYAL_JELLY, amount: 1 }
      ];
    case OBSTACLE_CLASS.STRUCTURE:
      return [{ type: 'honey', amount: 6 + row * 2 }];
    case OBSTACLE_CLASS.COMMON:
    default:
      return [{ type: 'honey', amount: baseByRow }];
  }
}

export function getDefaultNectarRequirement(row, obstacleClass, cellType) {
  if (cellType === CELL_TYPE.GATE || row < 3) { return 0; }
  var base = CONFIG.ACTIVATION_NECTAR_BASE + Math.max(0, row - 3) * CONFIG.ACTIVATION_NECTAR_ROW_STEP;
  if (obstacleClass === OBSTACLE_CLASS.STRUCTURE) { return base + 2; }
  if (obstacleClass === OBSTACLE_CLASS.TREASURE) { return base + 1; }
  return base;
}

export function getDefaultProductionRate(row, cellType) {
  if (cellType !== CELL_TYPE.OPEN) { return 0; }
  return CONFIG.CONVERSION_RATE + row * CONFIG.CONVERSION_ROW_BONUS;
}

export function getPrimarySeat(cell) {
  return cell && cell.seat ? cell.seat : null;
}

export function getCellSeats(cell) {
  return cell && cell.seats ? cell.seats : [];
}

export function getSeatTargetIds(cell) {
  var seat = getPrimarySeat(cell);
  return seat ? seat.seatTargetIds : [];
}

export function cellHasAssignableSeat(cell) {
  return getCellSeats(cell).length > 0;
}

export function isWorkerSeatCell(cell) {
  return !!(cell &&
    cell.cellType === CELL_TYPE.OPEN &&
    (cell.state === CELL_STATE.DORMANT || cell.state === CELL_STATE.ACTIVE));
}

export function addCellOccupant(cell, beeId) {
  if (!cell) { return; }
  if (!cell.occupantBeeIds) { cell.occupantBeeIds = []; }
  if (cell.occupantBeeIds.indexOf(beeId) === -1) { cell.occupantBeeIds.push(beeId); }
}

export function removeCellOccupant(cell, beeId) {
  if (!cell || !cell.occupantBeeIds) { return; }
  var idx = cell.occupantBeeIds.indexOf(beeId);
  if (idx !== -1) { cell.occupantBeeIds.splice(idx, 1); }
}

export function hasCellOccupants(cell) {
  return !!(cell && cell.occupantBeeIds && cell.occupantBeeIds.length > 0);
}

export function getCellDirectionId(cell, direction) {
  return cell && cell.directionMap ? (cell.directionMap[direction] || null) : null;
}

export function resolveDirectionIds(cell, directions) {
  var resolved = [];
  if (!cell || !directions) { return resolved; }
  for (var i = 0; i < directions.length; i++) {
    var dirName = directions[i];
    var targetId = getCellDirectionId(cell, dirName);
    if (targetId !== null && resolved.indexOf(targetId) === -1) {
      resolved.push(targetId);
    }
  }
  return resolved;
}

export function getRevealTargetIds(cell) {
  if (!cell) { return []; }
  if (cell.revealTargetIds && cell.revealTargetIds.length > 0) { return cell.revealTargetIds; }
  return cell.neighborIds || [];
}

export function getCellPrimaryReward(cell) {
  if (!cell || !cell.rewardTable || cell.rewardTable.length === 0) { return null; }
  return cell.rewardTable[0];
}

export function getDirectionsForTargetMode(targetMode) {
  switch (targetMode) {
    case TARGET_MODE.ALL6:
      return BOARD_DIRECTIONS.slice();
    case TARGET_MODE.ARC_A:
      return ['NW', 'W', 'SW'];
    case TARGET_MODE.ARC_B:
      return ['NE', 'E', 'SE'];
    case TARGET_MODE.CUSTOM:
    default:
      return [];
  }
}

export function resolveSeatTargetIdsFromSpec(parentCell, seatSpec) {
  var resolved = [];
  if (!parentCell || !seatSpec) { return resolved; }

  var targetDirections = [];
  if (seatSpec.targetMode && seatSpec.targetMode !== TARGET_MODE.CUSTOM) {
    targetDirections = getDirectionsForTargetMode(seatSpec.targetMode);
  }
  if (seatSpec.targetDirections) {
    targetDirections = seatSpec.targetDirections.slice();
  }
  if (targetDirections.length > 0) {
    resolved = resolveDirectionIds(parentCell, targetDirections);
  }
  if (seatSpec.targetIds) {
    for (var i = 0; i < seatSpec.targetIds.length; i++) {
      if (resolved.indexOf(seatSpec.targetIds[i]) === -1) {
        resolved.push(seatSpec.targetIds[i]);
      }
    }
  }
  return resolved;
}

export function ensureDefaultWorkerSeat(cell) {
  if (!cell || cell.cellType !== CELL_TYPE.OPEN) { return null; }
  if (!cell.seats) { cell.seats = []; }
  if (cell.seats.length > 0 && cell.seat) { return cell.seat; }

  var seat = {
    seatId: 'auto-seat-' + cell.id,
    parentCellId: cell.id,
    targetMode: TARGET_MODE.ALL6,
    seatTargetIds: resolveDirectionIds(cell, getDirectionsForTargetMode(TARGET_MODE.ALL6))
  };

  cell.seats.push(seat);
  cell.seat = seat;
  return seat;
}
