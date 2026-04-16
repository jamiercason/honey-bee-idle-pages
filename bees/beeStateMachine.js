import { lerpAngle } from '../utils/angles.js';
import { easeInOut, smoothstep } from '../utils/math.js';
import { BEE_ROLE, BEE_STATE, CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { getCellById } from '../board/boardQueries.js';
import { addCellOccupant, getSeatTargetIds } from '../board/cellState.js';
import { chooseGathererDepositTarget, depositNectarToActiveCell, depositNectarToDormantCell, routeNectarToActiveCells } from '../economy/rewards.js';
import { getBeeEffectiveGatherLoad, getBeeEffectiveGatherTravelMultiplier, getBeeEffectiveWorkRate, getBeeGatherRestDuration } from './beeQueries.js';
import { applyBeeFlightVisibility, applyBeePersonalSpace, arcPos, bankPosition, cellDeliveryPos, cellDisengagePos, cellExitPos, getGatherArcPos, randomOffset, travelDuration } from './beeMovement.js';
import { startGathererTrip } from './beeGathering.js';
import { applyMergeAssignment, pickWorkTarget, releaseWorkTarget, setBeeGathererRole } from './beeAssignments.js';

var stateRef = null;
var getSimTimeRef = function() { return 0; };
var getUseBeePoseSystemRef = function() { return false; };
var getDebugWorkersRef = function() { return false; };
var getSelectedBeeIdRef = function() { return null; };
var getCellWorldPosRef = function() { return null; };
var buildBeePoseInputRef = function() { return null; };
var computeBeePoseRef = function() { return null; };
var applyBeePoseRef = function() {};
var computeWorkerBeeFrameRef = function() { return null; };
var getCellRenderBasisRef = function() { return null; };
var snapForwardToHexDirectionRef = function() { return { vec: new globalThis.THREE.Vector3(0, 0, 1) }; };
var getFallbackSeatForwardRef = function() { return new globalThis.THREE.Vector3(0, 0, 1); };
var applyWorkerBeePoseRef = function() {};
var updateBeeReadabilityVisualRef = function() {};
var updateBeeFxRef = function() {};
var drawLineRef = function() {};
var findChildRef = function() { return null; };
var completeObstacleCellRef = function() {};

export function setBeeStateMachineRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
  getUseBeePoseSystemRef = runtime && runtime.getUseBeePoseSystem ? runtime.getUseBeePoseSystem : getUseBeePoseSystemRef;
  getDebugWorkersRef = runtime && runtime.getDebugWorkers ? runtime.getDebugWorkers : getDebugWorkersRef;
  getSelectedBeeIdRef = runtime && runtime.getSelectedBeeId ? runtime.getSelectedBeeId : getSelectedBeeIdRef;
  getCellWorldPosRef = runtime && runtime.getCellWorldPos ? runtime.getCellWorldPos : getCellWorldPosRef;
  buildBeePoseInputRef = runtime && runtime.buildBeePoseInput ? runtime.buildBeePoseInput : buildBeePoseInputRef;
  computeBeePoseRef = runtime && runtime.computeBeePose ? runtime.computeBeePose : computeBeePoseRef;
  applyBeePoseRef = runtime && runtime.applyBeePose ? runtime.applyBeePose : applyBeePoseRef;
  computeWorkerBeeFrameRef = runtime && runtime.computeWorkerBeeFrame ? runtime.computeWorkerBeeFrame : computeWorkerBeeFrameRef;
  getCellRenderBasisRef = runtime && runtime.getCellRenderBasis ? runtime.getCellRenderBasis : getCellRenderBasisRef;
  snapForwardToHexDirectionRef = runtime && runtime.snapForwardToHexDirection ? runtime.snapForwardToHexDirection : snapForwardToHexDirectionRef;
  getFallbackSeatForwardRef = runtime && runtime.getFallbackSeatForward ? runtime.getFallbackSeatForward : getFallbackSeatForwardRef;
  applyWorkerBeePoseRef = runtime && runtime.applyWorkerBeePose ? runtime.applyWorkerBeePose : applyWorkerBeePoseRef;
  updateBeeReadabilityVisualRef = runtime && runtime.updateBeeReadabilityVisual ? runtime.updateBeeReadabilityVisual : updateBeeReadabilityVisualRef;
  updateBeeFxRef = runtime && runtime.updateBeeFx ? runtime.updateBeeFx : updateBeeFxRef;
  drawLineRef = runtime && runtime.drawLine ? runtime.drawLine : drawLineRef;
  findChildRef = runtime && runtime.findChild ? runtime.findChild : findChildRef;
  completeObstacleCellRef = runtime && runtime.completeObstacleCell ? runtime.completeObstacleCell : completeObstacleCellRef;
}

