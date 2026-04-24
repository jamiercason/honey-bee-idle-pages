import { HIVE } from '../config/hiveConfig.js';
import { PRESENTATION } from '../config/presentationConfig.js';
import { BOOST_TYPE, CELL_STATE, OBSTACLE_CLASS, CELL_TYPE } from '../data/enums.js';
import { getCellWorldPos, getCellSurfaceNormal } from '../bees/beePose.js';
import { makeLayerCanvas } from '../utils/canvas.js';
import { buildCellFxTextures } from './textures.js';
import { cellRadialLift, getCellVisualState } from './materials.js';

export var cellFxMap = {};
export var cellFxTransientMap = {};

var burstCallbacks = [];
var sceneRef = null;
var hiveGroupRef = null;
var stateRef = null;
var getCellMeshMapRef = function() { return {}; };
var getCellVisualStateMapRef = function() { return {}; };
var getSimTimeRef = function() { return 0; };
var triggerRewardBloomRef = function() {};
var triggerScreenShakeRef = function() {};
var comboTextureCache = {};

function clampPresentation(value, min, max, fallback) {
  if (value === undefined || value === null || !isFinite(value)) { return fallback; }
  return Math.max(min, Math.min(max, value));
}

export function setCellFxRuntime(runtime) {
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  hiveGroupRef = runtime && runtime.hiveGroup ? runtime.hiveGroup : hiveGroupRef;
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getCellMeshMapRef = runtime && runtime.getCellMeshMap ? runtime.getCellMeshMap : getCellMeshMapRef;
  getCellVisualStateMapRef = runtime && runtime.getCellVisualStateMap ? runtime.getCellVisualStateMap : getCellVisualStateMapRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
  triggerRewardBloomRef = runtime && runtime.triggerRewardBloom ? runtime.triggerRewardBloom : triggerRewardBloomRef;
  triggerScreenShakeRef = runtime && runtime.triggerScreenShake ? runtime.triggerScreenShake : triggerScreenShakeRef;
}

export function ensureCellFx(cell, mesh) {
  var THREE = globalThis.THREE;
  if (!cell || !mesh) { return null; }
  if (cellFxMap[cell.id]) { return cellFxMap[cell.id]; }
  var tex = buildCellFxTextures();

  function makeSprite(map, color, scale) {
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: map,
      color: color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      toneMapped: false
    }));
    spr.scale.set(scale, scale, 1);
    spr.visible = false;
    spr.renderOrder = 8;
    return spr;
  }

  var fx = {
    root: new THREE.Group(),
    crack: makeSprite(tex.crack, 0xffe7b1, HIVE.HEX_CIRCUMRADIUS * 1.30),
    activation: makeSprite(tex.pulse, 0xffcc74, HIVE.HEX_CIRCUMRADIUS * 1.95),
    ready: makeSprite(tex.gleam, 0xfff2b2, HIVE.HEX_CIRCUMRADIUS * 1.32),
    readySpark: makeSprite(tex.readySpark, 0xfff5ca, HIVE.HEX_CIRCUMRADIUS * 1.18),
    goal: makeSprite(tex.goal, 0xffd46a, HIVE.HEX_CIRCUMRADIUS * 1.72),
    unlock: makeSprite(tex.unlock, 0xffdfa1, HIVE.HEX_CIRCUMRADIUS * 1.92),
    reward: makeSprite(tex.reward, 0xffefb0, HIVE.HEX_CIRCUMRADIUS * 1.42),
    work: makeSprite(tex.work, 0xffcb73, HIVE.HEX_CIRCUMRADIUS * 1.28),
    honeyDripAnchor: new THREE.Group()
  };
  var drip = makeSprite(tex.drip, 0xffcf58, HIVE.HEX_CIRCUMRADIUS * 0.82);
  var moteA = makeSprite(tex.reward, 0xfff3bf, HIVE.HEX_CIRCUMRADIUS * 0.26);
  var moteB = makeSprite(tex.reward, 0xffefae, HIVE.HEX_CIRCUMRADIUS * 0.18);
  var moteC = makeSprite(tex.reward, 0xffe39a, HIVE.HEX_CIRCUMRADIUS * 0.14);
  fx.honeyDripAnchor.add(drip);
  fx.honeyDripAnchor.add(moteA);
  fx.honeyDripAnchor.add(moteB);
  fx.honeyDripAnchor.add(moteC);
  fx.honeyDripAnchor.userData.drip = drip;
  fx.honeyDripAnchor.userData.motes = [moteA, moteB, moteC];
  fx.root.visible = false;
  fx.honeyDripAnchor.visible = false;
  fx.root.add(fx.goal);
  fx.root.add(fx.unlock);
  fx.root.add(fx.reward);
  fx.root.add(fx.activation);
  fx.root.add(fx.crack);
  fx.root.add(fx.work);
  fx.root.add(fx.ready);
  fx.root.add(fx.readySpark);
  fx.root.add(fx.honeyDripAnchor);
  hiveGroupRef.add(fx.root);
  cellFxMap[cell.id] = fx;
  return fx;
}

