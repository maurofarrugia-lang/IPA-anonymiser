/**
 * EUAA PDF Redaction Tool — App Controller
 */

// Wait for everything to be ready
window.addEventListener('load', function() {

  var processBtn     = document.getElementById('processBtn');
  var downloadAllBtn = document.getElementById('downloadAllBtn');
  var clearFilesBtn  = document.getElementById('clearFilesBtn');
  var clearSessionBtn= document.getElementById('clearSessionBtn');
  var progressWrap   = document.getElementById('progressWrap');
  var progressFill   = document.getElementById('progressFill');
  var progressLabel  = document.getElementById('progressLabel');
  var statusBanner   = document.getElementById('statusBanner');
  var statusText     = document.getElementById('statusText');
  var resultsCard    = document.getElementById('results-card');
  var resultsContainer = document.getElementById('resultsContainer');
  var ocrToggle      = document.getElementById('ocrToggle');
  var barPadding     = document.getElementById('barPadding');
  var manualTerms    = document.getElementById('manualTerms');

  // Check critical elements exist
  if (!processBtn) { alert('ERROR: processBtn not found'); return; }
  if (!statusText) { alert('ERROR: statusText not found'); return; }

  var sessionResults = [];

  // ── Status display ────────────────────────────────────────────────────────
  function setStatus(msg, type) {
    if (statusBanner) statusBanner.className = 'status-banner' + (type ? ' ' + type : '');
    if (statusText)   statusText.textContent = msg;
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  function showProgress(pct, label) {
    if (progressWrap)  progressWrap.style.display = '';
    if (progressFill)  progressFill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (progressLabel && label !== undefined) progressLabel.textContent = label;
  }
  function hideProgress() {
    if (progressWrap) progressWrap.style.display = 'none';
  }

  // ── File list ─────────────────────────────────────────────────────────────
  function refreshFileList() {
    var files = window._redactFiles || [];
    var n     = files.length;
    var cnt   = document.getElementById('fileCount');
    var lst   = document.getElementById('fileList');
    var qw    = document.getElementById('fileQueue');
    if (cnt) cnt.textContent = n + ' file' + (n === 1 ? '' : 's') + ' queued';
    if (lst) {
      lst.innerHTML = '';
      files.forEach(function(f) {
        var li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = '<i class="fa-solid fa-file-pdf" style="color:#dc2626;flex-shrink:0"></i>' +
          '<span class="file-item-name">' + esc(f.name) + '</span>' +
          '<span class="file-item-size">' + fmtSize(f.size) + '</span>' +
          '<span class="file-item-ext">pdf</span>';
        lst.appendChild(li);
      });
    }
    if (qw) qw.style.display = n > 0 ? '' : 'none';
    if (processBtn) processBtn.disabled = n === 0;
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtSize(n) {
    if (n < 1024)    return n + ' B';
    if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
    return (n/1048576).toFixed(1) + ' MB';
  }

  // ── Safe file download ────────────────────────────────────────────────────
  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a   = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
  }

  // ── Clear list button ─────────────────────────────────────────────────────
  if (clearFilesBtn) {
    clearFilesBtn.addEventListener('click', function() {
      window._redactFiles = [];
      refreshFileList();
      setStatus('File list cleared.', '');
    });
  }

  // ── Clear session button ──────────────────────────────────────────────────
  if (clearSessionBtn) {
    clearSessionBtn.addEventListener('click', function() {
      window._redactFiles = [];
      sessionResults = [];
      refreshFileList();
      if (resultsContainer) resultsContainer.innerHTML = '';
      if (resultsCard)      resultsCard.style.display = 'none';
      if (downloadAllBtn)   downloadAllBtn.disabled = true;
      hideProgress();
      setStatus('Session cleared.', '');
    });
  }

  // ── PROCESS BUTTON ────────────────────────────────────────────────────────
  processBtn.addEventListener('click', function() {
    var files = window._redactFiles || [];
    if (!files.length) {
      setStatus('Please add PDF files first.', 'warn');
      return;
    }

    // Check required libraries are loaded
    if (typeof pdfjsLib === 'undefined') {
      setStatus('ERROR: PDF.js library not loaded. Check your internet connection.', 'error');
      return;
    }
    if (typeof window.jspdf === 'undefined') {
      setStatus('ERROR: jsPDF library not loaded. Check your internet connection.', 'error');
      return;
    }
    if (typeof EuaaPdfProcessor === 'undefined') {
      setStatus('ERROR: PDF processor not loaded.', 'error');
      return;
    }

    // Read settings
    var active = new Set();
    document.querySelectorAll('.entity-toggle').forEach(function(t) {
      if (t.checked) active.add(t.value);
    });
    var padding = barPadding ? parseInt(barPadding.value, 10) : 4;
    var terms   = [];
    if (manualTerms && manualTerms.value.trim()) {
      terms = manualTerms.value.split(/[\n,;]+/)
        .map(function(s){ return s.trim(); })
        .filter(function(s){ return s.length > 0; });
    }
    var useOcr = ocrToggle ? ocrToggle.checked : false;

    // Reset UI
    sessionResults = [];
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (resultsCard)      resultsCard.style.display = '';
    if (downloadAllBtn)   downloadAllBtn.disabled = true;
    processBtn.disabled = true;
    showProgress(0, 'Starting…');
    setStatus('Processing…', 'info');

    var total = files.length;
    var index = 0;

    // Process files one by one using recursive async
    function processNext() {
      if (index >= total) {
        // All done
        showProgress(100, 'Complete');
        setTimeout(hideProgress, 1000);
        processBtn.disabled = false;
        var ok  = sessionResults.filter(function(r){ return !r.error; }).length;
        var err = sessionResults.filter(function(r){ return  r.error; }).length;
        if (downloadAllBtn) downloadAllBtn.disabled = ok === 0;
        setStatus(
          err ? '✅ ' + ok + ' done · ⚠️ ' + err + ' error(s) — see below'
              : '✅ ' + ok + ' file(s) redacted. Click "Download" to save.',
          err ? 'warn' : 'success'
        );
        return;
      }

      var entry    = files[index];
      var fileNum  = index + 1;
      showProgress((index / total) * 100, '(' + fileNum + '/' + total + ') ' + entry.name);
      setStatus('Redacting page by page: ' + entry.name, 'info');

      EuaaPdfProcessor.process(
        entry.file,
        active,
        useOcr,
        padding,
        terms,
        function(msg, pct) {
          var base  = (index / total) * 100;
          var slice = (1 / total) * 100;
          var p     = (pct !== undefined) ? pct : 50;
          showProgress(base + slice * (p / 100), msg);
        }
      ).then(function(result) {
        sessionResults.push(result);
        showProgress(((index + 1) / total) * 100, 'Done ' + (index+1) + '/' + total);
        renderCard(result);
        index++;
        processNext();
      }).catch(function(err) {
        console.error('Process error:', err);
        var result = {
          sourceName: entry.name,
          error:      true,
          message:    String(err && err.message ? err.message : err),
          downloads:  [],
          canvases:   []
        };
        sessionResults.push(result);
        renderCard(result);
        index++;
        processNext();
      });
    }

    processNext();
  });

  // ── Render result card ────────────────────────────────────────────────────
  function renderCard(result) {
    if (!resultsContainer) return;
    var card = document.createElement('article');
    card.className = 'result-card';
    card.dataset.sourceName = result.sourceName;

    if (result.error) {
      card.innerHTML =
        '<div class="result-head">' +
          '<h3>' + esc(result.sourceName) + '</h3>' +
          '<span class="badge-redacted" style="background:#dc2626;">&#10060; Error</span>' +
        '</div>' +
        '<div style="padding:.85rem 1rem;font-size:.83rem;color:#dc2626;background:#fee2e2;' +
             'font-family:monospace;white-space:pre-wrap;">' +
          esc(result.message) +
        '\n\nTips:\n• Must be a valid PDF (opens in Acrobat)\n• Enable OCR for scanned PDFs\n• Encrypted PDFs are not supported</div>';
    } else {
      card.innerHTML =
        '<div class="result-head">' +
          '<h3>' + esc(result.sourceName) + '</h3>' +
          '<span class="result-meta">' + (result.barCount || 0) + ' bar(s) applied</span>' +
          '<span class="badge-redacted">&#9632; Redacted</span>' +
        '</div>' +
        '<div class="result-dl">' +
          '<button class="dl-link btn-review" type="button">' +
            '<i class="fa-solid fa-pen-to-square"></i> Review &amp; add manual bars' +
          '</button>' +
          '<button class="dl-link btn-dl-single" type="button">' +
            '<i class="fa-solid fa-download"></i> Download redacted PDF' +
          '</button>' +
        '</div>';

      var res = result;
      card.querySelector('.btn-dl-single').addEventListener('click', function() {
        if (!res.downloads || !res.downloads.length) {
          setStatus('No download available.', 'error');
          return;
        }
        triggerDownload(res.downloads[0].blob, res.downloads[0].filename);
      });

      card.querySelector('.btn-review').addEventListener('click', function() {
        openReviewModal(res);
      });
    }

    resultsContainer.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Download all ZIP ──────────────────────────────────────────────────────
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', function() {
      if (!sessionResults.length) return;
      downloadAllBtn.disabled = true;
      downloadAllBtn.innerHTML = '<span class="spinner"></span> Zipping…';

      var zip = new JSZip();
      sessionResults.forEach(function(r) {
        r.downloads.forEach(function(dl) { zip.file(dl.filename, dl.blob); });
      });
      zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(function(blob) {
        triggerDownload(blob, 'redacted-' + new Date().toISOString().slice(0,10) + '.zip');
        setStatus('✅ ZIP download started.', 'success');
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download all (ZIP)';
      }).catch(function(e) {
        setStatus('ZIP error: ' + e.message, 'error');
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download all (ZIP)';
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MANUAL REVIEW MODAL
  // ══════════════════════════════════════════════════════════════════════════
  var modal = {
    result:   null,
    canvases: [],
    origCvs:  [],
    page:     0,
    drawing:  false,
    sx: 0, sy: 0,
    scale: 1
  };

  function openReviewModal(result) {
    if (!result.canvases || !result.canvases.length) {
      setStatus('No page previews available.', 'warn');
      return;
    }
    modal.result  = result;
    modal.page    = 0;
    modal.drawing = false;
    modal.origCvs = result.canvases;
    modal.canvases = result.canvases.map(function(src) {
      var dst = document.createElement('canvas');
      dst.width = src.width; dst.height = src.height;
      dst.getContext('2d').drawImage(src, 0, 0);
      return { canvas: dst, bars: [] };
    });
    var el = document.getElementById('reviewModal');
    if (el) { el.style.display = 'flex'; el.classList.add('open'); }
    renderModalPage();
    updateModalNav();
  }

  function closeReviewModal() {
    var el = document.getElementById('reviewModal');
    if (el) { el.style.display = 'none'; el.classList.remove('open'); }
    modal.result = null; modal.canvases = []; modal.origCvs = [];
  }

  function renderModalPage() {
    var container = document.getElementById('modalCanvasContainer');
    if (!container || !modal.canvases.length) return;
    container.innerHTML = '';

    var pg  = modal.canvases[modal.page];
    var src = pg.canvas;

    var maxW  = Math.max(container.clientWidth - 40, 400);
    var maxH  = Math.max(window.innerHeight - 240, 300);
    var scale = Math.min(maxW / src.width, maxH / src.height, 1);
    modal.scale = scale;

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;user-select:none;';

    var disp = document.createElement('canvas');
    disp.width  = Math.floor(src.width  * scale);
    disp.height = Math.floor(src.height * scale);
    disp.style.cssText = 'display:block;cursor:crosshair;touch-action:none;border-radius:4px;' +
                         'box-shadow:0 0 0 2px #374151,0 8px 32px rgba(0,0,0,.5);';
    var dCtx = disp.getContext('2d');
    dCtx.drawImage(src, 0, 0, disp.width, disp.height);

    var ovl = document.createElement('canvas');
    ovl.width = disp.width; ovl.height = disp.height;
    ovl.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    var oCtx = ovl.getContext('2d');

    wrap.appendChild(disp);
    wrap.appendChild(ovl);
    container.appendChild(wrap);

    function getPos(e) {
      var rect = disp.getBoundingClientRect();
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale };
    }
    function getThick() {
      var el = document.getElementById('modalBarThickness');
      return el ? parseInt(el.value, 10) : 16;
    }

    disp.addEventListener('mousedown', function(e) {
      e.preventDefault();
      modal.drawing = true;
      var p = getPos(e); modal.sx = p.x; modal.sy = p.y;
    });
    disp.addEventListener('mousemove', function(e) {
      if (!modal.drawing) return;
      e.preventDefault();
      var p = getPos(e);
      var x = Math.min(modal.sx, p.x), y = Math.min(modal.sy, p.y);
      var w = Math.abs(p.x - modal.sx), h = Math.max(Math.abs(p.y - modal.sy), getThick());
      oCtx.clearRect(0,0,ovl.width,ovl.height);
      oCtx.fillStyle = 'rgba(0,0,0,0.85)';
      oCtx.fillRect(x*scale, y*scale, w*scale, h*scale);
    });
    function finishDraw(e) {
      if (!modal.drawing) return;
      modal.drawing = false;
      oCtx.clearRect(0,0,ovl.width,ovl.height);
      var p = getPos(e);
      var x = Math.min(modal.sx, p.x), y = Math.min(modal.sy, p.y);
      var w = Math.abs(p.x - modal.sx), h = Math.max(Math.abs(p.y - modal.sy), getThick());
      if (w < 2) return;
      pg.bars.push({x:x,y:y,w:w,h:h});
      src.getContext('2d').fillStyle = '#000';
      src.getContext('2d').fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));
      dCtx.drawImage(src, 0, 0, disp.width, disp.height);
    }
    disp.addEventListener('mouseup', finishDraw);
    disp.addEventListener('mouseleave', finishDraw);
    disp.addEventListener('touchstart', function(e){ e.preventDefault(); modal.drawing=true; var p=getPos(e); modal.sx=p.x; modal.sy=p.y; }, {passive:false});
    disp.addEventListener('touchmove', function(e){ if(!modal.drawing)return; e.preventDefault(); var p=getPos(e); var x=Math.min(modal.sx,p.x),y=Math.min(modal.sy,p.y),w=Math.abs(p.x-modal.sx),h=Math.max(Math.abs(p.y-modal.sy),getThick()); oCtx.clearRect(0,0,ovl.width,ovl.height); oCtx.fillStyle='rgba(0,0,0,0.85)'; oCtx.fillRect(x*scale,y*scale,w*scale,h*scale); }, {passive:false});
    disp.addEventListener('touchend', function(e){ if(!modal.drawing)return; modal.drawing=false; oCtx.clearRect(0,0,ovl.width,ovl.height); var t=e.changedTouches[0]; var rect=disp.getBoundingClientRect(); var px=(t.clientX-rect.left)/scale,py=(t.clientY-rect.top)/scale; var x=Math.min(modal.sx,px),y=Math.min(modal.sy,py),w=Math.abs(px-modal.sx),h=Math.max(Math.abs(py-modal.sy),getThick()); if(w<2)return; pg.bars.push({x:x,y:y,w:w,h:h}); src.getContext('2d').fillStyle='#000'; src.getContext('2d').fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h)); dCtx.drawImage(src,0,0,disp.width,disp.height); });

    document.getElementById('modalPageInfo').textContent = 'Page ' + (modal.page+1) + ' of ' + modal.canvases.length;
  }

  function updateModalNav() {
    var prev = document.getElementById('modalPrevBtn');
    var next = document.getElementById('modalNextBtn');
    var info = document.getElementById('modalPageInfo');
    if (prev) prev.disabled = modal.page === 0;
    if (next) next.disabled = modal.page >= modal.canvases.length - 1;
    if (info) info.textContent = 'Page ' + (modal.page+1) + ' of ' + modal.canvases.length;
  }

  // Modal buttons
  var mPrev = document.getElementById('modalPrevBtn');
  var mNext = document.getElementById('modalNextBtn');
  var mClose= document.getElementById('modalCloseBtn');
  var mCancel=document.getElementById('modalCancelBtn');
  var mUndo = document.getElementById('modalUndoBtn');
  var mDl   = document.getElementById('modalDownloadBtn');
  var mModal= document.getElementById('reviewModal');

  if (mPrev)   mPrev.addEventListener('click', function(){ if(modal.page>0){modal.page--;renderModalPage();updateModalNav();} });
  if (mNext)   mNext.addEventListener('click', function(){ if(modal.page<modal.canvases.length-1){modal.page++;renderModalPage();updateModalNav();} });
  if (mClose)  mClose.addEventListener('click',  closeReviewModal);
  if (mCancel) mCancel.addEventListener('click', closeReviewModal);
  if (mModal)  mModal.addEventListener('click',  function(e){ if(e.target===mModal) closeReviewModal(); });

  if (mUndo) {
    mUndo.addEventListener('click', function() {
      var pg = modal.canvases[modal.page];
      if (!pg || !pg.bars.length) return;
      pg.bars.pop();
      var orig = modal.origCvs[modal.page];
      var dst  = pg.canvas;
      var ctx  = dst.getContext('2d');
      ctx.clearRect(0,0,dst.width,dst.height);
      ctx.drawImage(orig,0,0);
      ctx.fillStyle = '#000';
      pg.bars.forEach(function(b){ ctx.fillRect(Math.floor(b.x),Math.floor(b.y),Math.ceil(b.w),Math.ceil(b.h)); });
      renderModalPage(); updateModalNav();
    });
  }

  if (mDl) {
    mDl.addEventListener('click', function() {
      if (!modal.result || !modal.canvases.length) return;
      mDl.disabled = true;
      mDl.innerHTML = '<span class="spinner"></span> Building PDF…';

      var SCALE  = (window.EuaaPdfProcessor && window.EuaaPdfProcessor.SCALE) || 2.5;
      var jsPDF  = window.jspdf.jsPDF;
      var doc    = null;
      var total  = (modal.result.barCount || 0);
      modal.canvases.forEach(function(pg){ total += pg.bars.length; });

      try {
        for (var i = 0; i < modal.canvases.length; i++) {
          var canvas  = modal.canvases[i].canvas;
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
        var outBuf  = doc.output('arraybuffer');
        var outName = (modal.result.sourceName || 'document').replace(/\.pdf$/i,'') + '_REDACTED.pdf';
        var blob    = new Blob([outBuf], { type: 'application/pdf' });
        modal.result.downloads = [{ filename: outName, blob: blob }];
        modal.result.barCount  = total;
        document.querySelectorAll('.result-card').forEach(function(c){
          if (c.dataset.sourceName === modal.result.sourceName) {
            var m = c.querySelector('.result-meta');
            if (m) m.textContent = total + ' bar(s) applied';
          }
        });
        triggerDownload(blob, outName);
        closeReviewModal();
        setStatus('✅ Downloaded: ' + outName, 'success');
      } catch(err) {
        setStatus('PDF build error: ' + err.message, 'error');
        console.error(err);
      }
      mDl.disabled = false;
      mDl.innerHTML = '<i class="fa-solid fa-download"></i> Finalise &amp; download';
    });
  }

  // Modal thickness slider label
  var mThick = document.getElementById('modalBarThickness');
  var mThickVal = document.getElementById('modalBarThicknessVal');
  if (mThick && mThickVal) {
    mThick.addEventListener('input', function(){ mThickVal.textContent = this.value + ' px'; });
  }

  // Keep file list in sync when files are added via the upload script
  var _origAdd = window.addFilesToQueue;
  window.addFilesToQueue = function(raw) {
    if (typeof _origAdd === 'function') _origAdd(raw);
    refreshFileList();
  };

  // Initial state
  refreshFileList();
  setStatus('Upload PDF files above to get started.', 'info');
  hideProgress();

});
