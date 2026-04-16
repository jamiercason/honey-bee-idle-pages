import { HIVE } from '../config/hiveConfig.js';
import { BEE_STATE } from '../data/enums.js';
import { BOARD_DIRECTIONS } from '../board/boardGraph.js';
import { getCellById } from '../board/boardQueries.js';

var beeBodyRef = null;
var beePoseRef = null;

export function setBeePoseRuntime(runtime) {
  beeBodyRef = runtime && runtime.beeBody ? runtime.beeBody : beeBodyRef;
  beePoseRef = runtime && runtime.beePose ? runtime.beePose : beePoseRef;
}

export function getCellWorldPos(cell) {
  var r = HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH;
  return new globalThis.THREE.Vector3(
    Math.cos(cell.theta) * r,
    cell.worldPos.y,
    Math.sin(cell.theta) * r
  );
}

export function getCellSurfaceNormal(cell) {
  return new globalThis.THREE.Vector3(
    Math.cos(cell.theta),
    0,
    Math.sin(cell.theta)
  );
}

export function projectOnPlane(vec, planeNormal) {
  var dot = vec.dot(planeNormal);
  return vec.clone().addScaledVector(planeNormal, -dot);
}

export function getFallbackSeatForward(cell, dirName) {
  var normal = getCellSurfaceNormal(cell);
  var worldUp = new globalThis.THREE.Vector3(0, 1, 0);
  var rise = projectOnPlane(worldUp, normal);
  if (rise.lengthSq() < 0.0001) {
    rise.set(0, 1, 0);
  } else {
    rise.normalize();
  }
  var around = new globalThis.THREE.Vector3().crossVectors(normal, rise);
  if (around.lengthSq() < 0.0001) {
    around.set(-Math.sin(cell.theta), 0, Math.cos(cell.theta));
  } else {
    around.normalize();
  }
  var diag = Math.sqrt(3) * 0.5;
  var half = 0.5;
  var dir = new globalThis.THREE.Vector3();
  switch (dirName) {
    case 'E': dir.copy(around); break;
    case 'W': dir.copy(around).multiplyScalar(-1); break;
    case 'NE': dir.copy(around).multiplyScalar(half).addScaledVector(rise, diag); break;
    case 'NW': dir.copy(around).multiplyScalar(-half).addScaledVector(rise, diag); break;
    case 'SE': dir.copy(around).multiplyScalar(half).addScaledVector(rise, -diag); break;
    case 'SW': dir.copy(around).multiplyScalar(-half).addScaledVector(rise, -diag); break;
    default: dir.copy(around); break;
  }
  dir = projectOnPlane(dir, normal);
  if (dir.lengthSq() < 0.0001) {
    dir.copy(around);
  }
  return dir.normalize();
}

export function getCellHexDirections(cell) {
  var dirs = [];
  for (var i = 0; i < BOARD_DIRECTIONS.length; i++) {
    var dirName = BOARD_DIRECTIONS[i];
    dirs.push({ name: dirName, vec: getFallbackSeatForward(cell, dirName) });
  }
  return dirs;
}

export function getCellRenderBasis(cell) {
  return {
    worldPos: getCellWorldPos(cell),
    normal: getCellSurfaceNormal(cell),
    hexDirections: getCellHexDirections(cell)
  };
}

export function getSharedFaceDirection(seatCell, targetCell) {
  var seatPos = getCellWorldPos(seatCell);
  var targetPos = getCellWorldPos(targetCell);
  var raw = targetPos.clone().sub(seatPos);
  var normal = getCellSurfaceNormal(seatCell);
  var tangent = projectOnPlane(raw, normal);
  var len = tangent.length();
  if (len < 0.0001) { return new globalThis.THREE.Vector3(0, 0, 0); }
  return tangent.divideScalar(len);
}

export function getSeatToTargetFaceDirection(seatCell, targetCell) {
  if (!seatCell || !targetCell) { return new globalThis.THREE.Vector3(0, 1, 0); }
  var sharedFace = getSharedFaceDirection(seatCell, targetCell);
  if (sharedFace.lengthSq() > 0.0001) { return sharedFace; }
  return getCellWorldPos(targetCell).clone().sub(getCellWorldPos(seatCell)).normalize();
}

