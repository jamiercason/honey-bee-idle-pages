import { clamp01 } from './math.js';

export function normalizeAngle(angle) {
  while (angle > Math.PI) { angle -= Math.PI * 2; }
  while (angle < -Math.PI) { angle += Math.PI * 2; }
  return angle;
}

export function shortestAngleDelta(from, to) {
  var d = to - from;
  while (d > Math.PI) { d -= Math.PI * 2; }
  while (d < -Math.PI) { d += Math.PI * 2; }
  return d;
}

export function lerpAngle(from, to, t) {
  return from + shortestAngleDelta(from, to) * clamp01(t);
}

export function cellThetaToCameraTheta(cellTheta) {
  return normalizeAngle((Math.PI * 0.5) - cellTheta);
}
