export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function saturate01(v) {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function inverseLerp(a, b, v) {
  if (Math.abs(b - a) < 0.00001) { return 0; }
  return (v - a) / (b - a);
}

export function smoothstep(edge0, edge1, x) {
  var t = clamp01(inverseLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