function updateBeeTravelState(bee, dt) {
  if (bee.travelT >= 1.0) { return; }
  bee.travelT += dt / bee.travelDur;
  bee.landedTheta = null;
  if (bee.travelT >= 1.0) {
    bee.travelT = 1.0;
    bee.pos.copy(bee.targetPos);
    if (bee.role === BEE_ROLE.GATHERER) {
      if (bee.gatherPhase === 'outbound') {
        bee.carryNectar = getBeeEffectiveGatherLoad(bee);
        var depositCell = chooseGathererDepositTarget(bee);
        bee.targetCellId = depositCell ? depositCell.id : null;
        if (depositCell) {
          var depositPos = cellDeliveryPos(depositCell, bee.id);
          bee.origin.copy(bee.pos);
          bee.targetPos.copy(depositPos);
          bee.travelT = 0;
          bee.travelDur = Math.max(0.55, travelDuration(bee.pos, depositPos) / Math.max(0.55, getBeeEffectiveGatherTravelMultiplier(bee) * 0.82));
          bee.gatherPhase = 'delivering';
        } else {
          bee.gatherPhase = 'resting';
          bee.idleTimer = getBeeGatherRestDuration(bee.level);
        }
      } else if (bee.gatherPhase === 'delivering') {
        var depositTarget = bee.targetCellId ? getCellById(bee.targetCellId) : null;
        var leftover = bee.carryNectar;
        if (depositTarget) {
          if (depositTarget.state === CELL_STATE.DORMANT) {
            var dormantDeposit = depositNectarToDormantCell(depositTarget, leftover, 'wildflower');
            leftover = dormantDeposit.leftover;
          } else if (depositTarget.state === CELL_STATE.ACTIVE && depositTarget.cellType === CELL_TYPE.OPEN) {
            var activeDeposit = depositNectarToActiveCell(depositTarget, leftover, 'wildflower');
            leftover = activeDeposit.leftover;
          }
        }
        if (leftover > 0) {
          leftover -= routeNectarToActiveCells(bee.pos, leftover, null, 'wildflower');
        }
        bee.carryNectar = Math.max(0, leftover);
        if (depositTarget) {
          var disengagePos = cellDisengagePos(depositTarget, bee.id);
          bee.origin.copy(bee.pos);
          bee.targetPos.copy(disengagePos);
          bee.travelT = 0;
          bee.travelDur = Math.max(0.34, travelDuration(bee.pos, disengagePos) / Math.max(0.45, getBeeEffectiveGatherTravelMultiplier(bee) * 0.48));
          bee.exitReverse = 1.0;
          bee.gatherPhase = 'backing_out';
        } else {
          bee.targetCellId = null;
          var directReturnPos = bankPosition(bee.id).add(randomOffset());
          bee.origin.copy(bee.pos);
          bee.targetPos.copy(directReturnPos);
          bee.travelT = 0;
          bee.travelDur = Math.max(0.35, travelDuration(bee.pos, directReturnPos) / getBeeEffectiveGatherTravelMultiplier(bee));
          bee.gatherPhase = 'returning';
        }
      } else if (bee.gatherPhase === 'backing_out') {
        var exitTarget = bee.targetCellId ? getCellById(bee.targetCellId) : null;
        if (exitTarget) {
          var exitPos = cellExitPos(exitTarget, bee.id);
          bee.origin.copy(bee.pos);
          bee.targetPos.copy(exitPos);
          bee.travelT = 0;
          bee.travelDur = Math.max(0.26, travelDuration(bee.pos, exitPos) / Math.max(0.75, getBeeEffectiveGatherTravelMultiplier(bee) * 1.1));
          bee.gatherPhase = 'turning_out';
        } else {
          bee.targetCellId = null;
          var returnPos = bankPosition(bee.id).add(randomOffset());
          bee.origin.copy(bee.pos);
          bee.targetPos.copy(returnPos);
          bee.travelT = 0;
          bee.travelDur = Math.max(0.35, travelDuration(bee.pos, returnPos) / getBeeEffectiveGatherTravelMultiplier(bee));
          bee.gatherPhase = 'returning';
        }
      } else if (bee.gatherPhase === 'turning_out') {
        var turnReturnPos = bankPosition(bee.id).add(randomOffset());
        bee.origin.copy(bee.pos);
        bee.targetPos.copy(turnReturnPos);
        bee.travelT = 0;
        bee.travelDur = Math.max(0.35, travelDuration(bee.pos, turnReturnPos) / getBeeEffectiveGatherTravelMultiplier(bee));
        bee.targetCellId = null;
        bee.exitReverse = 0.0;
        bee.gatherPhase = 'returning';
      } else if (bee.gatherPhase === 'returning') {
        bee.gatherPhase = 'resting';
        bee.exitReverse = 0.0;
        bee.idleTimer = getBeeGatherRestDuration(bee.level) * 0.35;
      }
    }
  } else {
    if (bee.role === BEE_ROLE.GATHERER) {
      bee.pos.copy(getGatherArcPos(bee, bee.origin, bee.targetPos, bee.travelT));
    } else {
      bee.pos.copy(arcPos(bee.origin, bee.targetPos, bee.travelT));
    }
  }
}

