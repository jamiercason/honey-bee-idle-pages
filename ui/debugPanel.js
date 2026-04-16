import { BUILD_VERSION, CONFIG } from '../config/config.js';
import { HIVE } from '../config/hiveConfig.js';
import { CAM, CAM_CONTEXT } from '../config/cameraConfig.js';
import { LIGHTING } from '../config/lightingConfig.js';
import { SCENE_ART } from '../config/sceneArtConfig.js';
import { PRESENTATION } from '../config/presentationConfig.js';

var stateRef = null;
var getCameraRef = function() { return null; };
var getCamStateRef = function() { return null; };
var getCamTargetRef = function() { return null; };
var getHiveGlowRef = function() { return null; };
var getUseBeePoseSystemRef = function() { return false; };
var setUseBeePoseSystemRef = function() {};
var getWorkerDebugDrawRef = function() { return false; };
var setWorkerDebugDrawRef = function() {};
var refreshLightingRigRef = function() {};
var refreshCoreCylinderMaterialRef = function() {};
var refreshAllCellMaterialsRef = function() {};
var syncGateWorkRequirementRef = function() {};
var invalidateBuildingLabelCacheRef = function() {};
var refreshM6TuningStateRef = function() {};
var invalidateGateLabelCacheRef = function() {};
var initSceneArtRef = function() {};
var onRebuildRef = function() {};
var onCopyValuesRef = function() {};

var debugPanel = document.getElementById('debug-panel');
var debugToggle = document.getElementById('debug-toggle');
var debugSectionState = {};
var stepButtonsWired = false;
var debugPanelInitDone = false;

