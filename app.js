/**
 * EUAA PDF Redaction Tool — App Controller
 * =========================================
 * Black-bar redaction only. No text replacement. No anonymisation.
 * All processing happens entirely in the browser.
 */

(function () {
  'use strict';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Safe download: creates a temporary <a>, appends to body, clicks, removes.
  // Works in all browsers; avoids innerHTML blob-link security restrictions.
  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 90000);
  }

  // ── Session ───────────────────────────────────────────────────────────────
  var session = {
    results: []
  };

  function getFiles() { return window._redactFiles || []; }

  // ── Status & progress ─────────────────────────────────────────────────────
  function setStatus(msg, type) {
    var banner = $('statusBanner');
    var text   = $('statusText');
    if (!banner || !text) return;
    banner.className = 'status-banner' + (type ? ' ' + type : '');
    text.textContent = msg;
  }

  function setProgress(pct, label) {
    var fill  = $('progressFill');
    var lbl   = $('progressLabel');
    var wrap  = $('progressWrap');
    if (fill)  fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (lbl && label !== undefined)  lbl.textContent = label;
    if (wrap)  wrap.style.display = '';
  }

  function hideProgress() {
    var wrap = $('progressWrap');
    if (wrap) wrap.style.display = 'none';
  }

  // ── File queue refresh ────────────────────────────────────────────────────
  // Called any time _redactFiles changes so the UI stays in sync
  function refreshQueue() {
    var files = getFiles();
    var n     = files.length;

    var cnt = $('fileCount');
    var lst = $('fileList');
    var qw  = $('fileQueue');
    var pb  = $('processBtn');

    if (cnt) cnt.textContent = n + ' file' + (n === 1 ? '' : 's') + ' queued';
    if (pb)  pb.disabled = n === 0;

    if (lst) {
      lst.innerHTML = '';
      files.forEach(function (f) {
        var li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML =
          '<i class="fa-solid fa-file-pdf" style="color:#dc2626;flex-shrink:0"></i>' +
          '<span class="file-item-name" title="' + escHtml(f.name) + '">' + escHtml(f.name) + '</span>' +
          '<span class="file-item-size">' + fmtBytes(f.size) + '</span>' +
          '<span class="file-item-ext">pdf</span>';
        lst.appendChild(li);
      });
    }

    if (qw) qw.style.display = n > 0 ? '' : 'none';
  }

  function fmtBytes(n) {
    if (n < 1024)    return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  // ── Options ───────────────────────────────────────────────────────────────
  function getActive() {
    var toggles = document.querySelectorAll('.entity-toggle');
    var active  = new Set();
    toggles.forEach(function (t) { if (t.checked) active.add(t.value); });
    return active;
  }

  function getPadding() {
    var el = $('barPadding');
    return el ? parseInt(el.value, 10) : 4;
  }

  function getManualTerms() {
    var el = $('manualTerms');
    if (!el) return [];
    return el.value.split(/[\n,;]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  // ── Wire: clear file list ─────────────────────────────────────────────────
  function wireClearFiles() {
    var btn = $('clearFilesBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window._redactFiles = [];
      refreshQueue();
      setStatus('File list cleared.', '');
    });
  }

  // ── Wire: clear full session ──────────────────────────────────────────────
  function wireClearSession() {
    var btn = $('clearSessionBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window._redactFiles = [];
      session.results = [];
      refreshQueue();
      var rc = $('resultsContainer');
      var rcard = $('results-card');
      if (rc)    rc.innerHTML = '';
      if (rcard) rcard.style.display = 'none';
      hideProgress();
      var dlBtn = $('downloadAllBtn');
      if (dlBtn) dlBtn.disabled = true;
      setStatus('Session cleared.', '');
    });
  }

  // ── Wire: process button ──────────────────────────────────────────────────
  function wireProcessBtn() {
    var btn = $('processBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var files = getFiles();
      if (!files.length) {
        setStatus('Add PDF files first.', 'warn');
        return;
      }

      var active  = getActive();
      var padding = getPadding();
      var terms   = getManualTerms();
      var useOcr  = $('ocrToggle') ? $('ocrToggle').checked : true;

      session.results = [];

      var rc    = $('resultsContainer');
      var rcard = $('results-card');
      var dlBtn = $('downloadAllBtn');

      if (rc)    rc.innerHTML = '';
      if (rcard) rcard.style.display = '';
      if (btn)   btn.disabled = true;
      if (dlBtn) dlBtn.disabled = true;

      setProgress(0, 'Starting…');
      setStatus('Applying redaction…', 'info');

      var total = files.length;

      for (var i = 0; i < total; i++) {
        var entry = files[i];
        setProgress((i / total) * 100, '(' + (i + 1) + '/' + total + ') Loading ' + entry.name + '…');

        var result;
        try {
          var fileIndex = i;  // capture for closure
          result = await EuaaPdfProcessor.process(
            entry.file,
            active,
            useOcr,
            padding,
            terms,
            function (msg, pct) {
              var fileBase  = (fileIndex / total) * 100;
              var fileSlice = (1 / total) * 100;
              var p = (pct !== undefined) ? pct : 50;
              setProgress(fileBase + fileSlice * (p / 100), msg);
            }
          );
        } catch (err) {
          console.error('Redaction error:', err);
          result = {
            sourceName: entry.name,
            error:      true,
            message:    String(err && err.message ? err.message : err),
            downloads:  [],
            canvases:   []
          };
        }

        session.results.push(result);
        setProgress(((i + 1) / total) * 100, 'Done ' + (i + 1) + '/' + total);
        renderResultCard(result);
      }

      setProgress(100, 'Complete');
      setTimeout(hideProgress, 900);

      if (btn)   btn.disabled = false;
      if (dlBtn) dlBtn.disabled = session.results.every(function (r) { return !r.downloads.length; });

      var ok  = session.results.filter(function (r) { return !r.error; }).length;
      var err = session.results.filter(function (r) { return  r.error; }).length;
      var msg = err
        ? '✅ ' + ok + ' file(s) redacted · ⚠️ ' + err + ' error(s) — see details below'
        : '✅ ' + ok + ' file(s) redacted. Click "Review & add bars" to manually add more, then download.';
      setStatus(msg, err ? 'warn' : 'success');
    });
  }

  // ── Render result card ────────────────────────────────────────────────────
  function renderResultCard(result) {
    var rc = $('resultsContainer');
    if (!rc) return;

    var card = document.createElement('article');
    card.className = 'result-card';
    card.dataset.sourceName = result.sourceName;

    if (result.error) {
      card.innerHTML =
        '<div class="result-head">' +
          '<h3>' + escHtml(result.sourceName) + '</h3>' +
          '<span class="badge-redacted" style="background:#dc2626;">&#10060; Error</span>' +
        '</div>' +
        '<div style="padding:.85rem 1rem;font-size:.83rem;color:#dc2626;background:#fee2e2;' +
             'font-family:monospace;white-space:pre-wrap;">' + escHtml(result.message) +
        '\n\nTroubleshooting:\n' +
        '• Make sure the file is a valid PDF that opens in Acrobat or a PDF viewer.\n' +
        '• If it is a scanned PDF, enable the OCR fallback toggle.\n' +
        '• Encrypted or password-protected PDFs are not supported.</div>';
    } else {
      card.innerHTML =
        '<div class="result-head">' +
          '<h3>' + escHtml(result.sourceName) + '</h3>' +
          '<span class="result-meta">' + (result.barCount || 0) + ' bar(s) applied</span>' +
          '<span class="badge-redacted">&#9632; Redacted</span>' +
        '</div>' +
        '<div class="result-dl">' +
          '<button class="dl-link btn-review" type="button">'+
            '<i class="fa-solid fa-pen-to-square"></i> Review &amp; add manual bars'+
          '</button>' +
          '<button class="dl-link btn-dl-single" type="button">'+
            '<i class="fa-solid fa-download"></i> Download redacted PDF'+
          '</button>' +
        '</div>';

      // Store reference so button closures can find the result
      var thisResult = result;

      card.querySelector('.btn-dl-single').addEventListener('click', function () {
        if (!thisResult.downloads || !thisResult.downloads.length) {
          setStatus('No download available — processing may have failed.', 'error');
          return;
        }
        triggerDownload(thisResult.downloads[0].blob, thisResult.downloads[0].filename);
      });

      card.querySelector('.btn-review').addEventListener('click', function () {
        openReviewModal(thisResult);
      });
    }

    rc.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Wire: download all ZIP ─────────────────────────────────────────────────
  function wireDownloadAll() {
    var btn = $('downloadAllBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!session.results.length) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Zipping…';
      try {
        var zip = new JSZip();
        session.results.forEach(function (result) {
          result.downloads.forEach(function (dl) {
            zip.file(dl.filename, dl.blob);
          });
        });
        var blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        triggerDownload(blob, 'redacted-' + new Date().toISOString().slice(0, 10) + '.zip');
        setStatus('✅ ZIP download started.', 'success');
      } catch (err) {
        setStatus('ZIP error: ' + err.message, 'error');
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-download"></i> Download all (ZIP)';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MANUAL REVIEW MODAL
  // ══════════════════════════════════════════════════════════════════════════

  var modalState = {
    result:    null,
    canvases:  [],   // [{canvas, extraBars:[{x,y,w,h}]}]
    origCvs:   [],   // read-only originals for undo
    page:      0,
    drawing:   false,
    startX:    0,
    startY:    0,
    scale:     1
  };

  function openReviewModal(result) {
    if (!result.canvases || !result.canvases.length) {
      setStatus('No page previews available for this file.', 'warn');
      return;
    }

    modalState.result   = result;
    modalState.page     = 0;
    modalState.drawing  = false;

    // Clone canvases: origCvs = read-only, canvases = working copy
    modalState.origCvs  = result.canvases;
    modalState.canvases = result.canvases.map(function (src) {
      var dst = document.createElement('canvas');
      dst.width  = src.width;
      dst.height = src.height;
      dst.getContext('2d').drawImage(src, 0, 0);
      return { canvas: dst, extraBars: [] };
    });

    var modal = $('reviewModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
    }

    renderModalPage();
    updateModalNav();
  }

  function closeReviewModal() {
    var modal = $('reviewModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('open');
    }
    modalState.result   = null;
    modalState.canvases = [];
    modalState.origCvs  = [];
  }

  function renderModalPage() {
    var container = $('modalCanvasContainer');
    if (!container) return;
    container.innerHTML = '';

    var pg = modalState.canvases[modalState.page];
    if (!pg) return;

    var src = pg.canvas;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:inline-block;user-select:none;';

    // Scale to fit modal
    var maxW  = Math.max(container.clientWidth  - 40, 400);
    var maxH  = Math.max(window.innerHeight      - 240, 300);
    var scale = Math.min(maxW / src.width, maxH / src.height, 1);
    modalState.scale = scale;

    var disp = document.createElement('canvas');
    disp.width  = Math.floor(src.width  * scale);
    disp.height = Math.floor(src.height * scale);
    disp.style.cssText = 'display:block;cursor:crosshair;touch-action:none;' +
                         'border-radius:4px;box-shadow:0 0 0 2px #374151,0 8px 32px rgba(0,0,0,.5);';

    var dCtx = disp.getContext('2d');
    dCtx.drawImage(src, 0, 0, disp.width, disp.height);

    // Overlay for live drag preview
    var ovl = document.createElement('canvas');
    ovl.width  = disp.width;
    ovl.height = disp.height;
    ovl.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';

    wrapper.appendChild(disp);
    wrapper.appendChild(ovl);
    container.appendChild(wrapper);

    // ── Draw helpers ──────────────────────────────────────────────────────
    function getPos(e) {
      var rect   = disp.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top)  / scale
      };
    }

    function getThickness() {
      var el = $('modalBarThickness');
      return el ? parseInt(el.value, 10) : 16;
    }

    var startX = 0, startY = 0;

    function onDown(e) {
      e.preventDefault();
      modalState.drawing = true;
      var pos = getPos(e);
      startX = pos.x;
      startY = pos.y;
    }

    function onMove(e) {
      if (!modalState.drawing) return;
      e.preventDefault();
      var pos  = getPos(e);
      var x    = Math.min(startX, pos.x);
      var y    = Math.min(startY, pos.y);
      var w    = Math.abs(pos.x - startX);
      var h    = Math.max(Math.abs(pos.y - startY), getThickness());

      var oCtx = ovl.getContext('2d');
      oCtx.clearRect(0, 0, ovl.width, ovl.height);
      oCtx.fillStyle = 'rgba(0,0,0,0.85)';
      oCtx.fillRect(x * scale, y * scale, w * scale, h * scale);
    }

    function onUp(e) {
      if (!modalState.drawing) return;
      modalState.drawing = false;

      var oCtx = ovl.getContext('2d');
      oCtx.clearRect(0, 0, ovl.width, ovl.height);

      var pos = getPos(e.changedTouches ? { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY } : e);
      var x   = Math.min(startX, pos.x);
      var y   = Math.min(startY, pos.y);
      var w   = Math.abs(pos.x - startX);
      var h   = Math.max(Math.abs(pos.y - startY), getThickness());

      if (w < 2) return; // accidental click

      // Paint permanently onto working canvas
      var sCtx = src.getContext('2d');
      sCtx.fillStyle = '#000000';
      sCtx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));

      // Record for undo
      pg.extraBars.push({ x: x, y: y, w: w, h: h });

      // Redraw display
      dCtx.drawImage(src, 0, 0, disp.width, disp.height);
    }

    disp.addEventListener('mousedown',  onDown);
    disp.addEventListener('mousemove',  onMove);
    disp.addEventListener('mouseup',    onUp);
    disp.addEventListener('mouseleave', function (e) { if (modalState.drawing) onUp(e); });
    disp.addEventListener('touchstart', onDown, { passive: false });
    disp.addEventListener('touchmove',  onMove, { passive: false });
    disp.addEventListener('touchend',   onUp);
  }

  function updateModalNav() {
    var prev = $('modalPrevBtn');
    var next = $('modalNextBtn');
    var info = $('modalPageInfo');
    var total = modalState.canvases.length;
    if (prev) prev.disabled = modalState.page === 0;
    if (next) next.disabled = modalState.page >= total - 1;
    if (info) info.textContent = 'Page ' + (modalState.page + 1) + ' of ' + total;
  }

  function wireModal() {
    // Prev / next
    var prevBtn = $('modalPrevBtn');
    var nextBtn = $('modalNextBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (modalState.page > 0) {
          modalState.page--;
          renderModalPage();
          updateModalNav();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (modalState.page < modalState.canvases.length - 1) {
          modalState.page++;
          renderModalPage();
          updateModalNav();
        }
      });
    }

    // Close buttons
    var closeBtn  = $('modalCloseBtn');
    var cancelBtn = $('modalCancelBtn');
    if (closeBtn)  closeBtn.addEventListener('click',  closeReviewModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeReviewModal);

    // Backdrop click
    var modal = $('reviewModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeReviewModal();
      });
    }

    // Undo
    var undoBtn = $('modalUndoBtn');
    if (undoBtn) {
      undoBtn.addEventListener('click', function () {
        var pg = modalState.canvases[modalState.page];
        if (!pg || !pg.extraBars.length) return;
        pg.extraBars.pop();

        // Restore from original + re-draw remaining bars
        var orig = modalState.origCvs[modalState.page];
        var dst  = pg.canvas;
        var ctx  = dst.getContext('2d');
        ctx.clearRect(0, 0, dst.width, dst.height);
        ctx.drawImage(orig, 0, 0);
        ctx.fillStyle = '#000000';
        pg.extraBars.forEach(function (b) {
          ctx.fillRect(Math.floor(b.x), Math.floor(b.y), Math.ceil(b.w), Math.ceil(b.h));
        });
        renderModalPage();
        updateModalNav();
      });
    }

    // Finalise + download
    var dlBtn = $('modalDownloadBtn');
    if (dlBtn) {
      dlBtn.addEventListener('click', async function () {
        if (!modalState.result || !modalState.canvases.length) return;

        dlBtn.disabled = true;
        dlBtn.innerHTML = '<span class="spinner"></span> Building PDF…';

        try {
          var jsPDF  = window.jspdf.jsPDF;
          var SCALE  = (window.EuaaPdfProcessor && window.EuaaPdfProcessor.SCALE) || 2.5;
          var doc    = null;
          var total  = 0;

          modalState.canvases.forEach(function (pg) { total += pg.extraBars.length; });
          total += (modalState.result.barCount || 0);

          for (var i = 0; i < modalState.canvases.length; i++) {
            var canvas  = modalState.canvases[i].canvas;
            var mmW     = (canvas.width  / SCALE) * (25.4 / 96);
            var mmH     = (canvas.height / SCALE) * (25.4 / 96);
            var orient  = mmW > mmH ? 'l' : 'p';
            var imgData = canvas.toDataURL('image/jpeg', 0.95);

            if (!doc) {
              doc = new jsPDF({ orientation: orient, unit: 'mm', format: [mmW, mmH], compress: true });
            } else {
              doc.addPage([mmW, mmH], orient);
            }
            doc.addImage(imgData, 'JPEG', 0, 0, mmW, mmH);
          }

          if (!doc) throw new Error('No pages to encode.');

          var outBuf  = doc.output('arraybuffer');
          var outName = (modalState.result.sourceName || 'document')
                          .replace(/\.pdf$/i, '') + '_REDACTED.pdf';
          var blob    = new Blob([outBuf], { type: 'application/pdf' });

          // Update the session result so the card download button also works
          modalState.result.downloads  = [{ filename: outName, blob: blob, label: 'Download redacted PDF' }];
          modalState.result.barCount   = total;

          // Update bar count in the result card
          var cards = document.querySelectorAll('.result-card');
          cards.forEach(function (c) {
            if (c.dataset.sourceName === modalState.result.sourceName) {
              var meta = c.querySelector('.result-meta');
              if (meta) meta.textContent = total + ' bar(s) applied';
            }
          });

          triggerDownload(blob, outName);
          closeReviewModal();
          setStatus('✅ "' + outName + '" downloaded with all manual bars.', 'success');
        } catch (err) {
          console.error('PDF encode error:', err);
          setStatus('Error building final PDF: ' + err.message, 'error');
        }

        dlBtn.disabled = false;
        dlBtn.innerHTML = '<i class="fa-solid fa-download"></i> Finalise &amp; download';
      });
    }
  }

  // ── Expose refreshQueue so the upload inline script can call it ───────────
  // The inline upload script in index.html calls window.addFilesToQueue().
  // We override it here to ALSO call refreshQueue() so the queue stays in sync.
  function hookUploadScript() {
    var originalAdd = window.addFilesToQueue;
    window.addFilesToQueue = function (raw) {
      if (typeof originalAdd === 'function') originalAdd(raw);
      // refreshQueue is already called inside renderQ() within the original,
      // but we also sync processBtn state here for safety
      var pb = $('processBtn');
      if (pb) pb.disabled = getFiles().length === 0;
    };

    // Patch: make clear work by directly overriding the queue state
    window._clearFileQueue = function () {
      window._redactFiles = [];
      refreshQueue();
    };
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    setStatus('Upload PDF files above to get started.', 'info');
    wireClearFiles();
    wireClearSession();
    wireProcessBtn();
    wireDownloadAll();
    wireModal();
    hookUploadScript();

    // Sync queue display in case files were added before app.js loaded
    refreshQueue();
  }

  // Run after DOM is fully ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
