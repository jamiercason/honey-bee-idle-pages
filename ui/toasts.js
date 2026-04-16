export var buildingToast = '';
export var buildingToastTimer = 0;
export var mergeToastLevel = 0;
export var mergeToastTimer = 0;

export function setBuildingToast(text, duration) {
  buildingToast = text;
  buildingToastTimer = duration;
}

export function clearBuildingToast() {
  buildingToast = '';
  buildingToastTimer = 0;
}

export function appendBuildingToast(text, duration) {
  buildingToast += text;
  buildingToastTimer = Math.max(buildingToastTimer, duration);
}

export function setMergeToast(level, duration) {
  mergeToastLevel = level;
  mergeToastTimer = duration;
}

export function clearMergeToast() {
  mergeToastLevel = 0;
  mergeToastTimer = 0;
}

export function updateToasts(dt) {
  if (mergeToastTimer > 0) { mergeToastTimer -= dt; }
  if (buildingToastTimer > 0) { buildingToastTimer -= dt; }
}
