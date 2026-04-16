import { CONFIG } from '../config/config.js';
import { HIVE } from '../config/hiveConfig.js';
import { LABEL } from '../config/labelConfig.js';
import { CELL_STATE, CELL_TYPE, BEE_ROLE } from '../data/enums.js';
import { makeCanvas } from '../utils/canvas.js';
import { getCellById } from '../board/boardQueries.js';
import { hasCellOccupants, isWorkerSeatCell } from '../board/cellState.js';
import { getHatcheryNectarInterval, getHatcheryNectarYield } from '../economy/buildings.js';
import { evaluateGateConditions, getStageExitBonus } from '../economy/gates.js';
import { getBeeFlightFade } from '../bees/beeMovement.js';

export var cellLabelMap = {};
export var openCellLabelMap = {};
export var gateLabelMap = {};
export var beeLabelMap = {};

var THREE = globalThis.THREE;
var sceneRef = null;
var stateRef = null;
var beeConfigRef = null;
var getCameraThetaRef = function() { return 0; };

export function setLabelsRuntime(runtime) {
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : beeConfigRef;
  getCameraThetaRef = runtime && runtime.getCameraTheta ? runtime.getCameraTheta : getCameraThetaRef;
}

export function drawGateLabel(ctx, px, gateReady, levelComplete, exitBonus, gateCell, gateConds) {
  ctx.clearRect(0, 0, px, px);
  var cx = px / 2;
  var cy = px / 2;
  var conds = gateConds || evaluateGateConditions();
  var bgColor = levelComplete ? 'rgba(40,30,0,0.80)' : gateReady ? 'rgba(50,0,0,0.85)' : 'rgba(20,0,0,0.70)';
  var rimColor = levelComplete ? '#ffee44' : gateReady ? '#ff4444' : '#771111';
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.43, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.43, 0, Math.PI * 2);
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = gateReady ? px * 0.08 : px * 0.045;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (levelComplete) {
    ctx.font = 'bold ' + Math.round(px * 0.14) + 'px monospace';
    ctx.fillStyle = '#ffee44';
    ctx.fillText('COMPLETE', cx, cy);
  } else if (gateCell && gateCell.state === CELL_STATE.OBSTACLE) {
    var prog = gateCell.activationRequired > 0 ? Math.min(1.0, gateCell.activationProgress / gateCell.activationRequired) : 0;
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.34, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = px * 0.075;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.font = 'bold ' + Math.round(px * 0.15) + 'px monospace';
    ctx.fillStyle = '#ff8888';
    ctx.fillText('WORK', cx, cy - px * 0.10);
    ctx.font = Math.round(px * 0.10) + 'px monospace';
    ctx.fillStyle = 'rgba(255,180,180,0.72)';
    ctx.fillText(Math.max(0, Math.ceil(gateCell.activationRequired - gateCell.activationProgress)) + ' hp', cx, cy + px * 0.06);
    ctx.fillText((conds.gatesCleared || 0) + '/' + (conds.gatesTotal || 0) + ' gates', cx, cy + px * 0.22);
  } else if (gateReady) {
    var bonus = exitBonus || getStageExitBonus();
    ctx.font = 'bold ' + Math.round(px * 0.18) + 'px monospace';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('CLEAR', cx, cy - px * 0.14);
    ctx.font = Math.round(px * 0.10) + 'px monospace';
    ctx.fillStyle = 'rgba(255,100,100,0.75)';
    ctx.fillText('ALL GATES', cx, cy + px * 0.00);
    ctx.fillStyle = '#ffee44';
    ctx.fillText('+' + bonus.honey + ' honey', cx, cy + px * 0.15);
    if (!bonus.stats.fullClear && bonus.extraForFullClear > 0) {
      ctx.fillStyle = 'rgba(255,220,120,0.68)';
      ctx.fillText('full +' + bonus.extraForFullClear, cx, cy + px * 0.28);
    }
  } else {
    ctx.font = 'bold ' + Math.round(px * 0.13) + 'px monospace';
    ctx.fillStyle = '#cc4444';
    ctx.fillText('GATE', cx, cy - px * 0.20);
    ctx.font = Math.round(px * 0.10) + 'px monospace';
    ctx.fillStyle = conds.structuresOk ? '#44ff88' : '#cc8844';
    ctx.fillText('build ' + conds.structuresReady + '/' + conds.structuresTotal, cx, cy - px * 0.03);
    ctx.fillStyle = '#cc8844';
    ctx.fillText('then work gates', cx, cy + px * 0.13);
  }
}

