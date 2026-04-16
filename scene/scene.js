export function createScene(lighting) {
  var THREE = globalThis.THREE;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9e3f7);
  scene.fog = new THREE.FogExp2(lighting.FOG_COLOR, lighting.FOG_DENSITY);
  return scene;
}

export function createCamera(cam) {
  var THREE = globalThis.THREE;
  return new THREE.PerspectiveCamera(cam.FOV, window.innerWidth / window.innerHeight, cam.NEAR, cam.FAR);
}

export function createHiveGroup(scene) {
  var THREE = globalThis.THREE;
  var hiveGroup = new THREE.Group();
  scene.add(hiveGroup);
  return hiveGroup;
}
