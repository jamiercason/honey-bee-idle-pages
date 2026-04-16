import { BOOST_TYPE, CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { isWorkerSeatCell } from '../board/cellState.js';
import { getRoyalRushStacks, registerRoyalRush } from '../economy/boosts.js';
import { grantCellReward } from '../economy/rewards.js';
import { tryBuildOrUpgrade } from '../economy/buildings.js';
import { evaluateGateConditions } from '../economy/gates.js';
import { getSelectedBee } from '../bees/beeQueries.js';
import { assignBeeToCell, setBeeGathererRole } from '../bees/beeAssignments.js';
import { mergeBees } from '../bees/beeMerging.js';
import { refreshCellMaterial } from '../scene/materials.js';
import { updateBoostGhost } from '../ui/summonBar.js';
import { BOOST_TARGET_TOLERANCE_PX, POINTER_INTENT_STATE } from '../config/inputConfig.js';
import { longPressState, pointer } from './inputState.js';
import { getBeeNearScreen, getCellAtScreen } from './raycast.js';
import { pickFreshBeeCandidate, resolveActiveDragTargets, resolveReleaseTarget } from './targeting.js';

var THREE = globalThis.THREE;

var stateRef = null;
var getCameraRef = function() { return null; };
var setBuildingToastRef = function() {};
var selectBeeRef = function() {};
var rejectShakeRef = function() {};
var flashCellRef = function() {};
var markCameraInteractionRef = function() {};
var applyRoyalJellyToBeeRef = function() { return false; };

var dragPreviewNDC = new THREE.Vector3();
var dragPreviewTowardCamera = new THREE.Vector3();

export function setInteractionsRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getCameraRef = runtime && runtime.getCamera ? runtime.getCamera : getCameraRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
  selectBeeRef = runtime && runtime.selectBee ? runtime.selectBee : selectBeeRef;
  rejectShakeRef = runtime && runtime.rejectShake ? runtime.rejectShake : rejectShakeRef;
  flashCellRef = runtime && runtime.flashCell ? runtime.flashCell : flashCellRef;
  markCameraInteractionRef = runtime && runtime.markCameraInteraction ? runtime.markCameraInteraction : markCameraInteractionRef;
  applyRoyalJellyToBeeRef = runtime && runtime.applyRoyalJellyToBee ? runtime.applyRoyalJellyToBee : applyRoyalJellyToBeeRef;
}

function applyResolvedDragHover(resolved) {
  pointer.resolvedDragTarget = resolved;
  pointer.dragHoverBeeId = resolved && resolved.mergeCandidate ? resolved.mergeCandidate.bee.id : null;
  if (resolved && resolved.cellCandidate) {
    pointer.dragHoverCellId = resolved.cellCandidate.cell.id;
  } else if (resolved && resolved.directFallback) {
    pointer.dragHoverCellId = resolved.directFallback.cell.id;
  } else {
    pointer.dragHoverCellId = null;
  }

  if (resolved && resolved.mergeCandidate) {
    pointer.dragHoverTargetKind = 'merge';
  } else if (resolved && resolved.cellCandidate) {
    pointer.dragHoverTargetKind = 'cell';
  } else if (resolved && resolved.directFallback) {
    pointer.dragHoverTargetKind = 'direct_cell';
  } else {
    pointer.dragHoverTargetKind = null;
  }
}

export function beginBoostDrag(boostType, x, y) {
  if (boostType === BOOST_TYPE.ROYAL_JELLY && (!stateRef.boosts || stateRef.boosts.royal_jelly <= 0)) { return; }
  if (longPressState.timer !== null) {
    clearTimeout(longPressState.timer);
    longPressState.timer = null;
  }
  pointer.active = true;
  pointer.moved = true;
  pointer.intentState = POINTER_INTENT_STATE.LOCKED_BOOST_DRAG;
  pointer.dragMode = 'boost_drag';
  pointer.dragBoostType = boostType;
  pointer.dragHoverBeeId = null;
  pointer.dragHoverCellId = null;
  pointer.dragHoverTargetKind = null;
  pointer.dragVisualPos = null;
  pointer.resolvedDragTarget = null;
  pointer.edgeRotateDir = 0;
  pointer.edgeRotateTimer = 0;
  pointer.startX = x;
  pointer.startY = y;
  pointer.lastX = x;
  pointer.lastY = y;
  pointer.deltaX = 0;
  pointer.deltaY = 0;
  updateBoostDragInteraction(x, y);
}