export function drawRewardBlockerLabel(ctx, px, rewardType, amount, isOpen, collected) {
  if (collected) { return; }
  ctx.clearRect(0, 0, px, px);
  var cx = px / 2;
  var cy = px / 2;
  var isHoney = (rewardType === 'honey');
  var bgColor = isHoney ? 'rgba(40,25,0,0.75)' : 'rgba(5,30,15,0.75)';
  var rimColor = isHoney ? '#f5c842' : '#44dd88';
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.43, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.43, 0, Math.PI * 2);
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = isOpen ? px * 0.08 : px * 0.05;
  if (!isOpen) { ctx.setLineDash([px * 0.08, px * 0.06]); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold ' + Math.round(px * 0.30) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rimColor;
  ctx.fillText(isHoney ? 'H' : 'N', cx, cy - px * 0.06);
  ctx.font = 'bold ' + Math.round(px * 0.14) + 'px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('+' + amount, cx, cy + px * 0.17);
  ctx.font = Math.round(px * 0.09) + 'px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(isHoney ? 'HONEY' : 'NECTAR', cx, cy + px * 0.32);
}

export function drawObstacleLabel(ctx, px, row) {
  ctx.clearRect(0, 0, px, px);
  var cx = px / 2;
  var cy = px / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,6,0,0.55)';
  ctx.fill();
  ctx.font = 'bold ' + Math.round(px * 0.38) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c8870a';
  ctx.fillText(String(row), cx, cy + px * 0.02);
  ctx.font = Math.round(px * 0.11) + 'px monospace';
  ctx.fillStyle = 'rgba(200,135,10,0.7)';
  ctx.fillText('ROW ' + row, cx, cy + px * 0.30);
}