export function ensureCellFxTransient(cell) {
  if (!cell) { return null; }
  if (!cellFxTransientMap[cell.id]) {
    cellFxTransientMap[cell.id] = {
      unlockUntil: 0,
      rewardUntil: 0,
      readyPulseUntil: 0,
      lastReadyState: !!cell.isReadyToCollect
    };
  }
  return cellFxTransientMap[cell.id];
}

export function triggerCellUnlockFx(cell) {
  if (!cell || !PRESENTATION.EVENT_FX_ENABLED) { return; }
  var transient = ensureCellFxTransient(cell);
  transient.unlockUntil = getSimTimeRef() + clampPresentation(PRESENTATION.UNLOCK_LIGHT_DURATION, 0.25, 2.0, 0.9);
  triggerRewardBloomRef(getCellWorldPos(cell), 0xffd46a, 0.46);
  if (cell.obstacleClass === OBSTACLE_CLASS.TREASURE || cell.rewardType || (cell.rewardTable && cell.rewardTable.length > 0)) {
    transient.rewardUntil = getSimTimeRef() + 1.1;
  }
}

export function triggerHoneyReadyFx(cell) {
  if (!cell || !PRESENTATION.EVENT_FX_ENABLED) { return; }
  var transient = ensureCellFxTransient(cell);
  transient.readyPulseUntil = getSimTimeRef() + 1.9;
  transient.lastReadyState = true;
}

export function triggerMergeFx(worldPos, level) {
  if (!PRESENTATION.EVENT_FX_ENABLED || !worldPos) { return; }
  spawnMergeFuse(worldPos, Math.max(1, level || 1));
}