export function updateBeeDragPreviewPos(bee, screenX, screenY) {
  if (!bee) {
    pointer.dragVisualPos = null;
    return null;
  }

  var camera = getCameraRef();
  if (!pointer.dragVisualPos) { pointer.dragVisualPos = new THREE.Vector3(); }
  dragPreviewNDC.copy(bee.pos).project(camera);
  dragPreviewNDC.x = (screenX / window.innerWidth) * 2 - 1;
  dragPreviewNDC.y = -(screenY / window.innerHeight) * 2 + 1;
  pointer.dragVisualPos.copy(dragPreviewNDC).unproject(camera);

  dragPreviewTowardCamera.copy(camera.position).sub(pointer.dragVisualPos);
  if (dragPreviewTowardCamera.lengthSq() > 0.0001) {
    dragPreviewTowardCamera.normalize();
    pointer.dragVisualPos.addScaledVector(dragPreviewTowardCamera, 0.18);
  }
  return pointer.dragVisualPos;
}

export function updateBeeDragInteraction(bee, screenX, screenY) {
  if (!bee) {
    pointer.dragHoverBeeId = null;
    pointer.dragHoverCellId = null;
    pointer.dragHoverTargetKind = null;
    pointer.resolvedDragTarget = null;
    pointer.edgeRotateDir = 0;
    pointer.edgeRotateTimer = 0;
    pointer.dragVisualPos = null;
    return;
  }

  applyResolvedDragHover(resolveActiveDragTargets(bee, screenX, screenY));
  updateBeeDragPreviewPos(bee, screenX, screenY);
}

export function updateBoostDragInteraction(screenX, screenY) {
  pointer.dragHoverCellId = null;
  pointer.dragHoverTargetKind = null;
  var hoverBee = getBeeNearScreen(screenX, screenY, null, BOOST_TARGET_TOLERANCE_PX);
  pointer.dragHoverBeeId = hoverBee ? hoverBee.id : null;
  pointer.dragGhostX = screenX;
  pointer.dragGhostY = screenY;
  updateBoostGhost(screenX, screenY);
}

export function applyBoostDragDrop(screenX, screenY) {
  if (pointer.dragBoostType === BOOST_TYPE.ROYAL_JELLY) {
    var hitBee = getBeeNearScreen(screenX, screenY, null, BOOST_TARGET_TOLERANCE_PX);
    if (hitBee) {
      applyRoyalJellyToBeeRef(hitBee);
      return;
    }
    setBuildingToastRef('Drop jelly on a bee', 1.5);
  }
}

export function applySelectedBeeDragDrop(screenX, screenY) {
  var selectedBee = getSelectedBee();
  if (!selectedBee) { return; }

  var resolvedTarget = resolveReleaseTarget(selectedBee, screenX, screenY);
  pointer.resolvedDragTarget = resolvedTarget;

  if (resolvedTarget && resolvedTarget.kind === 'merge') {
    if (resolvedTarget.bee.level === selectedBee.level) {
      mergeBees(selectedBee, resolvedTarget.bee);
      return;
    }
    rejectShakeRef(selectedBee);
    setBuildingToastRef('Merge requires matching levels', 1.6);
    return;
  }

  if (resolvedTarget && (resolvedTarget.kind === 'cell' || resolvedTarget.kind === 'direct_cell')) {
    assignBeeToCell(selectedBee, resolvedTarget.cell);
    return;
  }

  if (selectedBee.isWorker && selectedBee.seatCellId !== null) {
    setBeeGathererRole(selectedBee, true);
    setBuildingToastRef('Bee switched to gatherer', 1.6);
    selectBeeRef(null);
    return;
  }

  rejectShakeRef(selectedBee);
  setBuildingToastRef('Drop on a seat, obstacle, or matching bee', 1.6);
}

