import { HIVE } from '../config/hiveConfig.js';
import { LIGHTING } from '../config/lightingConfig.js';

var rendererRef = null;
var sceneRef = null;
var skyFillLightRef = null;
var sunLightRef = null;
var groundBounceLightRef = null;
var rimLightRef = null;
var hiveGlowRef = null;

export function createLightingRig(scene) {
  var THREE = globalThis.THREE;
  var skyFillLight = new THREE.HemisphereLight(LIGHTING.SKY_COLOR, LIGHTING.SKY_GROUND, LIGHTING.SKY_INTENSITY);
  scene.add(skyFillLight);

  var sunLight = new THREE.DirectionalLight(LIGHTING.KEY_COLOR, LIGHTING.KEY_INTENSITY);
  sunLight.position.set(-10, 18, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 60;
  sunLight.shadow.camera.left = -15;
  sunLight.shadow.camera.bottom = -15;
  sunLight.shadow.camera.right = 15;
  sunLight.shadow.camera.top = 15;
  sunLight.shadow.bias = -0.001;
  scene.add(sunLight);

  var groundBounceLight = new THREE.PointLight(LIGHTING.BOUNCE_COLOR, LIGHTING.BOUNCE_INTENSITY, 45);
  groundBounceLight.position.set(0, -8, 10);
  scene.add(groundBounceLight);

  var rimLight = new THREE.DirectionalLight(LIGHTING.RIM_COLOR, LIGHTING.RIM_INTENSITY);
  rimLight.position.set(12, 10, -12);
  scene.add(rimLight);

  var hiveGlow = new THREE.PointLight(LIGHTING.HIVE_GLOW_COLOR, 0.0, 22);
  hiveGlow.position.set(HIVE.CYLINDER_RADIUS + 3, -1, 0);
  scene.add(hiveGlow);

  return {
    skyFillLight: skyFillLight,
    sunLight: sunLight,
    groundBounceLight: groundBounceLight,
    rimLight: rimLight,
    hiveGlow: hiveGlow
  };
}

export function setLightingRuntime(runtime) {
  rendererRef = runtime && runtime.renderer ? runtime.renderer : rendererRef;
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  skyFillLightRef = runtime && runtime.skyFillLight ? runtime.skyFillLight : skyFillLightRef;
  sunLightRef = runtime && runtime.sunLight ? runtime.sunLight : sunLightRef;
  groundBounceLightRef = runtime && runtime.groundBounceLight ? runtime.groundBounceLight : groundBounceLightRef;
  rimLightRef = runtime && runtime.rimLight ? runtime.rimLight : rimLightRef;
  hiveGlowRef = runtime && runtime.hiveGlow ? runtime.hiveGlow : hiveGlowRef;
}

export function refreshLightingRig() {
  rendererRef.toneMappingExposure = LIGHTING.EXPOSURE;
  sceneRef.fog.color.setHex(LIGHTING.FOG_COLOR);
  sceneRef.fog.density = LIGHTING.FOG_DENSITY;
  skyFillLightRef.color.setHex(LIGHTING.SKY_COLOR);
  skyFillLightRef.groundColor.setHex(LIGHTING.SKY_GROUND);
  skyFillLightRef.intensity = LIGHTING.SKY_INTENSITY;
  sunLightRef.color.setHex(LIGHTING.KEY_COLOR);
  sunLightRef.intensity = LIGHTING.KEY_INTENSITY;
  groundBounceLightRef.color.setHex(LIGHTING.BOUNCE_COLOR);
  groundBounceLightRef.intensity = LIGHTING.BOUNCE_INTENSITY;
  rimLightRef.color.setHex(LIGHTING.RIM_COLOR);
  rimLightRef.intensity = LIGHTING.RIM_INTENSITY;
  hiveGlowRef.color.setHex(LIGHTING.HIVE_GLOW_COLOR);
}