function getComboBadgeTexture(stacks) {
  var THREE = globalThis.THREE;
  var key = Math.max(2, Math.round(stacks || 2));
  if (comboTextureCache[key]) { return comboTextureCache[key]; }
  var c = makeLayerCanvas(256, 256);
  var ctx = c.getContext('2d');
  var glow = ctx.createRadialGradient(128, 128, 18, 128, 128, 112);
  glow.addColorStop(0.0, 'rgba(255,255,255,0.98)');
  glow.addColorStop(0.24, 'rgba(255,238,174,0.94)');
  glow.addColorStop(0.60, 'rgba(255,181,58,0.52)');
  glow.addColorStop(1.0, 'rgba(255,181,58,0.0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,245,214,0.96)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(98,49,0,0.96)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 76px Arial';
  ctx.fillText('x' + key, 128, 122);
  ctx.fillStyle = 'rgba(255,249,224,0.92)';
  ctx.font = '700 28px Arial';
  ctx.fillText('combo', 128, 176);
  var tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  comboTextureCache[key] = tex;
  return tex;
}

export function triggerHoneyCollectFx(worldPos, amount, comboStacks) {
  var THREE = globalThis.THREE;
  if (!PRESENTATION.EVENT_FX_ENABLED || !sceneRef || !worldPos) { return; }
  var overflowIntensity = clampPresentation(PRESENTATION.HONEY_OVERFLOW_INTENSITY, 0, 2.0, 1.0);
  if (overflowIntensity <= 0.01) { return; }
  var comboIntensity = clampPresentation(PRESENTATION.COMBO_FEEDBACK_INTENSITY, 0, 2.0, 1.0);
  var amountScale = clampPresentation(Math.sqrt(Math.max(0.01, amount || 0)) / 3.2, 0.85, 1.9, 1.0);
  var comboScale = clampPresentation(1 + Math.max(0, (comboStacks || 1) - 1) * 0.12, 1.0, 1.7, 1.0);
  var dropCount = Math.max(4, Math.min(20, Math.round(clampPresentation(PRESENTATION.HONEY_OVERFLOW_COUNT, 4, 20, 10) * amountScale * 0.6)));
  triggerRewardBloomRef(worldPos, 0xffd36b, 0.58 * overflowIntensity * amountScale);
  if ((comboStacks || 1) >= 3) {
    triggerScreenShakeRef(0.16 + comboIntensity * 0.10);
  }
  var burstGroup = new THREE.Group();
  burstGroup.position.copy(worldPos);
  sceneRef.add(burstGroup);

  var ringGeo = new THREE.TorusGeometry(0.34, 0.022, 6, 28);
  var ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
    color: 0xffde82,
    emissive: 0xffbe48,
    emissiveIntensity: 1.8 * overflowIntensity * amountScale,
    roughness: 0.20,
    metalness: 0.0,
    transparent: true,
    opacity: 0.48
  }));
  ring.rotation.x = Math.PI / 2;
  burstGroup.add(ring);

  var dropletGeo = new THREE.SphereGeometry(0.055, 7, 6);
  var droplets = [];
  for (var di = 0; di < dropCount; di++) {
    var droplet = new THREE.Mesh(dropletGeo, new THREE.MeshStandardMaterial({
      color: di % 3 === 0 ? 0xfff0a8 : 0xffbe44,
      emissive: di % 3 === 0 ? 0xffcf5e : 0xffa52b,
      emissiveIntensity: 1.6 * overflowIntensity * amountScale,
      roughness: 0.16,
      metalness: 0.0,
      transparent: true,
      opacity: 0.96
    }));
    var side = Math.random() - 0.5;
    var lipY = -0.02 - Math.random() * 0.08;
    droplet.position.set(side * 0.26, lipY, (Math.random() - 0.5) * 0.14);
    droplets.push({
      mesh: droplet,
      vel: new THREE.Vector3(side * (0.34 + Math.random() * 0.40), -(0.28 + Math.random() * 0.42), (Math.random() - 0.5) * 0.22),
      gravity: 0.95 + Math.random() * 0.55,
      stretch: 0.70 + Math.random() * 0.55,
      wobble: Math.random() * Math.PI * 2,
      trailDelay: Math.random() * 0.12
    });
    burstGroup.add(droplet);
  }

  var comboBadge = null;
  if ((comboStacks || 0) > 1 && comboIntensity > 0.01) {
    comboBadge = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getComboBadgeTexture(comboStacks),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: true,
      toneMapped: false
    }));
    comboBadge.scale.set(1.35, 1.35, 1);
    comboBadge.position.set(0, 1.15, 0);
    comboBadge.renderOrder = 16;
    burstGroup.add(comboBadge);
  }

  var elapsed = 0;
  var duration = 0.92 + amountScale * 0.18;
  function animateCollect(rawDt) {
    elapsed += rawDt;
    var t = elapsed / duration;
    if (t >= 1.0) {
      droplets.forEach(function(d) { d.mesh.material.dispose(); });
      dropletGeo.dispose();
      ringGeo.dispose();
      ring.material.dispose();
      if (comboBadge && comboBadge.material) { comboBadge.material.dispose(); }
      sceneRef.remove(burstGroup);
      return;
    }
    var fade = 1.0 - t;
    var rise = Math.sin(Math.min(1.0, t * 1.12) * Math.PI);
    ring.scale.setScalar((0.84 + rise * 1.18) * amountScale);
    ring.material.opacity = fade * 0.30 * overflowIntensity;
    ring.material.emissiveIntensity = (1.0 + fade * 1.6) * overflowIntensity * amountScale;
    burstGroup.position.y = worldPos.y + Math.sin(Math.min(1.0, t) * Math.PI) * 0.06;
    droplets.forEach(function(d, idx) {
      var liveDt = Math.max(0, elapsed - d.trailDelay);
      if (liveDt <= 0) { return; }
      d.vel.y -= rawDt * d.gravity;
      d.mesh.position.addScaledVector(d.vel, rawDt);
      d.mesh.position.x += Math.sin(elapsed * 6.5 + d.wobble + idx) * rawDt * 0.035;
      d.mesh.scale.set(
        0.18 + fade * d.stretch * 0.42,
        0.26 + fade * (0.54 + d.stretch * 0.28),
        0.18 + fade * d.stretch * 0.42
      );
      d.mesh.material.opacity = Math.min(1, fade * 1.15) * overflowIntensity;
      d.mesh.material.emissiveIntensity = (0.8 + fade * 2.0 + Math.abs(Math.sin(elapsed * 10 + idx)) * 0.6) * overflowIntensity * amountScale;
    });
    if (comboBadge) {
      comboBadge.material.opacity = Math.min(0.92, rise * 0.92 * comboIntensity);
      comboBadge.position.y = 0.86 + rise * 0.72;
      comboBadge.scale.setScalar(1.00 + rise * 0.50 * comboIntensity * comboScale);
    }
    queueBurstCallback(animateCollect);
  }
  queueBurstCallback(animateCollect);
}

