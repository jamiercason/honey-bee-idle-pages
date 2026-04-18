import { CONFIG } from '../config/config.js';
import { registerRoyalRush } from '../economy/boosts.js';
import { getBeeWorkRateForLevel } from './beeQueries.js';
import { captureMergeAssignment, applyMergeAssignment } from './beeAssignments.js';
import { removeBee, spawnMergedBee } from './beeFactory.js';

var THREE = globalThis.THREE;

var updateMergeTargetHighlightsRef = function() {};
var spawnMergeBurstRef = function() {};
var triggerMergeFxRef = function() {};
var queueBurstCallbackRef = function() {};
var setMergeToastRef = function() {};
var setBuildingToastRef = function() {};
var mergedBodyAnchorWorld = new THREE.Vector3();
var mergedAnchorDelta = new THREE.Vector3();

function getVisibleBeeBodyAnchorPos(bee, out) {
  if (bee && bee.mesh && bee.mesh.userData && bee.mesh.userData.bodyAnchor) {
    bee.mesh.userData.bodyAnchor.getWorldPosition(out);
  } else if (bee && bee.mesh) {
    out.copy(bee.mesh.position);
  } else if (bee) {
    out.copy(bee.pos);
  } else {
    out.set(0, 0, 0);
  }
  return out;
}

function pinBeeToVisibleBodyAnchor(bee, visibleAnchorPos) {
  if (!bee || !bee.mesh || !visibleAnchorPos) { return; }
  getVisibleBeeBodyAnchorPos(bee, mergedBodyAnchorWorld);
  mergedAnchorDelta.copy(visibleAnchorPos).sub(mergedBodyAnchorWorld);
  bee.mesh.position.add(mergedAnchorDelta);
  bee.pos.copy(bee.mesh.position);
  bee.origin.copy(bee.mesh.position);
  bee.targetPos.copy(bee.mesh.position);
  bee.mergeAnchorPos.copy(bee.mesh.position);
}

function resetMergedBeeMotionState(bee, visibleAnchorPos, freezeWithAssignment) {
  if (!bee) { return; }
  bee.travelT = 1.0;
  bee.travelDur = 0.0001;
  bee.targetCellId = null;
  bee.workTargetCellId = freezeWithAssignment ? bee.workTargetCellId : null;
  bee.forcedWorkTarget = null;
  bee.carryNectar = 0;
  bee.exitReverse = 0.0;
  bee.landedTheta = null;
  bee.gatherRouteRadius = 0;
  bee.gatherRouteHeight = 0;
  bee.gatherRouteBump = 1.0;
  bee.gatherRouteSide = 0;
  bee.gatherRouteCurve = 0;
  bee.gatherPhase = freezeWithAssignment ? null : 'released';
  pinBeeToVisibleBodyAnchor(bee, visibleAnchorPos);
  bee.lastFlightPos.copy(bee.pos);
}

export function setBeeMergingRuntime(runtime) {
  updateMergeTargetHighlightsRef = runtime && runtime.updateMergeTargetHighlights ? runtime.updateMergeTargetHighlights : updateMergeTargetHighlightsRef;
  spawnMergeBurstRef = runtime && runtime.spawnMergeBurst ? runtime.spawnMergeBurst : spawnMergeBurstRef;
  triggerMergeFxRef = runtime && runtime.triggerMergeFx ? runtime.triggerMergeFx : triggerMergeFxRef;
  queueBurstCallbackRef = runtime && runtime.queueBurstCallback ? runtime.queueBurstCallback : queueBurstCallbackRef;
  setMergeToastRef = runtime && runtime.setMergeToast ? runtime.setMergeToast : setMergeToastRef;
  setBuildingToastRef = runtime && runtime.setBuildingToast ? runtime.setBuildingToast : setBuildingToastRef;
}

export function mergeBees(beeA, beeB) {
  var newLevel = beeA.level + 1;
  var anchorPos = new THREE.Vector3();
  getVisibleBeeBodyAnchorPos(beeB, anchorPos);
  var mergeAssignment = captureMergeAssignment(beeB);
  registerRoyalRush();
  function flashWhite(bee) {
    bee.mesh.traverse(function(obj) {
      if (obj.isMesh && !obj.material.transparent) {
        obj.material.emissive.setHex(0xffffff);
        obj.material.emissiveIntensity = 4.0;
      }
    });
  }
  flashWhite(beeA);
  flashWhite(beeB);
  setTimeout(function() {
    updateMergeTargetHighlightsRef(null);
    removeBee(beeA);
    removeBee(beeB);
    var newBee = spawnMergedBee(newLevel, anchorPos, {
      pendingAssignment: mergeAssignment
    });
    var mergedWorkRate = getBeeWorkRateForLevel(newLevel);
    if (newBee) {
      resetMergedBeeMotionState(newBee, anchorPos, !!mergeAssignment);
      newBee.mergeSurgeTimer = CONFIG.MERGE_SURGE_DURATION;
      if (mergeAssignment) {
        if (applyMergeAssignment(newBee, mergeAssignment, { anchorWorldPos: newBee.mergeAnchorPos })) {
          newBee.mergePendingAssignment = null;
        }
      }
      newBee.mesh.scale.setScalar(0.1);
      pinBeeToVisibleBodyAnchor(newBee, anchorPos);
      var popT = 0;
      var baseScale = newBee.baseScale || (1.0 + (newLevel - 1) * 0.06);
      function popAnim() {
        popT += 0.12;
        if (popT >= 1.0) {
          newBee.mesh.scale.setScalar(baseScale);
          pinBeeToVisibleBodyAnchor(newBee, anchorPos);
          return;
        }
        newBee.mesh.scale.setScalar(baseScale * (1.0 + Math.sin(popT * Math.PI) * 0.45));
        pinBeeToVisibleBodyAnchor(newBee, anchorPos);
        queueBurstCallbackRef(function() { popAnim(); });
      }
      queueBurstCallbackRef(function() { popAnim(); });
    }
    spawnMergeBurstRef(anchorPos, newLevel);
    triggerMergeFxRef(anchorPos, newLevel);
    setMergeToastRef(newLevel, 2.0);
    setBuildingToastRef('Merged to Lv.' + newLevel + '  work x' + mergedWorkRate.toFixed(2) + '  surge +' + Math.round(CONFIG.MERGE_SURGE_WORK_BONUS * 100) + '%', 2.0);
  }, 80);
}
