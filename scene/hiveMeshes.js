import { HIVE } from '../config/hiveConfig.js';
import { PRESENTATION } from '../config/presentationConfig.js';
import { lerp } from '../utils/math.js';
import { buildProceduralMaterialMaps } from './textures.js';

var sceneRef = null;
var hiveGroupRef = null;
var cellMaterialRef = function() { return null; };
var cellRadialLiftRef = function() { return 0; };
var ensureCellSurfaceLayersRef = function() {};
var ensureCellFxRef = function() {};
var getCoreCylRef = function() { return null; };

export function setHiveMeshesRuntime(runtime) {
  sceneRef = runtime && runtime.scene ? runtime.scene : sceneRef;
  hiveGroupRef = runtime && runtime.hiveGroup ? runtime.hiveGroup : hiveGroupRef;
  cellMaterialRef = runtime && runtime.cellMaterial ? runtime.cellMaterial : cellMaterialRef;
  cellRadialLiftRef = runtime && runtime.cellRadialLift ? runtime.cellRadialLift : cellRadialLiftRef;
  ensureCellSurfaceLayersRef = runtime && runtime.ensureCellSurfaceLayers ? runtime.ensureCellSurfaceLayers : ensureCellSurfaceLayersRef;
  ensureCellFxRef = runtime && runtime.ensureCellFx ? runtime.ensureCellFx : ensureCellFxRef;
  getCoreCylRef = runtime && runtime.getCoreCyl ? runtime.getCoreCyl : getCoreCylRef;
}

function clampTunable(value, min, max, fallback) {
  value = Number(value);
  if (!isFinite(value)) { return fallback; }
  return Math.max(min, Math.min(max, value));
}

function buildHexRing(radius, scale) {
  var verts = [];
  for (var v = 0; v < 6; v++) {
    var angle = (Math.PI / 6) + ((Math.PI / 3) * v);
    verts.push({
      x: Math.cos(angle) * radius * scale,
      y: Math.sin(angle) * radius * scale
    });
  }
  return verts;
}

function buildHexPerimeter(radius, scale, sideSegments) {
  var corners = buildHexRing(radius, scale);
  var verts = [];
  for (var side = 0; side < 6; side++) {
    var a = corners[side];
    var b = corners[(side + 1) % 6];
    for (var s = 0; s < sideSegments; s++) {
      var t = s / sideSegments;
      verts.push({
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t)
      });
    }
  }
  return verts;
}

function mapCurvedPoint(cellTheta, cylRadius, lx, ly, lz) {
  var arcAngle = lx / cylRadius;
  var thetaFinal = cellTheta + arcAngle;
  var rad = cylRadius + lz;
  return {
    x: Math.cos(thetaFinal) * rad,
    y: ly,
    z: Math.sin(thetaFinal) * rad,
    theta: thetaFinal
  };
}

function getCellRearRelief(depth) {
  return Math.max(0.006, depth * 0.11);
}

export function getCoreCylinderRadius() {
  var inset = clampTunable(HIVE.CORE_SURFACE_INSET, -0.02, 0.16, 0.006);
  return Math.max(0.1, HIVE.CYLINDER_RADIUS + getCellRearRelief(HIVE.HEX_DEPTH) - inset);
}

export function getCoreOccluderRadius() {
  return Math.max(0.1, getCoreCylinderRadius() - 0.02);
}

