import { HIVE } from '../config/hiveConfig.js';
import { BEE_ROLE, BEE_STATE } from '../data/enums.js';
import { getCellById } from '../board/boardQueries.js';
import { easeInOut, lerp, smoothstep } from '../utils/math.js';

var stateRef = null;
var pointerRef = null;
var beeConfigRef = null;
var getSelectedBeeIdRef = function() { return null; };
var getCellRenderBasisRef = function() { return null; };
var projectOnPlaneRef = function(vec) { return vec; };
var getFallbackSeatForwardRef = function() { return null; };
var getCellSurfaceNormalRef = function() { return null; };
var getCellWorldPosRef = function() { return null; };

export function setBeeMovementRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  pointerRef = runtime && runtime.pointer ? runtime.pointer : pointerRef;
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : beeConfigRef;
  getSelectedBeeIdRef = runtime && runtime.getSelectedBeeId ? runtime.getSelectedBeeId : getSelectedBeeIdRef;
  getCellRenderBasisRef = runtime && runtime.getCellRenderBasis ? runtime.getCellRenderBasis : getCellRenderBasisRef;
  projectOnPlaneRef = runtime && runtime.projectOnPlane ? runtime.projectOnPlane : projectOnPlaneRef;
  getFallbackSeatForwardRef = runtime && runtime.getFallbackSeatForward ? runtime.getFallbackSeatForward : getFallbackSeatForwardRef;
  getCellSurfaceNormalRef = runtime && runtime.getCellSurfaceNormal ? runtime.getCellSurfaceNormal : getCellSurfaceNormalRef;
  getCellWorldPosRef = runtime && runtime.getCellWorldPos ? runtime.getCellWorldPos : getCellWorldPosRef;
}

function getBeeSafeRadius() {
  return HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + beeConfigRef.FLY_HEIGHT_EXTRA * 0.6;
}

export function bankPosition(beeId) {
  var angle = (beeId / beeConfigRef.MAX_COUNT) * Math.PI * 2;
  var r = beeConfigRef.BANK_RADIUS;
  return new globalThis.THREE.Vector3(Math.cos(angle) * r, beeConfigRef.BANK_Y, Math.sin(angle) * r);
}

export function gatherSourcePosition(beeId) {
  var angle = (beeId / beeConfigRef.MAX_COUNT) * Math.PI * 2 + 0.35;
  var r = beeConfigRef.BANK_RADIUS + 2.4;
  return new globalThis.THREE.Vector3(Math.cos(angle) * r, beeConfigRef.BANK_Y - 1.6, Math.sin(angle) * r);
}

export function randomOffset() {
  return new globalThis.THREE.Vector3(
    (Math.random() - 0.5) * beeConfigRef.OFFSET_RANGE * 2,
    (Math.random() - 0.5) * beeConfigRef.OFFSET_RANGE,
    (Math.random() - 0.5) * beeConfigRef.OFFSET_RANGE * 2
  );
}

export function cellHoverPos(cell) {
  var outward = HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + beeConfigRef.FLY_HEIGHT_EXTRA;
  return new globalThis.THREE.Vector3(Math.cos(cell.theta) * outward, cell.worldPos.y, Math.sin(cell.theta) * outward);
}

export function getCellOrbitBasis(cell) {
  var basis = getCellRenderBasisRef(cell);
  var tangentA = projectOnPlaneRef(getFallbackSeatForwardRef(cell, 'E'), basis.normal);
  if (tangentA.lengthSq() < 0.00001) {
    tangentA.set(-Math.sin(cell.theta), 0, Math.cos(cell.theta));
  }
  tangentA.normalize();
  var tangentB = new globalThis.THREE.Vector3().crossVectors(basis.normal, tangentA).normalize();
  return {
    normal: basis.normal,
    tangentA: tangentA,
    tangentB: tangentB
  };
}

export function cellDeliveryPos(cell, beeId) {
  var pos = cellHoverPos(cell);
  var orbit = getCellOrbitBasis(cell);
  var angle = (((beeId * 0.61803398875) % 1) + 1) % 1 * Math.PI * 2;
  var radius = beeConfigRef.PERSONAL_SPACE * 0.62;
  return pos
    .addScaledVector(orbit.tangentA, Math.cos(angle) * radius)
    .addScaledVector(orbit.tangentB, Math.sin(angle) * radius * 0.78)
    .addScaledVector(orbit.normal, 0.04);
}