export function drawDormantLabel(ctx, px, nectarRequired, storedNectar, isSeatable) {
  ctx.clearRect(0, 0, px, px);
  var cx = px / 2;
  var cy = px / 2;
  var prog = nectarRequired > 0 ? Math.min(1.0, storedNectar / nectarRequired) : 1.0;
  var canActivate = (storedNectar >= nectarRequired);
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = canActivate ? 'rgba(18,26,10,0.68)' : 'rgba(20,16,6,0.60)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.35, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
  ctx.strokeStyle = canActivate ? 'rgba(100,255,160,0.95)' : 'rgba(245,200,66,0.72)';
  ctx.lineWidth = px * 0.07;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = canActivate ? 'rgba(100,255,160,0.82)' : 'rgba(245,200,66,0.75)';
  ctx.lineWidth = px * 0.04;
  ctx.setLineDash([px * 0.06, px * 0.05]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold ' + Math.round(px * 0.17) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = canActivate ? '#88ffb0' : '#f5c842';
  ctx.fillText(canActivate ? 'READY' : (isSeatable ? 'SEAT' : 'FEED'), cx, cy - px * 0.10);
  ctx.font = 'bold ' + Math.round(px * 0.13) + 'px monospace';
  ctx.fillText(canActivate ? 'HONEY' : (isSeatable ? 'LIVE' : 'BUILD'), cx, cy + px * 0.04);
  if (nectarRequired > 0) {
    ctx.font = Math.round(px * 0.09) + 'px monospace';
    ctx.fillStyle = canActivate ? 'rgba(136,255,176,0.78)' : 'rgba(245,200,66,0.70)';
    ctx.fillText(Math.floor(storedNectar) + '/' + nectarRequired + ' nectar', cx, cy + px * 0.22);
  }
}

export function drawTimerLabel(ctx, px, progress, secondsLeft) {
  ctx.clearRect(0, 0, px, px);
  var cx = px / 2;
  var cy = px / 2;
  var r = px * 0.40;
  ctx.beginPath();
  ctx.arc(cx, cy, r + px * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,6,0,0.65)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
  ctx.strokeStyle = 'rgba(200,135,10,0.25)';
  ctx.lineWidth = px * 0.07;
  ctx.lineCap = 'round';
  ctx.stroke();
  var remaining = 1.0 - progress;
  if (remaining > 0.001) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
    ctx.strokeStyle = '#f5c842';
    ctx.lineWidth = px * 0.075;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  var mins = Math.floor(secondsLeft / 60);
  var secs = Math.floor(secondsLeft % 60);
  ctx.font = 'bold ' + Math.round(px * 0.18) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5c842';
  ctx.fillText(mins > 0 ? mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's' : secs + 's', cx, cy - px * 0.04);
  ctx.font = Math.round(px * 0.10) + 'px monospace';
  ctx.fillStyle = 'rgba(245,200,66,0.65)';
  ctx.fillText('clear', cx, cy + px * 0.15);
}

export function drawBeeLabel(ctx, px, level, role, hasCargo, statusType) {
  ctx.clearRect(0, 0, px, px);
  var cx = px / 2;
  var cy = px / 2;
  var roleIsWorker = (role === BEE_ROLE.WORKER);
  var roleColor = roleIsWorker ? '#f5c842' : '#7be9ff';
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.40, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,4,0,0.78)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.40, 0, Math.PI * 2);
  ctx.strokeStyle = roleColor;
  ctx.lineWidth = px * 0.07;
  ctx.stroke();
  ctx.font = 'bold ' + Math.round(px * 0.12) + 'px monospace';
  ctx.fillStyle = roleColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(roleIsWorker ? 'W' : 'G', cx, cy - px * 0.24);
  ctx.font = 'bold ' + Math.round(px * 0.40) + 'px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#f5c842';
  ctx.shadowBlur = px * 0.12;
  ctx.fillText(String(level), cx, cy + px * 0.04);
  ctx.shadowBlur = 0;
  if (hasCargo) {
    ctx.beginPath();
    ctx.arc(cx - px * 0.18, cy + px * 0.22, px * 0.055, 0, Math.PI * 2);
    ctx.fillStyle = '#44dd88';
    ctx.fill();
  }
  if (statusType) {
    ctx.beginPath();
    ctx.arc(cx + px * 0.18, cy + px * 0.22, px * 0.055, 0, Math.PI * 2);
    ctx.fillStyle = statusType === 'jelly' ? '#7be9ff' : '#ffbf55';
    ctx.fill();
  }
}

export function drawOpenCellLabel(ctx, px, nectarStored, nectarCapacity, honeyStored, productionRate, isReady) {
  ctx.clearRect(0, 0, px, px);
  if (nectarStored <= 0 && honeyStored <= 0) { return; }
  var cx = px / 2;
  var cy = px / 2;
  if (isReady) {
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,7,0,0.72)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.40, 0, Math.PI * 2);
    ctx.strokeStyle = '#f5c842';
    ctx.lineWidth = px * 0.08;
    ctx.stroke();
    ctx.font = 'bold ' + Math.round(px * 0.28) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5c842';
    ctx.fillText(Math.floor(honeyStored), cx, cy - px * 0.06);
    ctx.font = Math.round(px * 0.12) + 'px monospace';
    ctx.fillStyle = 'rgba(245,200,66,0.8)';
    ctx.fillText('HONEY', cx, cy + px * 0.18);
    ctx.font = Math.round(px * 0.10) + 'px monospace';
    ctx.fillStyle = 'rgba(245,200,66,0.55)';
    ctx.fillText('tap to collect', cx, cy + px * 0.32);
  } else if (nectarStored > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,7,0,0.65)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.34, -Math.PI / 2, Math.PI * 1.5);
    ctx.strokeStyle = 'rgba(180,100,0,0.22)';
    ctx.lineWidth = px * 0.07;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, px * 0.34, -Math.PI / 2, -Math.PI / 2 + Math.min(1.0, nectarStored / Math.max(1, nectarCapacity)) * Math.PI * 2);
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = px * 0.07;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.font = 'bold ' + Math.round(px * 0.20) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d4a017';
    ctx.fillText(Math.ceil(nectarStored), cx, cy - px * 0.04);
    ctx.font = Math.round(px * 0.09) + 'px monospace';
    ctx.fillStyle = 'rgba(212,160,23,0.65)';
    ctx.fillText('conv ' + productionRate.toFixed(2) + '/s', cx, cy + px * 0.16);
  }
}

