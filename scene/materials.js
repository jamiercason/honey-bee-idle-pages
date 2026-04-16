import { CONFIG } from '../config/config.js';
import { HIVE } from '../config/hiveConfig.js';
import { PRESENTATION } from '../config/presentationConfig.js';
import { BOOST_TYPE, CELL_STATE, OBSTACLE_CLASS, CELL_TYPE } from '../data/enums.js';
import { saturate01, lerp } from '../utils/math.js';
import { mixHex, addHexTint } from '../utils/color.js';
import { cellHasAssignableSeat, hasCellOccupants, isWorkerSeatCell } from '../board/cellState.js';
import { isRequiredStructureCell } from '../economy/buildings.js';
import { getSelectedBee } from '../bees/beeQueries.js';
import { beeCanWorkTargetCell } from '../bees/beeAssignments.js';
import { buildFlatHexFaceGeometry } from './hiveMeshes.js';
import { buildHoneyPoolTexture, buildProceduralMaterialMaps } from './textures.js';

export var VIS = {
  COL_LOCKED:         0x3f2a10,
  COL_OBSTACLE:       0x88561b,
  COL_DORMANT:        0x7f9fbc,
  COL_OPEN:           0xd99618,
  COL_NECTAR:         0xf0ae33,
  COL_HONEY:          0xf5c641,
  COL_REWARD_LOCKED:  0x5f3e10,
  COL_REWARD_DORMANT: 0x9b6a1f,
  COL_BUILDING_LOT:   0x6b5826,
  COL_BUILDING_OPEN:  0xb9872f,
  COL_HATCHERY:       0x8d7e46,
  COL_HATCHERY_BUILT: 0xf0be6a,
  COL_PROCESSOR:      0x8b6c2b,
  COL_PROCESSOR_BUILT:0xf4ce78,
  COL_GATE_LOCKED:    0x6a4417,
  COL_GATE_DORMANT:   0x9f6420,
  COL_GATE_OPEN:      0xd19b38,
  EMI_LOCKED:         0x140a02,
  EMI_OBSTACLE:       0x361705,
  EMI_DORMANT:        0x20384c,
  EMI_OPEN:           0x643800,
  EMI_NECTAR:         0xb66b07,
  EMI_HONEY:          0xffb52f,
  EMI_REWARD_LOCKED:  0x2a1300,
  EMI_REWARD_DORMANT: 0x6a3200,
  EMI_BUILDING_LOT:   0x2d1705,
  EMI_BUILDING_OPEN:  0x6c430a,
  EMI_HATCHERY:       0x6d4d0f,
  EMI_PROCESSOR:      0x67480c,
  EMI_GATE:           0x672800,
  EMI_GATE_OPEN:      0xd88114,
  LIFT_OPEN:          0.03,
  LIFT_NECTAR:        0.04,
  LIFT_HONEY:         0.07,
  LIFT_GATE:          0.05,
  LIFT_REWARD:        0.02
};

export var CELL_SURFACE = {
  INNER_FACE_SCALE: 0.94,
  INNER_FACE_DEPTH: 0.038,
  INNER_FACE_Z: 0.48,
  HONEY_FACE_SCALE: 0.78,
  HONEY_FACE_DEPTH: 0.030,
  HONEY_FACE_Z: 0.40
};

var stateRef = null;
var getPointerRef = function() { return null; };
var getCellVisualStateMapRef = function() { return {}; };
var getCellMeshMapRef = function() { return {}; };
var getHiveGroupRef = function() { return null; };
var getSimTimeRef = function() { return 0; };
var getCellWorldPosRef = function() { return null; };
var getCellSurfaceNormalRef = function() { return null; };

export function setMaterialsRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  getPointerRef = runtime && runtime.getPointer ? runtime.getPointer : getPointerRef;
  getCellVisualStateMapRef = runtime && runtime.getCellVisualStateMap ? runtime.getCellVisualStateMap : getCellVisualStateMapRef;
  getCellMeshMapRef = runtime && runtime.getCellMeshMap ? runtime.getCellMeshMap : getCellMeshMapRef;
  getHiveGroupRef = runtime && runtime.getHiveGroup ? runtime.getHiveGroup : getHiveGroupRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
  getCellWorldPosRef = runtime && runtime.getCellWorldPos ? runtime.getCellWorldPos : getCellWorldPosRef;
  getCellSurfaceNormalRef = runtime && runtime.getCellSurfaceNormal ? runtime.getCellSurfaceNormal : getCellSurfaceNormalRef;
}