export function onTap(screenX, screenY) {
  var candidate = pickFreshBeeCandidate(screenX, screenY, null);
  var hitBee = candidate ? candidate.bee : null;
  if (hitBee) {
    var selBee = getSelectedBee();
    if (selBee && selBee.id !== hitBee.id) {
      if (selBee.level === hitBee.level) {
        mergeBees(selBee, hitBee);
        return;
      }
      rejectShakeRef(selBee);
      setBuildingToastRef('Merge requires matching levels', 1.6);
      return;
    }
    if (selBee && selBee.id === hitBee.id) { selectBeeRef(null); } else { selectBeeRef(hitBee); }
    return;
  }

  var hitCell = getCellAtScreen(screenX, screenY);
  if (hitCell) {
    var selectedBee = getSelectedBee();
    if (selectedBee) {
      var resolvedTapTarget = resolveReleaseTarget(selectedBee, screenX, screenY);
      if (resolvedTapTarget && (resolvedTapTarget.kind === 'cell' || resolvedTapTarget.kind === 'direct_cell')) {
        assignBeeToCell(selectedBee, resolvedTapTarget.cell);
      } else {
        rejectShakeRef(selectedBee);
      }
    } else if (hitCell.state === CELL_STATE.DORMANT) {
      setBuildingToastRef(
        isWorkerSeatCell(hitCell)
          ? 'Seat is live - gatherers feed nectar to start honey'
          : 'Gatherers activate dormant cells by depositing nectar',
        1.8
      );
    } else if (hitCell.cellType === CELL_TYPE.GATE) {
      var conds = evaluateGateConditions();
      if (stateRef.levelComplete) {
        setBuildingToastRef('Level already complete!', 1.5);
      } else if (hitCell.state === CELL_STATE.OBSTACLE) {
        setBuildingToastRef('Assign more bees to clear this gate', 1.8);
      } else if (hitCell.state === CELL_STATE.ACTIVE && !conds.allGatesCleared) {
        setBuildingToastRef('Other gate cells still need clearing', 1.8);
      } else {
        setBuildingToastRef(conds.detail, 2.4);
      }
    } else if (hitCell.cellType === CELL_TYPE.REWARD_BLOCKER && hitCell.state === CELL_STATE.ACTIVE && !hitCell.rewardCollected) {
      grantCellReward(hitCell);
    } else if (hitCell.state === CELL_STATE.ACTIVE && (hitCell.cellType === CELL_TYPE.HATCHERY || hitCell.cellType === CELL_TYPE.PROCESSOR || hitCell.cellType === CELL_TYPE.BUILDING_LOT)) {
      var result = tryBuildOrUpgrade(hitCell);
      if (result) { setBuildingToastRef(result, 2.5); }
    } else if (hitCell.state === CELL_STATE.ACTIVE && hitCell.cellType === CELL_TYPE.OPEN && hitCell.isReadyToCollect) {
      var collectedHoney = hitCell.honeyStored;
      stateRef.honey += hitCell.honeyStored;
      hitCell.honeyStored = 0;
      hitCell.isReadyToCollect = false;
      hitCell.conversionProgress = 0;
      refreshCellMaterial(hitCell);
      flashCellRef(hitCell.id, 0xffee44);
      markCameraInteractionRef(hitCell);
      registerRoyalRush();
      setBuildingToastRef('+' + Math.floor(collectedHoney) + ' honey  •  rush x' + getRoyalRushStacks(), 1.8);
    }
    return;
  }

  if (getSelectedBee()) {
    selectBeeRef(null);
  }
}
