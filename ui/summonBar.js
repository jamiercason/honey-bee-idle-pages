import { BOOST_TYPE } from '../data/enums.js';

var doSummonRef = function() {};
var beginBoostDragRef = function() {};
var onPointerMoveRef = function() {};
var onPointerUpRef = function() {};
var getPointerRef = function() { return null; };
var initDone = false;

var boostGhost = null;

export function setSummonBarRuntime(runtime) {
  doSummonRef = runtime && runtime.doSummon ? runtime.doSummon : doSummonRef;
  beginBoostDragRef = runtime && runtime.beginBoostDrag ? runtime.beginBoostDrag : beginBoostDragRef;
  onPointerMoveRef = runtime && runtime.onPointerMove ? runtime.onPointerMove : onPointerMoveRef;
  onPointerUpRef = runtime && runtime.onPointerUp ? runtime.onPointerUp : onPointerUpRef;
  getPointerRef = runtime && runtime.getPointer ? runtime.getPointer : getPointerRef;
}

function getBoostGhost() {
  if (!boostGhost) { boostGhost = document.getElementById('boost-drag-ghost'); }
  return boostGhost;
}

export function updateBoostGhost(screenX, screenY) {
  var ghost = getBoostGhost();
  if (!ghost) { return; }
  ghost.style.display = 'block';
  ghost.style.transform = 'translate3d(' + screenX + 'px,' + screenY + 'px,0)';
}

export function clearBoostGhost() {
  var ghost = getBoostGhost();
  if (!ghost) { return; }
  ghost.style.display = 'none';
  ghost.style.transform = 'translate3d(-9999px,-9999px,0)';
}

export function initSummonBar() {
  if (initDone) { return; }
  initDone = true;

  var summonBtn = document.getElementById('summon-btn');
  var summonBar = document.getElementById('summon-bar');
  var boostJellyBtn = document.getElementById('boost-jelly-btn');

  summonBtn.addEventListener('click', function(e) { e.stopPropagation(); doSummonRef(); });
  summonBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); doSummonRef(); }, { passive: false });
  summonBar.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
  summonBar.addEventListener('touchmove', function(e) {
    e.stopPropagation();
    var pointer = getPointerRef();
    if (pointer && pointer.dragMode === 'boost_drag' && e.touches.length > 0) {
      e.preventDefault();
      onPointerMoveRef(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  summonBar.addEventListener('touchend', function(e) {
    e.stopPropagation();
    var pointer = getPointerRef();
    if (pointer && pointer.dragMode === 'boost_drag' && e.touches.length === 0) {
      e.preventDefault();
      onPointerUpRef();
    }
  }, { passive: false });
  boostJellyBtn.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    beginBoostDragRef(BOOST_TYPE.ROYAL_JELLY, e.clientX, e.clientY);
  });
  boostJellyBtn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length > 0) {
      beginBoostDragRef(BOOST_TYPE.ROYAL_JELLY, e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
}