export function getCellMaterialKey(vs, cell) {
  if (!cell || !vs) { return 'locked_comb'; }
  if (cell.cellType === CELL_TYPE.GATE) {
    if (vs.state === CELL_STATE.LOCKED) { return 'gate_locked'; }
    if (vs.state === CELL_STATE.OBSTACLE) { return 'gate_obstacle'; }
    return 'gate_active';
  }
  if (vs.cellRole === 'structure') {
    if (vs.structureType === 'hatchery') { return 'structure_hatchery'; }
    if (vs.structureType === 'processor') { return 'structure_processor'; }
    if (vs.structureType === 'honey_pot') { return 'structure_honey_pot'; }
    return 'obstacle_structure';
  }
  if (vs.state === CELL_STATE.LOCKED) { return 'locked_comb'; }
  if (vs.state === CELL_STATE.DORMANT) { return 'dormant_open'; }
  if (vs.state === CELL_STATE.ACTIVE) { return 'active_open'; }
  if (vs.obstacleClass === OBSTACLE_CLASS.HEAVY) { return 'obstacle_heavy'; }
  if (vs.obstacleClass === OBSTACLE_CLASS.TREASURE) { return 'obstacle_treasure'; }
  if (vs.obstacleClass === OBSTACLE_CLASS.STRUCTURE) { return 'obstacle_structure'; }
  return 'obstacle_common';
}

export function getCellMaterialMaps(materialFamily) {
  var maps = buildProceduralMaterialMaps();
  switch (materialFamily) {
    case 'obstacle_common':
    case 'obstacle_heavy':
    case 'obstacle_treasure':
    case 'obstacle_structure':
    case 'gate_locked':
    case 'gate_obstacle':
      return { map: maps.obstacle, bumpMap: maps.bump, alphaMap: null };
    case 'active_open':
    case 'gate_active':
    case 'structure_hatchery':
    case 'structure_processor':
    case 'structure_honey_pot':
      return { map: maps.honeyGloss, bumpMap: maps.bump, alphaMap: null };
    case 'dormant_open':
    case 'locked_comb':
    default:
      return { map: maps.wax, bumpMap: maps.bump, alphaMap: null };
  }
}

export function applyCellMaterialMaps(material, maps, richness) {
  if (!material) { return; }
  if (!PRESENTATION.MATERIAL_RICHNESS_ENABLED || !maps) {
    material.map = null;
    material.bumpMap = null;
    material.bumpScale = 0;
    material.needsUpdate = true;
    return;
  }
  material.map = maps.map || null;
  material.bumpMap = maps.bumpMap || null;
  material.bumpScale = richness || 0.03;
  material.needsUpdate = true;
}

export function getCellRoleName(cell) {
  if (!cell) { return 'other'; }
  if (cell.cellType === CELL_TYPE.OPEN) { return 'open'; }
  if (cell.cellType === CELL_TYPE.GATE) { return 'gate'; }
  if (cell.cellType === CELL_TYPE.BUILDING_LOT || cell.cellType === CELL_TYPE.HATCHERY || cell.cellType === CELL_TYPE.PROCESSOR) { return 'structure'; }
  return 'other';
}

export function getCellStructureType(cell) {
  if (!cell) { return 'none'; }
  if (cell.cellType === CELL_TYPE.HATCHERY) { return 'hatchery'; }
  if (cell.cellType === CELL_TYPE.PROCESSOR) { return 'processor'; }
  if (cell.cellType === CELL_TYPE.BUILDING_LOT) { return 'honey_pot'; }
  return 'none';
}

export function getCellRewardLeadType(cell) {
  if (!cell) { return 'none'; }
  if (cell.rewardType) { return cell.rewardType; }
  if (cell.rewardTable && cell.rewardTable.length > 0) { return cell.rewardTable[0].type || 'none'; }
  return 'none';
}

