import { BEE_ROLE, BEE_STATE } from '../data/enums.js';
import { lerp } from '../utils/math.js';
import { getBeeEffectiveGatherTravelMultiplier } from './beeQueries.js';
import { randomOffset, travelDuration } from './beeMovement.js';

var beeConfigRef = null;
var getSimTimeRef = function() { return 0; };

export function setBeeGatheringRuntime(runtime) {
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : beeConfigRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
}

export function refreshBeeGatherRoute(bee) {
  if (!bee) { return; }
  bee.gatherRouteRadius = lerp(beeConfigRef.GATHER_MISSION_RADIUS_MIN, beeConfigRef.GATHER_MISSION_RADIUS_MAX, (((bee.id * 0.417) % 1) + Math.random() * 0.45) % 1);
  bee.gatherRouteHeight = lerp(beeConfigRef.GATHER_MISSION_Y_MIN, beeConfigRef.GATHER_MISSION_Y_MAX, Math.random());
  bee.gatherRouteBump = 0.95 + Math.random() * 0.95;
  bee.gatherRouteSide = (Math.random() - 0.5) * 1.8;
  bee.gatherRouteCurve = (Math.random() - 0.5) * 3.8;
}

export function getBeeGatherMissionSourcePos(bee) {
  var simTime = getSimTimeRef();
  var baseAngle = (bee.id / beeConfigRef.MAX_COUNT) * Math.PI * 2 + 0.35;
  var angleJitter = (bee.gatherRouteSide || 0) * 0.85 + Math.sin(simTime * 0.13 + bee.id * 1.37) * 0.08;
  var angle = baseAngle + angleJitter;
  var radius = bee.gatherRouteRadius || (beeConfigRef.GATHER_MISSION_RADIUS_MIN + beeConfigRef.GATHER_MISSION_RADIUS_MAX) * 0.5;
  var y = bee.gatherRouteHeight || ((beeConfigRef.GATHER_MISSION_Y_MIN + beeConfigRef.GATHER_MISSION_Y_MAX) * 0.5);
  return new globalThis.THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

export function startGathererTrip(bee) {
  if (!bee || bee.role !== BEE_ROLE.GATHERER) { return; }
  refreshBeeGatherRoute(bee);
  var sourcePos = getBeeGatherMissionSourcePos(bee).add(randomOffset());
  bee.origin.copy(bee.pos);
  bee.targetPos.copy(sourcePos);
  bee.travelT = 0;
  bee.travelDur = Math.max(0.35, travelDuration(bee.pos, sourcePos) / getBeeEffectiveGatherTravelMultiplier(bee));
  bee.gatherPhase = 'outbound';
  bee.state = BEE_STATE.IDLE;
}
