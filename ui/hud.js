import { CAMERA_MODE, BEE_ROLE, CELL_STATE, CELL_TYPE } from '../data/enums.js';
import { buildingToast, buildingToastTimer, mergeToastLevel, mergeToastTimer } from './toasts.js';

var stateRef = null;
var beeConfigRef = null;
var getCurrentSpawnCostRef = function() { return 0; };
var getSelectedBeeRef = function() { return null; };
var getRoyalRushStacksRef = function() { return 0; };
var evaluateGateConditionsRef = function() { return { gatesCleared: 0, gatesTotal: 0, structuresReady: 0, structuresTotal: 0 }; };
var getStageExitBonusRef = function() { return { honey: 0, extraForFullClear: 0 }; };
var buildingActionLabelRef = function() { return ''; };
var getBeeEffectiveWorkRateRef = function() { return 0; };
var getBeeEffectiveGatherLoadRef = function() { return 0; };

var hud = document.getElementById('hud');
var vignette = document.getElementById('vignette');
var summonBtn = document.getElementById('summon-btn');
var spawnTimerFill = document.getElementById('spawn-timer-fill');
var boostJellyBtn = document.getElementById('boost-jelly-btn');

export function setHudRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : beeConfigRef;
  getCurrentSpawnCostRef = runtime && runtime.getCurrentSpawnCost ? runtime.getCurrentSpawnCost : getCurrentSpawnCostRef;
  getSelectedBeeRef = runtime && runtime.getSelectedBee ? runtime.getSelectedBee : getSelectedBeeRef;
  getRoyalRushStacksRef = runtime && runtime.getRoyalRushStacks ? runtime.getRoyalRushStacks : getRoyalRushStacksRef;
  evaluateGateConditionsRef = runtime && runtime.evaluateGateConditions ? runtime.evaluateGateConditions : evaluateGateConditionsRef;
  getStageExitBonusRef = runtime && runtime.getStageExitBonus ? runtime.getStageExitBonus : getStageExitBonusRef;
  buildingActionLabelRef = runtime && runtime.buildingActionLabel ? runtime.buildingActionLabel : buildingActionLabelRef;
  getBeeEffectiveWorkRateRef = runtime && runtime.getBeeEffectiveWorkRate ? runtime.getBeeEffectiveWorkRate : getBeeEffectiveWorkRateRef;
  getBeeEffectiveGatherLoadRef = runtime && runtime.getBeeEffectiveGatherLoad ? runtime.getBeeEffectiveGatherLoad : getBeeEffectiveGatherLoadRef;
}