export function cellDisengagePos(cell, beeId) {
  var deliveryPos = cellDeliveryPos(cell, beeId);
  var center = getCellWorldPosRef(cell);
  var away = deliveryPos.clone().sub(center);
  away.y = 0;
  if (away.lengthSq() < 0.00001) {
    away.copy(getCellSurfaceNormalRef(cell));
    away.y = 0;
  } else {
    away.normalize();
  }
  var pos = deliveryPos
    .clone()
    .addScaledVector(away, 0.92)
    .addScaledVector(getCellSurfaceNormalRef(cell), 0.10);
  pos.y = deliveryPos.y;
  return pos;
}

export function cellExitPos(cell, beeId) {
  var disengagePos = cellDisengagePos(cell, beeId);
  var center = getCellWorldPosRef(cell);
  var away = disengagePos.clone().sub(center);
  away.y = 0;
  if (away.lengthSq() < 0.00001) {
    away.copy(getCellSurfaceNormalRef(cell));
    away.y = 0;
  } else {
    away.normalize();
  }
  var pos = disengagePos
    .clone()
    .addScaledVector(away, 1.65)
    .addScaledVector(getCellSurfaceNormalRef(cell), 0.06);
  pos.y = disengagePos.y;
  return pos;
}

export function travelDuration(from, to) {
  return Math.max(0.3, from.distanceTo(to) / beeConfigRef.SPEED);
}

export function arcPos(fromPos, toPos, t) {
  return arcPosEx(fromPos, toPos, t, 0.35, 0, 0);
}

export function arcPosEx(fromPos, toPos, t, bumpScale, altOffset, altCurve) {
  var et = easeInOut(t);
  var fromAngle = Math.atan2(fromPos.z, fromPos.x);
  var toAngle = Math.atan2(toPos.z, toPos.x);
  var da = toAngle - fromAngle;
  while (da > Math.PI) { da -= Math.PI * 2; }
  while (da < -Math.PI) { da += Math.PI * 2; }
  var angle = fromAngle + da * et;
  var safeRadius = getBeeSafeRadius();
  var fromR = Math.max(safeRadius, Math.sqrt(fromPos.x * fromPos.x + fromPos.z * fromPos.z));
  var toR = Math.max(safeRadius, Math.sqrt(toPos.x * toPos.x + toPos.z * toPos.z));
  var straightR = fromR + (toR - fromR) * et;
  var r = Math.max(safeRadius, straightR + Math.sin(t * Math.PI) * (HIVE.CYLINDER_RADIUS * bumpScale));
  var y = fromPos.y + (toPos.y - fromPos.y) * et + altCurve * Math.sin(t * Math.PI) + altOffset;
  return new globalThis.THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
}

export function getGatherArcPos(bee, fromPos, toPos, t) {
  var bump = bee && bee.gatherRouteBump ? bee.gatherRouteBump : 0.9;
  var routeY = (bee && bee.gatherRouteHeight !== undefined) ? bee.gatherRouteHeight : (beeConfigRef.BANK_Y - 1.4);
  var alt = routeY - ((fromPos.y + toPos.y) * 0.5);
  var curve = bee && bee.gatherRouteCurve ? bee.gatherRouteCurve : 0;
  var tt = t;

  if (bee && bee.gatherPhase === 'outbound') {
    bump += 0.85;
    alt *= 1.10;
    curve += bee.arcAlt * 0.35;
  } else if (bee && bee.gatherPhase === 'delivering') {
    bump = Math.max(0.42, bump * 0.72);
    alt *= 0.30;
    curve = bee.arcAlt * 0.25;
    tt = 1.0 - Math.pow(1.0 - t, 2.2);
  } else if (bee && bee.gatherPhase === 'backing_out') {
    tt = smoothstep(0.0, 1.0, t);
    return fromPos.clone().lerp(toPos, tt);
  } else if (bee && bee.gatherPhase === 'turning_out') {
    tt = smoothstep(0.0, 1.0, t);
    return fromPos.clone().lerp(toPos, tt);
  } else if (bee && bee.gatherPhase === 'returning') {
    bump = Math.max(0.85, bump * 0.92);
    alt *= 0.85;
    curve *= 0.55;
    tt = smoothstep(0.0, 1.0, t);
    var returnArc = arcPosEx(fromPos, toPos, tt, bump, alt, curve);
    var returnLine = fromPos.clone().lerp(toPos, tt);
    var returnBlend = smoothstep(0.22, 0.62, t);
    var result = returnLine.lerp(returnArc, returnBlend);
    result.y = lerp(fromPos.y, returnArc.y, smoothstep(0.42, 0.96, t));
    return result;
  }

  return arcPosEx(fromPos, toPos, tt, bump, alt, curve);
}

