import { CAM } from '../config/cameraConfig.js';
import { pinch, pointer } from './inputState.js';
import { cancelPointerGesture, onPointerDown, onPointerMove, onPointerUp } from './pointerController.js';

var getCamStateRef = function() { return null; };
var getDebugPanelRef = function() { return null; };
var dbgRefreshRef = function() {};
var gestureControllerInstalled = false;

export function setGestureControllerRuntime(runtime) {
  getCamStateRef = runtime && runtime.getCamState ? runtime.getCamState : getCamStateRef;
  getDebugPanelRef = runtime && runtime.getDebugPanel ? runtime.getDebugPanel : getDebugPanelRef;
  dbgRefreshRef = runtime && runtime.dbgRefresh ? runtime.dbgRefresh : dbgRefreshRef;
}

export function getDesktopWheelZoomScale(deltaY) {
  var clampedDelta = Math.max(-240, Math.min(240, deltaY));
  return Math.exp(clampedDelta * CAM.DESKTOP_WHEEL_ZOOM_SENSITIVITY);
}

function refreshDebugPanelIfOpen() {
  var debugPanel = getDebugPanelRef();
  if (debugPanel && debugPanel.classList.contains('open')) { dbgRefreshRef(); }
}

export function installGestureController(rendererDomElement) {
  if (gestureControllerInstalled) { return; }
  gestureControllerInstalled = true;

  rendererDomElement.addEventListener('wheel', function(e) {
    e.preventDefault();
    var camState = getCamStateRef();
    var delta = getDesktopWheelZoomScale(e.deltaY);
    camState.radius = Math.max(CAM.RADIUS_MIN, Math.min(CAM.RADIUS_MAX, camState.radius * delta));
    refreshDebugPanelIfOpen();
  }, { passive: false });

  rendererDomElement.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      pinch.active = false;
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      cancelPointerGesture();
      pointer.active = false;
      pinch.active = true;
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      pinch.lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: false });

  window.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (e.touches.length === 2 && pinch.active) {
      var camState = getCamStateRef();
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (pinch.lastDist > 0) {
        var scale = pinch.lastDist / dist;
        camState.radius = Math.max(CAM.RADIUS_MIN, Math.min(CAM.RADIUS_MAX, camState.radius * scale));
        refreshDebugPanelIfOpen();
      }
      pinch.lastDist = dist;
    } else if (e.touches.length === 1 && !pinch.active) {
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  window.addEventListener('touchend', function(e) {
    if (e.touches.length < 2) { pinch.active = false; }
    if (e.touches.length === 0) { onPointerUp(); }
  }, { passive: false });
}
