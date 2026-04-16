export function createRuntimeTime(theta, y) {
  return {
    simTime: 0,
    spectacleGlowTheta: theta,
    lastInteractTheta: theta,
    lastInteractY: y,
    lastInteractYTimer: 0,
    assertionTimer: 0
  };
}

export function advanceSimTime(runtimeTime, dt) {
  runtimeTime.simTime += dt;
  return runtimeTime.simTime;
}

export function markInteractionTime(runtimeTime, theta, y, holdDuration) {
  runtimeTime.lastInteractTheta = theta;
  runtimeTime.lastInteractY = y;
  runtimeTime.lastInteractYTimer = holdDuration;
}

export function updateInteractHold(runtimeTime, rawDt) {
  if (runtimeTime.lastInteractYTimer > 0) {
    runtimeTime.lastInteractYTimer = Math.max(0, runtimeTime.lastInteractYTimer - rawDt);
  }
  return runtimeTime.lastInteractYTimer;
}

export function shouldRunAssertions(runtimeTime, rawDt, interval) {
  runtimeTime.assertionTimer -= rawDt;
  if (runtimeTime.assertionTimer > 0) { return false; }
  runtimeTime.assertionTimer = interval;
  return true;
}