export function spawnMergeFuse(pos, newLevel) {
  var THREE = globalThis.THREE;
  if (!sceneRef || !pos) { return; }
  var intensity = clampPresentation(PRESENTATION.MERGE_FUSE_INTENSITY, 0, 2.0, 1.0);
  if (intensity <= 0.01) { return; }
  triggerRewardBloomRef(pos, newLevel >= 5 ? 0xff8a2b : 0xffcf63, 0.48 + newLevel * 0.04);
  if (newLevel >= 3) {
    triggerScreenShakeRef(0.14 + newLevel * 0.035);
  }
  var fuseGroup = new THREE.Group();
  fuseGroup.position.copy(pos);
  sceneRef.add(fuseGroup);

  var burstColor = newLevel >= 5 ? 0xff7a22 : (newLevel >= 3 ? 0xffb12f : 0xffdf5a);
  var ringGeo = new THREE.TorusGeometry(0.44, 0.025, 6, 36);
  var ringMat = new THREE.MeshStandardMaterial({
    color: 0xffd873,
    emissive: burstColor,
    emissiveIntensity: 2.2 * intensity,
    roughness: 0.22,
    metalness: 0.0,
    transparent: true,
    opacity: 0.75
  });
  var ringA = new THREE.Mesh(ringGeo, ringMat.clone());
  var ringB = new THREE.Mesh(ringGeo, ringMat.clone());
  ringA.rotation.x = Math.PI / 2;
  ringB.rotation.x = Math.PI / 2;
  ringB.rotation.z = Math.PI * 0.5;
  fuseGroup.add(ringA);
  fuseGroup.add(ringB);

  var dropletGeo = new THREE.SphereGeometry(0.052, 7, 6);
  var droplets = [];
  var dropletCount = Math.max(6, Math.round(8 + newLevel * 1.4));
  for (var di = 0; di < dropletCount; di++) {
    var mat = new THREE.MeshStandardMaterial({
      color: di % 2 === 0 ? 0xffd36a : burstColor,
      emissive: di % 2 === 0 ? 0xffb735 : burstColor,
      emissiveIntensity: 1.8 * intensity,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.92
    });
    var drop = new THREE.Mesh(dropletGeo, mat);
    var side = di % 2 === 0 ? -1 : 1;
    var radius = 0.48 + Math.random() * 0.26;
    var theta = (di / dropletCount) * Math.PI * 2;
    drop.position.set(Math.cos(theta) * radius * side, (Math.random() - 0.5) * 0.18, Math.sin(theta) * radius);
    droplets.push({
      mesh: drop,
      side: side,
      theta: theta,
      radius: radius,
      lift: (Math.random() - 0.5) * 0.18,
      spin: (Math.random() - 0.5) * 5.0
    });
    fuseGroup.add(drop);
  }

  var elapsed = 0;
  var duration = 0.78;
  function animateFuse(rawDt) {
    elapsed += rawDt;
    var ft = elapsed / duration;
    if (ft >= 1.0) {
      droplets.forEach(function(d) { d.mesh.material.dispose(); });
      ringGeo.dispose();
      ringA.material.dispose();
      ringB.material.dispose();
      dropletGeo.dispose();
      sceneRef.remove(fuseGroup);
      return;
    }
    var fade = 1.0 - ft;
    var squeeze = Math.max(0.06, 1.0 - ft * 0.86);
    ringA.scale.setScalar(0.55 + ft * 1.15);
    ringB.scale.setScalar(0.85 - ft * 0.42);
    ringA.rotation.z += rawDt * (3.2 + newLevel * 0.2);
    ringB.rotation.z -= rawDt * (2.4 + newLevel * 0.18);
    ringA.material.opacity = fade * 0.38 * intensity;
    ringB.material.opacity = fade * 0.48 * intensity;
    ringA.material.emissiveIntensity = (1.0 + fade * 2.2) * intensity;
    ringB.material.emissiveIntensity = (1.0 + fade * 2.4) * intensity;
    droplets.forEach(function(d, idx) {
      var spiral = d.theta + ft * Math.PI * (1.45 + idx * 0.02) * d.side;
      var radius = d.radius * squeeze;
      d.mesh.position.set(Math.cos(spiral) * radius, d.lift + Math.sin(ft * Math.PI) * 0.28, Math.sin(spiral) * radius);
      d.mesh.rotation.y += rawDt * d.spin;
      d.mesh.scale.setScalar(0.34 + fade * 0.74);
      d.mesh.material.opacity = Math.min(1, fade * 1.15) * intensity;
      d.mesh.material.emissiveIntensity = (1.2 + fade * 2.0 + Math.abs(Math.sin(elapsed * 16 + idx)) * 0.8) * intensity;
    });
    queueBurstCallback(animateFuse);
  }
  queueBurstCallback(animateFuse);
}

