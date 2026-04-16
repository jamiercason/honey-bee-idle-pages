import { makeLayerCanvas, featherCanvasEdges } from '../utils/canvas.js';

var _cellFxTextures = null;
var _materialMapCache = null;

export function buildCellFxTextures() {
  var THREE = globalThis.THREE;
  if (_cellFxTextures) { return _cellFxTextures; }

  function makeTex(drawFn, size) {
    var c = makeLayerCanvas(size || 256, size || 256);
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFn(ctx, c.width, c.height);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  _cellFxTextures = {
    crack: makeTex(function(ctx, w, h) {
      ctx.strokeStyle = 'rgba(255,244,219,0.9)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.58);
      ctx.lineTo(w * 0.36, h * 0.52);
      ctx.lineTo(w * 0.47, h * 0.38);
      ctx.lineTo(w * 0.62, h * 0.44);
      ctx.lineTo(w * 0.78, h * 0.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.46, h * 0.40);
      ctx.lineTo(w * 0.40, h * 0.24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.52, h * 0.46);
      ctx.lineTo(w * 0.59, h * 0.62);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.50);
      ctx.lineTo(w * 0.26, h * 0.36);
      ctx.stroke();
    }),
    pulse: makeTex(function(ctx, w, h) {
      var g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.08, w * 0.5, h * 0.5, w * 0.48);
      g.addColorStop(0.0, 'rgba(255,240,190,0.96)');
      g.addColorStop(0.28, 'rgba(255,198,82,0.42)');
      g.addColorStop(0.60, 'rgba(255,176,46,0.14)');
      g.addColorStop(1.0, 'rgba(255,176,46,0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,223,145,0.92)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }),
    gleam: makeTex(function(ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      ctx.strokeStyle = 'rgba(255,252,224,0.95)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (var i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 0.5) * i + Math.PI * 0.25);
        ctx.beginPath();
        ctx.moveTo(0, -w * 0.22);
        ctx.lineTo(0, -w * 0.42);
        ctx.stroke();
        ctx.restore();
      }
      var g = ctx.createRadialGradient(0, 0, w * 0.03, 0, 0, w * 0.24);
      g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
      g.addColorStop(0.55, 'rgba(255,239,168,0.62)');
      g.addColorStop(1.0, 'rgba(255,239,168,0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }),
    readySpark: makeTex(function(ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(-Math.PI * 0.18);
      var sweep = ctx.createLinearGradient(-w * 0.30, 0, w * 0.30, 0);
      sweep.addColorStop(0.0, 'rgba(255,246,196,0.0)');
      sweep.addColorStop(0.40, 'rgba(255,243,180,0.10)');
      sweep.addColorStop(0.50, 'rgba(255,255,244,0.95)');
      sweep.addColorStop(0.60, 'rgba(255,226,148,0.18)');
      sweep.addColorStop(1.0, 'rgba(255,226,148,0.0)');
      ctx.fillStyle = sweep;
      ctx.beginPath();
      ctx.moveTo(-w * 0.34, -h * 0.06);
      ctx.lineTo(w * 0.34, -h * 0.18);
      ctx.lineTo(w * 0.34, h * 0.02);
      ctx.lineTo(-w * 0.34, h * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,252,224,0.88)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-w * 0.12, -h * 0.12);
      ctx.lineTo(w * 0.04, h * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.03, -h * 0.15);
      ctx.lineTo(w * 0.13, h * 0.01);
      ctx.stroke();
    }),
    goal: makeTex(function(ctx, w, h) {
      ctx.strokeStyle = 'rgba(255,225,126,0.95)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,194,64,0.55)';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }),
    unlock: makeTex(function(ctx, w, h) {
      ctx.strokeStyle = 'rgba(255,229,156,0.94)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      for (var i = 0; i < 16; i++) {
        var a = (i / 16) * Math.PI * 2;
        var r0 = w * 0.22;
        var r1 = w * 0.46;
        ctx.strokeStyle = 'rgba(255,206,98,0.55)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + Math.cos(a) * r0, h * 0.5 + Math.sin(a) * r0);
        ctx.lineTo(w * 0.5 + Math.cos(a) * r1, h * 0.5 + Math.sin(a) * r1);
        ctx.stroke();
      }
    }),
    reward: makeTex(function(ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      for (var i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 8);
        ctx.strokeStyle = 'rgba(255,245,199,0.92)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(0, -w * 0.10);
        ctx.lineTo(0, -w * 0.34);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,224,128,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }),
    work: makeTex(function(ctx, w, h) {
      ctx.strokeStyle = 'rgba(255,214,138,0.80)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.56, w * 0.26, Math.PI * 0.15, Math.PI * 0.88);
      ctx.stroke();
      for (var i = 0; i < 10; i++) {
        ctx.fillStyle = 'rgba(255,198,112,' + (0.14 + Math.random() * 0.14) + ')';
        ctx.beginPath();
        ctx.arc(w * (0.25 + Math.random() * 0.5), h * (0.28 + Math.random() * 0.34), 6 + Math.random() * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }),
    drip: makeTex(function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, h * 0.10, 0, h * 0.96);
      g.addColorStop(0.0, 'rgba(255,247,196,0.92)');
      g.addColorStop(0.20, 'rgba(255,208,96,0.96)');
      g.addColorStop(0.72, 'rgba(255,163,28,0.94)');
      g.addColorStop(1.0, 'rgba(173,89,0,0.98)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(w * 0.50, h * 0.08);
      ctx.bezierCurveTo(w * 0.32, h * 0.26, w * 0.26, h * 0.48, w * 0.40, h * 0.70);
      ctx.bezierCurveTo(w * 0.46, h * 0.82, w * 0.47, h * 0.92, w * 0.50, h * 0.96);
      ctx.bezierCurveTo(w * 0.53, h * 0.92, w * 0.54, h * 0.82, w * 0.60, h * 0.70);
      ctx.bezierCurveTo(w * 0.74, h * 0.48, w * 0.68, h * 0.26, w * 0.50, h * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,249,210,0.88)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(w * 0.46, h * 0.22);
      ctx.quadraticCurveTo(w * 0.56, h * 0.28, w * 0.58, h * 0.48);
      ctx.stroke();
    })
  };
  return _cellFxTextures;
}

export function buildProceduralMaterialMaps() {
  var THREE = globalThis.THREE;
  if (_materialMapCache) { return _materialMapCache; }

  function makeTexture(size, drawFn, repeatX, repeatY) {
    var c = makeLayerCanvas(size, size);
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawFn(ctx, c.width, c.height);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || repeatX || 1);
    tex.needsUpdate = true;
    return tex;
  }

  _materialMapCache = {
    wax: makeTexture(256, function(ctx, w, h) {
      ctx.fillStyle = '#e9c25d';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 240; i++) {
        var x = Math.random() * w;
        var y = Math.random() * h;
        var r = 8 + Math.random() * 34;
        var a = 0.02 + Math.random() * 0.07;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0.0, 'rgba(255,244,210,' + a + ')');
        g.addColorStop(0.6, 'rgba(196,132,48,' + (a * 0.75) + ')');
        g.addColorStop(1.0, 'rgba(112,74,24,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1.15, 1.15),
    bump: makeTexture(256, function(ctx, w, h) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 420; i++) {
        var shade = 104 + Math.floor(Math.random() * 78);
        var alpha = 0.08 + Math.random() * 0.12;
        ctx.fillStyle = 'rgba(' + shade + ',' + shade + ',' + shade + ',' + alpha + ')';
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1.25, 1.25),
    obstacle: makeTexture(256, function(ctx, w, h) {
      ctx.fillStyle = '#8d6b36';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        var x = Math.random() * w;
        var y = Math.random() * h;
        var rw = 18 + Math.random() * 46;
        var rh = 10 + Math.random() * 28;
        ctx.fillStyle = 'rgba(70,40,12,' + (0.10 + Math.random() * 0.18) + ')';
        ctx.beginPath();
        ctx.ellipse(x, y, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1.0, 1.0),
    honeyGloss: makeTexture(256, function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
      g.addColorStop(0.28, 'rgba(255,240,180,0.18)');
      g.addColorStop(0.68, 'rgba(255,212,102,0.35)');
      g.addColorStop(1.0, 'rgba(255,178,56,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 14; i++) {
        ctx.strokeStyle = 'rgba(255,249,220,' + (0.05 + Math.random() * 0.10) + ')';
        ctx.lineWidth = 4 + Math.random() * 8;
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, Math.random() * h);
        ctx.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h);
        ctx.stroke();
      }
    }, 1.0, 1.0),
    bark: makeTexture(256, function(ctx, w, h) {
      var barkGrad = ctx.createLinearGradient(0, 0, w, 0);
      barkGrad.addColorStop(0.0, '#311708');
      barkGrad.addColorStop(0.26, '#5c3010');
      barkGrad.addColorStop(0.52, '#6f3c14');
      barkGrad.addColorStop(0.78, '#47240c');
      barkGrad.addColorStop(1.0, '#251105');
      ctx.fillStyle = barkGrad;
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 120; i++) {
        var x = Math.random() * w;
        var wid = 3 + Math.random() * 14;
        var alpha = 0.08 + Math.random() * 0.18;
        ctx.fillStyle = 'rgba(130,78,28,' + alpha + ')';
        ctx.fillRect(x, 0, wid, h);
      }
      for (var j = 0; j < 180; j++) {
        ctx.strokeStyle = 'rgba(24,10,3,' + (0.08 + Math.random() * 0.16) + ')';
        ctx.lineWidth = 1 + Math.random() * 4;
        ctx.beginPath();
        var sx = Math.random() * w;
        var sy = Math.random() * h;
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + (Math.random() - 0.5) * 10, sy + h * 0.12, sx + (Math.random() - 0.5) * 14, sy + h * 0.48, sx + (Math.random() - 0.5) * 18, Math.min(h, sy + h * (0.40 + Math.random() * 0.45)));
        ctx.stroke();
      }
      for (var k = 0; k < 28; k++) {
        var cx = Math.random() * w;
        var cy = Math.random() * h;
        var rw = 8 + Math.random() * 28;
        var rh = 16 + Math.random() * 44;
        ctx.strokeStyle = 'rgba(86,44,14,' + (0.10 + Math.random() * 0.10) + ')';
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw, rh, (Math.random() - 0.5) * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }, 1.0, 2.8)
  };
  return _materialMapCache;
}

export function buildCellFaceOverlayTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(256, 256);
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  var g = ctx.createRadialGradient(c.width * 0.5, c.height * 0.42, c.width * 0.12, c.width * 0.5, c.height * 0.56, c.width * 0.54);
  g.addColorStop(0.0, 'rgba(255,244,214,0.10)');
  g.addColorStop(0.62, 'rgba(99,64,22,0.08)');
  g.addColorStop(1.0, 'rgba(27,12,2,0.24)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  var tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function buildHoneyPoolTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(256, 256);
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  var pool = new Path2D();
  pool.moveTo(c.width * 0.17, c.height * 0.88);
  pool.lineTo(c.width * 0.17, c.height * 0.76);
  pool.bezierCurveTo(c.width * 0.24, c.height * 0.66, c.width * 0.37, c.height * 0.60, c.width * 0.50, c.height * 0.60);
  pool.bezierCurveTo(c.width * 0.63, c.height * 0.60, c.width * 0.76, c.height * 0.66, c.width * 0.83, c.height * 0.76);
  pool.lineTo(c.width * 0.83, c.height * 0.88);
  pool.closePath();

  ctx.fillStyle = 'rgba(255,255,255,1.0)';
  ctx.fill(pool);

  var tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function buildSkyTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(128, 768);
  var ctx = c.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0.0, '#88bdf2');
  grad.addColorStop(0.28, '#cfe9ff');
  grad.addColorStop(0.58, '#eef6ef');
  grad.addColorStop(1.0, '#dae7b0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  var sunGlow = ctx.createRadialGradient(c.width * 0.74, c.height * 0.30, c.width * 0.05, c.width * 0.74, c.height * 0.30, c.width * 0.72);
  sunGlow.addColorStop(0.0, 'rgba(255,239,182,0.28)');
  sunGlow.addColorStop(0.44, 'rgba(255,236,185,0.10)');
  sunGlow.addColorStop(1.0, 'rgba(255,239,198,0.0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, c.width, c.height);
  var haze = ctx.createRadialGradient(c.width * 0.5, c.height * 0.70, c.width * 0.08, c.width * 0.5, c.height * 0.70, c.width * 0.88);
  haze.addColorStop(0.0, 'rgba(255,248,220,0.16)');
  haze.addColorStop(0.56, 'rgba(255,248,220,0.06)');
  haze.addColorStop(1.0, 'rgba(255,248,220,0.0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, c.width, c.height);
  for (var i = 0; i < 12; i++) {
    var x = Math.random() * c.width;
    var y = c.height * (0.08 + Math.random() * 0.26);
    var r = 42 + Math.random() * 84;
    var gl = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    gl.addColorStop(0.0, 'rgba(255,255,255,0.20)');
    gl.addColorStop(0.58, 'rgba(255,255,255,0.07)');
    gl.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return new THREE.CanvasTexture(c);
}

export function buildCloudTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(1024, 512);
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  for (var i = 0; i < 18; i++) {
    var x = Math.random() * c.width;
    var y = Math.random() * c.height * 0.66;
    var r = 150 + Math.random() * 210;
    var g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
    g.addColorStop(0.0, 'rgba(255,255,255,0.48)');
    g.addColorStop(0.52, 'rgba(255,248,238,0.24)');
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  featherCanvasEdges(c, 0.18, 0.18, 0.14, 0.18);
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildHorizonTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(1024, 384);
  var ctx = c.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.12, 'rgba(244,230,188,0.18)');
  grad.addColorStop(0.40, 'rgba(150,191,106,0.82)');
  grad.addColorStop(0.78, 'rgba(87,140,58,0.96)');
  grad.addColorStop(1.0, 'rgba(64,108,40,1.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  for (var i = 0; i < 34; i++) {
    var x = i / 30 * c.width;
    var h = 92 + Math.random() * 136;
    ctx.fillStyle = 'rgba(66,100,50,0.50)';
    ctx.beginPath();
    ctx.moveTo(x, c.height);
    ctx.bezierCurveTo(x - 40, c.height - h * 0.4, x - 20, c.height - h, x, c.height - h);
    ctx.bezierCurveTo(x + 20, c.height - h, x + 40, c.height - h * 0.4, x + 65, c.height);
    ctx.closePath();
    ctx.fill();
  }
  for (var j = 0; j < 22; j++) {
    var ridgeX = Math.random() * c.width;
    var ridgeY = c.height * (0.50 + Math.random() * 0.24);
    var ridgeW = 80 + Math.random() * 180;
    var ridgeH = 18 + Math.random() * 34;
    var ridge = ctx.createRadialGradient(ridgeX, ridgeY, 8, ridgeX, ridgeY, ridgeW);
    ridge.addColorStop(0.0, 'rgba(118,164,84,0.20)');
    ridge.addColorStop(0.48, 'rgba(118,164,84,0.08)');
    ridge.addColorStop(1.0, 'rgba(118,164,84,0.0)');
    ctx.fillStyle = ridge;
    ctx.fillRect(ridgeX - ridgeW, ridgeY - ridgeH, ridgeW * 2, ridgeH * 2);
  }
  var glow = ctx.createRadialGradient(c.width * 0.50, c.height * 0.54, 20, c.width * 0.50, c.height * 0.54, c.width * 0.44);
  glow.addColorStop(0.0, 'rgba(255,238,191,0.20)');
  glow.addColorStop(0.65, 'rgba(255,238,191,0.05)');
  glow.addColorStop(1.0, 'rgba(255,238,191,0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, c.width, c.height);
  featherCanvasEdges(c, 0.08, 0.08, 0.34, 0.08);
  return new THREE.CanvasTexture(c);
}

export function buildFlowerTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(1024, 512);
  var ctx = c.getContext('2d');
  var bg = ctx.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0.0, 'rgba(186,202,125,0.0)');
  bg.addColorStop(0.22, 'rgba(162,188,98,0.16)');
  bg.addColorStop(0.64, 'rgba(118,172,74,0.48)');
  bg.addColorStop(1.0, 'rgba(84,144,50,0.86)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  var blooms = ['rgba(255,255,255,0.92)', 'rgba(255,189,204,0.88)', 'rgba(255,176,91,0.88)', 'rgba(230,171,255,0.84)', 'rgba(255,236,145,0.84)'];
  for (var i = 0; i < 132; i++) {
    var leftSide = Math.random() < 0.5;
    var xBand = leftSide ? (0.02 + Math.random() * 0.28) : (0.70 + Math.random() * 0.28);
    var x = xBand * c.width;
    var y = c.height * (0.18 + Math.random() * 0.78);
    var r = 10 + Math.random() * 34;
    ctx.fillStyle = blooms[i % blooms.length];
    ctx.globalAlpha = 0.18 + Math.random() * 0.18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,162,82,0.24)';
    ctx.lineWidth = 1 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.18);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 12, y + r * 0.8, x + (Math.random() - 0.5) * 18, y + r * (1.4 + Math.random() * 0.5));
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,96,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  var centerWash = ctx.createRadialGradient(c.width * 0.5, c.height * 0.68, c.width * 0.08, c.width * 0.5, c.height * 0.68, c.width * 0.32);
  centerWash.addColorStop(0.0, 'rgba(255,255,255,0.10)');
  centerWash.addColorStop(0.70, 'rgba(255,255,255,0.03)');
  centerWash.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = centerWash;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 1;
  featherCanvasEdges(c, 0.10, 0.10, 0.20, 0.06);
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildForegroundTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(1024, 512);
  var ctx = c.getContext('2d');
  var blooms = ['rgba(255,255,255,0.88)', 'rgba(255,191,206,0.84)', 'rgba(255,180,98,0.84)', 'rgba(230,176,255,0.80)', 'rgba(255,236,145,0.80)'];
  var grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0.0, 'rgba(112,161,72,0.0)');
  grad.addColorStop(0.20, 'rgba(135,188,80,0.14)');
  grad.addColorStop(0.62, 'rgba(84,146,38,0.58)');
  grad.addColorStop(1.0, 'rgba(39,94,16,0.98)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  for (var i = 0; i < 260; i++) {
    var x = Math.random() * c.width;
    var y = c.height;
    var h = 40 + Math.random() * 90;
    ctx.strokeStyle = 'rgba(196,236,126,' + (0.20 + Math.random() * 0.18) + ')';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 30, y - h * 0.5, x + (Math.random() - 0.5) * 40, y - h);
    ctx.stroke();
  }
  for (var j = 0; j < 36; j++) {
    var sideBand = Math.random() < 0.5 ? (0.04 + Math.random() * 0.24) : (0.72 + Math.random() * 0.24);
    var fx = sideBand * c.width;
    var fy = c.height * (0.46 + Math.random() * 0.42);
    var fr = 8 + Math.random() * 18;
    ctx.globalAlpha = 0.12 + Math.random() * 0.12;
    ctx.fillStyle = blooms[j % blooms.length];
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,214,108,0.70)';
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  var calmCenter = ctx.createRadialGradient(c.width * 0.5, c.height * 0.56, c.width * 0.08, c.width * 0.5, c.height * 0.56, c.width * 0.28);
  calmCenter.addColorStop(0.0, 'rgba(255,255,255,0.10)');
  calmCenter.addColorStop(0.72, 'rgba(255,255,255,0.03)');
  calmCenter.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = calmCenter;
  ctx.fillRect(0, 0, c.width, c.height);
  featherCanvasEdges(c, 0.08, 0.08, 0.42, 0.02);
  return new THREE.CanvasTexture(c);
}

export function buildAmbientBeeTexture() {
  var THREE = globalThis.THREE;
  var c = makeLayerCanvas(1024, 256);
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  for (var i = 0; i < 26; i++) {
    var x = Math.random() * c.width;
    var y = 40 + Math.random() * (c.height - 80);
    var s = 6 + Math.random() * 10;
    ctx.fillStyle = 'rgba(54,31,12,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.1, s * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(x + s * 0.2, y - s * 0.2, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  featherCanvasEdges(c, 0.28, 0.28, 0.24, 0.24);
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
