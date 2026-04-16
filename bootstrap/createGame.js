import { createInitialState } from '../core/state.js';

export function createGame(legacy) {
  var game = {
    config: {
      CONFIG: legacy.CONFIG,
      HIVE: legacy.HIVE,
      CAM: legacy.CAM,
      CAM_CONTEXT: legacy.CAM_CONTEXT,
      LIGHTING: legacy.LIGHTING,
      SCENE_ART: legacy.SCENE_ART,
      PRESENTATION: legacy.PRESENTATION,
      LABEL: legacy.LABEL,
      BEE: legacy.BEE,
      BEE_VIS: legacy.BEE_VIS,
      BEE_BODY: legacy.BEE_BODY,
      BEE_POSE: legacy.BEE_POSE
    },
    data: {
      STAGE_DEFS: legacy.STAGE_DEFS,
      CURRENT_STAGE_ID: legacy.CURRENT_STAGE_ID,
      currentStage: legacy.getCurrentStageDef()
    },
    state: null,
    runtime: {
      time: null,
      clock: null,
      rawDt: 0,
      dt: 0,
      legacy: null
    },
    scene: {
      renderer: null,
      scene: null,
      lightingRig: null,
      skyFillLight: null,
      sunLight: null,
      groundBounceLight: null,
      rimLight: null,
      hiveGlow: null,
      hiveGroup: null,
      camera: null,
      camTarget: null,
      camState: null,
      coreCyl: null,
      coreOccluder: null
    },
    ui: {
      debugPanel: null,
      previewModal: null
    },
    input: {
      pointer: legacy.pointer,
      pinch: legacy.pinch
    },
    caches: {
      cellVisualStateMap: {},
      cellFlashStateMap: {},
      cellMeshMap: {},
      meshUuidToBeeId: {},
      meshUuidToCellId: {}
    }
  };
  game.state = createInitialState(game.data.currentStage);
  if (legacy.bindGameAliases) { legacy.bindGameAliases(game); }
  return game;
}