function updateGathererState(bee, dt) {
  bee.idleTimer -= dt;
  if (bee.idleTimer <= 0) {
    startGathererTrip(bee);
  }
}

function updateWorkerTravelToSeat(bee, dt) {
  bee.travelT += dt / bee.travelDur;
  if (bee.travelT >= 1.0) {
    bee.travelT = 1.0;
    bee.pos.copy(bee.targetPos);
    var arrivedSeat = bee.seatCellId ? getCellById(bee.seatCellId) : null;
    if (arrivedSeat) {
      bee.landedTheta = arrivedSeat.theta;
      addCellOccupant(arrivedSeat, bee.id);
    }
    bee.state = BEE_STATE.IDLE_ON_SEAT;
    bee.idleTimer = 0.2 + Math.random() * 0.3;
  } else {
    bee.landedTheta = null;
    bee.pos.copy(arcPos(bee.origin, bee.targetPos, bee.travelT));
  }
}

function updateWorkerIdleOnSeat(bee, dt) {
  bee.idleTimer -= dt;
  var idleSeat = bee.seatCellId ? getCellById(bee.seatCellId) : null;
  if (idleSeat) {
    bee.landedTheta = idleSeat.theta;
    bee.pos.copy(getCellWorldPosRef(idleSeat));
  } else {
    setBeeGathererRole(bee, true);
    return;
  }

  if (bee.idleTimer <= 0) {
    var nextTarget = pickWorkTarget(bee);
    if (nextTarget) {
      addCellOccupant(nextTarget, bee.id);
      bee.workTargetCellId = nextTarget.id;
      bee.state = BEE_STATE.WORKING;
    } else {
      bee.idleTimer = 1.0 + Math.random() * 1.0;
    }
  }
}