export function canBeeInteractWithCell(bee, cell) {
  if (!bee || !cell) { return { valid: false, invalid: false }; }
  if (cell.state === CELL_STATE.LOCKED) { return { valid: false, invalid: true }; }
  if (isWorkerSeatCell(cell)) {
    return { valid: !!cellHasAssignableSeat(cell), invalid: !cellHasAssignableSeat(cell) };
  }
  if (cell.state === CELL_STATE.OBSTACLE && beeCanWorkTargetCell(bee, cell)) {
    return { valid: true, invalid: false };
  }
  return { valid: false, invalid: true };
}

export function getCellVisualState(cell) {
  var selectedBee = getSelectedBee();
  var pointerRef = getPointerRef();
  var isHovered = !!(pointerRef && pointerRef.dragMode === 'bee_assign' && pointerRef.moved && pointerRef.dragHoverCellId === cell.id);
  var interaction = isHovered ? canBeeInteractWithCell(selectedBee, cell) : { valid: false, invalid: false };
  var activationProgress = (cell.state === CELL_STATE.DORMANT && cell.nectarRequired > 0) ? saturate01(cell.nectarStored / Math.max(1, cell.nectarRequired)) : 0;
  var workProgress = (cell.state === CELL_STATE.OBSTACLE && cell.activationRequired > 0) ? saturate01(cell.activationProgress / Math.max(1, cell.activationRequired)) : 0;
  var productionFill = 0;
  if (cell.state === CELL_STATE.ACTIVE && cell.cellType === CELL_TYPE.OPEN) {
    productionFill = Math.max(
      cell.honeyCapacity > 0 ? saturate01(cell.honeyStored / Math.max(1, cell.honeyCapacity)) : 0,
      cell.nectarCapacity > 0 ? saturate01(cell.nectarStored / Math.max(1, cell.nectarCapacity)) * 0.45 : 0
    );
  }
  var requiredStructure = isRequiredStructureCell(cell);
  var isGoalCritical = false;
  if (cell.cellType === CELL_TYPE.GATE && ((stateRef && stateRef.gateReady) || cell.state === CELL_STATE.OBSTACLE || cell.state === CELL_STATE.ACTIVE)) {
    isGoalCritical = true;
  } else if (requiredStructure && !(cell.state === CELL_STATE.ACTIVE && cell.buildingConstructed)) {
    isGoalCritical = true;
  }
  var vs = {
    state: cell.state,
    obstacleClass: cell.obstacleClass || 'none',
    cellRole: getCellRoleName(cell),
    structureType: getCellStructureType(cell),
    isRevealed: cell.state !== CELL_STATE.LOCKED,
    isSeatable: isWorkerSeatCell(cell) && cellHasAssignableSeat(cell),
    isOccupied: hasCellOccupants(cell),
    isSelected: !!(selectedBee && selectedBee.seatCellId === cell.id),
    isHovered: isHovered,
    isValidTarget: interaction.valid,
    isInvalidTarget: interaction.invalid,
    isBeingWorked: cell.state === CELL_STATE.OBSTACLE && hasCellOccupants(cell),
    workProgress: workProgress,
    isNearClear: workProgress >= 0.72,
    activationProgress: activationProgress,
    isNearActivation: activationProgress >= 0.72 && cell.state === CELL_STATE.DORMANT,
    productionFill: productionFill,
    readyToCollect: !!cell.isReadyToCollect,
    rewardLeadType: getCellRewardLeadType(cell),
    isGoalCritical: isGoalCritical,
    isBoostedByStructure: !!(cell.cellType === CELL_TYPE.OPEN && cell.state === CELL_STATE.ACTIVE && (cell.productionRate || 0) > (cell.baseProductionRate || 0)),
    isUnderRoyalRush: !!(stateRef && stateRef.royalRushTimer > 0),
    isRoyalJellyBuffed: false
  };
  getCellVisualStateMapRef()[cell.id] = vs;
  return vs;
}

