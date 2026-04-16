import * as previewViewerModule from '../scene/previewViewer.js';

var initDone = false;

function openPreviewModal() {
  document.getElementById('preview-modal').classList.add('open');
  previewViewerModule.openPreview();
}

function closePreviewModal() {
  previewViewerModule.closePreview();
  document.getElementById('preview-modal').classList.remove('open');
}

export function resizePreviewModal() {
  previewViewerModule.resizePreviewCanvas();
}

export function initPreviewModal() {
  if (initDone) { return; }
  initDone = true;

  var previewToggleBtn = document.getElementById('preview-toggle');
  if (previewToggleBtn) {
    previewToggleBtn.addEventListener('click', function(e) { e.stopPropagation(); openPreviewModal(); });
    previewToggleBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); openPreviewModal(); }, { passive: false });
  }
  var dbgPreviewBtn = document.getElementById('dbg-preview');
  if (dbgPreviewBtn) {
    dbgPreviewBtn.addEventListener('click', function(e) { e.stopPropagation(); openPreviewModal(); });
    dbgPreviewBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); openPreviewModal(); }, { passive: false });
  }

  document.getElementById('preview-close').addEventListener('click', function(e) { e.stopPropagation(); closePreviewModal(); });
  document.getElementById('preview-close').addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); closePreviewModal(); }, { passive: false });

  (function() {
    var btns = document.querySelectorAll('.prev-lvl-btn');
    for (var bi = 0; bi < btns.length; bi++) {
      (function(btn) {
        function activate() {
          var lvlStr = btn.getAttribute('data-level');
          for (var i = 0; i < btns.length; i++) { btns[i].classList.remove('active'); }
          btn.classList.add('active');
          if (previewViewerModule.setPreviewSelection) {
            if (lvlStr === 'all') {
              previewViewerModule.setPreviewSelection('all', 1);
            } else {
              previewViewerModule.setPreviewSelection('single', parseInt(lvlStr, 10));
            }
          }
        }
        btn.addEventListener('click', function(e) { e.stopPropagation(); activate(); });
        btn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); activate(); }, { passive: false });
      })(btns[bi]);
    }
  })();

  document.getElementById('preview-modal').addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
  document.getElementById('preview-modal').addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: true });
}