export function updateCellFx(cell, fx, vs, dt, t) {
  if (!fx || !vs) { return; }
  if (!PRESENTATION.CELL_FX_ENABLED) {
    fx.root.visible = false;
    return;
  }

  var transient = ensureCellFxTransient(cell);
  var normal = getCellSurfaceNormal(cell);
  var basePos = getCellWorldPos(cell).clone().addScaledVector(normal, 0.18 + cellRadialLift(cell));
  fx.root.visible = true;
  fx.root.position.copy(basePos);

  var crack = fx.crack;
  var activation = fx.activation;
  var ready = fx.ready;
  var readySpark = fx.readySpark;
  var goal = fx.goal;
  var unlock = fx.unlock;
  var reward = fx.reward;
  var work = fx.work;
  var honeyDripAnchor = fx.honeyDripAnchor;

  crack.visible = false;
  activation.visible = false;
  ready.visible = false;
  readySpark.visible = false;
  goal.visible = false;
  unlock.visible = false;
  reward.visible = false;
  work.visible = false;
  honeyDripAnchor.visible = false;

  var interactionDominant =
    vs.highlightReason === 'invalid_target' ||
    vs.highlightReason === 'valid_target' ||
    vs.highlightReason === 'selected';
  var goalDominant = (vs.highlightReason === 'goal');
  var readyDominant = (vs.highlightReason === 'ready');
  var workDominant = (vs.highlightReason === 'working');
  var activationDominant = (vs.highlightReason === 'near_activation');

  if (!interactionDominant && cell.state === CELL_STATE.OBSTACLE && (vs.workProgress > 0.04 || vs.isBeingWorked)) {
    work.visible = true;
    work.material.opacity = 0.03 + vs.workProgress * 0.12 + Math.abs(Math.sin(t * 6.0 + cell.col)) * 0.04;
    work.material.color.setHex(vs.isNearClear ? 0xffe39f : 0xffcb73);
    work.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.06 + vs.workProgress * 0.18));
  }

  if (!interactionDominant && !goalDominant && cell.state === CELL_STATE.DORMANT && cell.nectarRequired > 0 && cell.nectarStored > 0.01) {
    activation.visible = true;
    activation.material.opacity = 0.06 + vs.activationProgress * 0.18 + Math.abs(Math.sin(t * 3.6 + cell.col * 0.4)) * 0.05;
    activation.material.color.setHex(activationDominant ? 0xffd981 : 0xffc46d);
    activation.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.58 + vs.activationProgress * 0.36 + Math.sin(t * 2.5 + cell.col * 0.2) * 0.05));
  }

  ready.position.set(0, 0, 0);
  readySpark.position.set(0, 0, 0);

  if (!interactionDominant && vs.isGoalCritical) {
    goal.visible = true;
    goal.material.opacity = 0.04 + Math.abs(Math.sin(t * 2.2 + cell.row * 0.12)) * 0.06;
    goal.material.color.setHex(cell.cellType === CELL_TYPE.GATE ? 0xffd56d : 0xffc78d);
    goal.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.46 + Math.abs(Math.sin(t * 2.0 + cell.row * 0.12)) * 0.06));
  }

  if (PRESENTATION.EVENT_FX_ENABLED && transient.unlockUntil > t) {
    var unlockDuration = clampPresentation(PRESENTATION.UNLOCK_LIGHT_DURATION, 0.25, 2.0, 0.9);
    var unlockIntensity = clampPresentation(PRESENTATION.UNLOCK_LIGHT_INTENSITY, 0, 2.0, 1.0);
    var unlockT = Math.max(0, Math.min(1, (transient.unlockUntil - t) / unlockDuration));
    var unlockElapsed = 1.0 - unlockT;
    unlock.visible = true;
    unlock.material.color.setHex(0xffd46a);
    unlock.material.opacity = Math.min(0.52, Math.sin(unlockElapsed * Math.PI) * 0.36 * unlockIntensity + unlockT * 0.14 * unlockIntensity);
    unlock.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.18 + unlockElapsed * (0.86 + unlockIntensity * 0.18)));
    activation.visible = true;
    activation.material.color.setHex(0xffbb46);
    activation.material.opacity = Math.max(activation.material.opacity || 0, Math.sin(unlockElapsed * Math.PI) * 0.16 * unlockIntensity);
    activation.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.36 + unlockElapsed * 0.78));
  }

  if (PRESENTATION.EVENT_FX_ENABLED && transient.rewardUntil > t) {
    var rewardT = (transient.rewardUntil - t) / 1.1;
    reward.visible = true;
    reward.material.opacity = Math.min(0.52, rewardT * 0.52);
    reward.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.12 + (1 - rewardT) * 0.40));
  }

  if (PRESENTATION.EVENT_FX_ENABLED && transient.readyPulseUntil > t) {
    var readyIntensity = clampPresentation(PRESENTATION.HONEY_READY_FX_INTENSITY, 0, 2.0, 1.0);
    var readyT = Math.max(0, Math.min(1, (transient.readyPulseUntil - t) / 1.9));
    var readyElapsed = 1.0 - readyT;
    var readyWave = Math.sin(readyElapsed * Math.PI);
    ready.visible = !interactionDominant && readyIntensity > 0.01;
    ready.material.color.setHex(0xffd15c);
    ready.material.opacity = ready.visible ? Math.min(0.48, (readyWave * 0.30 + readyT * 0.08) * readyIntensity) : 0;
    ready.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.02 + readyElapsed * 0.48 + readyIntensity * 0.06));
    readySpark.visible = ready.visible;
    readySpark.material.color.setHex(0xfff0a8);
    readySpark.material.opacity = readySpark.visible ? Math.min(0.54, (0.16 + Math.abs(Math.sin(t * 8.5 + cell.id)) * 0.22) * readyT * readyIntensity) : 0;
    readySpark.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (0.82 + Math.sin(t * 5.0 + cell.id) * 0.04));
    honeyDripAnchor.visible = ready.visible;
    if (honeyDripAnchor.visible) {
      var drip = honeyDripAnchor.userData.drip;
      var motes = honeyDripAnchor.userData.motes || [];
      var dripCount = Math.max(0, Math.min(motes.length, Math.round(clampPresentation(PRESENTATION.HONEY_READY_DRIP_COUNT, 0, motes.length, 3))));
      honeyDripAnchor.position.set(0, -HIVE.HEX_CIRCUMRADIUS * 0.18, 0);
      if (drip) {
        drip.visible = true;
        drip.material.color.setHex(0xffc247);
        drip.material.opacity = Math.min(0.62, readyWave * 0.42 * readyIntensity);
        drip.position.set(0, -HIVE.HEX_CIRCUMRADIUS * (0.16 + readyElapsed * 0.32), 0);
        drip.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (0.34 + readyT * 0.14));
      }
      for (var mi = 0; mi < motes.length; mi++) {
        var mote = motes[mi];
        var moteOn = mi < dripCount;
        mote.visible = moteOn;
        if (!moteOn) { continue; }
        var phase = readyElapsed + mi * 0.18;
        var fall = phase % 1.0;
        var side = (mi - 1) * HIVE.HEX_CIRCUMRADIUS * 0.16;
        mote.material.color.setHex(mi === 0 ? 0xfff0a8 : 0xffc95a);
        mote.material.opacity = Math.max(0, (1.0 - fall) * 0.32 * readyIntensity);
        mote.position.set(side + Math.sin(t * 4.0 + mi) * 0.03, -HIVE.HEX_CIRCUMRADIUS * (0.02 + fall * 0.52), 0);
        mote.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (0.10 + (1.0 - fall) * 0.06));
      }
    }
  }

  if (!crack.visible && !activation.visible && !ready.visible && !readySpark.visible && !goal.visible && !unlock.visible && !reward.visible && !work.visible && !honeyDripAnchor.visible) {
    fx.root.visible = false;
  }
}