export function resolveCellVisualStyle(vs, cell) {
  var color = VIS.COL_LOCKED;
  var emissive = VIS.EMI_LOCKED;
  var roughness = 0.92;
  var metalness = 0.02;
  var emissiveIntensity = 0.62;
  var materialFamily = getCellMaterialKey(vs, cell);
  var bumpScale = 0.024;

  if (vs.state === CELL_STATE.LOCKED) {
    if (vs.obstacleClass === OBSTACLE_CLASS.GATE || cell.cellType === CELL_TYPE.GATE) {
      color = VIS.COL_GATE_LOCKED;
      emissive = VIS.EMI_GATE;
      roughness = 0.62;
      metalness = 0.18;
    } else if (vs.obstacleClass === OBSTACLE_CLASS.STRUCTURE || vs.cellRole === 'structure') {
      color = VIS.COL_BUILDING_LOT;
      emissive = VIS.EMI_BUILDING_LOT;
      roughness = 0.72;
      metalness = 0.08;
    } else if (vs.rewardLeadType !== 'none') {
      color = VIS.COL_REWARD_LOCKED;
      emissive = VIS.EMI_REWARD_LOCKED;
      roughness = 0.86;
      metalness = 0.04;
    } else {
      color = VIS.COL_LOCKED;
      emissive = VIS.EMI_LOCKED;
      roughness = 0.95;
      metalness = 0.0;
    }
  } else if (vs.state === CELL_STATE.OBSTACLE) {
    color = VIS.COL_OBSTACLE;
    emissive = VIS.EMI_OBSTACLE;
    roughness = 0.80;
    metalness = 0.02;
    if (vs.obstacleClass === OBSTACLE_CLASS.HEAVY) {
      color = mixHex(VIS.COL_OBSTACLE, 0x5f3813, 0.52);
      emissive = mixHex(VIS.EMI_OBSTACLE, 0x2a0d00, 0.44);
      roughness = 0.88;
      bumpScale = 0.048;
    } else if (vs.obstacleClass === OBSTACLE_CLASS.TREASURE || vs.rewardLeadType === BOOST_TYPE.ROYAL_JELLY) {
      color = mixHex(VIS.COL_REWARD_DORMANT, 0xd28f2b, 0.55);
      emissive = mixHex(VIS.EMI_REWARD_DORMANT, 0xaa5d00, 0.52);
      roughness = 0.50;
      metalness = 0.08;
      bumpScale = 0.032;
    } else if (vs.obstacleClass === OBSTACLE_CLASS.STRUCTURE || vs.cellRole === 'structure') {
      color = mixHex(VIS.COL_BUILDING_LOT, 0x8c6534, 0.44);
      emissive = VIS.EMI_BUILDING_LOT;
      roughness = 0.68;
      bumpScale = 0.030;
    } else if (cell.cellType === CELL_TYPE.GATE) {
      color = VIS.COL_GATE_DORMANT;
      emissive = VIS.EMI_GATE;
      roughness = 0.48;
      metalness = 0.14;
      bumpScale = 0.050;
    }
    if (vs.workProgress > 0) {
      color = addHexTint(color, 0xffd97d, vs.workProgress * 0.34);
      emissive = addHexTint(emissive, 0xff9d22, vs.workProgress * 0.46);
      roughness = Math.max(0.36, roughness - vs.workProgress * 0.24);
    }
  } else if (vs.state === CELL_STATE.DORMANT) {
    if (vs.cellRole === 'structure') {
      color = mixHex(VIS.COL_BUILDING_LOT, 0xcaa56d, 0.16);
      emissive = mixHex(VIS.EMI_BUILDING_LOT, 0x6e4a10, 0.34);
      roughness = 0.60;
      metalness = 0.05;
    } else {
      color = mixHex(VIS.COL_DORMANT, 0xcab998, 0.06);
      emissive = mixHex(VIS.EMI_DORMANT, 0x2f4152, 0.08);
      roughness = 0.76;
      metalness = 0.04;
      if (vs.isSeatable) {
        emissive = addHexTint(emissive, 0xffc86b, 0.12);
      }
    }
    if (vs.activationProgress > 0) {
      color = addHexTint(color, 0xffdf8d, vs.activationProgress * 0.26);
      emissive = addHexTint(emissive, 0xffac2f, vs.activationProgress * 0.42);
      roughness = Math.max(0.40, roughness - vs.activationProgress * 0.12);
    }
  } else if (vs.state === CELL_STATE.ACTIVE) {
    if (cell.cellType === CELL_TYPE.GATE) {
      color = mixHex(VIS.COL_GATE_OPEN, 0xffcf64, 0.36);
      emissive = mixHex(VIS.EMI_GATE_OPEN, 0xffb735, 0.44);
      roughness = 0.28;
      metalness = 0.18;
    } else if (vs.cellRole === 'structure') {
      if (vs.structureType === 'hatchery') {
        color = cell.buildingConstructed ? VIS.COL_HATCHERY_BUILT : mixHex(VIS.COL_HATCHERY, VIS.COL_DORMANT, 0.22);
        emissive = VIS.EMI_HATCHERY;
      } else if (vs.structureType === 'processor') {
        color = cell.buildingConstructed ? VIS.COL_PROCESSOR_BUILT : mixHex(VIS.COL_PROCESSOR, VIS.COL_DORMANT, 0.22);
        emissive = VIS.EMI_PROCESSOR;
      } else {
        color = cell.buildingConstructed ? VIS.COL_BUILDING_OPEN : VIS.COL_BUILDING_LOT;
        emissive = cell.buildingConstructed ? VIS.EMI_BUILDING_OPEN : VIS.EMI_BUILDING_LOT;
      }
      roughness = cell.buildingConstructed ? 0.32 : 0.46;
      metalness = 0.10;
      bumpScale = cell.buildingConstructed ? 0.020 : 0.028;
      if (cell.buildingStoredNectar > 0) {
        emissive = addHexTint(emissive, 0xffc85d, saturate01(cell.buildingStoredNectar / Math.max(1, CONFIG.HATCHERY_NECTAR_BUFFER)));
      }
    } else {
      color = mixHex(VIS.COL_OPEN, 0x8b5a10, 0.12 + vs.productionFill * 0.08);
      emissive = mixHex(VIS.EMI_OPEN, VIS.EMI_HONEY, 0.03 + vs.productionFill * 0.08);
      roughness = vs.readyToCollect ? 0.24 : lerp(0.60, 0.46, vs.productionFill);
      metalness = lerp(0.01, 0.04, vs.productionFill);
      bumpScale = lerp(0.026, 0.020, vs.productionFill);
      if (cell.nectarStored > 0.001) {
        color = addHexTint(color, VIS.COL_NECTAR, 0.025);
        emissive = addHexTint(emissive, VIS.EMI_NECTAR, 0.05);
      }
    }
  }

  if (vs.isBoostedByStructure) {
    emissive = addHexTint(emissive, 0xfff1c1, 0.24);
    roughness = Math.max(0.18, roughness - 0.05);
  }
  if (vs.readyToCollect) {
    color = addHexTint(color, 0xffd777, 0.04);
    emissive = addHexTint(emissive, 0xffc938, 0.10);
  }
  if (vs.isGoalCritical) {
    emissive = addHexTint(emissive, 0xffdd75, 0.24);
  }

  return {
    materialFamily: materialFamily,
    color: color,
    emissive: emissive,
    roughness: roughness,
    metalness: metalness,
    emissiveIntensity: emissiveIntensity,
    bumpScale: bumpScale
  };
}

