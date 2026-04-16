import { SCENE_ART } from '../config/sceneArtConfig.js';
import { featherCanvasEdges, makeLayerCanvas } from '../utils/canvas.js';
import { buildAmbientBeeTexture, buildCloudTexture, buildFlowerTexture, buildForegroundTexture, buildHorizonTexture, buildSkyTexture } from './textures.js';

export var sceneArt = {
  root: null,
  layers: {},
  groups: {},
  entities: {},
  pollen: [],
  pollenMat: null,
  pollenGeo: null
};

var sceneRef = null;
var cameraRef = null;
var getSimTimeRef = function() { return 0; };

export function setSceneArtRuntime(runtime) {
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  cameraRef = runtime && runtime.camera ? runtime.camera : cameraRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
}

function buildForegroundMaskTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(1024, 512);
  var ctx = c.getContext('2d');
  var blooms = ['rgba(255,255,255,0.86)', 'rgba(255,192,206,0.82)', 'rgba(255,181,100,0.82)', 'rgba(230,178,255,0.78)', 'rgba(255,236,145,0.80)'];
  var grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0.0, 'rgba(70,132,34,0.0)');
  grad.addColorStop(0.18, 'rgba(67,128,30,0.22)');
  grad.addColorStop(0.56, 'rgba(48,108,18,0.82)');
  grad.addColorStop(1.0, 'rgba(20,71,7,1.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  for (var i = 0; i < 460; i++) {
    var x = Math.random() * c.width;
    var y = c.height;
    var h = 56 + Math.random() * 132;
    ctx.strokeStyle = 'rgba(186,232,118,' + (0.18 + Math.random() * 0.18) + ')';
    ctx.lineWidth = 1 + Math.random() * 3.0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 34, y - h * 0.5, x + (Math.random() - 0.5) * 48, y - h);
    ctx.stroke();
  }

  for (var j = 0; j < 70; j++) {
    var edgeBias = Math.random() < 0.45;
    var xBand = edgeBias ? (0.03 + Math.random() * 0.24) : (0.73 + Math.random() * 0.24);
    if (Math.random() < 0.24) { xBand = 0.34 + Math.random() * 0.32; }
    var fx = xBand * c.width;
    var fy = c.height * (0.42 + Math.random() * 0.44);
    var fr = 10 + Math.random() * 26;
    ctx.globalAlpha = 0.14 + Math.random() * 0.14;
    ctx.fillStyle = blooms[j % blooms.length];
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,214,108,0.68)';
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  var centerDip = ctx.createRadialGradient(c.width * 0.5, c.height * 0.40, c.width * 0.05, c.width * 0.5, c.height * 0.40, c.width * 0.22);
  centerDip.addColorStop(0.0, 'rgba(255,255,255,0.06)');
  centerDip.addColorStop(0.64, 'rgba(255,255,255,0.015)');
  centerDip.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = centerDip;
  ctx.fillRect(0, 0, c.width, c.height);

  featherCanvasEdges(c, 0.05, 0.05, 0.34, 0.0);
  return new THREE.CanvasTexture(c);
}

export function makeArtPlane(width, height, map, opacity) {
  var THREE = globalThis.THREE;
  var mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: map,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false
    })
  );
  mesh.renderOrder = -100;
  return mesh;
}

function makeForegroundMaskPlane(width, height, map, opacity) {
  var THREE = globalThis.THREE;
  var mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: map,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false
    })
  );
  mesh.renderOrder = 250;
  return mesh;
}

