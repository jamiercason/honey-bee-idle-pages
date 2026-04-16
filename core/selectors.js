export function getGameConfig(game) {
  return game ? game.config : null;
}

export function getGameData(game) {
  return game ? game.data : null;
}

export function getGameState(game) {
  return game ? game.state : null;
}

export function getGameRuntime(game) {
  return game ? game.runtime : null;
}

export function getGameScene(game) {
  return game ? game.scene : null;
}

export function getGameUI(game) {
  return game ? game.ui : null;
}

export function getGameInput(game) {
  return game ? game.input : null;
}

export function getGameCaches(game) {
  return game ? game.caches : null;
}

export function getGameCurrentStage(game) {
  return game && game.data ? game.data.currentStage : null;
}

export function getGameSelectedBeeId(game) {
  return game && game.state ? game.state.selectedBeeId : null;
}

export function getGameSimTime(game) {
  return game && game.runtime && game.runtime.time ? game.runtime.time.simTime : 0;
}

export function getGameLastInteractY(game) {
  return game && game.runtime && game.runtime.time ? game.runtime.time.lastInteractY : 0;
}

export function getGameLastInteractYTimer(game) {
  return game && game.runtime && game.runtime.time ? game.runtime.time.lastInteractYTimer : 0;
}

export function getGameCellVisualStateMap(game) {
  return game && game.caches ? game.caches.cellVisualStateMap : null;
}

export function getGameCellFlashStateMap(game) {
  return game && game.caches ? game.caches.cellFlashStateMap : null;
}

export function getGameCellMeshMap(game) {
  return game && game.caches ? game.caches.cellMeshMap : null;
}

export function getGameMeshUuidToBeeId(game) {
  return game && game.caches ? game.caches.meshUuidToBeeId : null;
}

export function getGameMeshUuidToCellId(game) {
  return game && game.caches ? game.caches.meshUuidToCellId : null;
}