function updateWorkerWorkingState(bee, dt) {
  var wSeat = bee.seatCellId ? getCellById(bee.seatCellId) : null;
  var wTarget = bee.workTargetCellId ? getCellById(bee.workTargetCellId) : null;
  if (!wSeat) {
    setBeeGathererRole(bee, true);
    return;
  }
  if (!wTarget || wTarget.state !== CELL_STATE.OBSTACLE) {
    releaseWorkTarget(bee);
    bee.state = BEE_STATE.IDLE_ON_SEAT;
    bee.idleTimer = 0.1;
    return;
  }

  bee.landedTheta = wSeat.theta;
  bee.pos.copy(getCellWorldPosRef(wSeat));
  addCellOccupant(wTarget, bee.id);
  wTarget.activationProgress += getBeeEffectiveWorkRate(bee) * dt;
  if (wTarget.activationProgress >= wTarget.activationRequired) {
    completeObstacleCellRef(wTarget);
    bee.workTargetCellId = null;
    bee.state = BEE_STATE.IDLE_ON_SEAT;
    bee.idleTimer = 0.1;
  }
}

function updateBeeAnimationState(bee, dt) {
  var simTime = getSimTimeRef();
  if (bee.state === BEE_STATE.IDLE_ON_SEAT || bee.state === BEE_STATE.WORKING) {
    var fwSeat = getCellById(bee.seatCellId);
    if (fwSeat) {
      var THREE = globalThis.THREE;
      var fwTarget = null;
      if (bee.state === BEE_STATE.WORKING && bee.workTargetCellId) { fwTarget = getCellById(bee.workTargetCellId); }
      if (!fwTarget) {
        var fwBest = null;
        var fwSeatTargetIds = getSeatTargetIds(fwSeat);
        for (var fwNi = 0; fwNi < fwSeatTargetIds.length; fwNi++) {
          var fwN = getCellById(fwSeatTargetIds[fwNi]);
          if (!fwN || fwN.state !== CELL_STATE.OBSTACLE) { continue; }
          if (!fwBest) {
            fwBest = fwN;
            continue;
          }
          if (fwN.row < fwBest.row) {
            fwBest = fwN;
            continue;
          }
          if (fwN.row === fwBest.row && fwN.activationProgress < fwBest.activationProgress) { fwBest = fwN; }
        }
        if (fwBest) { fwTarget = fwBest; }
      }

      var fwFrame = null;
      if (getUseBeePoseSystemRef()) {
        var poseInput = buildBeePoseInputRef(bee);
        if (poseInput && !poseInput.targetCell && fwTarget) {
          poseInput.targetCell = fwTarget;
          poseInput.targetCellId = fwTarget.id;
          poseInput.targetPos = getCellWorldPosRef(fwTarget).clone();
        }
        if (poseInput && !poseInput.targetCell) {
          var poseSeatTargetIds = getSeatTargetIds(fwSeat);
          if (poseSeatTargetIds.length > 0) {
            poseInput.targetCell = getCellById(poseSeatTargetIds[0]);
            poseInput.targetCellId = poseInput.targetCell ? poseInput.targetCell.id : null;
            poseInput.targetPos = poseInput.targetCell ? getCellWorldPosRef(poseInput.targetCell).clone() : null;
          }
        }
        var pose = computeBeePoseRef(poseInput, simTime);
        applyBeePoseRef(bee, pose);
        if (getDebugWorkersRef() && getSelectedBeeIdRef() === bee.id && pose) {
          console.log('BeePose', {
            beeId: bee.id,
            seatCellId: poseInput ? poseInput.seatCellId : null,
            targetCellId: poseInput ? poseInput.targetCellId : null,
            dirIndex: pose.snappedDirIndex,
            forward: [pose.forward.x, pose.forward.y, pose.forward.z]
          });
        }
        fwFrame = pose ? {
          origin: pose.anchorPos.clone(),
          normal: pose.up.clone(),
          forward: pose.forward.clone(),
          right: pose.right.clone()
        } : null;
      } else {
        if (fwTarget) {
          fwFrame = computeWorkerBeeFrameRef(fwSeat, fwTarget);
        } else {
          var fwBasis = getCellRenderBasisRef(fwSeat);
          var fwFallback = snapForwardToHexDirectionRef(getFallbackSeatForwardRef(fwSeat, 'E'), fwBasis.hexDirections).vec;
          var fwRight = new THREE.Vector3().crossVectors(fwFallback, fwBasis.normal).normalize();
          var fwOrigin = fwBasis.worldPos.clone();
          fwFrame = { origin: fwOrigin, normal: fwBasis.normal, forward: fwFallback, right: fwRight };
        }
        applyWorkerBeePoseRef(bee, fwFrame, simTime);
      }
      updateBeeReadabilityVisualRef(bee);
      applyBeeFlightVisibility(bee);
      updateBeeFxRef(bee, dt, simTime);
      if (getDebugWorkersRef() && fwFrame) { drawLineRef(fwFrame.origin, fwFrame.origin.clone().add(fwFrame.forward), 0xff00ff); }

      bee.poseT = Math.min(1.0, bee.poseT + dt * 2.8);
      var fwPt = easeInOut(bee.poseT);
      var fwWL = findChildRef(bee.mesh, 'wingL');
      var fwWR = findChildRef(bee.mesh, 'wingR');
      var fwWingRest = fwPt * 1.2;
      var fwFlapSpeed = 18.0 * (1.0 - fwPt * 0.85);
      var fwFlapAmp = 0.55 * (1.0 - fwPt * 0.75);
      bee.wingPhase += dt * fwFlapSpeed * stateRef.gameTimeScale;
      var fwFlap = Math.sin(bee.wingPhase) * fwFlapAmp;
      if (fwWL) { fwWL.rotation.z = (0.3 + fwWingRest) + fwFlap; }
      if (fwWR) { fwWR.rotation.z = -(0.3 + fwWingRest) - fwFlap; }
      bee.lastFlightPos.copy(bee.pos);
      return;
    }
  }

  bee.poseT = Math.max(0.0, bee.poseT - dt * 2.8);
  bee.poseAnchor = null;
  bee.poseForward = null;
  bee.poseRight = null;
  bee.poseUp = null;
  bee.poseDirIndex = -1;
  bee.poseSeatCellId = null;
  bee.poseTargetCellId = null;
  var pt = easeInOut(bee.poseT);
  var prevFlightPos = bee.lastFlightPos ? bee.lastFlightPos.clone() : bee.pos.clone();
  bee.mesh.position.copy(bee.pos);
  bee.mesh.rotation.set(bee.mesh.rotation.x, bee.mesh.rotation.y, 0);
  var targetYaw = bee.mesh.rotation.y;
  var moveDelta = bee.pos.clone().sub(prevFlightPos);
  moveDelta.y = 0;
  var moveDistSq = moveDelta.lengthSq();

  if (bee.landedTheta !== null && pt > 0.05) {
    targetYaw = Math.atan2(Math.cos(bee.landedTheta), Math.sin(bee.landedTheta));
  } else if (bee.gatherPhase === 'backing_out' && bee.targetCellId) {
    var backingCell = getCellById(bee.targetCellId);
    if (backingCell) {
      var backDx = getCellWorldPosRef(backingCell).x - bee.pos.x;
      var backDz = getCellWorldPosRef(backingCell).z - bee.pos.z;
      var backDist = Math.sqrt(backDx * backDx + backDz * backDz);
      if (backDist > 0.01) { targetYaw = Math.atan2(backDx, backDz); }
    }
  } else if (moveDistSq > 0.0004) {
    targetYaw = Math.atan2(moveDelta.x, moveDelta.z);
  } else if (bee.gatherPhase === 'turning_out' && bee.targetCellId) {
    var turnCell = getCellById(bee.targetCellId);
    var moveDx = bee.targetPos.x - bee.pos.x;
    var moveDz = bee.targetPos.z - bee.pos.z;
    var moveDist = Math.sqrt(moveDx * moveDx + moveDz * moveDz);
    var moveYaw = moveDist > 0.01 ? Math.atan2(moveDx, moveDz) : targetYaw;
    if (turnCell) {
      var turnDx = getCellWorldPosRef(turnCell).x - bee.pos.x;
      var turnDz = getCellWorldPosRef(turnCell).z - bee.pos.z;
      var turnDist = Math.sqrt(turnDx * turnDx + turnDz * turnDz);
      var turnYaw = turnDist > 0.01 ? Math.atan2(turnDx, turnDz) : moveYaw;
      targetYaw = lerpAngle(turnYaw, moveYaw, smoothstep(0.22, 0.88, bee.travelT));
    } else {
      targetYaw = moveYaw;
    }
  } else if (bee.travelT < 0.98) {
    var fdx = bee.targetPos.x - bee.pos.x;
    var fdz = bee.targetPos.z - bee.pos.z;
    var fd = Math.sqrt(fdx * fdx + fdz * fdz);
    if (fd > 0.01) { targetYaw = Math.atan2(fdx, fdz); }
  }

  var dyaw = targetYaw - bee.mesh.rotation.y;
  while (dyaw > Math.PI) { dyaw -= Math.PI * 2; }
  while (dyaw < -Math.PI) { dyaw += Math.PI * 2; }
  var yawFollow = (bee.gatherPhase === 'backing_out' || bee.gatherPhase === 'turning_out') ? 5.0 : 8.0;
  bee.mesh.rotation.y += dyaw * Math.min(1.0, dt * yawFollow);
  bee.mesh.rotation.x = pt * (Math.PI / 2);

  var flapSpeed = 18.0 * (1.0 - pt * 0.85);
  var flapAmp = 0.55 * (1.0 - pt * 0.75);
  var wingRestAng = pt * 1.2;
  bee.wingPhase += dt * flapSpeed * stateRef.gameTimeScale;
  var flapAngle = Math.sin(bee.wingPhase) * flapAmp;
  var wL = findChildRef(bee.mesh, 'wingL');
  var wR = findChildRef(bee.mesh, 'wingR');
  if (wL) { wL.rotation.z = (0.3 + wingRestAng) + flapAngle; }
  if (wR) { wR.rotation.z = -(0.3 + wingRestAng) - flapAngle; }
  updateBeeReadabilityVisualRef(bee);
  applyBeeFlightVisibility(bee);
  updateBeeFxRef(bee, dt, simTime);
  bee.lastFlightPos.copy(bee.pos);
}