export function resolveCellHighlightState(vs, cell, ci) {
  var simTime = getSimTimeRef();
  if (!PRESENTATION.CELL_HIGHLIGHTS_ENABLED) {
    return {
      reason: 'none',
      colorTint: null,
      emissiveTint: null,
      emissiveIntensity: null
    };
  }

  if (vs.isInvalidTarget) {
    return {
      reason: 'invalid_target',
      colorTint: 0xffb0a2,
      emissiveTint: 0xff4f52,
      emissiveIntensity: 1.45 + Math.abs(Math.sin(simTime * 5.0)) * 0.35
    };
  }
  if (vs.isValidTarget) {
    return {
      reason: 'valid_target',
      colorTint: 0xfff3ac,
      emissiveTint: 0xffde69,
      emissiveIntensity: 1.10 + Math.abs(Math.sin(simTime * 4.0 + ci * 0.15)) * 0.24
    };
  }
  if (vs.isSelected) {
    return {
      reason: 'selected',
      colorTint: 0xfff6ce,
      emissiveTint: 0xfff2b8,
      emissiveIntensity: 1.28 + Math.abs(Math.sin(simTime * 3.8)) * 0.24
    };
  }
  if (vs.isGoalCritical) {
    return {
      reason: 'goal',
      colorTint: 0xffe1a2,
      emissiveTint: 0xffd96a,
      emissiveIntensity: 1.02 + Math.abs(Math.sin(simTime * 2.3 + ci * 0.2)) * 0.18
    };
  }
  if (vs.readyToCollect) {
    return {
      reason: 'ready',
      colorTint: 0xfff4b0,
      emissiveTint: 0xffc938,
      emissiveIntensity: 1.18 + Math.pow(Math.abs(Math.sin(simTime * 2.8 + ci * 0.2)), 0.7) * 0.44
    };
  }
  if (vs.isBeingWorked) {
    return {
      reason: 'working',
      colorTint: 0xffdb93,
      emissiveTint: 0xffaa43,
      emissiveIntensity: 1.08 + Math.abs(Math.sin(simTime * 6.6 + ci)) * 0.30
    };
  }
  if (vs.isNearActivation) {
    return {
      reason: 'near_activation',
      colorTint: 0xffefbe,
      emissiveTint: 0xffb85a,
      emissiveIntensity: 0.98 + Math.abs(Math.sin(simTime * 3.2 + ci * 0.3)) * 0.18
    };
  }
  if (vs.isNearClear) {
    return {
      reason: 'near_clear',
      colorTint: 0xffd08e,
      emissiveTint: 0xff9f39,
      emissiveIntensity: 0.98 + Math.abs(Math.sin(simTime * 3.2 + ci * 0.3)) * 0.18
    };
  }
  if (vs.state === CELL_STATE.OBSTACLE && vs.rewardLeadType !== 'none') {
    return {
      reason: 'reward',
      colorTint: 0xffdfa0,
      emissiveTint: 0xffc25a,
      emissiveIntensity: 0.78 + Math.abs(Math.sin(simTime * 1.9 + ci * 0.8)) * 0.12
    };
  }

  return {
    reason: 'none',
    colorTint: null,
    emissiveTint: null,
    emissiveIntensity: null
  };
}

