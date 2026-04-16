import { createGame } from './bootstrap/createGame.js';
import { initRuntime } from './bootstrap/initRuntime.js';
import { startGameLoop } from './core/gameLoop.js';

export async function main(legacy, boot) {
  if (boot && boot.mark) {
    boot.mark(0.70, 'Waking the nursery', 'Rousing the sleepy workers.');
  }
  var game = createGame(legacy);
  if (boot && boot.mark) {
    boot.mark(0.76, 'Setting the comb', 'Checking the wax seams and honey rails.');
  }
  initRuntime(game, legacy, boot);
  if (legacy.initSelectionRing) { legacy.initSelectionRing(); }
  if (boot && boot.mark) {
    boot.mark(0.95, 'Teaching the routes', 'Polishing the runway for the first loop.');
  }
  startGameLoop(game, legacy);
  if (boot && boot.finish) {
    await boot.finish('The bees are buzzing and ready to work.');
  }
  return game;
}