export function buildCurvedHexGeometry(cellTheta, cylRadius, circumradius, depth, gap) {
  var THREE = globalThis.THREE;
  var r = circumradius * gap;
  var faceScale = clampTunable(HIVE.HEX_FACE_SCALE, 0.86, 0.985, 0.94);
  var recess = clampTunable(HIVE.HEX_FACE_RECESS, 0.0, Math.max(0.001, depth * 0.12), Math.min(0.008, depth * 0.08));
  var bevelInset = clampTunable(HIVE.HEX_BEVEL_INSET, 0.0, Math.max(0.001, r * 0.16), 0.090);
  var sideSegments = Math.round(clampTunable(HIVE.HEX_FACE_SEGMENTS, 2, 8, 5));
  var bevelScale = 1 - (Math.max(0.001, bevelInset) / Math.max(0.001, r));
  var innerScale = Math.max(0.82, Math.min(faceScale, bevelScale, 0.985));
  var midScaleA = innerScale * 0.36;
  var midScaleB = innerScale * 0.68;
  var faceZ = Math.max(depth * 0.58, depth - (depth * 0.34));
  var centerZ = faceZ - recess;
  var edgeZ = getCellRearRelief(depth);
  var backZ = Math.max(0, Math.min(edgeZ - 0.002, getCoreCylinderRadius() - cylRadius + 0.001));
  var rings = [
    { scale: midScaleA, z: centerZ + (recess * 0.18) },
    { scale: midScaleB, z: centerZ + (recess * 0.55) },
    { scale: innerScale, z: faceZ },
    { scale: 1.0, z: edgeZ }
  ];
  var positions = [];
  var uvs = [];
  var colors = [];
  var indices = [];

  function getWaxShade(lx, ly, ringScale) {
    var seam = clampTunable(HIVE.CELL_SEAM_SHADOW, 0, 0.5, 0.24);
    var variation = clampTunable(HIVE.CELL_WAX_VARIATION, 0, 0.24, 0.08);
    var edgeShade = 1 - seam * Math.pow(Math.max(0, ringScale), 2.2);
    var grain = Math.sin((cellTheta * 19.7) + lx * 3.1 + ly * 2.3) * Math.sin((cellTheta * 11.3) + lx * 0.9 - ly * 2.7);
    return Math.max(0.48, Math.min(1.04, edgeShade + grain * variation));
  }

  function pushVertex(lx, ly, lz, ringScale) {
    var p = mapCurvedPoint(cellTheta, cylRadius, lx, ly, lz);
    var shade = getWaxShade(lx, ly, ringScale || 0);
    positions.push(p.x, p.y, p.z);
    uvs.push((lx / (r * 2)) + 0.5, (ly / (r * 2)) + 0.5);
    colors.push(shade, shade, shade);
    return (positions.length / 3) - 1;
  }

  var centerIndex = pushVertex(0, 0, centerZ, 0);
  var ringIndices = [];
  for (var ri = 0; ri < rings.length; ri++) {
    var perimeter = buildHexPerimeter(r, rings[ri].scale, sideSegments);
    var ring = [];
    for (var pi = 0; pi < perimeter.length; pi++) {
      ring.push(pushVertex(perimeter[pi].x, perimeter[pi].y, rings[ri].z, rings[ri].scale));
    }
    ringIndices.push(ring);
  }

  var perimeterCount = ringIndices[0].length;
  for (var fi = 0; fi < perimeterCount; fi++) {
    indices.push(centerIndex, ringIndices[0][(fi + 1) % perimeterCount], ringIndices[0][fi]);
  }

  for (var band = 0; band < ringIndices.length - 1; band++) {
    var inner = ringIndices[band];
    var outer = ringIndices[band + 1];
    for (var bi = 0; bi < perimeterCount; bi++) {
      var bj = (bi + 1) % perimeterCount;
      indices.push(inner[bi], outer[bj], outer[bi]);
      indices.push(inner[bi], inner[bj], outer[bj]);
    }
  }

  if (backZ < edgeZ - 0.001) {
    var outerRing = ringIndices[ringIndices.length - 1];
    var backingRing = [];
    var backingPerimeter = buildHexPerimeter(r, 1.0, sideSegments);
    for (var bpi = 0; bpi < backingPerimeter.length; bpi++) {
      backingRing.push(pushVertex(backingPerimeter[bpi].x, backingPerimeter[bpi].y, backZ, 1.0));
    }
    for (var si = 0; si < perimeterCount; si++) {
      var sj = (si + 1) % perimeterCount;
      indices.push(outerRing[si], backingRing[sj], outerRing[sj]);
      indices.push(outerRing[si], backingRing[si], backingRing[sj]);
    }
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

export function buildCurvedHexFaceGeometry(cellTheta, cylRadius, circumradius, gap, xSegments) {
  var THREE = globalThis.THREE;
  var r = circumradius * gap;
  var verts2 = [];
  for (var v = 0; v < 6; v++) {
    var angle = (Math.PI / 6) + ((Math.PI / 3) * v);
    verts2.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r
    });
  }

  function verticalIntersections(x) {
    var ys = [];
    for (var i = 0; i < verts2.length; i++) {
      var a = verts2[i];
      var b = verts2[(i + 1) % verts2.length];
      var minX = Math.min(a.x, b.x);
      var maxX = Math.max(a.x, b.x);
      if (x < minX - 0.0001 || x > maxX + 0.0001) { continue; }
      if (Math.abs(a.x - b.x) < 0.0001) {
        ys.push(a.y, b.y);
        continue;
      }
      var t = (x - a.x) / (b.x - a.x);
      if (t >= -0.0001 && t <= 1.0001) {
        ys.push(lerp(a.y, b.y, t));
      }
    }
    ys.sort(function(a, b) { return a - b; });
    if (ys.length < 2) { return null; }
    return { y0: ys[0], y1: ys[ys.length - 1] };
  }

  var cols = Math.max(8, xSegments || 18);
  var positions = [];
  var uvs = [];
  var indices = [];
  var xMin = -r;
  var xMax = r;

  for (var ci = 0; ci <= cols; ci++) {
    var lx = lerp(xMin, xMax, ci / cols);
    var hits = verticalIntersections(lx);
    if (!hits) { continue; }
    var arcAngle = lx / cylRadius;
    var thetaFinal = cellTheta + arcAngle;
    var wx = Math.cos(thetaFinal) * cylRadius;
    var wz = Math.sin(thetaFinal) * cylRadius;

    positions.push(wx, hits.y0, wz);
    positions.push(wx, hits.y1, wz);
    uvs.push(ci / cols, 0);
    uvs.push(ci / cols, 1);
  }

  var colCount = positions.length / 6;
  for (var qi = 0; qi < colCount - 1; qi++) {
    var base = qi * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildFlatHexFaceGeometry(scale) {
  var THREE = globalThis.THREE;
  var r = HIVE.HEX_CIRCUMRADIUS * scale * HIVE.HEX_GAP_FACTOR;
  var shape = new THREE.Shape();
  for (var v = 0; v < 6; v++) {
    var angle = (Math.PI / 6) + ((Math.PI / 3) * v);
    var vx = Math.cos(angle) * r;
    var vy = Math.sin(angle) * r;
    if (v === 0) { shape.moveTo(vx, vy); } else { shape.lineTo(vx, vy); }
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export function buildInitialCellMeshes(cells) {
  var THREE = globalThis.THREE;
  var cellMeshMap = {};
  var i;
  var cell;
  var mesh;
  var lift;
  var cylR;
  var geo;

  for (i = 0; i < cells.length; i++) {
    cell = cells[i];
    lift = cellRadialLiftRef(cell);
    cylR = HIVE.CYLINDER_RADIUS + lift;

    geo = buildCurvedHexGeometry(
      cell.theta,
      cylR,
      HIVE.HEX_CIRCUMRADIUS,
      HIVE.HEX_DEPTH,
      HIVE.HEX_GAP_FACTOR
    );

    mesh = new THREE.Mesh(geo, cellMaterialRef(cell));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(0, cell.worldPos.y, 0);

    mesh.userData.cellId = cell.id;
    hiveGroupRef.add(mesh);
    cellMeshMap[cell.id] = mesh;
    ensureCellSurfaceLayersRef(cell, mesh, cylR);
    ensureCellFxRef(cell, mesh);
  }

  return cellMeshMap;
}

export function createCoreCyl() {
  var THREE = globalThis.THREE;
  var hiveVisibleHeight = HIVE.ROWS * HIVE.VERTICAL_SPACING;
  var coreCylHeight = hiveVisibleHeight * 2.4;
  var coreRadius = getCoreCylinderRadius();
  var coreCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(
      coreRadius,
      coreRadius,
      coreCylHeight,
      48,
      1,
      false
    ),
    new THREE.MeshStandardMaterial({ color: 0x030200, roughness: 1.0, side: THREE.FrontSide })
  );
  sceneRef.add(coreCyl);
  return coreCyl;
}

export function createCoreOccluder() {
  var THREE = globalThis.THREE;
  var hiveVisibleHeight = HIVE.ROWS * HIVE.VERTICAL_SPACING;
  var occluderHeight = hiveVisibleHeight * 2.45;
  var occluderRadius = getCoreOccluderRadius();
  var occluder = new THREE.Mesh(
    new THREE.CylinderGeometry(
      occluderRadius,
      occluderRadius,
      occluderHeight,
      24,
      1,
      false
    ),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  occluder.name = 'coreOccluder';
  occluder.renderOrder = -100;
  sceneRef.add(occluder);
  return occluder;
}

export function refreshCoreCylinderMaterial() {
  var coreCyl = getCoreCylRef();
  if (!coreCyl || !coreCyl.material) { return; }
  var maps = buildProceduralMaterialMaps();
  coreCyl.material.color.setHex(0x5a2d11);
  coreCyl.material.emissive.setHex(0x241006);
  coreCyl.material.emissiveIntensity = 0.18;
  coreCyl.material.roughness = 0.90;
  coreCyl.material.metalness = 0.0;
  if (PRESENTATION.MATERIAL_RICHNESS_ENABLED) {
    coreCyl.material.map = maps.bark;
    coreCyl.material.bumpMap = maps.bump;
    coreCyl.material.bumpScale = 0.09;
  } else {
    coreCyl.material.map = null;
    coreCyl.material.bumpMap = null;
    coreCyl.material.bumpScale = 0;
  }
  coreCyl.material.needsUpdate = true;
}