export function getBeeFlightFade(bee) {
  if (!bee || bee.role !== BEE_ROLE.GATHERER) { return 1.0; }
  if (bee.gatherPhase === 'resting' && bee.seatCellId === null && !bee.selected) {
    return 0.0;
  }
  if (bee.travelT >= 0.999) { return 1.0; }
  if (bee.gatherPhase === 'outbound') {
    var outboundReveal = smoothstep(0.06, 0.18, bee.travelT);
    var outboundFade = lerp(1.0, 0.0, smoothstep(0.24, 0.86, bee.travelT));
    return outboundReveal * outboundFade;
  }
  if (bee.gatherPhase === 'delivering') {
    return smoothstep(0.28, 0.82, bee.travelT);
  }
  if (bee.gatherPhase === 'backing_out') {
    return 1.0;
  }
  if (bee.gatherPhase === 'turning_out') {
    return 1.0;
  }
  if (bee.gatherPhase === 'returning') {
    return lerp(1.0, 0.0, smoothstep(0.34, 0.94, bee.travelT));
  }
  return 1.0;
}

export function applyBeeFlightVisibility(bee) {
  if (!bee || !bee.mesh) { return; }
  var fade = getBeeFlightFade(bee);
  bee.mesh.visible = !(bee.role === BEE_ROLE.GATHERER && bee.gatherPhase === 'resting' && !bee.selected);
  var contactShadow = bee.mesh.userData.contactShadow;
  var bodyHalo = bee.mesh.userData.bodyHalo;
  var roleNode = bee.mesh.userData.roleNode;
  var cargoOrb = bee.mesh.userData.cargoOrb;
  var boostHalo = bee.mesh.userData.boostHalo;

  bee.mesh.traverse(function(obj) {
    if (!obj.isMesh || obj.userData.isLabel || !obj.material) { return; }
    if (obj.material._flightBaseTransparent === undefined) {
      obj.material._flightBaseTransparent = !!obj.material.transparent;
      obj.material._flightBaseOpacity = (obj.material.opacity !== undefined) ? obj.material.opacity : 1.0;
    }
    if (fade < 0.995) {
      obj.material.transparent = true;
      obj.material.opacity = obj.material._flightBaseOpacity * fade;
    } else {
      obj.material.transparent = obj.material._flightBaseTransparent;
      obj.material.opacity = obj.material._flightBaseOpacity;
    }
  });

  if (contactShadow) { contactShadow.visible = fade > 0.72; }
  if (bodyHalo) { bodyHalo.visible = bodyHalo.visible && fade > 0.32; }
  if (roleNode) { roleNode.visible = roleNode.visible && fade > 0.20; }
  if (cargoOrb) { cargoOrb.visible = cargoOrb.visible && fade > 0.16; }
  if (boostHalo) { boostHalo.visible = boostHalo.visible && fade > 0.26; }
}

export function applyMovingBeeOrientation(bee) {
  if (!bee || !bee.mesh || bee.travelT >= 0.98) { return; }
  var move = bee.targetPos.clone().sub(bee.pos);
  move.y = 0;
  if (move.lengthSq() < 0.0001) { return; }
  move.normalize();
  var targetYaw = Math.atan2(move.x, move.z);
  var dyaw = targetYaw - bee.mesh.rotation.y;
  while (dyaw > Math.PI) { dyaw -= Math.PI * 2; }
  while (dyaw < -Math.PI) { dyaw += Math.PI * 2; }
  bee.mesh.rotation.y += dyaw * 0.18;
}

export function getBeeSeparationDirection(bee, dir) {
  var out = dir.clone();
  if (bee && bee.seatCellId !== null &&
      (bee.state === BEE_STATE.IDLE_ON_SEAT || bee.state === BEE_STATE.WORKING || bee.state === BEE_STATE.MOVING_TO_SEAT)) {
    var seatCell = getCellById(bee.seatCellId);
    if (seatCell) {
      out = projectOnPlaneRef(out, getCellSurfaceNormalRef(seatCell));
    }
  } else {
    out.y = 0;
  }
  if (out.lengthSq() < 0.00001) {
    out.set(dir.x, 0, dir.z);
  }
  if (out.lengthSq() < 0.00001) {
    out.set(1, 0, 0);
  }
  return out.normalize();
}

export function shouldApplyBeePersonalSpace(bee) {
  if (!bee) { return false; }
  if (bee.mergeFreezeTimer > 0) { return false; }
  if (bee.role === BEE_ROLE.GATHERER &&
      (bee.gatherPhase === 'delivering' || bee.gatherPhase === 'backing_out' || bee.gatherPhase === 'turning_out')) {
    return false;
  }
  return true;
}

