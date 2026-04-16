export function makeLayerCanvas(w, h) {
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function makeCanvas(px) {
  var c = document.createElement('canvas');
  c.width = c.height = px;
  return c;
}

export function featherCanvasEdges(c, leftFrac, rightFrac, topFrac, bottomFrac) {
  var ctx = c.getContext('2d');
  var w = c.width;
  var h = c.height;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';

  function applyGrad(x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) { g.addColorStop(stops[i][0], stops[i][1]); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (leftFrac > 0) {
    applyGrad(0, 0, w * leftFrac, 0, [
      [0.0, 'rgba(255,255,255,0.0)'],
      [1.0, 'rgba(255,255,255,1.0)']
    ]);
  }
  if (rightFrac > 0) {
    applyGrad(w, 0, w * (1 - rightFrac), 0, [
      [0.0, 'rgba(255,255,255,0.0)'],
      [1.0, 'rgba(255,255,255,1.0)']
    ]);
  }
  if (topFrac > 0) {
    applyGrad(0, 0, 0, h * topFrac, [
      [0.0, 'rgba(255,255,255,0.0)'],
      [1.0, 'rgba(255,255,255,1.0)']
    ]);
  }
  if (bottomFrac > 0) {
    applyGrad(0, h, 0, h * (1 - bottomFrac), [
      [0.0, 'rgba(255,255,255,0.0)'],
      [1.0, 'rgba(255,255,255,1.0)']
    ]);
  }
  ctx.restore();
}
