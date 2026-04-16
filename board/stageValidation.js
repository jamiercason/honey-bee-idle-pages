import { TARGET_MODE, CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { BOARD_DIRECTIONS, OPPOSITE_DIRECTION } from './boardGraph.js';
import { getCellById } from './boardQueries.js';
import {
  getCellDirectionId,
  getRevealTargetIds,
  isWorkerSeatCell,
  cellHasAssignableSeat,
  getSeatTargetIds,
  getDirectionsForTargetMode,
  resolveDirectionIds
} from './cellState.js';

var isRequiredStructureCellRef = function() { return false; };

export function setStageValidationRuntime(runtime) {
  isRequiredStructureCellRef = runtime && runtime.isRequiredStructureCell ? runtime.isRequiredStructureCell : isRequiredStructureCellRef;
}

export function validateBoardGraph(cells, stageDef) {
  var expectedCellCount = stageDef.rows * stageDef.cols;
  var issues = [];
  var seenIds = {};

  if (cells.length !== expectedCellCount) {
    issues.push('Expected ' + expectedCellCount + ' cells but built ' + cells.length + '.');
  }

  for (var i = 0; i < cells.length; i++) {
    var cell = cells[i];
    if (seenIds[cell.id]) {
      issues.push('Duplicate cell id: ' + cell.id);
      continue;
    }
    seenIds[cell.id] = true;

    var expectedNeighborCount = (cell.row === 0 || cell.row === stageDef.rows - 1) ? 4 : 6;
    if (cell.neighborIds.length !== expectedNeighborCount) {
      issues.push('Cell ' + cell.id + ' has ' + cell.neighborIds.length + ' neighbors, expected ' + expectedNeighborCount + '.');
    }

    for (var d = 0; d < BOARD_DIRECTIONS.length; d++) {
      var dirName = BOARD_DIRECTIONS[d];
      var targetId = getCellDirectionId(cell, dirName);
      if (targetId === null) { continue; }
      var targetCell = null;
      for (var ci = 0; ci < cells.length; ci++) {
        if (cells[ci].id === targetId) {
          targetCell = cells[ci];
          break;
        }
      }
      if (!targetCell) {
        issues.push('Cell ' + cell.id + ' points to missing target ' + targetId + ' in direction ' + dirName + '.');
        continue;
      }
      var opposite = OPPOSITE_DIRECTION[dirName];
      if (getCellDirectionId(targetCell, opposite) !== cell.id) {
        issues.push('Cell ' + cell.id + ' and ' + targetCell.id + ' are not reciprocal for ' + dirName + '/' + opposite + '.');
      }
    }
  }

  if (issues.length > 0) {
    throw new Error('Board graph validation failed:\n- ' + issues.join('\n- '));
  }
}

export function validateStageAuthoring(cells, stageDef) {
  var issues = [];
  var activeSeatCells = [];
  var targetableObstacleIds = {};
  var hasProgressReveal = false;
  var hasGateCell = false;

  if ((stageDef.beeStartCount || 0) < 2) {
    issues.push('Stage must start with at least 2 bees for an opening merge opportunity.');
  }

  for (var ci = 0; ci < cells.length; ci++) {
    var cell = cells[ci];
    if (cell.cellType === CELL_TYPE.GATE) { hasGateCell = true; }
    if (isWorkerSeatCell(cell) && cellHasAssignableSeat(cell)) {
      activeSeatCells.push(cell);
      var seatTargets = getSeatTargetIds(cell);
      for (var ti = 0; ti < seatTargets.length; ti++) {
        var targetCell = getCellById(seatTargets[ti]);
        if (targetCell && targetCell.state === CELL_STATE.OBSTACLE) {
          targetableObstacleIds[targetCell.id] = true;
        }
      }
    }
  }

  if (activeSeatCells.length === 0) {
    issues.push('Stage must expose at least one active cell with an authored seat.');
  }

  var targetableObstacleCells = Object.keys(targetableObstacleIds);
  if (targetableObstacleCells.length === 0) {
    issues.push('Stage opening must include at least one obstacle target reachable from an active seat.');
  }

  for (var di = 0; di < targetableObstacleCells.length; di++) {
    var obstacleCell = getCellById(targetableObstacleCells[di]);
    var revealIds = getRevealTargetIds(obstacleCell);
    for (var ri = 0; ri < revealIds.length; ri++) {
      var revealCell = getCellById(revealIds[ri]);
      if (revealCell && revealCell.state === CELL_STATE.LOCKED && revealCell.cellType !== CELL_TYPE.GATE) {
        hasProgressReveal = true;
        break;
      }
    }
    if (hasProgressReveal) { break; }
  }

  if (!hasProgressReveal) {
    issues.push('Stage opening must include a clear progression route from an initial obstacle target into a future locked cell.');
  }

  if (!hasGateCell) {
    issues.push('Stage must include at least one gate cell.');
  }

  var reachableIds = getStageReachableCellIds(cells);
  var gateSeatCellIds = {};
  for (var ci2 = 0; ci2 < cells.length; ci2++) {
    var reachCell = cells[ci2];
    if (isRequiredStructureCellRef(reachCell) && reachableIds.indexOf(reachCell.id) === -1) {
      issues.push('Required structure at row=' + reachCell.row + ' col=' + reachCell.col + ' is not reachable from the authored reveal chain.');
    }
  }

  for (var gi = 0; gi < cells.length; gi++) {
    var gateCell = cells[gi];
    if (gateCell.cellType !== CELL_TYPE.GATE) { continue; }
    var seatCount = 0;
    for (var si2 = 0; si2 < cells.length; si2++) {
      var seatCandidate = cells[si2];
      if (reachableIds.indexOf(seatCandidate.id) === -1) { continue; }
      if (!canCellEventuallyBecomeWorkerSeat(seatCandidate)) { continue; }
      if (getFutureSeatTargetIds(seatCandidate).indexOf(gateCell.id) === -1) { continue; }
      gateSeatCellIds[seatCandidate.id] = true;
      seatCount += 1;
    }
    if (seatCount === 0) {
      issues.push('Gate at row=' + gateCell.row + ' col=' + gateCell.col + ' has no reachable future worker seat.');
    }
  }

  if (Object.keys(gateSeatCellIds).length < 3) {
    issues.push('Stage should expose at least 3 distinct reachable worker seats that can pressure the gate cluster.');
  }

  if (issues.length > 0) {
    throw new Error('Stage authoring validation failed:\n- ' + issues.join('\n- '));
  }
}

export function canCellEventuallyBecomeWorkerSeat(cell) {
  if (!cell) { return false; }
  return cell.cellType === CELL_TYPE.OPEN || cell.cellType === CELL_TYPE.BLOCKER || cell.cellType === CELL_TYPE.REWARD_BLOCKER;
}

export function getFutureSeatTargetIds(cell) {
  if (!cell) { return []; }
  if (cellHasAssignableSeat(cell)) { return getSeatTargetIds(cell); }
  if (!canCellEventuallyBecomeWorkerSeat(cell)) { return []; }
  return resolveDirectionIds(cell, getDirectionsForTargetMode(TARGET_MODE.ALL6));
}

export function getStageReachableCellIds(cells) {
  var reachable = [];
  var queue = [];
  var seen = {};

  for (var ci = 0; ci < cells.length; ci++) {
    var cell = cells[ci];
    if (cell.state !== CELL_STATE.LOCKED && cell.cellType !== CELL_TYPE.GATE) {
      queue.push(cell.id);
      seen[cell.id] = true;
      reachable.push(cell.id);
    }
  }

  while (queue.length > 0) {
    var cellId = queue.shift();
    var src = getCellById(cellId);
    if (!src || src.cellType === CELL_TYPE.GATE) { continue; }
    var revealIds = getRevealTargetIds(src);
    for (var ri = 0; ri < revealIds.length; ri++) {
      var rid = revealIds[ri];
      var target = getCellById(rid);
      if (!target || target.cellType === CELL_TYPE.GATE || seen[rid]) { continue; }
      seen[rid] = true;
      reachable.push(rid);
      queue.push(rid);
    }
  }

  return reachable;
}