export function updateUI() {
  var tsStr = stateRef.gameTimeScale.toFixed(2) + 'x';
  var atCap = (stateRef.bees.length >= beeConfigRef.MAX_COUNT);
  var currentSpawnCost = getCurrentSpawnCostRef();
  var canAfford = (stateRef.honey >= currentSpawnCost);
  var selectedBee = getSelectedBeeRef();
  var mergeStr = (mergeToastTimer > 0) ? '<span style="color:#ffee44;font-size:13px"> LEVEL UP! Lv.' + mergeToastLevel + '</span>' : '';
  var rushStacks = getRoyalRushStacksRef();
  var rushStr = rushStacks > 0
    ? '<span style="color:#ffdd77">rush x' + rushStacks + ' ' + stateRef.royalRushTimer.toFixed(1) + 's</span><br>'
    : '';

  var dormantFedCells = 0;
  var honeyCells = 0;
  var producingCells = 0;
  var storedNectar = 0;
  var gathererCount = 0;
  var workerCount = 0;
  var boostedBeeCount = 0;
  var hatcheryCount = 0;
  var hatcheryBank = 0;
  for (var hi = 0; hi < stateRef.cells.length; hi++) {
    var hc = stateRef.cells[hi];
    if (hc.isReadyToCollect) { honeyCells++; }
    if (hc.state === CELL_STATE.ACTIVE && hc.cellType === CELL_TYPE.OPEN && hc.nectarStored > 0) { producingCells++; }
    if (hc.state === CELL_STATE.DORMANT && hc.nectarStored > 0) { dormantFedCells++; }
    storedNectar += hc.nectarStored || 0;
    if (hc.state === CELL_STATE.ACTIVE && hc.cellType === CELL_TYPE.HATCHERY && hc.buildingConstructed) {
      hatcheryCount += 1;
      hatcheryBank += hc.buildingStoredNectar || 0;
    }
  }
  for (var hb = 0; hb < stateRef.bees.length; hb++) {
    if (stateRef.bees[hb].role === BEE_ROLE.WORKER) { workerCount++; }
    else { gathererCount++; }
    if (stateRef.bees[hb].royalJellyTimer > 0) { boostedBeeCount++; }
  }

  var buildHint = '';
  for (var bi2 = 0; bi2 < stateRef.cells.length; bi2++) {
    var bc = stateRef.cells[bi2];
    if (bc.state === CELL_STATE.ACTIVE && (bc.cellType === CELL_TYPE.HATCHERY || bc.cellType === CELL_TYPE.PROCESSOR || bc.cellType === CELL_TYPE.BUILDING_LOT)) {
      buildHint = '<span style="color:#88aaff">TAP blue hex: ' + buildingActionLabelRef(bc) + '</span><br>';
      break;
    }
  }

  var toastStr = '';
  if (buildingToastTimer > 0) { toastStr = '<span style="color:#44ffaa;font-size:12px">' + buildingToast + '</span><br>'; }

  if (spawnTimerFill) { spawnTimerFill.style.width = (canAfford ? 100 : 0).toFixed(1) + '%'; }

  if (summonBtn) {
    if (atCap) {
      summonBtn.textContent = 'BEE CAP (' + beeConfigRef.MAX_COUNT + ')';
      summonBtn.className = 'disabled';
    } else if (!canAfford) {
      summonBtn.textContent = '+ BEE  need ' + currentSpawnCost + ' honey';
      summonBtn.className = 'disabled';
    } else {
      summonBtn.textContent = '+ BEE  ' + currentSpawnCost + ' honey';
      summonBtn.className = '';
    }
  }

  var gateStr = '';
  if (stateRef.levelComplete) {
    gateStr = '<span style="color:#ffee44;font-size:13px">LEVEL COMPLETE!</span><br>';
  } else {
    var gc = evaluateGateConditionsRef();
    if (stateRef.gateReady) {
      var exitBonus = getStageExitBonusRef();
      gateStr = '<span style="color:#ff6666;font-size:12px">gate cells: ' + gc.gatesCleared + '/' + gc.gatesTotal + ' cleared  +' + exitBonus.honey + ' finish bonus</span>' +
        (exitBonus.extraForFullClear > 0 ? ' <span style="color:#ffcc88">full clear +' + exitBonus.extraForFullClear + '</span>' : '') +
        '<br>';
    } else {
      gateStr = '<span style="color:#886644">structures: ' + gc.structuresReady + '/' + gc.structuresTotal + ' claimed  gates: ' + gc.gatesCleared + '/' + gc.gatesTotal + ' cleared</span><br>';
    }
  }

  var selectedStr = '--';
  if (selectedBee) {
    selectedStr = 'bee #' + selectedBee.id + '  ' + selectedBee.role + '  Lv.' + selectedBee.level + '  work x' + getBeeEffectiveWorkRateRef(selectedBee).toFixed(2);
    if (selectedBee.role === BEE_ROLE.GATHERER) {
      selectedStr += '  nectar ' + getBeeEffectiveGatherLoadRef(selectedBee) + '/trip';
    }
    if (selectedBee.mergeSurgeTimer > 0) {
      selectedStr += '  surge ' + selectedBee.mergeSurgeTimer.toFixed(1) + 's';
    }
    if (selectedBee.royalJellyTimer > 0) {
      selectedStr += '  jelly ' + selectedBee.royalJellyTimer.toFixed(1) + 's';
    }
  }

  hud.innerHTML = 'honey: <b>' + Math.floor(stateRef.honey) + '</b>  bees: <b>' + stateRef.bees.length + '/' + beeConfigRef.MAX_COUNT + '</b>' +
    (atCap ? '  <span style="color:#ff8844">cap</span>' : '  cost: <b>' + currentSpawnCost + ' honey</b>') + '<br>' + gateStr +
    rushStr +
    'nectar in hive: <b>' + Math.floor(storedNectar) + '</b>  gatherers: <b>' + gathererCount + '</b>  workers: <b>' + workerCount + '</b>  boost: <b>' + boostedBeeCount + '</b>  dormant fed: <b>' + dormantFedCells + '</b>  ready: <b>' + honeyCells + '</b>  proc: <b>' + producingCells + '</b>' +
    (hatcheryCount > 0 ? '  hatch: <b>' + hatcheryCount + '</b>  bank: <b>' + Math.floor(hatcheryBank) + '</b>' : '') +
    (honeyCells > 0 ? '  <span style="color:#f5c842">TAP honey</span>' : '') + '<br>' +
    buildHint + toastStr + 'sel: <b>' + selectedStr + '</b>  ' + tsStr + mergeStr;

  if (boostJellyBtn) {
    var jellyCount = stateRef.boosts ? stateRef.boosts.royal_jelly : 0;
    boostJellyBtn.textContent = 'JELLY x' + jellyCount;
    boostJellyBtn.classList.toggle('disabled', jellyCount <= 0);
    boostJellyBtn.classList.toggle('ready', jellyCount > 0);
  }

  vignette.style.opacity = (stateRef.cameraMode === CAMERA_MODE.POST_DRAG_SLOWMO) ? '1' : '0';
}