export function cellMaterial(cell) {
  var THREE = globalThis.THREE;
  var visualState = getCellVisualState(cell);
  var style = resolveCellVisualStyle(visualState, cell);
  var material = new THREE.MeshStandardMaterial({
    color: style.color,
    emissive: style.emissive,
    emissiveIntensity: style.emissiveIntensity,
    roughness: style.roughness,
    metalness: style.metalness
  });
  applyCellMaterialMaps(material, getCellMaterialMaps(style.materialFamily), style.bumpScale);
  material.userData.materialFamily = style.materialFamily;
  return material;
}

export function cellRadialLift(cell) {
  if (cell.state === CELL_STATE.ACTIVE && cell.cellType === CELL_TYPE.GATE) { return VIS.LIFT_GATE; }
  if (cell.isReadyToCollect) { return VIS.LIFT_HONEY; }
  if (cell.state === CELL_STATE.ACTIVE && cell.nectarStored > 0) { return VIS.LIFT_NECTAR; }
  if (cell.state === CELL_STATE.ACTIVE) { return VIS.LIFT_OPEN; }
  if (cell.state === CELL_STATE.OBSTACLE && cell.cellType === CELL_TYPE.REWARD_BLOCKER) { return VIS.LIFT_REWARD; }
  return 0;
}

export function refreshCellMaterial(cell) {
  var cellMeshMap = getCellMeshMapRef();
  var mesh = cellMeshMap[cell.id];
  if (!mesh) { return; }
  var visualState = getCellVisualState(cell);
  var style = resolveCellVisualStyle(visualState, cell);
  mesh.material.color.setHex(style.color);
  mesh.material.emissive.setHex(style.emissive);
  mesh.material.emissiveIntensity = style.emissiveIntensity;
  mesh.material.roughness = style.roughness;
  mesh.material.metalness = style.metalness;
  mesh.material.userData.materialFamily = style.materialFamily;
  applyCellMaterialMaps(mesh.material, getCellMaterialMaps(style.materialFamily), style.bumpScale);
  updateCellSurfaceLayers(cell, mesh, visualState, style);
}