export function buildSceneArtLayers() {
  var THREE = globalThis.THREE;
  var i;
  sceneRef.add(cameraRef);
  if (sceneArt.root && sceneArt.root.parent) { sceneArt.root.parent.remove(sceneArt.root); }
  sceneArt.root = new THREE.Group();
  sceneArt.root.position.set(0, 0, 0);
  cameraRef.add(sceneArt.root);
  sceneArt.layers = {};
  sceneArt.groups = {};
  sceneArt.entities = {
    clouds: [],
    flowers: [],
    ambientBees: [],
    pollen: []
  };

  function addGroup(key) {
    var group = new THREE.Group();
    group.name = key;
    sceneArt.groups[key] = group;
    sceneArt.root.add(group);
    return group;
  }

  var skyGroup = addGroup('bgSkyGroup');
  var cloudGroup = addGroup('bgCloudGroup');
  var horizonGroup = addGroup('bgHorizonGroup');
  var flowerGroup = addGroup('bgFlowerGroup');
  var ambientBeeGroup = addGroup('bgAmbientBeeGroup');
  var foregroundGroup = addGroup('bgForegroundGroup');
  var pollenGroup = addGroup('bgPollenGroup');

  sceneArt.layers.sky = makeArtPlane(120, 152, buildSkyTexture(), SCENE_ART.SKY_OPACITY);
  sceneArt.layers.sky.position.set(0, 1, SCENE_ART.BG_DEPTH_SKY_Z);
  skyGroup.add(sceneArt.layers.sky);

  sceneArt.layers.horizon = makeArtPlane(128, 54, buildHorizonTexture(), SCENE_ART.HORIZON_OPACITY);
  sceneArt.layers.horizon.position.set(0, -8.8, SCENE_ART.BG_DEPTH_HORIZON_Z);
  horizonGroup.add(sceneArt.layers.horizon);

  for (i = 0; i < 4; i++) {
    var cloud = makeArtPlane(34 + Math.random() * 18, 14 + Math.random() * 8, buildCloudTexture(), SCENE_ART.CLOUD_OPACITY);
    cloud.position.set(-28 + i * 18 + (Math.random() - 0.5) * 6, 7.5 + Math.random() * 6.5, SCENE_ART.BG_DEPTH_CLOUD_Z - i);
    cloud.userData.drift = 0.35 + Math.random() * 0.75;
    cloud.userData.baseX = cloud.position.x;
    cloud.userData.phase = Math.random() * Math.PI * 2;
    cloudGroup.add(cloud);
    sceneArt.entities.clouds.push(cloud);
  }
  sceneArt.layers.cloud = sceneArt.entities.clouds[0] || null;

  var flowerTex = buildFlowerTexture();
  for (i = 0; i < SCENE_ART.FLOWER_CLUSTER_COUNT; i++) {
    var side = (i % 2 === 0) ? -1 : 1;
    var flower = makeArtPlane(18 + Math.random() * 14, 12 + Math.random() * 10, flowerTex, SCENE_ART.FLOWER_OPACITY * (0.84 + Math.random() * 0.32));
    flower.position.set(side * (15.0 + Math.random() * 13.5), -9.6 - Math.random() * 7.8, SCENE_ART.BG_DEPTH_FLOWER_Z - Math.random() * 4);
    flower.userData.baseX = flower.position.x;
    flower.userData.baseY = flower.position.y;
    flower.userData.phase = Math.random() * Math.PI * 2;
    flower.userData.sway = 0.35 + Math.random() * 0.45;
    flowerGroup.add(flower);
    sceneArt.entities.flowers.push(flower);
  }
  sceneArt.layers.flowers = flowerGroup;

  var ambientBeeTex = buildAmbientBeeTexture();
  for (i = 0; i < SCENE_ART.AMBIENT_BEE_COUNT; i++) {
    var speck = makeArtPlane(1.0 + Math.random() * 0.8, 0.36 + Math.random() * 0.22, ambientBeeTex, 0.06 + Math.random() * 0.04);
    speck.position.set((Math.random() < 0.5 ? -1 : 1) * (10.5 + Math.random() * 14.0), -5 + Math.random() * 17, SCENE_ART.BG_DEPTH_AMBIENT_BEE_Z - Math.random() * 3);
    speck.userData.phase = Math.random() * Math.PI * 2;
    speck.userData.speed = SCENE_ART.AMBIENT_BEE_SPEED_MIN + Math.random() * (SCENE_ART.AMBIENT_BEE_SPEED_MAX - SCENE_ART.AMBIENT_BEE_SPEED_MIN);
    speck.userData.rangeX = 1.6 + Math.random() * 4.8;
    speck.userData.rangeY = 0.6 + Math.random() * 1.8;
    speck.userData.baseX = speck.position.x;
    speck.userData.baseY = speck.position.y;
    ambientBeeGroup.add(speck);
    sceneArt.entities.ambientBees.push(speck);
  }
  sceneArt.layers.ambientBees = ambientBeeGroup;

  sceneArt.layers.foreground = makeArtPlane(138, 40, buildForegroundTexture(), SCENE_ART.FOREGROUND_OPACITY);
  sceneArt.layers.foreground.position.set(0, -20.8, SCENE_ART.BG_DEPTH_FOREGROUND_Z);
  foregroundGroup.add(sceneArt.layers.foreground);
  sceneArt.layers.foregroundMask = makeForegroundMaskPlane(150, 54, buildForegroundMaskTexture(), 0.0);
  sceneArt.layers.foregroundMask.position.set(0, -16.6, -18);
  foregroundGroup.add(sceneArt.layers.foregroundMask);

  sceneArt.pollenGeo = new THREE.BufferGeometry();
  var pollenCount = SCENE_ART.POLLEN_COUNT;
  var pollenPos = new Float32Array(pollenCount * 3);
  var pollenSeed = new Float32Array(pollenCount);
  var pollenSize = new Float32Array(pollenCount);
  for (i = 0; i < pollenCount; i++) {
    var edgeSide = Math.random() < 0.5 ? -1 : 1;
    pollenPos[i * 3] = edgeSide * (6 + Math.random() * 14);
    pollenPos[i * 3 + 1] = -13 + Math.random() * 29;
    pollenPos[i * 3 + 2] = SCENE_ART.BG_DEPTH_FOREGROUND_Z - 2 - Math.random() * 18;
    pollenSeed[i] = Math.random() * Math.PI * 2;
    pollenSize[i] = SCENE_ART.POLLEN_SIZE_MIN + Math.random() * (SCENE_ART.POLLEN_SIZE_MAX - SCENE_ART.POLLEN_SIZE_MIN);
  }
  sceneArt.pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
  sceneArt.pollenGeo.setAttribute('seed', new THREE.BufferAttribute(pollenSeed, 1));
  sceneArt.pollenGeo.setAttribute('size', new THREE.BufferAttribute(pollenSize, 1));
  sceneArt.pollenMat = new THREE.PointsMaterial({
    color: 0xffefb5,
    size: 0.12,
    transparent: true,
    opacity: SCENE_ART.POLLEN_OPACITY,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false
  });
  sceneArt.layers.pollen = new THREE.Points(sceneArt.pollenGeo, sceneArt.pollenMat);
  sceneArt.layers.pollen.renderOrder = -90;
  pollenGroup.add(sceneArt.layers.pollen);
}

