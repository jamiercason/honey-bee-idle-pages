import { LIGHTING } from '../config/lightingConfig.js';
import { createBeeMesh } from '../bees/beeFactory.js';

var THREE = globalThis.THREE;

var previewRenderer = null;
var previewScene = null;
var previewCamera = null;
var previewClock = new THREE.Clock();
var previewTheta = 0;
var previewActive = false;
var previewMode = 'single';
var previewLevel = 1;
var previewBeeGroups = [];
var previewAnimFrame = null;
var PREVIEW_SPREAD = 2.2;
var PREVIEW_CAM_DIST = 3.2;
var PREVIEW_CAM_DIST_ALL = 9.5;

export function findChild(group, name) {
  for (var ci = 0; ci < group.children.length; ci++) {
    if (group.children[ci].name === name) { return group.children[ci]; }
  }
  return null;
}

function initPreviewRenderer() {
  if (previewRenderer) { return; }
  previewRenderer = new THREE.WebGLRenderer({ canvas: document.getElementById('preview-canvas'), antialias: true, alpha: true, powerPreference: 'high-performance' });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  previewRenderer.outputEncoding = THREE.sRGBEncoding;
  previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  previewRenderer.toneMappingExposure = LIGHTING.EXPOSURE;
  previewRenderer.physicallyCorrectLights = true;
  previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0xcbe8ff);
  previewScene.fog = new THREE.FogExp2(LIGHTING.FOG_COLOR, LIGHTING.FOG_DENSITY * 0.42);
  previewScene.add(new THREE.HemisphereLight(LIGHTING.SKY_COLOR, LIGHTING.SKY_GROUND, LIGHTING.SKY_INTENSITY));
  var key = new THREE.DirectionalLight(LIGHTING.KEY_COLOR, LIGHTING.KEY_INTENSITY);
  key.position.set(3.4, 5.4, 4.2);
  previewScene.add(key);
  var rim = new THREE.DirectionalLight(LIGHTING.RIM_COLOR, LIGHTING.RIM_INTENSITY);
  rim.position.set(-4, 2.5, -5);
  previewScene.add(rim);
  var bounce = new THREE.PointLight(LIGHTING.BOUNCE_COLOR, LIGHTING.BOUNCE_INTENSITY * 0.9, 20);
  bounce.position.set(0, -2.8, 3.5);
  previewScene.add(bounce);
  var wrap = document.getElementById('preview-canvas-wrap');
  var w = wrap.clientWidth || window.innerWidth;
  var h = wrap.clientHeight || window.innerHeight - 160;
  previewCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  previewCamera.position.set(0, 0.5, PREVIEW_CAM_DIST);
  previewCamera.lookAt(0, 0, 0);
  previewRenderer.setSize(w, h);
}

function clearPreviewBees() {
  for (var i = 0; i < previewBeeGroups.length; i++) {
    previewBeeGroups[i].traverse(function(obj) {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (obj.material.map) { obj.material.map.dispose(); }
        obj.material.dispose();
      }
    });
    previewScene.remove(previewBeeGroups[i]);
  }
  previewBeeGroups = [];
}

function buildPreviewBees(mode, level) {
  clearPreviewBees();
  if (mode === 'all') {
    var total = 6;
    var startX = -(total - 1) * PREVIEW_SPREAD * 0.5;
    for (var i = 0; i < total; i++) {
      var grp = createBeeMesh(i + 1);
      grp.position.set(startX + i * PREVIEW_SPREAD, 0, 0);
      grp.scale.setScalar(2.8);
      grp.rotation.y = Math.PI;
      previewScene.add(grp);
      previewBeeGroups.push(grp);
    }
    previewCamera.position.set(0, 0.8, PREVIEW_CAM_DIST_ALL);
    previewCamera.lookAt(0, 0, 0);
  } else {
    var singleGrp = createBeeMesh(level);
    singleGrp.scale.setScalar(4.2);
    singleGrp.position.set(0, -0.2, 0);
    singleGrp.rotation.y = Math.PI;
    previewScene.add(singleGrp);
    previewBeeGroups.push(singleGrp);
    previewCamera.position.set(0, 0.6, PREVIEW_CAM_DIST);
    previewCamera.lookAt(0, -0.2, 0);
  }
}

function updatePreviewInfo(mode, level) {
  var infoEl = document.getElementById('preview-info');
  if (mode === 'all') {
    infoEl.textContent = 'All levels - stripes and accent colour by level';
  } else {
    var levelT = Math.min(level - 1, 5) / 5.0;
    var hueDesc = levelT < 0.2 ? 'Blue (cold)' : levelT < 0.45 ? 'Teal' : levelT < 0.65 ? 'Green' : levelT < 0.82 ? 'Orange' : 'Red (hot)';
    infoEl.textContent = 'Level ' + level + '  |  ' + level + ' stripe(s)  |  Accent: ' + hueDesc;
  }
}

function previewTick() {
  if (!previewActive) { return; }
  previewAnimFrame = requestAnimationFrame(previewTick);
  previewTheta += previewClock.getDelta() * 0.55;
  for (var i = 0; i < previewBeeGroups.length; i++) {
    var grp = previewBeeGroups[i];
    grp.rotation.y = Math.PI + previewTheta;
    var wL = findChild(grp, 'wingL');
    var wR = findChild(grp, 'wingR');
    if (wL) { wL.rotation.z = 0.3 + Math.sin(previewTheta * 4.5) * 0.45; }
    if (wR) { wR.rotation.z = -0.3 - Math.sin(previewTheta * 4.5) * 0.45; }
  }
  previewRenderer.render(previewScene, previewCamera);
}

export function openPreview() {
  previewActive = true;
  initPreviewRenderer();
  resizePreviewCanvas();
  buildPreviewBees(previewMode, previewLevel);
  updatePreviewInfo(previewMode, previewLevel);
  previewClock.getDelta();
  previewTick();
}

export function closePreview() {
  previewActive = false;
  if (previewAnimFrame) {
    cancelAnimationFrame(previewAnimFrame);
    previewAnimFrame = null;
  }
}

export function resizePreviewCanvas() {
  if (!previewRenderer || !previewCamera) { return; }
  var wrap = document.getElementById('preview-canvas-wrap');
  var w = wrap.clientWidth;
  var h = wrap.clientHeight;
  if (w < 1 || h < 1) { return; }
  previewRenderer.setSize(w, h);
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();
}

export function setPreviewSelection(mode, level) {
  previewMode = mode;
  previewLevel = level;
  if (previewRenderer) {
    buildPreviewBees(previewMode, previewLevel);
    updatePreviewInfo(previewMode, previewLevel);
  }
}
