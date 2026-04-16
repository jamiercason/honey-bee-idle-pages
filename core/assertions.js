import { getSeatTargetIds, isWorkerSeatCell } from '../board/cellState.js';
import { CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { getGameCurrentStage, getGameSelectedBeeId, getGameState } from './selectors.js';

var warned = {};

function warnOnce(key, message) {
  if (warned[key]) { return; }
  warned[key] = true;
  console.warn('[assert]', message);
}

function getCellById(state, cellId) {
  if (!state || cellId === null || cellId === undefined) { return null; }
  for (var ci = 0; ci < state.cells.length; ci++) {
    if (state.cells[ci].id === cellId) { return state.cells[ci]; }
  }
  return null;
}

export function assertSelectedBeeExists(game) {
  var state = getGameState(game);
  var selectedBeeId = getGameSelectedBeeId(game);
  if (!state || selectedBeeId === null) { return; }
  for (var bi = 0; bi < state.bees.length; bi++) {
    if (state.bees[bi].id === selectedBeeId) { return; }
  }
  warnOnce('selected-bee:' + selectedBeeId, 'Selected bee #' + selectedBeeId + ' is missing from state.bees');
}

export function assertLockedCellsHaveNoOccupants(game) {
  var state = getGameState(game);
  if (!state) { return; }
  for (var ci = 0; ci < state.cells.length; ci++) {
    var cell = state.cells[ci];
    if (cell.state === CELL_STATE.LOCKED && cell.occupantBeeIds && cell.occupantBeeIds.length > 0) {
      warnOnce('locked-cell:' + cell.id, 'Locked cell ' + cell.id + ' still has occupants');
    }
  }
}

export function assertSeatAssignmentsRemainValid(game) {
  var state = getGameState(game);
  if (!state) { return; }
  for (var bi = 0; bi < state.bees.length; bi++) {
    var bee = state.bees[bi];
    if (bee.seatCellId === null) { continue; }

    var seatCell = getCellById(state, bee.seatCellId);
    if (!seatCell) {
      warnOnce('seat-missing:' + bee.id, 'Bee #' + bee.id + ' references missing seat cell ' + bee.seatCellId);
      continue;
    }
    if (!isWorkerSeatCell(seatCell)) {
      warnOnce('seat-invalid:' + bee.id + ':' + seatCell.id, 'Bee #' + bee.id + ' is seated on non-worker cell ' + seatCell.id);
    }
    if (!seatCell.occupantBeeIds || seatCell.occupantBeeIds.indexOf(bee.id) === -1) {
      warnOnce('seat-occupant-missing:' + bee.id + ':' + seatCell.id, 'Seat cell ' + seatCell.id + ' is missing occupant record for bee #' + bee.id);
    }
  }
}

export function assertBeeWorkTargetsReachable(game) {
  var state = getGameState(game);
  if (!state) { return; }
  for (var bi = 0; bi < state.bees.length; bi++) {
    var bee = state.bees[bi];
    if (bee.workTargetCellId === null) { continue; }

    var seatCell = getCellById(state, bee.seatCellId);
    if (!seatCell) {
      warnOnce('work-target-seat-missing:' + bee.id, 'Bee #' + bee.id + ' has work target ' + bee.workTargetCellId + ' without a valid seat');
      continue;
    }

    var targetCell = getCellById(state, bee.workTargetCellId);
    if (!targetCell) {
      warnOnce('work-target-missing:' + bee.id + ':' + bee.workTargetCellId, 'Bee #' + bee.id + ' references missing work target ' + bee.workTargetCellId);
      continue;
    }
    if (targetCell.state !== CELL_STATE.OBSTACLE) {
      warnOnce('work-target-state:' + bee.id + ':' + targetCell.id, 'Bee #' + bee.id + ' is targeting non-obstacle cell ' + targetCell.id);
    }
    if (getSeatTargetIds(seatCell).indexOf(targetCell.id) === -1) {
      warnOnce('work-target-unreachable:' + bee.id + ':' + targetCell.id, 'Bee #' + bee.id + ' cannot legally reach target cell ' + targetCell.id + ' from seat ' + seatCell.id);
    }
    if (!targetCell.occupantBeeIds || targetCell.occupantBeeIds.indexOf(bee.id) === -1) {
      warnOnce('work-target-occupant-missing:' + bee.id + ':' + targetCell.id, 'Target cell ' + targetCell.id + ' is missing occupant record for bee #' + bee.id);
    }
  }
}

export function assertGateProgressionState(game) {
  var state = getGameState(game);
  var currentStage = getGameCurrentStage(game);
  if (!state || !currentStage) { return; }
  if (state.stageId !== currentStage.id) {
    warnOnce('stage-id', 'State stageId ' + state.stageId + ' does not match current stage ' + currentStage.id);
  }
  if (state.levelComplete && !state.gateReady) {
    warnOnce('level-complete-without-gate-ready', 'Level is complete while gateReady is false');
  }

  var gateCount = 0;
  var lockedGateCount = 0;
  var obstacleGateCount = 0;
  var activeGateCount = 0;
  for (var ci = 0; ci < state.cells.length; ci++) {
    var cell = state.cells[ci];
    if (cell.cellType !== CELL_TYPE.GATE) { continue; }
    gateCount += 1;
    if (cell.state === CELL_STATE.LOCKED) { lockedGateCount += 1; }
    else if (cell.state === CELL_STATE.OBSTACLE) { obstacleGateCount += 1; }
    else if (cell.state === CELL_STATE.ACTIVE) { activeGateCount += 1; }
  }
  if (gateCount === 0) { return; }

  if (!state.levelComplete && !state.gateReady && obstacleGateCount > 0) {
    warnOnce('gate-exposed-before-ready', 'Gate cells are exposed while gateReady is false');
  }
  if (!state.levelComplete && !state.gateReady && activeGateCount > 0) {
    warnOnce('gate-cleared-before-ready', 'Gate cells are active while gateReady is false');
  }
  if (!state.levelComplete && state.gateReady && lockedGateCount > 0) {
    warnOnce('gate-ready-still-locked', 'Gate cells remain locked while gateReady is true');
  }
  if (state.levelComplete && activeGateCount !== gateCount) {
    warnOnce('level-complete-gates-not-active', 'Level is complete while some gate cells are not ACTIVE');
  }
}

export function runConservativeAssertions(game) {
  assertSelectedBeeExists(game);
  assertSeatAssignmentsRemainValid(game);
  assertBeeWorkTargetsReachable(game);
  assertLockedCellsHaveNoOccupants(game);
  assertGateProgressionState(game);
}