export function ensureCellSurfaceLayers(cell, mesh, cylR) {
  var THREE = globalThis.THREE;
  var hiveGroup = getHiveGroupRef();
  if (!cell || !mesh) { return null; }
  if (mesh.userData.innerFace) {
    hiveGroup.remove(mesh.userData.innerFace);
    if (mesh.userData.innerFace.geometry) { mesh.userData.innerFace.geometry.dispose(); }
    if (mesh.userData.innerFace.material) { mesh.userData.innerFace.material.dispose(); }
    mesh.userData.innerFace = null;
  }
  if (mesh.userData.honeyFace) {
    return { honeyFace: mesh.userData.honeyFace };
  }

  var honeyGeo = buildFlatHexFaceGeometry(CELL_SURFACE.HONEY_FACE_SCALE);
  var honeyMat = new THREE.MeshBasicMaterial({
    color: 0xffc24a,
    transparent: true,
    opacity: 0.0,
    fog: false,
    toneMapped: true
  });
  honeyMat.alphaMap = buildHoneyPoolTexture();
  var honeyFace = new THREE.Mesh(honeyGeo, honeyMat);
  honeyFace.castShadow = false;
  honeyFace.receiveShadow = false;
  honeyFace.renderOrder = 2;
  honeyFace.visible = false;
  honeyFace.userData.isCellSurfaceLayer = true;
  hiveGroup.add(honeyFace);

  mesh.userData.innerFace = null;
  mesh.userData.honeyFace = honeyFace;
  return { honeyFace: honeyFace };
}

export function updateCellSurfaceLayers(cell, mesh, vs, style) {
  var THREE = globalThis.THREE;
  if (!cell || !mesh) { return; }
  var innerFace = mesh.userData.innerFace;
  var honeyFace = mesh.userData.honeyFace;
  if (innerFace) { innerFace.visible = false; }
  if (!honeyFace) { return; }
  if (!PRESENTATION.MATERIAL_RICHNESS_ENABLED) {
    honeyFace.visible = false;
    return;
  }

  var normal = getCellSurfaceNormalRef(cell);
  var faceQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  var faceCenter = getCellWorldPosRef(cell).clone();
  honeyFace.position.copy(faceCenter).addScaledVector(normal, -HIVE.HEX_DEPTH * 0.48);
  honeyFace.position.y -= HIVE.HEX_CIRCUMRADIUS * 0.26;
  honeyFace.quaternion.copy(faceQuat);

  var openActive = (vs.state === CELL_STATE.ACTIVE && vs.cellRole === 'open');
  if (!openActive) {
    honeyFace.visible = false;
    honeyFace.material.opacity = 0;
    honeyFace.scale.set(1, 1, 1);
    return;
  }

  var honeyMix = Math.max(vs.productionFill, cell.nectarStored > 0.01 ? 0.44 : 0, cell.honeyStored > 0.01 ? 0.36 : 0, vs.readyToCollect ? 0.98 : 0);
  if (honeyMix <= 0.16 && !vs.readyToCollect) {
    honeyFace.visible = false;
    honeyFace.material.opacity = 0;
    honeyFace.scale.set(1, 1, 1);
    return;
  }
  var honeyPresence = saturate01((honeyMix - 0.12) / 0.88);
  var honeyColor = mixHex(0x7a4708, VIS.COL_HONEY, 0.34 + honeyPresence * 0.34);
  honeyFace.visible = true;
  honeyFace.material.color.setHex(honeyColor);
  honeyFace.material.opacity = Math.min(0.42, 0.14 + honeyPresence * 0.10 + (vs.readyToCollect ? 0.02 : 0));
  honeyFace.scale.set(0.96, lerp(0.34, 0.58, honeyPresence) + (vs.readyToCollect ? 0.02 : 0), 1.0);
  honeyFace.position.y = faceCenter.y - HIVE.HEX_CIRCUMRADIUS * lerp(0.38, 0.31, honeyPresence);
  honeyFace.material.map = null;
  honeyFace.material.alphaMap = buildHoneyPoolTexture();
  honeyFace.material.alphaTest = 0.78;
  honeyFace.material.needsUpdate = true;
}