export var dbgDefs = [
  { stem:'radius',  get:function(){ return getCamStateRef().radius; }, set:function(v){ getCamStateRef().radius = Math.max(6, Math.min(40, v)); }, step:0.5, fmt:function(v){ return v.toFixed(1); } },
  { stem:'phi',     get:function(){ return getCamStateRef().phi; }, set:function(v){ getCamStateRef().phi = Math.max(CAM.POLAR_MIN, Math.min(CAM.POLAR_MAX, v)); }, step:0.02, fmt:function(v){ return v.toFixed(2); } },
  { stem:'targety', get:function(){ return CAM.TARGET_Y; }, set:function(v){ CAM.TARGET_Y = Math.max(-6, Math.min(6, v)); if (!CAM_CONTEXT.ENABLED) { getCamTargetRef().y = CAM.TARGET_Y; } }, step:0.1, fmt:function(v){ return v.toFixed(1); } },
  { stem:'fov',     get:function(){ return getCameraRef().fov; }, set:function(v){ var camera = getCameraRef(); camera.fov = Math.max(20, Math.min(90, v)); camera.updateProjectionMatrix(); }, step:1, fmt:function(v){ return Math.round(v) + 'd'; } },
  { stem:'wheelzoom', get:function(){ return CAM.DESKTOP_WHEEL_ZOOM_SENSITIVITY; }, set:function(v){ CAM.DESKTOP_WHEEL_ZOOM_SENSITIVITY = Math.max(0.0001, Math.min(0.0030, v)); }, step:0.0001, fmt:function(v){ return v.toFixed(4); } },
  { stem:'rot',     get:function(){ return Math.round((2*Math.PI)/getCamStateRef().autoRotateSpeed); }, set:function(v){ getCamStateRef().autoRotateSpeed = (2*Math.PI)/Math.max(5,v); }, step:5, fmt:function(v){ return Math.round(v) + 's'; } },
  { stem:'ctxdwell', get:function(){ return CAM_CONTEXT.DWELL_STRENGTH; }, set:function(v){ CAM_CONTEXT.DWELL_STRENGTH = Math.max(0, Math.min(1.5, v)); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'ctxback', get:function(){ return CAM_CONTEXT.DWELL_BACKSIDE_BOOST; }, set:function(v){ CAM_CONTEXT.DWELL_BACKSIDE_BOOST = Math.max(0, Math.min(1.5, v)); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'ctxpull', get:function(){ return CAM_CONTEXT.THETA_PULL; }, set:function(v){ CAM_CONTEXT.THETA_PULL = Math.max(0, Math.min(1.0, v)); }, step:0.02, fmt:function(v){ return v.toFixed(2); } },
  { stem:'ctxanchor', get:function(){ return CAM_CONTEXT.OPENING_ANCHOR; }, set:function(v){ CAM_CONTEXT.OPENING_ANCHOR = Math.max(0, Math.min(1.5, v)); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'ctxarc', get:function(){ return CAM_CONTEXT.OPENING_SLOW_ARC; }, set:function(v){ CAM_CONTEXT.OPENING_SLOW_ARC = Math.max(0.08, Math.min(1.5, v)); }, step:0.04, fmt:function(v){ return v.toFixed(2); } },
  { stem:'ctxrise', get:function(){ return CAM_CONTEXT.Y_TRACK_STRENGTH; }, set:function(v){ CAM_CONTEXT.Y_TRACK_STRENGTH = Math.max(0, Math.min(1.5, v)); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'aimtrack', get:function(){ return CAM_CONTEXT.AIM_TRACK_Y; }, set:function(v){ CAM_CONTEXT.AIM_TRACK_Y = Math.max(0, Math.min(1.0, v)); }, step:0.04, fmt:function(v){ return v.toFixed(2); } },
  { stem:'camtrack', get:function(){ return CAM_CONTEXT.CAMERA_TRACK_Y; }, set:function(v){ CAM_CONTEXT.CAMERA_TRACK_Y = Math.max(0, Math.min(2.0, v)); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'camoff', get:function(){ return CAM_CONTEXT.CAMERA_TRACK_OFFSET; }, set:function(v){ CAM_CONTEXT.CAMERA_TRACK_OFFSET = Math.max(-2, Math.min(3, v)); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'ctxgateoff', get:function(){ return CAM_CONTEXT.GATE_Y_OFFSET; }, set:function(v){ CAM_CONTEXT.GATE_Y_OFFSET = Math.max(-2, Math.min(4, v)); }, step:0.1, fmt:function(v){ return v.toFixed(1); } },
  { stem:'sceneart', get:function(){ return SCENE_ART.ENABLED ? 1 : 0; }, set:function(v){ SCENE_ART.ENABLED = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'clouds', get:function(){ return SCENE_ART.CLOUD_VISIBLE ? 1 : 0; }, set:function(v){ SCENE_ART.CLOUD_VISIBLE = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'ambientbees', get:function(){ return SCENE_ART.AMBIENT_BEES_VISIBLE ? 1 : 0; }, set:function(v){ SCENE_ART.AMBIENT_BEES_VISIBLE = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'flowers', get:function(){ return SCENE_ART.FLOWERS_VISIBLE ? 1 : 0; }, set:function(v){ SCENE_ART.FLOWERS_VISIBLE = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'foreground', get:function(){ return SCENE_ART.FOREGROUND_VISIBLE ? 1 : 0; }, set:function(v){ SCENE_ART.FOREGROUND_VISIBLE = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'pollen', get:function(){ return SCENE_ART.POLLEN_VISIBLE ? 1 : 0; }, set:function(v){ SCENE_ART.POLLEN_VISIBLE = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'flowercount', get:function(){ return SCENE_ART.FLOWER_CLUSTER_COUNT; }, set:function(v){ SCENE_ART.FLOWER_CLUSTER_COUNT = Math.max(4, Math.min(28, Math.round(v))); initSceneArtRef(); }, step:2, fmt:function(v){ return Math.round(v) + ''; } },
  { stem:'ambientcount', get:function(){ return SCENE_ART.AMBIENT_BEE_COUNT; }, set:function(v){ SCENE_ART.AMBIENT_BEE_COUNT = Math.max(4, Math.min(36, Math.round(v))); initSceneArtRef(); }, step:2, fmt:function(v){ return Math.round(v) + ''; } },
  { stem:'pollencount', get:function(){ return SCENE_ART.POLLEN_COUNT; }, set:function(v){ SCENE_ART.POLLEN_COUNT = Math.max(8, Math.min(128, Math.round(v))); initSceneArtRef(); }, step:4, fmt:function(v){ return Math.round(v) + ''; } },
  { stem:'keylight', get:function(){ return LIGHTING.KEY_INTENSITY; }, set:function(v){ LIGHTING.KEY_INTENSITY = Math.max(0, Math.min(5, v)); refreshLightingRigRef(); }, step:0.1, fmt:function(v){ return v.toFixed(1); } },
  { stem:'skyfill', get:function(){ return LIGHTING.SKY_INTENSITY; }, set:function(v){ LIGHTING.SKY_INTENSITY = Math.max(0, Math.min(3, v)); refreshLightingRigRef(); }, step:0.1, fmt:function(v){ return v.toFixed(1); } },
  { stem:'bounce', get:function(){ return LIGHTING.BOUNCE_INTENSITY; }, set:function(v){ LIGHTING.BOUNCE_INTENSITY = Math.max(0, Math.min(3, v)); refreshLightingRigRef(); }, step:0.1, fmt:function(v){ return v.toFixed(1); } },
  { stem:'rimlight', get:function(){ return LIGHTING.RIM_INTENSITY; }, set:function(v){ LIGHTING.RIM_INTENSITY = Math.max(0, Math.min(3, v)); refreshLightingRigRef(); }, step:0.1, fmt:function(v){ return v.toFixed(1); } },
  { stem:'hiveglow', get:function(){ var hiveGlow = getHiveGlowRef(); return hiveGlow ? hiveGlow.intensity : 0; }, set:function(v){ var hiveGlow = getHiveGlowRef(); if (hiveGlow) { hiveGlow.intensity = Math.max(0, Math.min(4, v)); } }, step:0.1, fmt:function(v){ return v.toFixed(1); } },
  { stem:'cellhi', get:function(){ return PRESENTATION.CELL_HIGHLIGHTS_ENABLED ? 1 : 0; }, set:function(v){ PRESENTATION.CELL_HIGHLIGHTS_ENABLED = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'cellfx', get:function(){ return PRESENTATION.CELL_FX_ENABLED ? 1 : 0; }, set:function(v){ PRESENTATION.CELL_FX_ENABLED = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'beefx', get:function(){ return PRESENTATION.BEE_READABILITY_ENABLED ? 1 : 0; }, set:function(v){ PRESENTATION.BEE_READABILITY_ENABLED = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'matrich', get:function(){ return PRESENTATION.MATERIAL_RICHNESS_ENABLED ? 1 : 0; }, set:function(v){ PRESENTATION.MATERIAL_RICHNESS_ENABLED = Math.round(v) > 0; refreshCoreCylinderMaterialRef(); refreshAllCellMaterialsRef(); }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'beetrails', get:function(){ return PRESENTATION.BEE_TRAILS_ENABLED ? 1 : 0; }, set:function(v){ PRESENTATION.BEE_TRAILS_ENABLED = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'eventfx', get:function(){ return PRESENTATION.EVENT_FX_ENABLED ? 1 : 0; }, set:function(v){ PRESENTATION.EVENT_FX_ENABLED = Math.round(v) > 0; }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'beepose', get:function(){ return getUseBeePoseSystemRef() ? 1 : 0; }, set:function(v){ setUseBeePoseSystemRef(Math.round(v) > 0); }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'poseguides', get:function(){ return getWorkerDebugDrawRef() ? 1 : 0; }, set:function(v){ setWorkerDebugDrawRef(Math.round(v) > 0); }, step:1, fmt:function(v){ return Math.round(v) > 0 ? 'ON' : 'OFF'; } },
  { stem:'gatehp', get:function(){ return CONFIG.GATE_WORK_REQUIRED; }, set:function(v){ syncGateWorkRequirementRef(v); }, step:10, fmt:function(v){ return Math.round(v) + ''; } },
  { stem:'hatchc', get:function(){ return CONFIG.HATCHERY_BUILD_COST[1]; }, set:function(v){ CONFIG.HATCHERY_BUILD_COST[1] = Math.max(0, Math.round(v)); invalidateBuildingLabelCacheRef(); }, step:5, fmt:function(v){ return Math.round(v) + 'h'; } },
  { stem:'hatchy', get:function(){ return CONFIG.HATCHERY_NECTAR_YIELD[1]; }, set:function(v){ CONFIG.HATCHERY_NECTAR_YIELD[1] = Math.max(1, Math.round(v)); invalidateBuildingLabelCacheRef(); }, step:1, fmt:function(v){ return Math.round(v) + 'n'; } },
  { stem:'hatchi', get:function(){ return CONFIG.HATCHERY_NECTAR_INTERVAL[1]; }, set:function(v){ CONFIG.HATCHERY_NECTAR_INTERVAL[1] = Math.max(1, Math.round(v)); refreshM6TuningStateRef(); }, step:1, fmt:function(v){ return Math.round(v) + 's'; } },
  { stem:'procc', get:function(){ return CONFIG.PROCESSOR_BUILD_COST[1]; }, set:function(v){ CONFIG.PROCESSOR_BUILD_COST[1] = Math.max(0, Math.round(v)); invalidateBuildingLabelCacheRef(); }, step:5, fmt:function(v){ return Math.round(v) + 'h'; } },
  { stem:'procb', get:function(){ return CONFIG.PROCESSOR_RATE_BONUS[1]; }, set:function(v){ CONFIG.PROCESSOR_RATE_BONUS[1] = Math.max(0, Math.round(v)); refreshM6TuningStateRef(); }, step:1, fmt:function(v){ return '+' + Math.round(v); } },
  { stem:'potc', get:function(){ return CONFIG.BUILDING_LOT_CLAIM_COST; }, set:function(v){ CONFIG.BUILDING_LOT_CLAIM_COST = Math.max(0, Math.round(v)); invalidateBuildingLabelCacheRef(); }, step:5, fmt:function(v){ return Math.round(v) + 'h'; } },
  { stem:'potx', get:function(){ return CONFIG.BUILDING_LOT_EXIT_BONUS; }, set:function(v){ CONFIG.BUILDING_LOT_EXIT_BONUS = Math.max(0, Math.round(v)); invalidateBuildingLabelCacheRef(); invalidateGateLabelCacheRef(); }, step:2, fmt:function(v){ return '+' + Math.round(v); } },
  { stem:'exitc', get:function(){ return CONFIG.STAGE_EXIT_CLEAR_BONUS_MAX; }, set:function(v){ CONFIG.STAGE_EXIT_CLEAR_BONUS_MAX = Math.max(0, Math.round(v)); invalidateGateLabelCacheRef(); }, step:2, fmt:function(v){ return '+' + Math.round(v); } },
  { stem:'exits', get:function(){ return CONFIG.STAGE_EXIT_STRUCTURE_BONUS; }, set:function(v){ CONFIG.STAGE_EXIT_STRUCTURE_BONUS = Math.max(0, Math.round(v)); invalidateGateLabelCacheRef(); }, step:1, fmt:function(v){ return '+' + Math.round(v); } },
  { stem:'exitf', get:function(){ return CONFIG.STAGE_EXIT_FULL_CLEAR_BONUS; }, set:function(v){ CONFIG.STAGE_EXIT_FULL_CLEAR_BONUS = Math.max(0, Math.round(v)); invalidateGateLabelCacheRef(); }, step:5, fmt:function(v){ return '+' + Math.round(v); } },
  { stem:'cylr',    get:function(){ return HIVE.CYLINDER_RADIUS; }, set:function(v){ HIVE.CYLINDER_RADIUS = Math.max(1, v); }, step:0.1, fmt:function(v){ return v.toFixed(2); } },
  { stem:'vspace',  get:function(){ return HIVE.VERTICAL_SPACING; }, set:function(v){ HIVE.VERTICAL_SPACING = Math.max(0.1, v); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'hexr',    get:function(){ return HIVE.HEX_CIRCUMRADIUS; }, set:function(v){ HIVE.HEX_CIRCUMRADIUS = Math.max(0.1, v); }, step:0.05, fmt:function(v){ return v.toFixed(2); } },
  { stem:'hexd',    get:function(){ return HIVE.HEX_DEPTH; }, set:function(v){ HIVE.HEX_DEPTH = Math.max(0.02, v); }, step:0.02, fmt:function(v){ return v.toFixed(2); } },
  { stem:'gap',     get:function(){ return HIVE.HEX_GAP_FACTOR; }, set:function(v){ HIVE.HEX_GAP_FACTOR = Math.max(0.5, Math.min(1.0, v)); }, step:0.01, fmt:function(v){ return v.toFixed(3); } },
  { stem:'ts',      get:function(){ return stateRef.gameTimeScale; }, set:function(v){ stateRef.gameTimeScale = Math.max(0.05, Math.min(8, v)); }, step:0.1, fmt:function(v){ return v.toFixed(2) + 'x'; } }
];

export function setDebugPanelRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getCameraRef = runtime && runtime.getCamera ? runtime.getCamera : getCameraRef;
  getCamStateRef = runtime && runtime.getCamState ? runtime.getCamState : getCamStateRef;
  getCamTargetRef = runtime && runtime.getCamTarget ? runtime.getCamTarget : getCamTargetRef;
  getHiveGlowRef = runtime && runtime.getHiveGlow ? runtime.getHiveGlow : getHiveGlowRef;
  getUseBeePoseSystemRef = runtime && runtime.getUseBeePoseSystem ? runtime.getUseBeePoseSystem : getUseBeePoseSystemRef;
  setUseBeePoseSystemRef = runtime && runtime.setUseBeePoseSystem ? runtime.setUseBeePoseSystem : setUseBeePoseSystemRef;
  getWorkerDebugDrawRef = runtime && runtime.getWorkerDebugDraw ? runtime.getWorkerDebugDraw : getWorkerDebugDrawRef;
  setWorkerDebugDrawRef = runtime && runtime.setWorkerDebugDraw ? runtime.setWorkerDebugDraw : setWorkerDebugDrawRef;
  refreshLightingRigRef = runtime && runtime.refreshLightingRig ? runtime.refreshLightingRig : refreshLightingRigRef;
  refreshCoreCylinderMaterialRef = runtime && runtime.refreshCoreCylinderMaterial ? runtime.refreshCoreCylinderMaterial : refreshCoreCylinderMaterialRef;
  refreshAllCellMaterialsRef = runtime && runtime.refreshAllCellMaterials ? runtime.refreshAllCellMaterials : refreshAllCellMaterialsRef;
  syncGateWorkRequirementRef = runtime && runtime.syncGateWorkRequirement ? runtime.syncGateWorkRequirement : syncGateWorkRequirementRef;
  invalidateBuildingLabelCacheRef = runtime && runtime.invalidateBuildingLabelCache ? runtime.invalidateBuildingLabelCache : invalidateBuildingLabelCacheRef;
  refreshM6TuningStateRef = runtime && runtime.refreshM6TuningState ? runtime.refreshM6TuningState : refreshM6TuningStateRef;
  invalidateGateLabelCacheRef = runtime && runtime.invalidateGateLabelCache ? runtime.invalidateGateLabelCache : invalidateGateLabelCacheRef;
  initSceneArtRef = runtime && runtime.initSceneArt ? runtime.initSceneArt : initSceneArtRef;
  onRebuildRef = runtime && runtime.onRebuild ? runtime.onRebuild : onRebuildRef;
  onCopyValuesRef = runtime && runtime.onCopyValues ? runtime.onCopyValues : onCopyValuesRef;
}

export function getDebugPanel() {
  return debugPanel;
}

export function setDebugSectionCollapsed(header, body, collapsed) {
  header.classList.toggle('collapsed', !!collapsed);
  body.classList.toggle('collapsed', !!collapsed);
  debugSectionState[header.textContent.trim()] = !!collapsed;
}

export function initDebugSections() {
  if (!debugPanel || debugPanel.dataset.sectionsReady === '1') { return; }
  var children = Array.prototype.slice.call(debugPanel.children);
  var currentHeader = null;
  var currentBody = null;
  var defaultCollapsed = {
    'M6 Tuning': true,
    'Hive (press Rebuild)': true
  };

  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.classList && child.classList.contains('dbg-section')) {
      currentHeader = child;
      currentBody = document.createElement('div');
      currentBody.className = 'dbg-section-body';
      currentHeader.parentNode.insertBefore(currentBody, currentHeader.nextSibling);
      var title = currentHeader.textContent.trim();
      setDebugSectionCollapsed(currentHeader, currentBody, !!defaultCollapsed[title]);
      (function(header, body) {
        header.addEventListener('click', function(e) {
          e.stopPropagation();
          setDebugSectionCollapsed(header, body, !body.classList.contains('collapsed'));
        });
        header.addEventListener('touchend', function(e) {
          e.preventDefault();
          e.stopPropagation();
          setDebugSectionCollapsed(header, body, !body.classList.contains('collapsed'));
        }, { passive: false });
      })(currentHeader, currentBody);
      continue;
    }
    if (currentBody) {
      currentBody.appendChild(child);
    }
  }
  debugPanel.dataset.sectionsReady = '1';
}

export function dbgRefresh() {
  var versionSpan = document.getElementById('dbg-version-val');
  if (versionSpan) { versionSpan.textContent = BUILD_VERSION; }
  for (var i = 0; i < dbgDefs.length; i++) {
    var span = document.getElementById('dbg-' + dbgDefs[i].stem + '-val');
    if (span) { span.textContent = dbgDefs[i].fmt(dbgDefs[i].get()); }
  }
}

function wireStepButtons() {
  if (stepButtonsWired) { return; }
  stepButtonsWired = true;
  function wireBtn(id, fn) {
    var el = document.getElementById(id);
    if (!el) { return; }
    el.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); fn(); dbgRefresh(); }, { passive: false });
    el.addEventListener('click', function(e) { e.stopPropagation(); fn(); dbgRefresh(); });
  }
  for (var i = 0; i < dbgDefs.length; i++) {
    (function(d) {
      wireBtn('dbg-' + d.stem + '-up', function() { d.set(d.get() + d.step); });
      wireBtn('dbg-' + d.stem + '-dn', function() { d.set(d.get() - d.step); });
    })(dbgDefs[i]);
  }
}

export function initDebugPanel() {
  if (debugPanelInitDone) { return; }
  debugPanelInitDone = true;

  wireStepButtons();

  debugPanel.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
  debugPanel.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: true });
  debugPanel.addEventListener('touchend', function(e) { e.stopPropagation(); }, { passive: true });

  initDebugSections();

  debugToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    if (debugPanel.classList.contains('open')) {
      debugPanel.classList.remove('open');
    } else {
      debugPanel.classList.add('open');
      dbgRefresh();
    }
  });
  debugToggle.addEventListener('touchend', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (debugPanel.classList.contains('open')) {
      debugPanel.classList.remove('open');
    } else {
      debugPanel.classList.add('open');
      dbgRefresh();
    }
  }, { passive: false });

  document.getElementById('dbg-rebuild').addEventListener('click', function() { onRebuildRef(); });
  document.getElementById('dbg-copy').addEventListener('click', function() { onCopyValuesRef(); });
}