export function drawBuildingLabel(ctx, px, cell) {
  ctx.clearRect(0, 0, px, px);
  var cx = px / 2;
  var cy = px / 2;
  var isHatchery = (cell.cellType === CELL_TYPE.HATCHERY);
  var isProcessor = (cell.cellType === CELL_TYPE.PROCESSOR);
  var bgColor = isHatchery ? 'rgba(10,20,60,0.80)' : isProcessor ? 'rgba(5,40,20,0.80)' : 'rgba(10,15,30,0.80)';
  var rimColor = isHatchery ? '#4488ff' : isProcessor ? '#44ffaa' : '#6688bb';
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, px * 0.44, 0, Math.PI * 2);
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = px * 0.055;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!cell.buildingConstructed) {
    ctx.font = 'bold ' + Math.round(px * 0.13) + 'px monospace';
    ctx.fillStyle = rimColor;
    ctx.fillText(isHatchery ? 'HATCHERY' : isProcessor ? 'BOOSTER' : 'BUILD LOT', cx, cy - px * 0.14);
    ctx.font = Math.round(px * 0.11) + 'px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('TAP TO BUILD', cx, cy + px * 0.03);
    ctx.font = 'bold ' + Math.round(px * 0.13) + 'px monospace';
    ctx.fillStyle = '#f5c842';
    ctx.fillText((cell.cellType === CELL_TYPE.BUILDING_LOT ? CONFIG.BUILDING_LOT_CLAIM_COST : (isHatchery ? CONFIG.HATCHERY_BUILD_COST : CONFIG.PROCESSOR_BUILD_COST)[1]) + ' honey', cx, cy + px * 0.20);
  } else {
    var lvl = cell.buildingLevel;
    var maxLevel = isHatchery ? CONFIG.HATCHERY_MAX_LEVEL : CONFIG.PROCESSOR_MAX_LEVEL;
    ctx.font = 'bold ' + Math.round(px * 0.14) + 'px monospace';
    ctx.fillStyle = rimColor;
    if (cell.cellType === CELL_TYPE.BUILDING_LOT) {
      ctx.fillText('POT Lv.' + lvl, cx, cy - px * 0.16);
      ctx.font = Math.round(px * 0.11) + 'px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.fillText('exit +' + CONFIG.BUILDING_LOT_EXIT_BONUS, cx, cy + px * 0.02);
      ctx.fillText('stage bonus', cx, cy + px * 0.18);
    } else if (isHatchery) {
      ctx.fillText('HATCH Lv.' + lvl, cx, cy - px * 0.16);
      ctx.font = Math.round(px * 0.10) + 'px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.60)';
      ctx.fillText('+' + getHatcheryNectarYield(lvl) + ' nectar / ' + getHatcheryNectarInterval(lvl) + 's', cx, cy + px * 0.00);
      ctx.fillText('bank ' + Math.floor(cell.buildingStoredNectar || 0), cx, cy + px * 0.15);
      if (lvl < maxLevel) {
        ctx.font = 'bold ' + Math.round(px * 0.11) + 'px monospace';
        ctx.fillStyle = '#f5c842';
        ctx.fillText(CONFIG.HATCHERY_BUILD_COST[lvl + 1] + ' honey', cx, cy + px * 0.31);
      } else {
        ctx.font = Math.round(px * 0.12) + 'px monospace';
        ctx.fillStyle = rimColor;
        ctx.fillText('MAX', cx, cy + px * 0.31);
      }
    } else {
      ctx.fillText('BOOST Lv.' + lvl, cx, cy - px * 0.16);
      if (lvl < maxLevel) {
        ctx.font = Math.round(px * 0.11) + 'px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('TAP UPGRADE', cx, cy + px * 0.01);
        ctx.font = 'bold ' + Math.round(px * 0.12) + 'px monospace';
        ctx.fillStyle = '#f5c842';
        ctx.fillText(CONFIG.PROCESSOR_BUILD_COST[lvl + 1] + ' honey', cx, cy + px * 0.18);
      } else {
        ctx.font = Math.round(px * 0.12) + 'px monospace';
        ctx.fillStyle = rimColor;
        ctx.fillText('MAX', cx, cy + px * 0.08);
      }
    }
  }
}

