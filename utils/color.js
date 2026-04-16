import { saturate01 } from './math.js';

var _cellColorA = new globalThis.THREE.Color();
var _cellColorB = new globalThis.THREE.Color();

export function mixHex(a, b, t) {
  _cellColorA.setHex(a);
  _cellColorB.setHex(b);
  _cellColorA.lerp(_cellColorB, saturate01(t));
  return _cellColorA.getHex();
}

export function addHexTint(base, tint, amount) {
  _cellColorA.setHex(base);
  _cellColorB.setHex(tint);
  _cellColorA.lerp(_cellColorB, saturate01(amount));
  return _cellColorA.getHex();
}