export function computeWorkerBeeFrame(seatCell, targetCell) {
  var normal = getCellSurfaceNormal(seatCell);
  var forward = getSeatToTargetFaceDirection(seatCell, targetCell);

  if (forward.lengthSq() < 0.0001) {
    forward = new globalThis.THREE.Vector3(
      -Math.sin(seatCell.theta),
      0,
      Math.cos(seatCell.theta)
    );
  }

  var right = new globalThis.THREE.Vector3().crossVectors(forward, normal).normalize();
  if (right.lengthSq() < 0.0001) {
    right = new globalThis.THREE.Vector3().crossVectors(new globalThis.THREE.Vector3(0, 1, 0), normal).normalize();
  }

  var origin = getCellWorldPos(seatCell).clone();
  return { origin: origin, normal: normal, forward: forward, right: right };
}

export function applyWorkerBeePose(bee, frame, t) {
  var mesh = bee.mesh;
  var base = frame.origin.clone()
    .add(frame.normal.clone().multiplyScalar(beeBodyRef.SEAT_SURFACE_LIFT))
    .add(frame.forward.clone().multiplyScalar(-beeBodyRef.BODY_CENTER_BACKSET));

  var thrust = 0;
  var sway = 0;
  var bob = 0;
  if (bee.state === BEE_STATE.WORKING) {
    var wc = getCellById(bee.workTargetCellId);
    var intensity = wc ? 0.5 + (wc.activationProgress / (wc.activationRequired || 1)) : 0.5;
    thrust = Math.sin(t * 6) * beeBodyRef.WORK_THRUST_AMPLITUDE * intensity;
    sway = Math.sin(t * 10) * beeBodyRef.WORK_SWAY_AMPLITUDE * intensity;
    bob = Math.sin(t * 4) * beeBodyRef.WORK_BOB_AMPLITUDE * intensity;
  } else {
    bob = Math.sin(t * 2) * beeBodyRef.WORK_BOB_AMPLITUDE * 0.3;
  }

  base.add(frame.forward.clone().multiplyScalar(thrust + beeBodyRef.HEAD_FORWARD_OFFSET))
    .add(frame.right.clone().multiplyScalar(sway))
    .add(frame.normal.clone().multiplyScalar(bob));

  mesh.position.copy(base);

  var m = new globalThis.THREE.Matrix4();
  m.makeBasis(frame.right, frame.normal, frame.forward);
  mesh.quaternion.setFromRotationMatrix(m);
}

export function snapForwardToHexDirection(planarForward, hexDirections) {
  if (!planarForward || planarForward.lengthSq() < 0.0001 || !hexDirections || !hexDirections.length) {
    return { index: 0, name: 'E', vec: new globalThis.THREE.Vector3(1, 0, 0) };
  }
  var bestIndex = 0;
  var bestDot = -Infinity;
  for (var i = 0; i < hexDirections.length; i++) {
    var dir = hexDirections[i];
    var dot = planarForward.dot(dir.vec);
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = i;
    }
  }
  return {
    index: bestIndex,
    name: hexDirections[bestIndex].name,
    vec: hexDirections[bestIndex].vec.clone()
  };
}

export function buildBeePoseInput(bee) {
  if (!bee || !bee.seatCellId) { return null; }
  var seatCell = getCellById(bee.seatCellId);
  if (!seatCell) { return null; }
  var targetCell = bee.workTargetCellId ? getCellById(bee.workTargetCellId) : null;
  var seatBasis = getCellRenderBasis(seatCell);
  return {
    beeId: bee.id,
    beeState: bee.state,
    seatCellId: seatCell.id,
    targetCellId: targetCell ? targetCell.id : null,
    seatCell: seatCell,
    targetCell: targetCell,
    seatPos: seatBasis.worldPos.clone(),
    targetPos: targetCell ? getCellWorldPos(targetCell).clone() : null,
    seatNormal: seatBasis.normal.clone(),
    hexDirections: seatBasis.hexDirections
  };
}