export function updateSceneArtLayers(rawDt, t) {
  if (!sceneArt.root) { return; }
  if (sceneArt.groups.bgSkyGroup) { sceneArt.groups.bgSkyGroup.visible = SCENE_ART.ENABLED && SCENE_ART.SKY_VISIBLE; }
  if (sceneArt.groups.bgCloudGroup) { sceneArt.groups.bgCloudGroup.visible = SCENE_ART.ENABLED && SCENE_ART.CLOUD_VISIBLE; }
  if (sceneArt.groups.bgHorizonGroup) { sceneArt.groups.bgHorizonGroup.visible = SCENE_ART.ENABLED && SCENE_ART.HORIZON_VISIBLE; }
  if (sceneArt.groups.bgFlowerGroup) { sceneArt.groups.bgFlowerGroup.visible = SCENE_ART.ENABLED && SCENE_ART.FLOWERS_VISIBLE; }
  if (sceneArt.groups.bgAmbientBeeGroup) { sceneArt.groups.bgAmbientBeeGroup.visible = SCENE_ART.ENABLED && SCENE_ART.AMBIENT_BEES_VISIBLE; }
  if (sceneArt.groups.bgForegroundGroup) { sceneArt.groups.bgForegroundGroup.visible = SCENE_ART.ENABLED && SCENE_ART.FOREGROUND_VISIBLE; }
  if (sceneArt.groups.bgPollenGroup) { sceneArt.groups.bgPollenGroup.visible = SCENE_ART.ENABLED && SCENE_ART.POLLEN_VISIBLE; }

  if (sceneArt.layers.sky && sceneArt.layers.sky.material) { sceneArt.layers.sky.material.opacity = SCENE_ART.SKY_OPACITY; }
  if (sceneArt.layers.horizon && sceneArt.layers.horizon.material) { sceneArt.layers.horizon.material.opacity = SCENE_ART.HORIZON_OPACITY; }
  if (sceneArt.layers.foreground && sceneArt.layers.foreground.material) { sceneArt.layers.foreground.material.opacity = SCENE_ART.FOREGROUND_OPACITY; }
  if (sceneArt.layers.foregroundMask && sceneArt.layers.foregroundMask.material) { sceneArt.layers.foregroundMask.material.opacity = 0.0; }

  for (var ci = 0; ci < sceneArt.entities.clouds.length; ci++) {
    var cloud = sceneArt.entities.clouds[ci];
    if (!cloud || !cloud.material) { continue; }
    cloud.material.opacity = SCENE_ART.CLOUD_OPACITY * (0.86 + Math.sin(t * 0.11 + cloud.userData.phase) * 0.08);
    cloud.position.x = cloud.userData.baseX + Math.sin(t * cloud.userData.drift * 0.22 + cloud.userData.phase) * 2.8;
    cloud.position.y = 10 + Math.sin(t * cloud.userData.drift * 0.15 + cloud.userData.phase) * 1.2;
  }

  for (var fi = 0; fi < sceneArt.entities.flowers.length; fi++) {
    var flower = sceneArt.entities.flowers[fi];
    if (!flower || !flower.material) { continue; }
    flower.material.opacity = SCENE_ART.FLOWER_OPACITY * (0.76 + Math.abs(Math.sin(t * 0.18 + flower.userData.phase)) * 0.18);
    flower.position.x = flower.userData.baseX + Math.sin(t * SCENE_ART.FLOWER_SWAY_SPEED + flower.userData.phase) * flower.userData.sway;
    flower.position.y = flower.userData.baseY + Math.cos(t * SCENE_ART.FLOWER_SWAY_SPEED * 0.8 + flower.userData.phase) * 0.18;
  }

  for (var ai = 0; ai < sceneArt.entities.ambientBees.length; ai++) {
    var ambient = sceneArt.entities.ambientBees[ai];
    if (!ambient || !ambient.material) { continue; }
    ambient.material.opacity = (0.035 + Math.abs(Math.sin(t * 0.55 + ambient.userData.phase)) * 0.04) * SCENE_ART.AMBIENT_BEES_VISIBLE;
    ambient.position.x = ambient.userData.baseX + Math.sin(t * ambient.userData.speed + ambient.userData.phase) * ambient.userData.rangeX;
    ambient.position.y = ambient.userData.baseY + Math.cos(t * ambient.userData.speed * 1.3 + ambient.userData.phase) * ambient.userData.rangeY;
  }

  if (sceneArt.pollenGeo) {
    var arr = sceneArt.pollenGeo.attributes.position.array;
    var seeds = sceneArt.pollenGeo.attributes.seed.array;
    for (var i = 0; i < seeds.length; i++) {
      arr[i * 3] += Math.sin(t * 0.4 + seeds[i]) * rawDt * SCENE_ART.POLLEN_DRIFT_X;
      arr[i * 3 + 1] += Math.cos(t * 0.8 + seeds[i] * 1.7) * rawDt * SCENE_ART.POLLEN_DRIFT_Y;
      if (arr[i * 3] > 17) { arr[i * 3] = -17; }
      if (arr[i * 3] < -17) { arr[i * 3] = 17; }
    }
    sceneArt.pollenGeo.attributes.position.needsUpdate = true;
    sceneArt.pollenMat.opacity = SCENE_ART.POLLEN_OPACITY;
  }
}

export function initSceneArt() {
  buildSceneArtLayers();
}

export function updateSceneArt(rawDt) {
  updateSceneArtLayers(rawDt, getSimTimeRef());
}
