import { PRESENTATION } from '../config/presentationConfig.js';
import { BEE_ROLE, BEE_STATE } from '../data/enums.js';
import { saturate01 } from '../utils/math.js';
import { getCellById } from '../board/boardQueries.js';
import { getCellWorldPos } from '../bees/beePose.js';
import { getBeeFlightFade } from '../bees/beeMovement.js';

export var beeFxMap = {};

var sceneRef = null;
var beeConfigRef = null;

export function setBeeFxRuntime(runtime) {
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : beeConfigRef;
}

export function buildBeeFx(bee) {
  var THREE = globalThis.THREE;
  if (!bee || beeFxMap[bee.id]) { return beeFxMap[bee.id] || null; }

  function makeFxSprite(color, scale, opacity) {
    var mat = new THREE.SpriteMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false
    });
    var spr = new THREE.Sprite(mat);
    spr.scale.set(scale, scale, 1);
    spr.visible = false;
    sceneRef.add(spr);
    return spr;
  }

  var fx = {
    trailRoot: new THREE.Group(),
    trailPoints: [],
    cargoGlow: makeFxSprite(0xffc468, 0.38, 0.0),
    buffOrbit: makeFxSprite(0x7be9ff, 0.48, 0.0),
    mergeBurstAnchor: new THREE.Group(),
    workerSpark: makeFxSprite(0xffd689, 0.22, 0.0)
  };
  sceneRef.add(fx.trailRoot);
  sceneRef.add(fx.mergeBurstAnchor);
  for (var i = 0; i < 5; i++) {
    var trail = makeFxSprite(0xffebb4, 0.18 + i * 0.02, 0.0);
    fx.trailPoints.push(trail);
  }
  beeFxMap[bee.id] = fx;
  return fx;
}

export function removeBeeFx(bee) {
  if (!bee || !beeFxMap[bee.id]) { return; }
  var fx = beeFxMap[bee.id];
  for (var i = 0; i < fx.trailPoints.length; i++) {
    sceneRef.remove(fx.trailPoints[i]);
    fx.trailPoints[i].material.dispose();
  }
  sceneRef.remove(fx.cargoGlow);
  sceneRef.remove(fx.buffOrbit);
  sceneRef.remove(fx.workerSpark);
  sceneRef.remove(fx.trailRoot);
  sceneRef.remove(fx.mergeBurstAnchor);
  fx.cargoGlow.material.dispose();
  fx.buffOrbit.material.dispose();
  fx.workerSpark.material.dispose();
  delete beeFxMap[bee.id];
}

export function updateBeeFx(bee, dt, t) {
  var THREE = globalThis.THREE;
  var fx = buildBeeFx(bee);
  if (!fx) { return; }
  if (!PRESENTATION.BEE_READABILITY_ENABLED) {
    for (var hi = 0; hi < fx.trailPoints.length; hi++) { fx.trailPoints[hi].visible = false; }
    fx.cargoGlow.visible = false;
    fx.buffOrbit.visible = false;
    fx.workerSpark.visible = false;
    return;
  }
  var fade = getBeeFlightFade(bee);
  if (!bee.mesh.visible || fade <= 0.08) {
    for (var zi = 0; zi < fx.trailPoints.length; zi++) { fx.trailPoints[zi].visible = false; }
    fx.cargoGlow.visible = false;
    fx.buffOrbit.visible = false;
    fx.workerSpark.visible = false;
    return;
  }
  var trailVisible = PRESENTATION.BEE_TRAILS_ENABLED && bee.role === BEE_ROLE.GATHERER && bee.travelT < 0.995 && fade > 0.03;
  var headPos = bee.mesh.position.clone();
  headPos.y += beeConfigRef.BODY_R * 0.18;

  for (var i = 0; i < fx.trailPoints.length; i++) {
    var tp = fx.trailPoints[i];
    if (!trailVisible) {
      tp.visible = false;
      continue;
    }
    if (!tp.userData.init) {
      tp.position.copy(headPos);
      tp.userData.init = true;
    }
    var lag = 0.15 + i * 0.08;
    tp.position.lerp(headPos, Math.min(1, dt * (7.0 - i * 0.8) * lag));
    tp.position.y += Math.sin(t * 4.0 + bee.id + i) * 0.01;
    tp.visible = true;
    tp.material.color.setHex(bee.carryNectar > 0 ? 0xffc46a : 0xffefc1);
    tp.material.opacity = (0.18 - i * 0.025) * fade;
    tp.scale.setScalar((0.18 + i * 0.02) * (bee.carryNectar > 0 ? 1.15 : 1.0));
  }

  fx.cargoGlow.visible = bee.carryNectar > 0 && fade > 0.06;
  if (fx.cargoGlow.visible) {
    fx.cargoGlow.position.copy(headPos).add(new THREE.Vector3(0, 0.18, 0));
    fx.cargoGlow.material.opacity = 0.18 + Math.abs(Math.sin(t * 5.0 + bee.id)) * 0.16;
  }

  var buffColor = 0;
  if (bee.royalJellyTimer > 0) { buffColor = 0x8aeaff; }
  else if (bee.mergeSurgeTimer > 0) { buffColor = 0xffc45a; }
  fx.buffOrbit.visible = !!buffColor && fade > 0.08;
  if (fx.buffOrbit.visible) {
    fx.buffOrbit.material.color.setHex(buffColor);
    fx.buffOrbit.material.opacity = 0.16 + Math.abs(Math.sin(t * 6.0 + bee.id)) * 0.14;
    fx.buffOrbit.position.copy(headPos);
    fx.buffOrbit.position.x += Math.cos(t * 3.4 + bee.id) * 0.18;
    fx.buffOrbit.position.y += 0.28 + Math.sin(t * 4.0 + bee.id) * 0.10;
    fx.buffOrbit.position.z += Math.sin(t * 3.4 + bee.id) * 0.18;
  }

  var working = bee.state === BEE_STATE.WORKING && bee.workTargetCellId;
  fx.workerSpark.visible = working && fade > 0.18;
  if (fx.workerSpark.visible) {
    var targetCell = getCellById(bee.workTargetCellId);
    var targetPos = targetCell ? getCellWorldPos(targetCell) : bee.pos;
    fx.workerSpark.position.copy(headPos).lerp(targetPos, 0.28);
    fx.workerSpark.position.y += 0.10 + Math.sin(t * 7.0 + bee.id) * 0.04;
    fx.workerSpark.material.opacity = (0.10 + Math.abs(Math.sin(t * 8.0 + bee.id)) * 0.16) * (targetCell && targetCell.activationRequired > 0 ? (0.7 + saturate01(targetCell.activationProgress / targetCell.activationRequired) * 0.4) : 1.0);
  }
}
