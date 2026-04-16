import { createGame } from './bootstrap/createGame.js';
import { initRuntime } from './bootstrap/initRuntime.js';
import { startGameLoop } from './core/gameLoop.js';

export function main(legacy) {
  var game = createGame(legacy);
  initRuntime(game, legacy);
  if (legacy.initSelectionRing) { legacy.initSelectionRing(); }
  startGameLoop(game, legacy);
  return game;
}