export function makeLabelPlane(worldSize, px) {
  var canvasPx = px || LABEL.CELL_SIZE;
  var canvas = makeCanvas(canvasPx);
  var ctx = canvas.getContext('2d');
  var tex = new THREE.CanvasTexture(canvas);
  var mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldSize, worldSize), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  return { mesh: mesh, canvas: canvas, tex: tex, ctx: ctx, px: canvasPx };
}

export function initCellLabels() {
  var outward = HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + 0.05;
  for (var i = 0; i < stateRef.cells.length; i++) {
    var cell = stateRef.cells[i];
    if (cell.cellType === CELL_TYPE.GATE) {
      var glbl = makeLabelPlane(LABEL.CELL_WORLD, LABEL.CELL_SIZE);
      glbl.lastGateReady = false;
      glbl.lastLevelComplete = false;
      glbl.lastBonusHoney = -1;
      glbl.lastBonusExtra = -1;
      glbl.lastGateState = '';
      glbl.lastGateProgress = -1;
      glbl.mesh.position.set(Math.cos(cell.theta) * outward, cell.worldPos.y, Math.sin(cell.theta) * outward);
      glbl.mesh.rotation.y = Math.PI / 2 - cell.theta;
      drawGateLabel(glbl.ctx, LABEL.CELL_SIZE, false, false, getStageExitBonus(), cell, evaluateGateConditions());
      glbl.tex.needsUpdate = true;
      sceneRef.add(glbl.mesh);
      gateLabelMap[cell.id] = glbl;
      continue;
    }
    if (cell.cellType === CELL_TYPE.REWARD_BLOCKER && (cell.state === CELL_STATE.LOCKED || cell.state === CELL_STATE.OBSTACLE)) {
      var lbl1 = makeLabelPlane(LABEL.CELL_WORLD, LABEL.CELL_SIZE);
      lbl1.lastProgress = -1;
      lbl1.lastRewardState = '';
      lbl1.mesh.position.set(Math.cos(cell.theta) * outward, cell.worldPos.y, Math.sin(cell.theta) * outward);
      lbl1.mesh.rotation.y = Math.PI / 2 - cell.theta;
      drawRewardBlockerLabel(lbl1.ctx, LABEL.CELL_SIZE, cell.rewardType, cell.rewardAmount, false, false);
      lbl1.tex.needsUpdate = true;
      sceneRef.add(lbl1.mesh);
      cellLabelMap[cell.id] = lbl1;
      continue;
    }
    if (cell.state === CELL_STATE.OBSTACLE) {
      var lbl2 = makeLabelPlane(LABEL.CELL_WORLD, LABEL.CELL_SIZE);
      lbl2.lastProgress = -1;
      lbl2.mesh.position.set(Math.cos(cell.theta) * outward, cell.worldPos.y, Math.sin(cell.theta) * outward);
      lbl2.mesh.rotation.y = Math.PI / 2 - cell.theta;
      drawObstacleLabel(lbl2.ctx, LABEL.CELL_SIZE, cell.row);
      lbl2.tex.needsUpdate = true;
      sceneRef.add(lbl2.mesh);
      cellLabelMap[cell.id] = lbl2;
    }
    if (cell.state === CELL_STATE.DORMANT) {
      var dlbl = makeLabelPlane(LABEL.CELL_WORLD, LABEL.CELL_SIZE);
      dlbl.lastActivationState = '';
      dlbl.mesh.position.set(Math.cos(cell.theta) * outward, cell.worldPos.y, Math.sin(cell.theta) * outward);
      dlbl.mesh.rotation.y = Math.PI / 2 - cell.theta;
      drawDormantLabel(dlbl.ctx, LABEL.CELL_SIZE, cell.nectarRequired, cell.nectarStored, isWorkerSeatCell(cell));
      dlbl.tex.needsUpdate = true;
      sceneRef.add(dlbl.mesh);
      cellLabelMap[cell.id] = dlbl;
    }
    if (cell.state === CELL_STATE.ACTIVE) {
      var olbl = makeLabelPlane(LABEL.CELL_WORLD, LABEL.CELL_SIZE);
      olbl.lastNectar = -1;
      olbl.lastHoney = -1;
      olbl.lastReady = false;
      olbl.mesh.position.set(Math.cos(cell.theta) * outward, cell.worldPos.y, Math.sin(cell.theta) * outward);
      olbl.mesh.rotation.y = Math.PI / 2 - cell.theta;
      olbl.mesh.visible = false;
      sceneRef.add(olbl.mesh);
      openCellLabelMap[cell.id] = olbl;
    }
  }
}

