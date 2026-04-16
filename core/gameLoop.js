import { advanceSimTime, shouldRunAssertions, updateInteractHold } from './time.js';

function updateSpectacle(game) {
  var runtimeTime = game.runtime.time;
  var hiveGlow = game.scene.hiveGlow;
  var activeCells = 0;
  var ci;
  for (ci = 0; ci < game.state.cells.length; ci++) {
    var sc = game.state.cells[ci];
    if (sc.state === game.runtime.legacy.CELL_STATE.ACTIVE && sc.cellType === game.runtime.legacy.CELL_TYPE.OPEN && (sc.honeyStored > 0 || sc.productionRate > 0)) { activeCells++; }
  }

  var glowTarget = runtimeTime.lastInteractTheta;
  var dg = glowTarget - runtimeTime.spectacleGlowTheta;
  while (dg > Math.PI) { dg -= Math.PI * 2; }
  while (dg < -Math.PI) { dg += Math.PI * 2; }
  runtimeTime.spectacleGlowTheta += dg * Math.min(1.0, game.runtime.rawDt * 0.6);

  var glowR = game.config.HIVE.CYLINDER_RADIUS + 4.5;
  hiveGlow.position.set(
    Math.cos(runtimeTime.spectacleGlowTheta) * glowR,
    -0.5 + 0.8 * Math.sin(runtimeTime.simTime * 0.4),
    Math.sin(runtimeTime.spectacleGlowTheta) * glowR
  );
  var actFrac = Math.min(1.0, activeCells / 4.0);
  hiveGlow.intensity = 0.15 + actFrac * 0.55 + 0.08 * Math.sin(runtimeTime.simTime * 1.1);
}

function updateCellPresentation(game) {
  var legacy = game.runtime.legacy;
  var runtimeTime = game.runtime.time;
  var cellMeshMap = game.caches.cellMeshMap;
  var cellFlashStateMap = game.caches.cellFlashStateMap;
  var ci;
  for (ci = 0; ci < game.state.cells.length; ci++) {
    var cell = game.state.cells[ci];
    var mesh = cellMeshMap[cell.id];
    if (!mesh) { continue; }
    var vs = legacy.getCellVisualState(cell);
    var style = legacy.resolveCellVisualStyle(vs, cell);
    var color = style.color;
    var emissive = style.emissive;
    var emissiveIntensity = style.emissiveIntensity;
    var highlight = legacy.resolveCellHighlightState(vs, cell, ci);
    vs.highlightReason = highlight.reason;

    if (highlight.reason !== 'none') {
      if (highlight.colorTint !== null) { color = legacy.addHexTint(color, highlight.colorTint, 0.12); }
      if (highlight.emissiveTint !== null) { emissive = legacy.addHexTint(emissive, highlight.emissiveTint, 0.28); }
      if (highlight.emissiveIntensity !== null) { emissiveIntensity = Math.max(emissiveIntensity, highlight.emissiveIntensity); }
    }

    if (game.config.PRESENTATION.CELL_FX_ENABLED) {
      if (vs.state === legacy.CELL_STATE.ACTIVE && vs.cellRole === 'open') {
        emissiveIntensity = 0.62 + vs.productionFill * 0.40 + (vs.isBoostedByStructure ? 0.12 : 0) + (vs.isUnderRoyalRush ? 0.08 : 0);
      }
      if (highlight.reason === 'none') {
        if (vs.isBeingWorked) {
          emissive = legacy.addHexTint(emissive, 0xffaa43, 0.46);
          emissiveIntensity = 0.96 + Math.abs(Math.sin(runtimeTime.simTime * 6.6 + ci)) * 0.20;
        } else if (vs.readyToCollect) {
          emissiveIntensity = 1.02 + Math.pow(Math.abs(Math.sin(runtimeTime.simTime * 2.8 + ci * 0.2)), 0.7) * 0.28;
        } else if (vs.isNearClear || vs.isNearActivation) {
          emissiveIntensity = Math.max(emissiveIntensity, 0.86 + Math.abs(Math.sin(runtimeTime.simTime * 3.2 + ci * 0.3)) * 0.10);
        } else if (vs.state === legacy.CELL_STATE.OBSTACLE && vs.rewardLeadType !== 'none') {
          emissiveIntensity = 0.74 + Math.abs(Math.sin(runtimeTime.simTime * 1.9 + ci * 0.8)) * 0.08;
        }
      }
    } else if (vs.state === legacy.CELL_STATE.ACTIVE && vs.cellRole === 'open') {
      emissiveIntensity = 0.72 + vs.productionFill * 0.22;
    }

    var flashState = cellFlashStateMap[cell.id];
    if (flashState && flashState.until > runtimeTime.simTime) {
      var flashT = (flashState.until - runtimeTime.simTime) / Math.max(0.001, flashState.duration);
      color = legacy.addHexTint(color, flashState.color, Math.min(0.34, flashT * 0.34));
      emissive = legacy.addHexTint(emissive, flashState.color, 0.68 * flashT);
      emissiveIntensity = Math.max(emissiveIntensity, 1.15 + flashT * 1.1);
    } else if (flashState) {
      delete cellFlashStateMap[cell.id];
    }

    mesh.material.color.setHex(color);
    mesh.material.emissive.setHex(emissive);
    mesh.material.emissiveIntensity = emissiveIntensity;
    mesh.material.roughness = style.roughness;
    mesh.material.metalness = style.metalness;
    legacy.updateCellSurfaceLayers(cell, mesh, vs, style);
  }
}

function updateSimulation(game) {
  var legacy = game.runtime.legacy;
  advanceSimTime(game.runtime.time, game.runtime.dt);
  legacy.updateCellEconomy(game.runtime.dt);
  legacy.updateBuildings(game.runtime.dt);
  legacy.updateGate();
  legacy.updateBees(game.runtime.dt);
  updateCellPresentation(game);
  legacy.updateCellVfx(game.runtime.dt);
  legacy.updateSelectionVisual(game.runtime.dt);
  legacy.updateLabels(game.runtime.dt);
  legacy.updateWorkEdges();
  legacy.updateWorkerDebug();
  legacy.updateBeePoseDebug();
}

export function startGameLoop(game, legacy) {
  var THREE = globalThis.THREE;
  game.runtime.legacy = legacy;
  game.runtime.clock = new THREE.Clock();
  if (legacy.bindGameAliases) { legacy.bindGameAliases(game); }

  function tick() {
    requestAnimationFrame(tick);
    var rawDt = game.runtime.clock.getDelta();
    if (rawDt > 0.1) { rawDt = 0.1; }
    game.runtime.rawDt = rawDt;
    game.runtime.dt = rawDt * game.state.gameTimeScale;
    legacy.updateBurstCallbacks(rawDt);
    legacy.updateToasts(rawDt);
    updateInteractHold(game.runtime.time, rawDt);
    legacy.updateRoyalRush(rawDt);
    legacy.updateTimeScale(rawDt);
    legacy.updateCamera(rawDt, game.runtime.dt);
    legacy.updateSceneArt(rawDt);
    updateSpectacle(game);
    updateSimulation(game);
    if (shouldRunAssertions(game.runtime.time, rawDt, 2.0)) { legacy.runConservativeAssertions(game); }
    legacy.updateUI();
    game.scene.renderer.render(game.scene.scene, game.scene.camera);
  }

  tick();
  legacy.initPreviewModal();
  legacy.installRendererResizeHandling(game.scene.camera, game.scene.renderer, legacy.resizePreviewModal);
}