export function updateCellVfx(dt) {
  if (!stateRef) { return; }
  var cellMeshMap = getCellMeshMapRef();
  var cellVisualStateMap = getCellVisualStateMapRef();
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    var mesh = cellMeshMap[cell.id];
    if (!mesh) { continue; }
    var fx = ensureCellFx(cell, mesh);
    var vs = cellVisualStateMap[cell.id] || getCellVisualState(cell);
    if (!fx) { continue; }
    updateCellFx(cell, fx, vs, dt, getSimTimeRef());
  }
}

export function queueBurstCallback(fn) {
  burstCallbacks.push(fn);
}

export function updateBurstCallbacks(rawDt) {
  if (burstCallbacks.length <= 0) { return; }
  var pending = burstCallbacks.splice(0, burstCallbacks.length);
  for (var bci = 0; bci < pending.length; bci++) { pending[bci](rawDt); }
}

export function spawnLevelCompleteBurst(pos) {
  var THREE = globalThis.THREE;
  triggerRewardBloomRef(pos, 0xffee8a, 1.15);
  triggerScreenShakeRef(0.48);
  var count = 24;
  var particles = [];
  var burstGroup = new THREE.Group();
  sceneRef.add(burstGroup);
  var pGeo = new THREE.SphereGeometry(0.07, 5, 5);
  var colors = [0xffee44, 0xff8800, 0xffffff, 0xffcc00];
  for (var pi = 0; pi < count; pi++) {
    var col = colors[pi % colors.length];
    var pMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.5, roughness: 0.0, transparent: true, opacity: 1.0 });
    var p = new THREE.Mesh(pGeo, pMat);
    var angle = (pi / count) * Math.PI * 2;
    var r = 0.5 + Math.random() * 1.5;
    p.position.set(pos.x + Math.cos(angle) * r, pos.y, pos.z + Math.sin(angle) * r);
    particles.push({ mesh: p, vel: new THREE.Vector3((Math.random() - 0.5) * 2.0, 2.5 + Math.random() * 3.0, (Math.random() - 0.5) * 2.0) });
    burstGroup.add(p);
  }

  var rings = [];
  for (var ri = 0; ri < 3; ri++) {
    var rGeo = new THREE.TorusGeometry(0.6 + ri * 0.4, 0.06, 6, 24);
    var rMat = new THREE.MeshStandardMaterial({ color: 0xffee44, emissive: 0xffcc00, emissiveIntensity: 3.0 });
    var ring = new THREE.Mesh(rGeo, rMat);
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    sceneRef.add(ring);
    rings.push(ring);
  }

  var elapsed = 0;
  var duration = 1.8;
  function animateComplete(rawDt) {
    elapsed += rawDt;
    var t = elapsed / duration;
    if (t >= 1.0) {
      particles.forEach(function(p) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
      pGeo.dispose();
      sceneRef.remove(burstGroup);
      rings.forEach(function(r) { r.geometry.dispose(); r.material.dispose(); sceneRef.remove(r); });
      return;
    }
    var fade = 1.0 - t;
    particles.forEach(function(p) {
      p.mesh.position.addScaledVector(p.vel, rawDt);
      p.vel.y -= rawDt * 1.8;
      p.mesh.material.opacity = fade;
      p.mesh.scale.setScalar(0.3 + fade * 0.8);
    });
    rings.forEach(function(r, idx) {
      var rt = Math.max(0, t - idx * 0.15);
      r.scale.setScalar(1.0 + rt * 4.0);
      r.material.emissiveIntensity = 3.0 * Math.max(0, 1.0 - rt * 1.5);
      r.position.y = pos.y + rt * 2.5;
    });
    queueBurstCallback(animateComplete);
  }
  queueBurstCallback(animateComplete);
}

