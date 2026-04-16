import { CONFIG } from '../config/config.js';
import { CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { getRoyalRushConversionMultiplier } from './boosts.js';

var stateRef = null;
var currentStageRef = null;
var beeConfigRef = null;
var getCellMeshMapRef = function() { return {}; };
var getSimTimeRef = function() { return 0; };
var refreshCellMaterialRef = function() {};
var triggerHoneyReadyFxRef = function() {};
var setBuildingToastRef = function() {};
var spawnAtHiveRef = function() { return null; };

export function setEconomyRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : null;
  currentStageRef = runtime && runtime.currentStage ? runtime.currentStage : null;
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : null;
  getCellMeshMapRef = runtime && runtime.getCellMeshMap ? runtime.getCellMeshMap : getCellMeshMapRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
  refreshCellMaterialRef = runtime && runtime.refreshCellMaterial ? runtime.refreshCellMaterial : refreshCellMaterialRef;
  triggerHoneyReadyFxRef = runtime && runtime.triggerHoneyReadyFx ? runtime.triggerHoneyReadyFx : triggerHoneyReadyFxRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
  spawnAtHiveRef = runtime && runtime.spawnAtHive ? runtime.spawnAtHive : spawnAtHiveRef;
}

export function updateCellEconomy(dt) {
  var j;
  var cell;
  var mesh;
  var pulse;
  var fillFrac;
  var cellMeshMap = getCellMeshMapRef();
  var simTime = getSimTimeRef();
  for (j = 0; j < stateRef.cells.length; j++) {
    cell = stateRef.cells[j];

    if (cell.cellType === CELL_TYPE.GATE) {
      mesh = cellMeshMap[cell.id];
      if (mesh) {
        if (cell.state === CELL_STATE.OBSTACLE) {
          pulse = 0.30 * Math.abs(Math.sin(simTime * 4.0 + j * 0.4));
          mesh.material.emissiveIntensity = 1.2 + pulse;
        } else if (cell.state === CELL_STATE.LOCKED) {
          pulse = 0.04 * Math.sin(simTime * 1.2 + j * 0.8);
          mesh.material.emissiveIntensity = 0.6 + pulse;
        } else {
          mesh.material.emissiveIntensity = 1.0;
        }
      }
      continue;
    }

    if (cell.cellType === CELL_TYPE.REWARD_BLOCKER && cell.state === CELL_STATE.OBSTACLE) {
      mesh = cellMeshMap[cell.id];
      if (mesh) {
        pulse = 0.12 * Math.abs(Math.sin(simTime * 1.8 + j * 1.1));
        mesh.material.emissiveIntensity = 0.7 + pulse;
      }
      continue;
    }

    if (cell.cellType === CELL_TYPE.REWARD_BLOCKER && cell.state === CELL_STATE.ACTIVE && !cell.rewardCollected) {
      mesh = cellMeshMap[cell.id];
      if (mesh) {
        pulse = 0.20 * Math.abs(Math.sin(simTime * 2.5));
        mesh.material.emissiveIntensity = 1.2 + pulse;
      }
      continue;
    }

    if ((cell.cellType === CELL_TYPE.BUILDING_LOT || cell.cellType === CELL_TYPE.HATCHERY || cell.cellType === CELL_TYPE.PROCESSOR) && cell.state === CELL_STATE.ACTIVE) {
      mesh = cellMeshMap[cell.id];
      if (mesh) {
        pulse = 0.06 * Math.sin(simTime * 1.4 + j * 0.5);
        mesh.material.emissiveIntensity = 0.8 + pulse;
      }
      continue;
    }

    if (cell.state !== CELL_STATE.ACTIVE || cell.cellType !== CELL_TYPE.OPEN) { continue; }

    var wasReady = cell.isReadyToCollect;
    var hadNectar = (cell.nectarStored > 0.001);
    var prevHoneyStored = cell.honeyStored;

    if (cell.nectarStored > 0.001 && cell.honeyStored < cell.honeyCapacity) {
      var convertRate = cell.conversionRate * getRoyalRushConversionMultiplier();
      var convert = Math.min(cell.nectarStored, convertRate * dt);
      cell.nectarStored -= convert;
      cell.conversionProgress += convert;
      if (cell.nectarStored <= 0.001) {
        cell.nectarStored = 0;
        cell.nectarType = null;
      }
      var honeyProduced = Math.floor(cell.conversionProgress / cell.nectarToHoneyRatio);
      if (honeyProduced > 0) {
        cell.honeyStored = Math.min(cell.honeyCapacity, cell.honeyStored + honeyProduced);
        cell.conversionProgress -= honeyProduced * cell.nectarToHoneyRatio;
      }
    }

    cell.isReadyToCollect = (cell.honeyStored >= 1.0);

    if (cell.isReadyToCollect !== wasReady || Math.abs(cell.honeyStored - prevHoneyStored) > 0.02 || (cell.nectarStored > 0.001) !== hadNectar) {
      refreshCellMaterialRef(cell);
    }
    if (cell.isReadyToCollect && !wasReady) {
      triggerHoneyReadyFxRef(cell);
    }

    mesh = cellMeshMap[cell.id];
    if (mesh) {
      if (cell.isReadyToCollect) {
        var hbeat = Math.pow(Math.abs(Math.sin(simTime * 2.8)), 0.6);
        mesh.material.emissiveIntensity = 0.9 + hbeat * 0.55;
      } else {
        fillFrac = cell.honeyCapacity > 0 ? (cell.honeyStored / cell.honeyCapacity) : 0;
        var nbreathe = 0.5 + 0.5 * Math.sin(simTime * 1.6 + cell.col * 0.7);
        mesh.material.emissiveIntensity = 0.55 + fillFrac * 0.30 + nbreathe * 0.12;
      }
    }
  }
}

export function getCurrentSpawnCost() {
  var summonsPurchased = stateRef && typeof stateRef.summonsPurchased === 'number' ? stateRef.summonsPurchased : 0;
  return Math.max(1, Math.round(currentStageRef.spawnCost * Math.pow(CONFIG.SUMMON_COST_GROWTH, summonsPurchased)));
}

export function doSummon() {
  var summonCost = getCurrentSpawnCost();
  if (stateRef.bees.length >= beeConfigRef.MAX_COUNT) {
    setBuildingToastRef('Bee cap reached (' + beeConfigRef.MAX_COUNT + ')', 1.8);
    return;
  }
  if (stateRef.honey < summonCost) {
    setBuildingToastRef('Need ' + summonCost + ' honey to summon', 1.8);
    return;
  }
  stateRef.honey -= summonCost;
  stateRef.summonsPurchased += 1;
  spawnAtHiveRef(1);
  setBuildingToastRef('Bee summoned', 1.2);
}