export function computeBeeWorkingAnim(input, time) {
  if (input && input.beeState === BEE_STATE.WORKING) {
    return {
      peck: Math.sin(time * beePoseRef.WORK_PECK_SPEED) * beePoseRef.WORK_PECK_AMP,
      wiggle: Math.sin(time * beePoseRef.WORK_WIGGLE_SPEED) * beePoseRef.WORK_WIGGLE_AMP,
      bob: Math.sin(time * (beePoseRef.WORK_PECK_SPEED * 0.5)) * beePoseRef.WORK_BOB_AMP
    };
  }
  return {
    peck: 0,
    wiggle: Math.sin(time * (beePoseRef.IDLE_BREATH_SPEED * 0.6)) * (beePoseRef.WORK_WIGGLE_AMP * 0.22),
    bob: Math.sin(time * beePoseRef.IDLE_BREATH_SPEED) * beePoseRef.IDLE_BREATH_AMP
  };
}

export function computeBeePose(input, time) {
  if (!input) { return null; }
  var up = input.seatNormal.clone().normalize();
  var fallbackForward = (input.hexDirections && input.hexDirections.length)
    ? input.hexDirections[2].vec.clone()
    : getFallbackSeatForward(input.seatCell, 'E');
  var rawForward = input.targetPos
    ? input.targetPos.clone().sub(input.seatPos)
    : fallbackForward.clone();
  if (rawForward.lengthSq() < 0.0001) {
    rawForward.copy(fallbackForward);
  } else {
    rawForward.normalize();
  }

  var planarForward = projectOnPlane(rawForward, up);
  if (planarForward.lengthSq() < 0.0001) {
    planarForward.copy(fallbackForward);
  } else {
    planarForward.normalize();
  }

  var snapped = snapForwardToHexDirection(planarForward, input.hexDirections);
  var forward = snapped.vec.clone().normalize();
  var right = new globalThis.THREE.Vector3().crossVectors(up, forward).normalize();
  if (right.lengthSq() < 0.0001) {
    right = new globalThis.THREE.Vector3().crossVectors(new globalThis.THREE.Vector3(0, 1, 0), forward).normalize();
  }
  forward = new globalThis.THREE.Vector3().crossVectors(right, up).normalize();

  var anchorPos = input.seatPos.clone().addScaledVector(up, beePoseRef.SEAT_LIFT);
  var anim = computeBeeWorkingAnim(input, time);
  var headTargetOffset = beePoseRef.TARGET_EDGE_OFFSET;
  if (input.beeState === BEE_STATE.WORKING) {
    headTargetOffset += beePoseRef.WORK_TARGET_HEAD_BIAS;
  }
  var baseForwardOffset = headTargetOffset - beePoseRef.HEAD_TO_CENTER - beePoseRef.BODY_BACKSET;
  var bodyPos = anchorPos.clone()
    .addScaledVector(forward, baseForwardOffset + anim.peck)
    .addScaledVector(right, anim.wiggle)
    .addScaledVector(up, anim.bob);
  var basis = new globalThis.THREE.Matrix4();
  basis.makeBasis(right, up, forward);
  var quat = new globalThis.THREE.Quaternion().setFromRotationMatrix(basis);
  return {
    anchorPos: anchorPos,
    bodyPos: bodyPos,
    forward: forward,
    right: right,
    up: up,
    quat: quat,
    seatCellId: input.seatCellId,
    targetCellId: input.targetCellId,
    snappedDirIndex: snapped.index,
    snappedDirName: snapped.name,
    debugSeatPos: input.seatPos.clone(),
    debugTargetPos: input.targetPos ? input.targetPos.clone() : null
  };
}

export function applyBeePose(bee, pose) {
  if (!bee || !pose || !bee.mesh) { return; }
  bee.mesh.position.copy(pose.bodyPos);
  bee.mesh.quaternion.copy(pose.quat);
  bee.poseAnchor = pose.anchorPos.clone();
  bee.poseForward = pose.forward.clone();
  bee.poseRight = pose.right.clone();
  bee.poseUp = pose.up.clone();
  bee.poseDirIndex = pose.snappedDirIndex;
  bee.poseSeatCellId = pose.seatCellId;
  bee.poseTargetCellId = pose.targetCellId;
}
