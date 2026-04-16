import {
  CELL_SNAP_RADIUS_PX,
  EDGE_PENALTY_ZONE_FRAC,
  FRESH_PICKUP_RADIUS_PX,
  MERGE_SNAP_RADIUS_PX,
  MIN_BEE_PICKUP_SCORE,
  WORKER_SNAP_RADIUS_PX
} from '../config/inputConfig.js';
import { cellHasAssignableSeat, isWorkerSeatCell } from '../board/cellState.js';
import { getCellWorldPos } from '../bees/beePose.js';
import { beeCanWorkTargetCell } from '../bees/beeAssignments.js';
import { cellHoverPos, getBeeFlightFade } from '../bees/beeMovement.js';
import {
  getBeeInteractionWorldPos,
  getDirectCellHit,
  getFrontmostBeeColliderHit,
  getProjectedDistancePx,
  getScreenRay,
  getTrunkOccluderHit,
  intersectBeeInteractionColliders,
  projectWorldToScreen
} from './raycast.js';

var THREE = globalThis.THREE;

var stateRef = null;
var candidateWorldPos = new THREE.Vector3();
var SEAT_SNAP_RADIUS_PX = Math.min(CELL_SNAP_RADIUS_PX, 56);

export function setTargetingRuntime(runtime) {
  stateRef = runtime && runtime.state ? runtime.state : stateRef;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getScreenEdgePenalty(screenX, screenY) {
  var edgeX = Math.min(screenX, window.innerWidth - screenX) / Math.max(1, window.innerWidth);
  var edgeY = Math.min(screenY, window.innerHeight - screenY) / Math.max(1, window.innerHeight);
  var edgeFrac = Math.min(edgeX, edgeY);
  var normalized = 1.0 - clamp01(edgeFrac / Math.max(0.001, EDGE_PENALTY_ZONE_FRAC));
  return normalized * normalized;
}

function getCellInteractionAnchor(cell, bee) {
  if (cell.state === 'obstacle' && bee && bee.isWorker) {
    return getCellWorldPos(cell);
  }
  if (isWorkerSeatCell(cell)) { return cellHoverPos(cell); }
  return getCellWorldPos(cell);
}

function isCellGameplayValid(bee, cell) {
  if (!bee || !cell) { return false; }
  if (cell.state === 'locked') { return false; }
  if (isWorkerSeatCell(cell)) { return cellHasAssignableSeat(cell); }
  return cell.state === 'obstacle' && beeCanWorkTargetCell(bee, cell);
}

export function isBeeBlockedByTrunk(beeHit, screenX, screenY) {
  if (!beeHit) { return false; }
  var trunkHit = getTrunkOccluderHit(screenX, screenY);
  return !!(trunkHit && trunkHit.distance + 0.0001 < beeHit.distance);
}

export function isCellBlockedByTrunk(cell, screenX, screenY, directHit) {
  if (!cell) { return false; }
  var trunkHit = getTrunkOccluderHit(screenX, screenY);
  if (!trunkHit) { return false; }
  var anchorPos = directHit && directHit.point ? directHit.point : getCellInteractionAnchor(cell, null);
  var distance = directHit && directHit.distance !== undefined
    ? directHit.distance
    : getScreenRay(screenX, screenY).origin.distanceTo(anchorPos);
  return trunkHit.distance + 0.0001 < distance;
}

export function scoreFreshBeeCandidate(beeHit, screenX, screenY, frontmostBeeId) {
  if (!beeHit || !beeHit.bee) { return null; }
  if (isBeeBlockedByTrunk(beeHit, screenX, screenY)) { return null; }

  var centerDistPx = getProjectedDistancePx(screenX, screenY, beeHit.center);
  if (!isFinite(centerDistPx) || centerDistPx > FRESH_PICKUP_RADIUS_PX * 1.2) { return null; }

  var proximity = clamp01(1.0 - (centerDistPx / Math.max(1, FRESH_PICKUP_RADIUS_PX)));
  var fade = clamp01(getBeeFlightFade(beeHit.bee));
  var edgePenalty = getScreenEdgePenalty(screenX, screenY);
  var stateBias = beeHit.bee.isWorker ? 0.06 : 0.0;
  var frontBonus = (frontmostBeeId === beeHit.bee.id) ? 0.08 : 0.0;
  var score = 0.62 + proximity * 0.28 + fade * 0.10 + stateBias + frontBonus - edgePenalty * 0.14;

  return {
    bee: beeHit.bee,
    hit: beeHit,
    distancePx: centerDistPx,
    score: clamp01(score)
  };
}

export function pickFreshBeeCandidate(screenX, screenY, excludeBeeId) {
  if (!stateRef || !stateRef.bees) { return null; }
  var hits = intersectBeeInteractionColliders(screenX, screenY, excludeBeeId);
  if (!hits.length) { return null; }
  var frontmostBeeId = hits[0].bee.id;
  var best = null;
  for (var hi = 0; hi < hits.length; hi++) {
    var scored = scoreFreshBeeCandidate(hits[hi], screenX, screenY, frontmostBeeId);
    if (!scored || scored.score < MIN_BEE_PICKUP_SCORE) { continue; }
    if (!best || scored.score > best.score ||
        (Math.abs(scored.score - best.score) < 0.0001 && hits[hi].distance < best.hit.distance) ||
        (Math.abs(scored.score - best.score) < 0.0001 && Math.abs(hits[hi].distance - best.hit.distance) < 0.0001 && scored.bee.id < best.bee.id)) {
      best = scored;
    }
  }
  return best;
}

export function scoreMergeTarget(draggedBee, candidateBee, screenX, screenY, directHitBeeId) {
  if (!draggedBee || !candidateBee || candidateBee.id === draggedBee.id) { return null; }
  if (candidateBee.level !== draggedBee.level) { return null; }
  getBeeInteractionWorldPos(candidateBee, candidateWorldPos);
  var distancePx = getProjectedDistancePx(screenX, screenY, candidateWorldPos);
  if (!isFinite(distancePx) || distancePx > MERGE_SNAP_RADIUS_PX) { return null; }
  var centerHit = {
    bee: candidateBee,
    center: candidateWorldPos,
    distance: getScreenRay(screenX, screenY).origin.distanceTo(candidateWorldPos)
  };
  if (isBeeBlockedByTrunk(centerHit, screenX, screenY)) { return null; }
  var proximity = clamp01(1.0 - (distancePx / Math.max(1, MERGE_SNAP_RADIUS_PX)));
  var directBonus = directHitBeeId === candidateBee.id ? 0.28 : 0.0;
  return {
    kind: 'merge',
    bee: candidateBee,
    distancePx: distancePx,
    score: proximity + directBonus
  };
}

export function scoreCellTarget(bee, cell, screenX, screenY, directCellId) {
  if (!isCellGameplayValid(bee, cell)) { return null; }
  var snapRadius = isWorkerSeatCell(cell)
    ? SEAT_SNAP_RADIUS_PX
    : (bee && bee.isWorker ? WORKER_SNAP_RADIUS_PX : CELL_SNAP_RADIUS_PX);
  var anchor = getCellInteractionAnchor(cell, bee);
  var distancePx = getProjectedDistancePx(screenX, screenY, anchor);
  if (!isFinite(distancePx) || distancePx > snapRadius) { return null; }
  if (isCellBlockedByTrunk(cell, screenX, screenY, null)) { return null; }
  var proximity = clamp01(1.0 - (distancePx / Math.max(1, snapRadius)));
  var directBonus = directCellId === cell.id ? 0.20 : 0.0;
  var workerBias = bee && bee.isWorker && cell.state === 'obstacle' ? 0.10 : 0.0;
  return {
    kind: 'cell',
    cell: cell,
    distancePx: distancePx,
    score: proximity + directBonus + workerBias
  };
}

function pickBestMergeTarget(draggedBee, screenX, screenY) {
  if (!stateRef || !stateRef.bees) { return null; }
  var directHit = getFrontmostBeeColliderHit(screenX, screenY, draggedBee ? draggedBee.id : null);
  var directHitBeeId = directHit ? directHit.bee.id : null;
  var best = null;
  for (var bi = 0; bi < stateRef.bees.length; bi++) {
    var candidateBee = stateRef.bees[bi];
    var scored = scoreMergeTarget(draggedBee, candidateBee, screenX, screenY, directHitBeeId);
    if (!scored) { continue; }
    if (!best || scored.score > best.score ||
        (Math.abs(scored.score - best.score) < 0.0001 && scored.distancePx < best.distancePx) ||
        (Math.abs(scored.score - best.score) < 0.0001 && Math.abs(scored.distancePx - best.distancePx) < 0.0001 && scored.bee.id < best.bee.id)) {
      best = scored;
    }
  }
  return best;
}

function pickBestCellTarget(bee, screenX, screenY, directCellId) {
  if (!stateRef || !stateRef.cells) { return null; }
  var best = null;
  for (var ci = 0; ci < stateRef.cells.length; ci++) {
    var cell = stateRef.cells[ci];
    var scored = scoreCellTarget(bee, cell, screenX, screenY, directCellId);
    if (!scored) { continue; }
    if (!best || scored.score > best.score ||
        (Math.abs(scored.score - best.score) < 0.0001 && scored.distancePx < best.distancePx) ||
        (Math.abs(scored.score - best.score) < 0.0001 && Math.abs(scored.distancePx - best.distancePx) < 0.0001 && scored.cell.id < best.cell.id)) {
      best = scored;
    }
  }
  return best;
}

function getValidDirectFallbackCell(bee, screenX, screenY) {
  var directHit = getDirectCellHit(screenX, screenY);
  if (!directHit || !directHit.cell) { return null; }
  if (!isCellGameplayValid(bee, directHit.cell)) { return null; }
  // Direct geometry fallback is only safe for obstacle retargeting.
  // Seating should require an intentional snapped target so workers
  // dropped off-hive can fall back to gatherer instead of snapping in.
  if (isWorkerSeatCell(directHit.cell)) { return null; }
  if (isCellBlockedByTrunk(directHit.cell, screenX, screenY, directHit)) { return null; }
  return {
    kind: 'direct_cell',
    cell: directHit.cell,
    directHit: directHit
  };
}

export function resolveActiveDragTargets(draggedBee, screenX, screenY) {
  var directHit = getDirectCellHit(screenX, screenY);
  var directCellId = directHit && directHit.cell ? directHit.cell.id : null;
  var mergeCandidate = pickBestMergeTarget(draggedBee, screenX, screenY);
  var cellCandidate = pickBestCellTarget(draggedBee, screenX, screenY, directCellId);
  var directFallback = getValidDirectFallbackCell(draggedBee, screenX, screenY);
  var preferred = mergeCandidate || cellCandidate || directFallback || null;

  return {
    mergeCandidate: mergeCandidate,
    cellCandidate: cellCandidate,
    directFallback: directFallback,
    preferred: preferred
  };
}

export function resolveReleaseTarget(draggedBee, screenX, screenY) {
  var resolved = resolveActiveDragTargets(draggedBee, screenX, screenY);
  if (resolved.mergeCandidate) { return resolved.mergeCandidate; }
  if (resolved.cellCandidate) { return resolved.cellCandidate; }
  if (resolved.directFallback) { return resolved.directFallback; }
  return null;
}