export function addBeeLabelFor(bee) {
  if (!bee || !bee.mesh) { return; }
  var lbl = makeLabelPlane(LABEL.BEE_WORLD, LABEL.BEE_SIZE);
  lbl.mesh.position.set(0, beeConfigRef.BODY_R * 1.6, 0);
  lbl.mesh.userData.isLabel = true;
  bee.mesh.add(lbl.mesh);
  lbl.lastLevel = bee.level;
  lbl.lastRole = bee.role;
  lbl.lastCargo = !!bee.carryNectar;
  lbl.lastStatus = bee.royalJellyTimer > 0 ? 'jelly' : (bee.mergeSurgeTimer > 0 ? 'surge' : '');
  drawBeeLabel(lbl.ctx, LABEL.BEE_SIZE, bee.level, bee.role, !!bee.carryNectar, lbl.lastStatus);
  lbl.tex.needsUpdate = true;
  beeLabelMap[bee.id] = lbl;
}

export function removeBeeLabelFor(bee) {
  var lbl = beeLabelMap[bee.id];
  if (!lbl) { return; }
  lbl.tex.dispose();
  lbl.canvas = null;
  bee.mesh.remove(lbl.mesh);
  delete beeLabelMap[bee.id];
}

export function ensureActiveCellLabel(cell) {
  if (openCellLabelMap[cell.id]) { return; }
  var lOut = HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + 0.05;
  var nLbl = makeLabelPlane(LABEL.CELL_WORLD, LABEL.CELL_SIZE);
  nLbl.lastNectar = -1;
  nLbl.lastHoney = -1;
  nLbl.lastReady = false;
  nLbl.mesh.position.set(Math.cos(cell.theta) * lOut, cell.worldPos.y, Math.sin(cell.theta) * lOut);
  nLbl.mesh.rotation.y = Math.PI / 2 - cell.theta;
  nLbl.mesh.visible = false;
  sceneRef.add(nLbl.mesh);
  openCellLabelMap[cell.id] = nLbl;
}

export function ensureObstacleCellLabel(cell) {
  if (!cell || cellLabelMap[cell.id] || cell.state !== CELL_STATE.OBSTACLE || cell.cellType === CELL_TYPE.GATE) { return; }
  var rOut = HIVE.CYLINDER_RADIUS + HIVE.HEX_DEPTH + 0.05;
  var lbl = makeLabelPlane(LABEL.CELL_WORLD, LABEL.CELL_SIZE);
  lbl.lastProgress = -1;
  lbl.lastRewardState = '';
  lbl.lastActivationState = '';
  lbl.mesh.position.set(Math.cos(cell.theta) * rOut, cell.worldPos.y, Math.sin(cell.theta) * rOut);
  lbl.mesh.rotation.y = Math.PI / 2 - cell.theta;
  if (cell.cellType === CELL_TYPE.REWARD_BLOCKER) {
    drawRewardBlockerLabel(lbl.ctx, LABEL.CELL_SIZE, cell.rewardType, cell.rewardAmount, false, false);
  } else {
    drawObstacleLabel(lbl.ctx, LABEL.CELL_SIZE, cell.row);
  }
  lbl.tex.needsUpdate = true;
  sceneRef.add(lbl.mesh);
  cellLabelMap[cell.id] = lbl;
}