function updateMergeFrozenBee(bee, dt) {
  if (!bee || bee.mergeFreezeTimer <= 0) { return false; }
  bee.mergeFreezeTimer = Math.max(0, bee.mergeFreezeTimer - dt);
  if (bee.mergeAnchorPos) {
    bee.pos.copy(bee.mergeAnchorPos);
    bee.origin.copy(bee.mergeAnchorPos);
    bee.targetPos.copy(bee.mergeAnchorPos);
  }
  bee.travelT = 1.0;
  bee.travelDur = 0.0001;
  if (bee.mesh && bee.mergeAnchorPos) {
    bee.mesh.position.copy(bee.mergeAnchorPos);
  }
  updateBeeReadabilityVisualRef(bee);
  applyBeeFlightVisibility(bee);
  updateBeeFxRef(bee, dt, getSimTimeRef());
  bee.lastFlightPos.copy(bee.pos);

  if (bee.mergeFreezeTimer <= 0 && bee.mergePendingAssignment) {
    if (applyMergeAssignment(bee, bee.mergePendingAssignment, { anchorWorldPos: bee.mergeAnchorPos })) {
      bee.mergePendingAssignment = null;
    }
  }
  return true;
}

export function updateBees(dt) {
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var bee = stateRef.bees[bi];
    if (updateMergeFrozenBee(bee, dt)) { continue; }
    switch (bee.state) {
      case BEE_STATE.IDLE:
        if (bee.travelT < 1.0) {
          updateBeeTravelState(bee, dt);
        } else if (bee.role === BEE_ROLE.GATHERER) {
          updateGathererState(bee, dt);
        }
        break;
      case BEE_STATE.MOVING_TO_SEAT:
        updateWorkerTravelToSeat(bee, dt);
        break;
      case BEE_STATE.IDLE_ON_SEAT:
        updateWorkerIdleOnSeat(bee, dt);
        break;
      case BEE_STATE.WORKING:
        updateWorkerWorkingState(bee, dt);
        break;
    }

    updateBeeAnimationState(bee, dt);
  }

  applyBeePersonalSpace();
}