export function applyBeePersonalSpace() {
  if (!stateRef.bees || stateRef.bees.length < 2) { return; }

  var offsets = {};
  var basePositions = {};
  var seatGroups = {};
  var dragBeeId = (pointerRef && pointerRef.dragMode === 'bee_assign') ? getSelectedBeeIdRef() : null;

  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var bee = stateRef.bees[bi];
    if (!bee || !bee.mesh) { continue; }
    offsets[bee.id] = new globalThis.THREE.Vector3();
    basePositions[bee.id] = bee.mesh.position.clone();
    if (!shouldApplyBeePersonalSpace(bee)) { continue; }
    if (bee.seatCellId !== null &&
        (bee.state === BEE_STATE.IDLE_ON_SEAT || bee.state === BEE_STATE.WORKING || bee.state === BEE_STATE.MOVING_TO_SEAT)) {
      if (!seatGroups[bee.seatCellId]) { seatGroups[bee.seatCellId] = []; }
      seatGroups[bee.seatCellId].push(bee);
    }
  }

  for (var seatId in seatGroups) {
    if (!seatGroups.hasOwnProperty(seatId)) { continue; }
    var group = seatGroups[seatId];
    if (!group || group.length < 2) { continue; }
    group.sort(function(a, b) { return a.id - b.id; });
    var seatCell = getCellById(group[0].seatCellId);
    if (!seatCell) { continue; }
    var basis = getCellRenderBasisRef(seatCell);
    var tangentA = projectOnPlaneRef(getFallbackSeatForwardRef(seatCell, 'E'), basis.normal);
    if (tangentA.lengthSq() < 0.00001) {
      tangentA.set(-Math.sin(seatCell.theta), 0, Math.cos(seatCell.theta));
    }
    tangentA.normalize();
    var tangentB = new globalThis.THREE.Vector3().crossVectors(basis.normal, tangentA).normalize();
    var radius = Math.min(beeConfigRef.PERSONAL_SPACE * 0.60, beeConfigRef.SEAT_STACK_SPREAD + (group.length - 2) * 0.04);

    for (var gi = 0; gi < group.length; gi++) {
      if (group[gi].id === dragBeeId) { continue; }
      var angle = (group.length === 2)
        ? ((gi === 0) ? -Math.PI * 0.5 : Math.PI * 0.5)
        : ((gi / group.length) * Math.PI * 2);
      offsets[group[gi].id]
        .addScaledVector(tangentA, Math.cos(angle) * radius)
        .addScaledVector(tangentB, Math.sin(angle) * radius);
    }
  }

  for (var i = 0; i < stateRef.bees.length; i++) {
    var beeA = stateRef.bees[i];
    if (!beeA || !beeA.mesh) { continue; }
    if (!shouldApplyBeePersonalSpace(beeA)) { continue; }
    for (var j = i + 1; j < stateRef.bees.length; j++) {
      var beeB = stateRef.bees[j];
      if (!beeB || !beeB.mesh) { continue; }
      if (!shouldApplyBeePersonalSpace(beeB)) { continue; }

      var posA = basePositions[beeA.id].clone().add(offsets[beeA.id]);
      var posB = basePositions[beeB.id].clone().add(offsets[beeB.id]);
      var delta = posA.clone().sub(posB);
      var dist = delta.length();
      if (dist >= beeConfigRef.PERSONAL_SPACE) { continue; }

      if (dist < 0.0001) {
        var seed = ((beeA.id * 13 + beeB.id * 7) % 16) / 16 * Math.PI * 2;
        delta.set(Math.cos(seed), 0, Math.sin(seed));
        dist = 0.0001;
      }

      var push = Math.min(beeConfigRef.SEPARATION_PUSH_LIMIT, (beeConfigRef.PERSONAL_SPACE - dist) * 0.5);
      var dirA = getBeeSeparationDirection(beeA, delta);
      var dirB = getBeeSeparationDirection(beeB, delta.clone().multiplyScalar(-1));

      if (beeA.id !== dragBeeId) { offsets[beeA.id].addScaledVector(dirA, push); }
      if (beeB.id !== dragBeeId) { offsets[beeB.id].addScaledVector(dirB, push); }
    }
  }

  for (var ai = 0; ai < stateRef.bees.length; ai++) {
    var applyBee = stateRef.bees[ai];
    if (!applyBee || !applyBee.mesh || applyBee.id === dragBeeId) { continue; }
    if (!shouldApplyBeePersonalSpace(applyBee)) { continue; }
    applyBee.mesh.position.add(offsets[applyBee.id]);
  }
}
