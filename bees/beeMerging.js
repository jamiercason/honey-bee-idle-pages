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
  if (beeB && beeB.mesh && beeB.mesh.userData && beeB.mesh.userData.bodyAnchor) {
    beeB.mesh.userData.bodyAnchor.getWorldPosition(anchorPos);
  } else {
    anchorPos.copy(beeB.pos);
  }
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
      newBee.mergeSurgeTimer = CONFIG.MERGE_SURGE_DURATION;
      if (mergeAssignment) {
        if (applyMergeAssignment(newBee, mergeAssignment, { anchorWorldPos: anchorPos })) {
          newBee.mergePendingAssignment = null;
        }
      } else {
        newBee.mergeAnchorPos.copy(anchorPos);
      }
      newBee.mesh.scale.setScalar(0.1);
      var popT = 0;
      var baseScale = newBee.baseScale || (1.0 + (newLevel - 1) * 0.06);
      function popAnim() {
        popT += 0.12;
        if (popT >= 1.0) {
          newBee.mesh.scale.setScalar(baseScale);
          return;
        }
        newBee.mesh.scale.setScalar(baseScale * (1.0 + Math.sin(popT * Math.PI) * 0.45));
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
