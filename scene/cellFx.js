import { HIVE } from '../config/hiveConfig.js';
import { PRESENTATION } from '../config/presentationConfig.js';
import { BOOST_TYPE, CELL_STATE, OBSTACLE_CLASS, CELL_TYPE } from '../data/enums.js';
import { getCellWorldPos, getCellSurfaceNormal } from '../bees/beePose.js';
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

export function setCellFxRuntime(runtime) {
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  hiveGroupRef = runtime && runtime.hiveGroup ? runtime.hiveGroup : hiveGroupRef;
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getCellMeshMapRef = runtime && runtime.getCellMeshMap ? runtime.getCellMeshMap : getCellMeshMapRef;
  getCellVisualStateMapRef = runtime && runtime.getCellVisualStateMap ? runtime.getCellVisualStateMap : getCellVisualStateMapRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
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
  transient.unlockUntil = getSimTimeRef() + 0.9;
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
  spawnRewardBurst(worldPos, 'honey', Math.max(1, level || 1));
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

  if (!interactionDominant && vs.readyToCollect) {
    ready.visible = false;
    ready.material.opacity = 0;
    ready.position.set(0, 0, 0);
    readySpark.visible = false;
    readySpark.material.opacity = 0;
    readySpark.position.set(0, 0, 0);
  } else {
    ready.position.set(0, 0, 0);
    readySpark.position.set(0, 0, 0);
  }

  if (!interactionDominant && vs.isGoalCritical) {
    goal.visible = true;
    goal.material.opacity = 0.04 + Math.abs(Math.sin(t * 2.2 + cell.row * 0.12)) * 0.06;
    goal.material.color.setHex(cell.cellType === CELL_TYPE.GATE ? 0xffd56d : 0xffc78d);
    goal.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.46 + Math.abs(Math.sin(t * 2.0 + cell.row * 0.12)) * 0.06));
  }

  if (PRESENTATION.EVENT_FX_ENABLED && transient.unlockUntil > t) {
    var unlockT = (transient.unlockUntil - t) / 0.9;
    unlock.visible = true;
    unlock.material.opacity = Math.min(0.45, unlockT * 0.46);
    unlock.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.55 + (1 - unlockT) * 0.55));
  }

  if (PRESENTATION.EVENT_FX_ENABLED && transient.rewardUntil > t) {
    var rewardT = (transient.rewardUntil - t) / 1.1;
    reward.visible = true;
    reward.material.opacity = Math.min(0.52, rewardT * 0.52);
    reward.scale.setScalar(HIVE.HEX_CIRCUMRADIUS * (1.12 + (1 - rewardT) * 0.40));
  }

  if (PRESENTATION.EVENT_FX_ENABLED && transient.readyPulseUntil > t) {
    ready.visible = false;
    ready.material.opacity = 0;
    readySpark.visible = false;
    readySpark.material.opacity = 0;
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