export function spawnMergeBurst(pos, newLevel) {
  var THREE = globalThis.THREE;
  var particleCount = 26;
  var particles = [];
  var burstGroup = new THREE.Group();
  sceneRef.add(burstGroup);
  var pGeo = new THREE.SphereGeometry(0.045, 4, 4);
  var burstColor = newLevel >= 5 ? 0xff6600 : (newLevel >= 3 ? 0xffaa00 : 0xffee44);
  var pMat = new THREE.MeshStandardMaterial({ color: burstColor, emissive: burstColor, emissiveIntensity: 2.3, roughness: 0.0, transparent: true, opacity: 1.0 });
  for (var pi = 0; pi < particleCount; pi++) {
    var p = new THREE.Mesh(pGeo, pMat.clone());
    var theta = (pi / particleCount) * Math.PI * 2;
    var phi = Math.random() * Math.PI;
    p.position.copy(pos);
    particles.push({
      mesh: p,
      vel: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * (1.8 + Math.random() * 1.4),
        Math.cos(phi) * (2.2 + Math.random() * 1.9) + 0.8,
        Math.sin(phi) * Math.sin(theta) * (1.8 + Math.random() * 1.4)
      ),
      spin: (Math.random() - 0.5) * 10.0,
      twinkle: Math.random() * Math.PI * 2,
      liftBias: 0.6 + Math.random() * 0.8
    });
    burstGroup.add(p);
  }

  var elapsed = 0;
  var duration = 0.82;
  function animateBurst(rawDt) {
    elapsed += rawDt;
    var t = elapsed / duration;
    if (t >= 1.0) {
      particles.forEach(function(p) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
      pGeo.dispose();
      sceneRef.remove(burstGroup);
      return;
    }
    var fade = 1.0 - t;
    particles.forEach(function(p) {
      p.mesh.position.addScaledVector(p.vel, rawDt);
      p.vel.y -= rawDt * (2.0 + p.liftBias * 0.8);
      p.mesh.rotation.y += rawDt * p.spin;
      p.mesh.material.opacity = fade * (0.72 + Math.abs(Math.sin(elapsed * 18.0 + p.twinkle)) * 0.28);
      p.mesh.material.emissiveIntensity = 1.4 + fade * 1.8 + Math.abs(Math.sin(elapsed * 16.0 + p.twinkle)) * 0.8;
      p.mesh.scale.setScalar(0.18 + fade * 0.52);
    });
    queueBurstCallback(animateBurst);
  }
  queueBurstCallback(animateBurst);
}