export function updateLabels(dt) {
  for (var i = 0; i < stateRef.cells.length; i++) {
    var cell = stateRef.cells[i];
    var lbl = cellLabelMap[cell.id];
    var olbl = openCellLabelMap[cell.id];
    if (lbl) {
      var isRewardCell = (cell.cellType === CELL_TYPE.REWARD_BLOCKER);
      var labelVisible = (cell.state === CELL_STATE.OBSTACLE) || (cell.state === CELL_STATE.DORMANT) || (isRewardCell && cell.state === CELL_STATE.LOCKED && !cell.rewardCollected);
      lbl.mesh.visible = labelVisible;
      if (labelVisible) {
        if (cell.state === CELL_STATE.DORMANT) {
          var ask = cell.state + ':' + cell.nectarRequired + ':' + Math.floor(cell.nectarStored);
          if (lbl.lastActivationState !== ask) {
            drawDormantLabel(lbl.ctx, LABEL.CELL_SIZE, cell.nectarRequired, cell.nectarStored, isWorkerSeatCell(cell));
            lbl.tex.needsUpdate = true;
            lbl.lastActivationState = ask;
          }
        } else if (isRewardCell) {
          if (cell.state === CELL_STATE.OBSTACLE && cell.activationRequired > 0 && (hasCellOccupants(cell) || cell.activationProgress > 0.001)) {
            var rprog = cell.activationProgress / cell.activationRequired;
            var rsecs = Math.max(0, cell.activationRequired - cell.activationProgress);
            if (Math.abs(rprog - lbl.lastProgress) > 0.004) {
              drawTimerLabel(lbl.ctx, LABEL.CELL_SIZE, rprog, rsecs);
              lbl.tex.needsUpdate = true;
              lbl.lastProgress = rprog;
            }
          } else {
            var rsk = cell.state + (cell.rewardCollected ? '1' : '0');
            if (rsk !== lbl.lastRewardState) {
              drawRewardBlockerLabel(lbl.ctx, LABEL.CELL_SIZE, cell.rewardType, cell.rewardAmount, cell.state === CELL_STATE.ACTIVE, cell.rewardCollected);
              lbl.tex.needsUpdate = true;
              lbl.lastRewardState = rsk;
            }
          }
        } else {
          if (cell.activationRequired > 0 && (hasCellOccupants(cell) || cell.activationProgress > 0.001)) {
            var prog = cell.activationProgress / cell.activationRequired;
            var secs = Math.max(0, cell.activationRequired - cell.activationProgress);
            if (Math.abs(prog - lbl.lastProgress) > 0.004) {
              drawTimerLabel(lbl.ctx, LABEL.CELL_SIZE, prog, secs);
              lbl.tex.needsUpdate = true;
              lbl.lastProgress = prog;
            }
          } else {
            if (lbl.lastProgress !== -99) {
              drawObstacleLabel(lbl.ctx, LABEL.CELL_SIZE, cell.row);
              lbl.tex.needsUpdate = true;
              lbl.lastProgress = -99;
            }
          }
        }
      }
    }
    if (olbl) {
      if (cell.state !== CELL_STATE.ACTIVE) {
        olbl.mesh.visible = false;
      } else {
        var isBuildingCell = (cell.cellType === CELL_TYPE.HATCHERY || cell.cellType === CELL_TYPE.PROCESSOR || cell.cellType === CELL_TYPE.BUILDING_LOT);
        if (isBuildingCell) {
          olbl.mesh.visible = true;
          var buildingBuffer = Math.floor(cell.buildingStoredNectar || 0);
          var buildingTick = cell.cellType === CELL_TYPE.HATCHERY ? Math.ceil(Math.max(0, cell.buildingCooldown || 0) * 10) : 0;
          if (cell.buildingLevel !== olbl.lastHoney || cell.buildingConstructed !== olbl.lastReady || olbl.lastNectar !== buildingBuffer || (olbl.lastRate || 0) !== buildingTick) {
            drawBuildingLabel(olbl.ctx, LABEL.CELL_SIZE, cell);
            olbl.tex.needsUpdate = true;
            olbl.lastNectar = buildingBuffer;
            olbl.lastHoney = cell.buildingLevel;
            olbl.lastReady = cell.buildingConstructed;
            olbl.lastRate = buildingTick;
          }
        } else {
          var hasActivity = (cell.nectarStored > 0 || cell.honeyStored > 0);
          olbl.mesh.visible = hasActivity;
          if (hasActivity && (Math.abs(cell.nectarStored - olbl.lastNectar) > 0.2 || Math.abs(cell.honeyStored - olbl.lastHoney) > 0.05 || cell.isReadyToCollect !== olbl.lastReady || Math.abs(cell.productionRate - (olbl.lastRate || -1)) > 0.01)) {
            drawOpenCellLabel(olbl.ctx, LABEL.CELL_SIZE, cell.nectarStored, cell.nectarCapacity, cell.honeyStored, cell.productionRate, cell.isReadyToCollect);
            olbl.tex.needsUpdate = true;
            olbl.lastNectar = cell.nectarStored;
            olbl.lastHoney = cell.honeyStored;
            olbl.lastReady = cell.isReadyToCollect;
            olbl.lastRate = cell.productionRate;
          }
        }
      }
    }
  }
  for (var gid in gateLabelMap) {
    var glbl = gateLabelMap[gid];
    var gateCell = getCellById(gid);
    var gateBonus = getStageExitBonus();
    var gateConds = evaluateGateConditions();
    var gateState = gateCell ? gateCell.state : '';
    var gateProgress = gateCell ? Math.floor(gateCell.activationProgress || 0) : 0;
    if (stateRef.gateReady !== glbl.lastGateReady || stateRef.levelComplete !== glbl.lastLevelComplete ||
        gateBonus.honey !== glbl.lastBonusHoney || gateBonus.extraForFullClear !== glbl.lastBonusExtra ||
        gateState !== glbl.lastGateState || gateProgress !== glbl.lastGateProgress) {
      drawGateLabel(glbl.ctx, LABEL.CELL_SIZE, stateRef.gateReady, stateRef.levelComplete, gateBonus, gateCell, gateConds);
      glbl.tex.needsUpdate = true;
      glbl.lastGateReady = stateRef.gateReady;
      glbl.lastLevelComplete = stateRef.levelComplete;
      glbl.lastBonusHoney = gateBonus.honey;
      glbl.lastBonusExtra = gateBonus.extraForFullClear;
      glbl.lastGateState = gateState;
      glbl.lastGateProgress = gateProgress;
    }
  }
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var beeLabel = beeLabelMap[stateRef.bees[bi].id];
    if (beeLabel) {
      var labelBee = stateRef.bees[bi];
      var labelStatus = labelBee.royalJellyTimer > 0 ? 'jelly' : (labelBee.mergeSurgeTimer > 0 ? 'surge' : '');
      var hasCargo = !!(labelBee.carryNectar > 0.01);
      var flightFade = getBeeFlightFade(labelBee);
      if (beeLabel.lastLevel !== labelBee.level || beeLabel.lastRole !== labelBee.role || beeLabel.lastCargo !== hasCargo || beeLabel.lastStatus !== labelStatus) {
        drawBeeLabel(beeLabel.ctx, LABEL.BEE_SIZE, labelBee.level, labelBee.role, hasCargo, labelStatus);
        beeLabel.tex.needsUpdate = true;
        beeLabel.lastLevel = labelBee.level;
        beeLabel.lastRole = labelBee.role;
        beeLabel.lastCargo = hasCargo;
        beeLabel.lastStatus = labelStatus;
      }
      beeLabel.mesh.visible = labelBee.mesh.visible && flightFade > 0.08;
      if (beeLabel.mesh.material) { beeLabel.mesh.material.opacity = beeLabel.mesh.visible ? flightFade : 0; }
      beeLabel.mesh.rotation.y = -labelBee.mesh.rotation.y + (Math.PI / 2 - getCameraThetaRef());
    }
  }
}
