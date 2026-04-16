import { PRESENTATION } from '../config/presentationConfig.js';
import { BEE_ROLE, BEE_STATE } from '../data/enums.js';
import { clamp01 } from '../utils/math.js';
import { getBeeEffectiveGatherLoad } from './beeQueries.js';

var beeConfigRef = null;
var beeVisRef = null;
var getSimTimeRef = function() { return 0; };

export function setBeeVisualStateRuntime(runtime) {
  beeConfigRef = runtime && runtime.beeConfig ? runtime.beeConfig : beeConfigRef;
  beeVisRef = runtime && runtime.beeVis ? runtime.beeVis : beeVisRef;
  getSimTimeRef = runtime && runtime.getSimTime ? runtime.getSimTime : getSimTimeRef;
}

export function updateBeeReadabilityVisual(bee) {
  if (!bee || !bee.mesh) { return; }
  var simTime = getSimTimeRef();
  var roleNode = bee.mesh.userData.roleNode;
  var cargoOrb = bee.mesh.userData.cargoOrb;
  var boostHalo = bee.mesh.userData.boostHalo;
  var contactShadow = bee.mesh.userData.contactShadow;
  var bodyHalo = bee.mesh.userData.bodyHalo;
  var rolePulse = 0.78 + Math.abs(Math.sin(simTime * 2.8 + bee.id * 0.35)) * 0.42;
  var isWorker = (bee.role === BEE_ROLE.WORKER);
  var activeBoost = (bee.royalJellyTimer > 0 || bee.mergeSurgeTimer > 0);
  var workingPulse = 0.5 + Math.abs(Math.sin(simTime * 5.4 + bee.id * 0.6)) * 0.5;

  if (!PRESENTATION.BEE_READABILITY_ENABLED) {
    if (roleNode) { roleNode.visible = false; }
    if (cargoOrb) { cargoOrb.visible = false; }
    if (boostHalo) { boostHalo.visible = false; }
    if (contactShadow) { contactShadow.visible = false; }
    if (bodyHalo) { bodyHalo.visible = false; }
    return;
  }

  if (contactShadow && contactShadow.material) {
    contactShadow.visible = true;
    contactShadow.material.opacity = isWorker
      ? 0.24 + (bee.state === BEE_STATE.WORKING ? 0.12 : 0.04)
      : 0.18 + ((bee.carryNectar || 0) > 0 ? 0.08 : 0.0);
    contactShadow.scale.setScalar(isWorker ? 1.02 : 0.92);
    contactShadow.position.y = -beeConfigRef.BODY_R * 0.42;
    contactShadow.position.z = isWorker ? -beeConfigRef.BODY_R * 0.04 : -beeConfigRef.BODY_R * 0.10;
  }

  if (bodyHalo && bodyHalo.material) {
    bodyHalo.visible = true;
    bodyHalo.material.color.setHex(isWorker ? 0xffebaf : 0xdaf7ff);
    bodyHalo.material.opacity =
      (isWorker ? 0.05 : 0.04) +
      (bee.selected ? 0.06 : 0.0) +
      (bee.state === BEE_STATE.WORKING ? workingPulse * 0.05 : 0.0) +
      (activeBoost ? 0.07 : 0.0);
    bodyHalo.scale.setScalar(
      (isWorker ? 1.0 : 0.92) +
      (bee.selected ? 0.08 : 0.0) +
      (activeBoost ? 0.04 : 0.0)
    );
    bodyHalo.position.y = -beeConfigRef.BODY_R * 0.38;
  }

  if (roleNode && roleNode.material) {
    roleNode.visible = true;
    roleNode.material.color.setHex(isWorker ? beeVisRef.ROLE_WORKER_COLOR : beeVisRef.ROLE_GATHERER_COLOR);
    roleNode.material.emissive.setHex(isWorker ? beeVisRef.ROLE_WORKER_EMI : beeVisRef.ROLE_GATHERER_EMI);
    roleNode.material.emissiveIntensity = rolePulse + (bee.state === BEE_STATE.WORKING ? 0.45 : 0.0);
    roleNode.position.y = beeConfigRef.BODY_R * (isWorker ? 0.96 : 0.88) + Math.sin(simTime * 3.2 + bee.id) * 0.025;
    roleNode.scale.setScalar(isWorker ? 1.05 : 0.92);
  }

  if (cargoOrb && cargoOrb.material) {
    var carryFrac = clamp01((bee.carryNectar || 0) / Math.max(1, getBeeEffectiveGatherLoad(bee)));
    cargoOrb.visible = carryFrac > 0.02;
    if (cargoOrb.visible) {
      cargoOrb.scale.setScalar(0.68 + carryFrac * 0.72);
      cargoOrb.material.opacity = 0.42 + carryFrac * 0.45;
      cargoOrb.material.emissiveIntensity = 0.9 + carryFrac * 0.8;
      cargoOrb.position.y = -beeConfigRef.BODY_R * 0.10 + Math.sin(simTime * 5.0 + bee.id * 0.7) * 0.025;
    }
  }

  if (boostHalo && boostHalo.material) {
    var boostColor = null;
    if (bee.royalJellyTimer > 0) {
      boostColor = beeVisRef.BOOST_COLOR;
      boostHalo.material.emissive.setHex(beeVisRef.BOOST_EMI);
    } else if (bee.mergeSurgeTimer > 0) {
      boostColor = beeVisRef.SURGE_COLOR;
      boostHalo.material.emissive.setHex(beeVisRef.SURGE_EMI);
    }
    boostHalo.visible = !!boostColor;
    if (boostHalo.visible) {
      boostHalo.material.color.setHex(boostColor);
      boostHalo.material.opacity = 0.26 + Math.abs(Math.sin(simTime * 6.0 + bee.id * 0.9)) * 0.22;
      boostHalo.material.emissiveIntensity = 1.1 + Math.abs(Math.sin(simTime * 6.0 + bee.id * 0.9)) * 0.9;
      boostHalo.scale.setScalar(1.0 + Math.sin(simTime * 4.8 + bee.id * 0.4) * 0.08);
      boostHalo.position.y = beeConfigRef.BODY_R * 0.02;
    }
  }
}