export function spawnRewardBurst(pos, rewardType, amount) {
  var THREE = globalThis.THREE;
  var particleCount = 22;
  var particles = [];
  var burstGroup = new THREE.Group();
  sceneRef.add(burstGroup);
  var burstColor = 0xffcc00;
  if (rewardType === 'nectar') {
    burstColor = 0x44dd88;
  } else if (rewardType === BOOST_TYPE.ROYAL_JELLY) {
    burstColor = 0x7be9ff;
  }
  triggerRewardBloomRef(pos, burstColor, 0.40 + clampPresentation(Math.sqrt(Math.max(1, amount || 1)) * 0.06, 0.08, 0.40, 0.12));
  var pGeo = new THREE.SphereGeometry(0.04, 5, 5);
  var pMat = new THREE.MeshStandardMaterial({ color: burstColor, emissive: burstColor, emissiveIntensity: 2.2, roughness: 0.0, transparent: true, opacity: 1.0 });
  for (var pi = 0; pi < particleCount; pi++) {
    var p = new THREE.Mesh(pGeo, pMat.clone());
    var theta = (pi / particleCount) * Math.PI * 2;
    var upBias = 0.7 + Math.random() * 1.0;
    p.position.copy(pos);
    particles.push({
      mesh: p,
      vel: new THREE.Vector3(Math.cos(theta) * (1.0 + Math.random() * 1.1), upBias * (1.8 + Math.random() * 1.2), Math.sin(theta) * (1.0 + Math.random() * 1.1)),
      spin: (Math.random() - 0.5) * 12.0,
      twinkle: Math.random() * Math.PI * 2
    });
    burstGroup.add(p);
  }

  var elapsed = 0;
  var duration = 0.85;
  function animateReward(rawDt) {
    elapsed += rawDt;
    var t = elapsed / duration;
    if (t >= 1.0) {
      particles.forEach(function(p) { p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
      pGeo.dispose();
      sceneRef.remove(burstGroup);
      return;
    }
    var fade = 1.0 - t;
    particles.forEach(function(p) {
      p.mesh.position.addScaledVector(p.vel, rawDt);
      p.vel.y -= rawDt * 2.5;
      p.mesh.rotation.y += rawDt * p.spin;
      p.mesh.material.opacity = fade * (0.70 + Math.abs(Math.sin(elapsed * 15.0 + p.twinkle)) * 0.30);
      p.mesh.material.emissiveIntensity = 1.4 + fade * 1.5 + Math.abs(Math.sin(elapsed * 14.0 + p.twinkle)) * 0.7;
      p.mesh.scale.setScalar(0.16 + fade * 0.46);
    });
    queueBurstCallback(animateReward);
  }
  queueBurstCallback(animateReward);
}
