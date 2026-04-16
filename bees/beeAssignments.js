import { BEE_ROLE, BEE_STATE, CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { getCellById } from '../board/boardQueries.js';
import { addCellOccupant, cellHasAssignableSeat, ensureDefaultWorkerSeat, getSeatTargetIds, isWorkerSeatCell, removeCellOccupant } from '../board/cellState.js';
import { depositNectarToActiveCell, depositNectarToDormantCell } from '../economy/rewards.js';
import { getBeeGatherRestDuration } from './beeQueries.js';
import { bankPosition, cellHoverPos, randomOffset, travelDuration } from './beeMovement.js';

var pointerRef = null;
var getDebugNeighborsRef = function() { return false; };
var debugSeatNeighborsRef = function() {};
var rejectShakeRef = function() {};
var flashCellRef = function() {};
var setBuildingToastRef = function() {};
var selectBeeRef = function() {};
var getCellWorldPosRef = function() { return null; };

export function setBeeAssignmentsRuntime(runtime) {
  pointerRef = runtime && runtime.pointer ? runtime.pointer : pointerRef;
  getDebugNeighborsRef = runtime && runtime.getDebugNeighbors ? runtime.getDebugNeighbors : getDebugNeighborsRef;
  debugSeatNeighborsRef = runtime && runtime.debugSeatNeighbors ? runtime.debugSeatNeighbors : debugSeatNeighborsRef;
  rejectShakeRef = runtime && runtime.rejectShake ? runtime.rejectShake : rejectShakeRef;
  flashCellRef = runtime && runtime.flashCell ? runtime.flashCell : flashCellRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
  selectBeeRef = runtime && runtime.selectBee ? runtime.selectBee : selectBeeRef;
  getCellWorldPosRef = runtime && runtime.getCellWorldPos ? runtime.getCellWorldPos : getCellWorldPosRef;
}

export function canSeatTargetCell(seatCell, targetCell) {
  if (!seatCell || !targetCell) { return false; }
  if (seatCell.id === targetCell.id) { return false; }
  return getSeatTargetIds(seatCell).indexOf(targetCell.id) !== -1;
}

export function isTargetableFromSeat(seatCell, targetCell) {
  return canSeatTargetCell(seatCell, targetCell);
}

export function pickWorkTarget(bee) {
  if (!bee.seatCellId) { return null; }
  var seatCell = getCellById(bee.seatCellId);
  if (!seatCell) { return null; }

  var candidates = [];
  var seatTargetIds = getSeatTargetIds(seatCell);
  for (var i = 0; i < seatTargetIds.length; i++) {
    var tid = seatTargetIds[i];
    var nb = getCellById(tid);
    if (nb && nb.state === CELL_STATE.OBSTACLE) {
      candidates.push(nb);
    }
  }
  if (candidates.length === 0) { return null; }

  candidates.sort(function(a, b) {
    var aGate = (a.cellType === CELL_TYPE.GATE) ? 1 : 0;
    var bGate = (b.cellType === CELL_TYPE.GATE) ? 1 : 0;
    if (aGate !== bGate) { return bGate - aGate; }
    if (a.row !== b.row) { return b.row - a.row; }
    return a.activationProgress - b.activationProgress;
  });
  return candidates[0];
}

export function releaseWorkTarget(bee) {
  if (bee.workTargetCellId !== null) {
    var wc = getCellById(bee.workTargetCellId);
    if (wc) { removeCellOccupant(wc, bee.id); }
    bee.workTargetCellId = null;
  }
}

export function setBeeGathererRole(bee, immediateTravelHome) {
  if (!bee) { return; }
  releaseWorkTarget(bee);
  if (bee.seatCellId !== null) {
    var sc = getCellById(bee.seatCellId);
    if (sc) { removeCellOccupant(sc, bee.id); }
  }
  bee.role = BEE_ROLE.GATHERER;
  bee.isWorker = false;
  bee.seatCellId = null;
  bee.targetCellId = null;
  bee.workTargetCellId = null;
  bee.forcedWorkTarget = null;
  bee.landedTheta = null;
  bee.carryNectar = 0;
  bee.gatherPhase = 'resting';
  bee.state = BEE_STATE.IDLE;

  if (immediateTravelHome) {
    var homePos = bankPosition(bee.id).add(randomOffset());
    bee.origin.copy(bee.pos);
    bee.targetPos.copy(homePos);
    bee.travelT = 0;
    bee.travelDur = travelDuration(bee.pos, homePos);
    bee.idleTimer = 0.25;
  } else {
    bee.pos.copy(bankPosition(bee.id).add(randomOffset()));
    bee.origin.copy(bee.pos);
    bee.targetPos.copy(bee.pos);
    bee.travelT = 1.0;
    bee.travelDur = 0.0001;
    bee.idleTimer = getBeeGatherRestDuration(bee.level) * (0.65 + Math.random() * 0.35);
  }
}

export function setBeeWorkerRole(bee) {
  if (!bee) { return; }
  bee.role = BEE_ROLE.WORKER;
  bee.isWorker = true;
  bee.gatherPhase = null;
  bee.carryNectar = 0;
}

export function beeCanWorkTargetCell(bee, targetCell) {
  if (!bee || bee.seatCellId === null || !targetCell) { return false; }
  if (bee.state !== BEE_STATE.IDLE_ON_SEAT && bee.state !== BEE_STATE.WORKING) { return false; }

  var seatCell = getCellById(bee.seatCellId);
  return getSeatTargetIds(seatCell).indexOf(targetCell.id) !== -1;
}

export function assignBeeToCell(bee, cell) {
  if (cell.state === CELL_STATE.LOCKED) {
    rejectShakeRef(bee);
    setBuildingToastRef('Cell is still locked', 1.5);
    return;
  }
  if (isWorkerSeatCell(cell)) {
    ensureDefaultWorkerSeat(cell);
    if (!cellHasAssignableSeat(cell)) {
      rejectShakeRef(bee);
      setBuildingToastRef('No seat on this cell', 1.5);
      return;
    }
    if (bee.seatCellId !== null) {
      var prevSeat = getCellById(bee.seatCellId);
      if (prevSeat) { removeCellOccupant(prevSeat, bee.id); }
    }
    var carriedNectar = (bee.role === BEE_ROLE.GATHERER) ? (bee.carryNectar || 0) : 0;
    var depositedNectar = 0;
    if (carriedNectar > 0) {
      if (cell.state === CELL_STATE.DORMANT) {
        var seatedDormantDeposit = depositNectarToDormantCell(cell, carriedNectar, 'wildflower');
        depositedNectar = seatedDormantDeposit.used;
        carriedNectar = seatedDormantDeposit.leftover;
      } else if (cell.state === CELL_STATE.ACTIVE) {
        var seatedActiveDeposit = depositNectarToActiveCell(cell, carriedNectar, 'wildflower');
        depositedNectar = seatedActiveDeposit.used;
        carriedNectar = seatedActiveDeposit.leftover;
      }
      bee.carryNectar = carriedNectar;
    }
    releaseWorkTarget(bee);
    bee.seatCellId = cell.id;
    setBeeWorkerRole(bee);
    addCellOccupant(cell, bee.id);
    if (getDebugNeighborsRef()) { debugSeatNeighborsRef(cell); }
    var seatPos = cellHoverPos(cell);
    var instantSeatDrop = (pointerRef.dragMode === 'bee_assign' && pointerRef.moved);
    if (instantSeatDrop) {
      bee.pos.copy(seatPos);
      bee.origin.copy(seatPos);
      bee.targetPos.copy(seatPos);
      bee.travelT = 1.0;
      bee.travelDur = 0.0001;
      bee.landedTheta = cell.theta;
      bee.state = BEE_STATE.IDLE_ON_SEAT;
      bee.idleTimer = 0.05;
    } else {
      bee.origin.copy(bee.pos);
      bee.targetPos.copy(seatPos);
      bee.travelT = 0;
      bee.travelDur = travelDuration(bee.pos, seatPos);
      bee.state = BEE_STATE.MOVING_TO_SEAT;
    }
    flashCellRef(cell.id, 0xffee44);
    if (depositedNectar > 0) {
      setBuildingToastRef(
        (cell.state === CELL_STATE.DORMANT)
          ? 'Bee seated + ' + Math.floor(depositedNectar) + ' nectar deposited'
          : 'Bee assigned + ' + Math.floor(depositedNectar) + ' nectar delivered',
        1.2
      );
    } else {
      setBuildingToastRef((cell.state === CELL_STATE.DORMANT) ? 'Bee seated - waiting for nectar' : 'Bee assigned to seat', 1.2);
    }
    selectBeeRef(null);
    return;
  }
  if (cell.state === CELL_STATE.OBSTACLE) {
    if (beeCanWorkTargetCell(bee, cell)) {
      if (bee.workTargetCellId === cell.id) {
        flashCellRef(cell.id, 0xff9900);
        selectBeeRef(null);
        return;
      }
      if (bee.workTargetCellId !== null) {
        var oldTarget = getCellById(bee.workTargetCellId);
        if (oldTarget) { removeCellOccupant(oldTarget, bee.id); }
        bee.workTargetCellId = null;
      }
      addCellOccupant(cell, bee.id);
      bee.workTargetCellId = cell.id;
      bee.forcedWorkTarget = null;
      bee.state = BEE_STATE.WORKING;
      flashCellRef(cell.id, 0xff9900);
      setBuildingToastRef('Bee retargeted', 1.2);
      selectBeeRef(null);
    } else {
      rejectShakeRef(bee);
      setBuildingToastRef('Seat cannot reach this obstacle', 1.5);
      flashCellRef(cell.id, 0xff2200);
    }
    return;
  }
  if (cell.state === CELL_STATE.DORMANT) {
    rejectShakeRef(bee);
    setBuildingToastRef('No worker seat on this dormant cell', 1.5);
    return;
  }
  rejectShakeRef(bee);
}

export function captureMergeAssignment(bee) {
  if (!bee || !bee.isWorker || !bee.seatCellId) { return null; }
  return {
    seatCellId: bee.seatCellId,
    workTargetCellId: bee.workTargetCellId,
    state: bee.state
  };
}

export function applyMergeAssignment(bee, assignment, options) {
  if (!bee || !assignment || !assignment.seatCellId) { return false; }
  var assignOptions = options || {};

  var seatCell = getCellById(assignment.seatCellId);
  if (!seatCell || !isWorkerSeatCell(seatCell)) { return false; }
  ensureDefaultWorkerSeat(seatCell);

  setBeeWorkerRole(bee);
  bee.seatCellId = seatCell.id;
  bee.workTargetCellId = null;
  bee.forcedWorkTarget = null;
  addCellOccupant(seatCell, bee.id);

  var seatPos = assignOptions.anchorWorldPos ? assignOptions.anchorWorldPos.clone() : getCellWorldPosRef(seatCell);
  bee.pos.copy(seatPos);
  bee.origin.copy(seatPos);
  bee.targetPos.copy(seatPos);
  bee.travelT = 1.0;
  bee.travelDur = 0.0001;
  bee.landedTheta = seatCell.theta;
  bee.idleTimer = 0.05;
  if (assignOptions.anchorWorldPos) { bee.mergeAnchorPos.copy(assignOptions.anchorWorldPos); }

  var targetCell = assignment.workTargetCellId ? getCellById(assignment.workTargetCellId) : null;
  if (targetCell && targetCell.state === CELL_STATE.OBSTACLE && getSeatTargetIds(seatCell).indexOf(targetCell.id) !== -1) {
    bee.workTargetCellId = targetCell.id;
    addCellOccupant(targetCell, bee.id);
    bee.state = BEE_STATE.WORKING;
  } else {
    bee.state = BEE_STATE.IDLE_ON_SEAT;
  }
  return true;
}
