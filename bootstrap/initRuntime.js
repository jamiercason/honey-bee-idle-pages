import { createRuntimeTime } from '../core/time.js';

export function initRuntime(game, legacy, boot) {
  function reportBoot(progress, phase, line) {
    if (boot && boot.mark) {
      boot.mark(progress, phase, line);
    }
  }

  var scene = legacy.createScene(legacy.LIGHTING);
  var renderer = legacy.createRenderer(legacy.LIGHTING.EXPOSURE);
  var lightingRig = legacy.createLightingRig(scene);
  reportBoot(0.80, 'Raising the hive shell', 'Bracing the comb while the morning light settles.');

  game.scene.renderer = renderer;
  game.scene.scene = scene;
  game.scene.lightingRig = lightingRig;
  game.scene.skyFillLight = lightingRig.skyFillLight;
  game.scene.sunLight = lightingRig.sunLight;
  game.scene.groundBounceLight = lightingRig.groundBounceLight;
  game.scene.rimLight = lightingRig.rimLight;
  game.scene.hiveGlow = lightingRig.hiveGlow;
  game.scene.hiveGroup = legacy.createHiveGroup(scene);
  if (legacy.bindGameAliases) { legacy.bindGameAliases(game); }

  legacy.setBoardQueryRuntime({ state: game.state, currentStage: game.data.currentStage });
  legacy.setStageValidationRuntime({ isRequiredStructureCell: legacy.isRequiredStructureCell });
  legacy.setBoardBuilderRuntime({ state: game.state, currentStage: game.data.currentStage, cylinderCellPosition: legacy.cylinderCellPosition });
  legacy.setMaterialsRuntime({
    state: game.state,
    getPointer: function() { return game.input.pointer; },
    getCellVisualStateMap: function() { return game.caches.cellVisualStateMap; },
    getCellMeshMap: function() { return game.caches.cellMeshMap; },
    getHiveGroup: function() { return game.scene.hiveGroup; },
    getSimTime: function() { return game.runtime.time ? game.runtime.time.simTime : 0; },
    getCellWorldPos: legacy.getCellWorldPos,
    getCellSurfaceNormal: legacy.getCellSurfaceNormal
  });
  legacy.setCellFxRuntime({
    scene: game.scene.scene,
    hiveGroup: game.scene.hiveGroup,
    state: game.state,
    getCellMeshMap: function() { return game.caches.cellMeshMap; },
    getCellVisualStateMap: function() { return game.caches.cellVisualStateMap; },
    getSimTime: function() { return game.runtime.time ? game.runtime.time.simTime : 0; }
  });
  legacy.setLabelsRuntime({
    scene: game.scene.scene,
    state: game.state,
    beeConfig: legacy.BEE,
    getCameraTheta: function() { return game.scene.camState ? game.scene.camState.theta : 0; }
  });

  game.state.cells = legacy.initHive();
  reportBoot(0.84, 'Filling the cells', 'Waxing the hex corners before the workers move in.');

  legacy.setLightingRuntime({
    renderer: game.scene.renderer,
    scene: game.scene.scene,
    skyFillLight: game.scene.skyFillLight,
    sunLight: game.scene.sunLight,
    groundBounceLight: game.scene.groundBounceLight,
    rimLight: game.scene.rimLight,
    hiveGlow: game.scene.hiveGlow
  });
  legacy.setHiveMeshesRuntime({
    scene: game.scene.scene,
    hiveGroup: game.scene.hiveGroup,
    cellMaterial: legacy.cellMaterial,
    cellRadialLift: legacy.cellRadialLift,
    ensureCellSurfaceLayers: legacy.ensureCellSurfaceLayers,
    ensureCellFx: legacy.ensureCellFx,
    getCoreCyl: function() { return game.scene.coreCyl; }
  });
  game.caches.cellMeshMap = legacy.buildInitialCellMeshes(game.state.cells);
  game.scene.coreCyl = legacy.createCoreCyl();
  game.scene.coreOccluder = legacy.createCoreOccluder();
  if (legacy.bindGameAliases) { legacy.bindGameAliases(game); }
  legacy.refreshCoreCylinderMaterial();

  legacy.setCameraControllerRuntime({
    state: game.state,
    getPointer: function() { return game.input.pointer; },
    getCamera: function() { return game.scene.camera; },
    getCamState: function() { return game.scene.camState; },
    getCamTarget: function() { return game.scene.camTarget; },
    getSelectedBeeId: function() { return game.state.selectedBeeId; },
    getSelectedBee: legacy.getSelectedBee,
    updateBeeDragInteraction: legacy.updateBeeDragInteraction,
    getLastInteractY: function() { return game.runtime.time ? game.runtime.time.lastInteractY : 0; },
    getLastInteractYTimer: function() { return game.runtime.time ? game.runtime.time.lastInteractYTimer : 0; },
    beeDragEdgeRotateZoneFrac: legacy.BEE_DRAG_EDGE_ROTATE_ZONE_FRAC,
    beeDragEdgeRotateDwell: legacy.BEE_DRAG_EDGE_ROTATE_DWELL_S,
    beeDragEdgeRotateSpeedMax: legacy.BEE_DRAG_EDGE_ROTATE_SPEED_MAX
  });
  game.scene.camera = legacy.createCamera(legacy.CAM);
  legacy.setSceneArtRuntime({
    scene: game.scene.scene,
    camera: game.scene.camera,
    getSimTime: function() { return game.runtime.time ? game.runtime.time.simTime : 0; }
  });

  legacy.initSceneArt();
  legacy.refreshLightingRig();

  game.scene.camTarget = new legacy.THREE.Vector3(0, -4.00, 0);
  game.scene.camState = {
    theta: legacy.getOpeningFocusTheta(),
    phi: legacy.CAM.POLAR_ANGLE,
    radius: legacy.CAM.OPENING_RADIUS,
    railY: legacy.CAM.OPENING_RAIL_Y,
    autoRotateSpeed: (2 * Math.PI) / legacy.CAM.AUTO_ROTATE_TIME,
    momentumTheta: 0,
    momentumPhi: 0,
    momentumRailY: 0
  };
  game.scene.camTarget.y = legacy.CAM.OPENING_TARGET_Y;
  if (legacy.bindGameAliases) { legacy.bindGameAliases(game); }
  legacy.applyOpeningCameraPose();
  reportBoot(0.89, 'Framing the first flight', 'Minding the hive entrance and aligning the view.');

  game.runtime.time = createRuntimeTime(game.scene.camState.theta, game.scene.camTarget.y);
  if (legacy.bindGameAliases) { legacy.bindGameAliases(game); }

  legacy.setBoostsRuntime({ state: game.state });
  legacy.setRewardsRuntime({
    state: game.state,
    getCellWorldPos: legacy.getCellWorldPos,
    refreshCellMaterial: legacy.refreshCellMaterial,
    ensureActiveCellLabel: legacy.ensureActiveCellLabel,
    activateDormantCell: legacy.activateDormantCell,
    isRequiredStructureCell: legacy.isRequiredStructureCell,
    spawnRewardBurst: legacy.spawnRewardBurst,
    setBuildingToast: legacy.setBuildingToast
  });
  legacy.setBuildingsRuntime({
    state: game.state,
    getOpenCellLabelMap: function() { return legacy.openCellLabelMap; },
    getCellWorldPos: legacy.getCellWorldPos,
    routeNectarToActiveCells: legacy.routeNectarToActiveCells,
    refreshCellMaterial: legacy.refreshCellMaterial,
    flashCell: legacy.flashCell,
    markCameraInteraction: legacy.markCameraInteraction,
    syncGateWorkRequirement: legacy.syncGateWorkRequirement,
    invalidateGateLabelCache: legacy.invalidateGateLabelCache
  });
  legacy.setGatesRuntime({
    state: game.state,
    gateLabelMap: legacy.gateLabelMap,
    refreshCellMaterial: legacy.refreshCellMaterial,
    spawnLevelCompleteBurst: legacy.spawnLevelCompleteBurst,
    spawnRewardBurst: legacy.spawnRewardBurst,
    setBuildingToast: legacy.setBuildingToast,
    isRequiredStructureCell: legacy.isRequiredStructureCell
  });
  legacy.setEconomyRuntime({
    state: game.state,
    currentStage: game.data.currentStage,
    beeConfig: legacy.BEE,
    getCellMeshMap: function() { return game.caches.cellMeshMap; },
    getSimTime: function() { return game.runtime.time.simTime; },
    refreshCellMaterial: legacy.refreshCellMaterial,
    triggerHoneyReadyFx: legacy.triggerHoneyReadyFx,
    setBuildingToast: legacy.setBuildingToast,
    spawnAtHive: legacy.spawnAtHive
  });
  legacy.setHudRuntime({
    state: game.state,
    beeConfig: legacy.BEE,
    getCurrentSpawnCost: legacy.getCurrentSpawnCost,
    getSelectedBee: legacy.getSelectedBee,
    getRoyalRushStacks: legacy.getRoyalRushStacks,
    evaluateGateConditions: legacy.evaluateGateConditions,
    getStageExitBonus: legacy.getStageExitBonus,
    buildingActionLabel: legacy.buildingActionLabel,
    getBeeEffectiveWorkRate: legacy.getBeeEffectiveWorkRate,
    getBeeEffectiveGatherLoad: legacy.getBeeEffectiveGatherLoad
  });
  legacy.setSummonBarRuntime({
    doSummon: legacy.doSummon,
    beginBoostDrag: legacy.beginBoostDrag,
    onPointerMove: legacy.onPointerMove,
    onPointerUp: legacy.onPointerUp,
    getPointer: function() { return game.input.pointer; }
  });
  legacy.setBeeQueriesRuntime({
    state: game.state,
    getSelectedBeeId: function() { return game.state.selectedBeeId; }
  });
  legacy.setRaycastRuntime({
    state: game.state,
    getCamera: function() { return game.scene.camera; },
    getCellMeshMap: function() { return game.caches.cellMeshMap; },
    getCoreOccluder: function() { return game.scene.coreOccluder; },
    getMeshUuidToBeeId: function() { return game.caches.meshUuidToBeeId; },
    getMeshUuidToCellId: function() { return game.caches.meshUuidToCellId; }
  });
  legacy.setTargetingRuntime({
    state: game.state
  });
  legacy.setInteractionsRuntime({
    state: game.state,
    getCamera: function() { return game.scene.camera; },
    setBuildingToast: legacy.setBuildingToast,
    selectBee: legacy.selectBee,
    rejectShake: legacy.rejectShake,
    flashCell: legacy.flashCell,
    markCameraInteraction: legacy.markCameraInteraction,
    applyRoyalJellyToBee: legacy.applyRoyalJellyToBee
  });
  legacy.setPointerControllerRuntime({
    state: game.state,
    getCamera: function() { return game.scene.camera; },
    getMeshUuidToBeeId: function() { return game.caches.meshUuidToBeeId; },
    selectBee: legacy.selectBee,
    setBuildingToast: legacy.setBuildingToast
  });
  legacy.setGestureControllerRuntime({
    getCamState: function() { return game.scene.camState; },
    getDebugPanel: legacy.getDebugPanel,
    dbgRefresh: legacy.dbgRefresh
  });
  legacy.setBeePoseRuntime({
    beeBody: legacy.BEE_BODY,
    beePose: legacy.BEE_POSE
  });
  legacy.setBeeMovementRuntime({
    state: game.state,
    pointer: game.input.pointer,
    beeConfig: legacy.BEE,
    getSelectedBeeId: function() { return game.state.selectedBeeId; },
    getCellRenderBasis: legacy.getCellRenderBasis,
    projectOnPlane: legacy.projectOnPlane,
    getFallbackSeatForward: legacy.getFallbackSeatForward,
    getCellSurfaceNormal: legacy.getCellSurfaceNormal,
    getCellWorldPos: legacy.getCellWorldPos
  });
  legacy.setBeeGatheringRuntime({
    beeConfig: legacy.BEE,
    getSimTime: function() { return game.runtime.time.simTime; }
  });
  legacy.setBeeAssignmentsRuntime({
    pointer: game.input.pointer,
    getDebugNeighbors: function() { return legacy.getDebugNeighbors(); },
    debugSeatNeighbors: legacy.debugSeatNeighbors,
    rejectShake: legacy.rejectShake,
    flashCell: legacy.flashCell,
    setBuildingToast: legacy.setBuildingToast,
    selectBee: legacy.selectBee,
    getCellWorldPos: legacy.getCellWorldPos
  });
  legacy.setBeeVisualStateRuntime({
    beeConfig: legacy.BEE,
    beeVis: legacy.BEE_VIS,
    getSimTime: function() { return game.runtime.time.simTime; }
  });
  legacy.setBeeFxRuntime({
    scene: game.scene.scene,
    beeConfig: legacy.BEE
  });
  legacy.setBeeFactoryRuntime({
    state: game.state,
    beeConfig: legacy.BEE,
    beeVis: legacy.BEE_VIS,
    scene: game.scene.scene,
    buildBeeFx: legacy.buildBeeFx,
    addBeeLabelFor: legacy.addBeeLabelFor,
    removeBeeFx: legacy.removeBeeFx,
    removeBeeLabelFor: legacy.removeBeeLabelFor,
    selectBee: legacy.selectBee,
    getSelectedBeeId: function() { return game.state.selectedBeeId; },
    getMeshUuidToBeeId: function() { return game.caches.meshUuidToBeeId; },
    getCellMeshMap: function() { return game.caches.cellMeshMap; },
    registerCellMesh: legacy.registerCellMesh
  });
  legacy.setBeeMergingRuntime({
    updateMergeTargetHighlights: legacy.updateMergeTargetHighlights,
    spawnMergeBurst: legacy.spawnMergeBurst,
    triggerMergeFx: legacy.triggerMergeFx,
    queueBurstCallback: legacy.queueBurstCallback,
    setMergeToast: legacy.setMergeToast,
    setBuildingToast: legacy.setBuildingToast
  });
  legacy.setBeeStateMachineRuntime({
    state: game.state,
    getSimTime: function() { return game.runtime.time.simTime; },
    getUseBeePoseSystem: function() { return legacy.getUseBeePoseSystem(); },
    getDebugWorkers: function() { return legacy.getDebugWorkers(); },
    getSelectedBeeId: function() { return game.state.selectedBeeId; },
    getCellWorldPos: legacy.getCellWorldPos,
    buildBeePoseInput: legacy.buildBeePoseInput,
    computeBeePose: legacy.computeBeePose,
    applyBeePose: legacy.applyBeePose,
    computeWorkerBeeFrame: legacy.computeWorkerBeeFrame,
    getCellRenderBasis: legacy.getCellRenderBasis,
    snapForwardToHexDirection: legacy.snapForwardToHexDirection,
    getFallbackSeatForward: legacy.getFallbackSeatForward,
    applyWorkerBeePose: legacy.applyWorkerBeePose,
    updateBeeReadabilityVisual: legacy.updateBeeReadabilityVisual,
    updateBeeFx: legacy.updateBeeFx,
    drawLine: legacy.drawLine,
    findChild: legacy.findChild,
    completeObstacleCell: legacy.completeObstacleCell
  });
  legacy.setDebugDrawRuntime({
    state: game.state,
    scene: game.scene.scene,
    queueBurstCallback: legacy.queueBurstCallback,
    getSimTime: function() { return game.runtime.time.simTime; },
    getWorkerDebugDraw: function() { return legacy.getWorkerDebugDraw(); },
    getUseBeePoseSystem: function() { return legacy.getUseBeePoseSystem(); },
    getCellWorldPos: legacy.getCellWorldPos,
    computeWorkerBeeFrame: legacy.computeWorkerBeeFrame,
    getCellSurfaceNormal: legacy.getCellSurfaceNormal,
    beeBody: legacy.BEE_BODY
  });
  legacy.setDebugPanelRuntime({
    state: game.state,
    getCamera: function() { return game.scene.camera; },
    getCamState: function() { return game.scene.camState; },
    getCamTarget: function() { return game.scene.camTarget; },
    getHiveGlow: function() { return game.scene.hiveGlow; },
    getUseBeePoseSystem: function() { return legacy.getUseBeePoseSystem(); },
    setUseBeePoseSystem: function(on) { legacy.setUseBeePoseSystem(on); },
    getWorkerDebugDraw: function() { return legacy.getWorkerDebugDraw(); },
    setWorkerDebugDraw: function(on) { legacy.setWorkerDebugDraw(on); },
    refreshLightingRig: legacy.refreshLightingRig,
    refreshCoreCylinderMaterial: legacy.refreshCoreCylinderMaterial,
    refreshAllCellMaterials: function() {
      for (var mi = 0; mi < game.state.cells.length; mi++) { legacy.refreshCellMaterial(game.state.cells[mi]); }
    },
    syncGateWorkRequirement: legacy.syncGateWorkRequirement,
    invalidateBuildingLabelCache: legacy.invalidateBuildingLabelCache,
    refreshM6TuningState: legacy.refreshM6TuningState,
    invalidateGateLabelCache: legacy.invalidateGateLabelCache,
    initSceneArt: legacy.initSceneArt,
    onRebuild: legacy.rebuildHiveFromDebug,
    onCopyValues: legacy.copyDebugValues
  });
  legacy.initSummonBar();
  legacy.initDebugPanel();
  game.ui.debugPanel = legacy.getDebugPanel();
  game.ui.previewModal = document.getElementById('preview-modal');
  legacy.installPointerController(game.scene.renderer.domElement);
  legacy.installGestureController(game.scene.renderer.domElement);
  reportBoot(0.93, 'Briefing the keepers', 'Dusting the pollen off the controls and labels.');

  legacy.updateCamera(0, 0);
  legacy.initBees(game.data.currentStage.beeStartCount);
  legacy.initCellLabels();
  legacy.runConservativeAssertions(game);
  reportBoot(0.97, 'Checking the morning buzz', 'Listening for a clean hive hum.');
  if (legacy.bindGameAliases) { legacy.bindGameAliases(game); }
}
