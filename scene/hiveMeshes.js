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

export function buildCurvedHexGeometry(cellTheta, cylRadius, circumradius, depth, gap) {
  var THREE = globalThis.THREE;
  var r = circumradius * gap;
  var v;
  var angle;
  var vx;
  var vy;
  var shape = new THREE.Shape();
  for (v = 0; v < 6; v++) {
    angle = (Math.PI / 6) + ((Math.PI / 3) * v);
    vx = Math.cos(angle) * r;
    vy = Math.sin(angle) * r;
    if (v === 0) { shape.moveTo(vx, vy); } else { shape.lineTo(vx, vy); }
  }
  shape.closePath();

  var extrudeSettings = { depth: depth, bevelEnabled: false, steps: 6 };
  var geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  var pos = geo.attributes.position;
  var vcount = pos.count;
  var lx;
  var ly;
  var lz;
  var arcAngle;
  var thetaFinal;
  var rad;

  for (v = 0; v < vcount; v++) {
    lx = pos.getX(v);
    ly = pos.getY(v);
    lz = pos.getZ(v);
    arcAngle = lx / cylRadius;
    thetaFinal = cellTheta + arcAngle;
    rad = cylRadius + lz;
    pos.setXYZ(v, Math.cos(thetaFinal) * rad, ly, Math.sin(thetaFinal) * rad);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
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
  var coreCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(
      HIVE.CYLINDER_RADIUS - 0.72,
      HIVE.CYLINDER_RADIUS - 0.72,
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
  var occluder = new THREE.Mesh(
    new THREE.CylinderGeometry(
      HIVE.CYLINDER_RADIUS - 0.48,
      HIVE.CYLINDER_RADIUS - 0.48,
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
