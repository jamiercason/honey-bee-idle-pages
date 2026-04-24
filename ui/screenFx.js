import { PRESENTATION } from '../config/presentationConfig.js';

var cameraRef = null;
var rewardBloom = document.getElementById('reward-bloom');

var bloomState = {
  timer: 0,
  duration: 0.42,
  intensity: 0,
  x: 0.5,
  y: 0.5,
  color: 0xffd46a
};

var shakeState = {
  timer: 0,
  duration: 0.28,
  amplitude: 0,
  phase: 0,
  offsetX: 0,
  offsetY: 0
};

function clampPresentation(value, min, max, fallback) {
  if (value === undefined || value === null || !isFinite(value)) { return fallback; }
  return Math.max(min, Math.min(max, value));
}

function hexToRgbString(hex) {
  var safe = Math.max(0, Math.min(0xffffff, hex || 0));
  var r = (safe >> 16) & 255;
  var g = (safe >> 8) & 255;
  var b = safe & 255;
  return r + ', ' + g + ', ' + b;
}

function projectWorldToScreen(worldPos) {
  if (!worldPos || !cameraRef || !worldPos.clone) {
    return { x: 0.5, y: 0.48 };
  }
  var projected = worldPos.clone().project(cameraRef);
  var x = clampPresentation(projected.x * 0.5 + 0.5, 0.08, 0.92, 0.5);
  var y = clampPresentation((-projected.y) * 0.5 + 0.5, 0.10, 0.90, 0.48);
  return { x: x, y: y };
}

function updateBloomElement(opacity, scale) {
  if (!rewardBloom) { return; }
  var rgb = hexToRgbString(bloomState.color);
  rewardBloom.style.opacity = opacity.toFixed(3);
  rewardBloom.style.transform = 'scale(' + scale.toFixed(3) + ')';
  rewardBloom.style.background =
    'radial-gradient(circle at ' + (bloomState.x * 100).toFixed(1) + '% ' + (bloomState.y * 100).toFixed(1) + '%, ' +
    'rgba(' + rgb + ', 0.44) 0%, ' +
    'rgba(' + rgb + ', 0.20) 18%, ' +
    'rgba(255, 248, 214, 0.12) 34%, ' +
    'rgba(' + rgb + ', 0.05) 52%, ' +
    'rgba(' + rgb + ', 0.00) 74%)';
}

export function setScreenFxRuntime(runtime) {
  cameraRef = runtime && runtime.camera ? runtime.camera : cameraRef;
}

export function triggerRewardBloom(worldPos, color, intensity) {
  var bloomStrength = clampPresentation(PRESENTATION.SCREEN_REWARD_BLOOM, 0, 2.0, 1.0);
  if (bloomStrength <= 0.01) { return; }
  var projected = projectWorldToScreen(worldPos);
  bloomState.timer = clampPresentation(PRESENTATION.SCREEN_BLOOM_DURATION, 0.12, 1.1, 0.42);
  bloomState.duration = bloomState.timer;
  bloomState.intensity = Math.max(
    bloomState.intensity * 0.55,
    clampPresentation(intensity, 0.12, 1.8, 0.9) * bloomStrength
  );
  bloomState.x = projected.x;
  bloomState.y = projected.y;
  bloomState.color = color || 0xffd46a;
  updateBloomElement(0.01, 1.0);
}

export function triggerScreenShake(intensity) {
  var shakeStrength = clampPresentation(PRESENTATION.SCREEN_SHAKE_INTENSITY, 0, 2.0, 1.0);
  if (shakeStrength <= 0.01) { return; }
  shakeState.duration = clampPresentation(PRESENTATION.SCREEN_SHAKE_DURATION, 0.10, 0.80, 0.28);
  shakeState.timer = Math.max(shakeState.timer, shakeState.duration);
  shakeState.amplitude = Math.max(
    shakeState.amplitude,
    clampPresentation(intensity, 0.08, 1.0, 0.2) * shakeStrength * 0.050
  );
}

export function getScreenShakeOffset() {
  return shakeState;
}

export function updateScreenFx(rawDt) {
  if (bloomState.timer > 0) {
    bloomState.timer = Math.max(0, bloomState.timer - rawDt);
    var bloomT = bloomState.duration > 0 ? (bloomState.timer / bloomState.duration) : 0;
    var bloomElapsed = 1.0 - bloomT;
    var bloomWave = Math.sin(Math.min(1.0, bloomElapsed) * Math.PI);
    var opacity = Math.min(0.34, (bloomWave * 0.22 + bloomT * 0.06) * bloomState.intensity);
    var scale = 0.96 + bloomWave * 0.12 + bloomState.intensity * 0.02;
    updateBloomElement(opacity, scale);
    if (bloomState.timer <= 0) {
      bloomState.intensity = 0;
    }
  } else if (rewardBloom) {
    rewardBloom.style.opacity = '0';
    rewardBloom.style.transform = 'scale(1.0)';
  }

  if (shakeState.timer > 0) {
    shakeState.timer = Math.max(0, shakeState.timer - rawDt);
    var shakeT = shakeState.duration > 0 ? (shakeState.timer / shakeState.duration) : 0;
    var envelope = shakeT * shakeT;
    shakeState.phase += rawDt * (34 + shakeState.amplitude * 220);
    shakeState.offsetX = Math.sin(shakeState.phase * 1.17 + 0.6) * shakeState.amplitude * envelope;
    shakeState.offsetY = Math.cos(shakeState.phase * 1.91 + 1.4) * shakeState.amplitude * envelope * 0.72;
    if (shakeState.timer <= 0) {
      shakeState.amplitude = 0;
      shakeState.offsetX = 0;
      shakeState.offsetY = 0;
    }
  } else {
    shakeState.offsetX = 0;
    shakeState.offsetY = 0;
  }
}
