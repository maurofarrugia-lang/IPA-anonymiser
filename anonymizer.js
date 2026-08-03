/**
 * EUAA PDF Redaction Tool — App Controller
 * =========================================
 * Black-bar redaction only. No text replacement. No anonymisation.
 * Files are processed entirely in the browser.
 */

(() => {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const processBtn      = $('processBtn');
  const downloadAllBtn  = $('downloadAllBtn');
  const clearSessionBtn = $('clearSessionBtn');
  const clearFilesBtn   = $('clearFilesBtn');
  const progressWrap    = $('progressWrap');
  const progressLabel   = $('progressLabel');
  const progressFill    = $('progressFill');
  const statusBanner    = $('statusBanner');
  const statusText      = $('statusText');
  const resultsCard     = $('results-card');
  const resultsContainer= $('resultsContainer');
  const ocrToggle       = $('ocrToggle');
  const barPadding      = $('barPadding');
  const manualTerms     = $('manualTerms');
  const entityToggles   = [...document.querySelectorAll('.entity-toggle')];

  // ── Session ───────────────────────────────────────────────────────────────
  const session = {
    get files() { return window._redactFiles || []; },
    results: [],
  };

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
  function fmtBytes(n) {
    if (n < 1024)    return `${n} B`;
    if (n < 1048576) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1048576).toFixed(1)} MB`;
  }

  // ── Safe download helper ──────────────────────────────────────────────────
  // Creates a temporary <a> element appended to document.body, triggers it,
  // then removes it. This works around browser security restrictions on
  // blob URL clicks from dynamically inserted innerHTML links.
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ── Status ────────────────────────────────────────────────────────────────
  function setStatus(msg, type = '') {
    statusBanner.className = 'status-banner' + (type ? ' ' + type : '');
    statusText.textContent = msg;
  }
  function setProgress(pct, label) {
    progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    if (label !== undefined) progressLabel.textContent = label;
  }

  // ── Options ───────────────────────────────────────────────────────────────
  function getActive() {
    return new Set(entityToggles.filter(t => t.checked).map(t => t.value));
  }
  function getPadding() {
    return parseInt(barPadding?.value || '4', 10);
  }
  function getManualTerms() {
    const val = manualTerms?.value || '';
    return val.split(/[\n,;]+/).map(s => s.trim()).filter(s => s.length > 0);
  }

  // ── Clear files ───────────────────────────────────────────────────────────
  clearFilesBtn.addEventListener('click', () => {
    window._redactFiles = [];
    if (typeof window.addFilesToQueue === 'function') window.addFilesToQueue([]);
    processBtn.disabled = true;
    setStatus('File list cleared.', '');
  });

  // ── Clear session ─────────────────────────────────────────────────────────
  clearSessionBtn.addEventListener('click', () => {
    window._redactFiles = [];
    session.results = [];
    if (typeof window.addFilesToQueue === 'function') window.addFilesToQueue([]);
    resultsContainer.innerHTML = '';
    resultsCard.style.display  = 'none';
    progressWrap.style.display = 'none';
    processBtn.disabled     = true;
    downloadAllBtn.disabled = true;
    setStatus('Session cleared.', '');
  });

  // ── Main: process all files ───────────────────────────────────────────────
  processBtn.addEventListener('click', async () => {
    const files = session.files;
    if (!files.length) { setStatus('Add PDF files first.', 'warn'); return; }

    const active  = getActive();
    const padding = getPadding();
    const terms   = getManualTerms();
    const useOcr  = ocrToggle?.checked !== false;

    session.results = [];
    resultsContainer.innerHTML = '';
    resultsCard.style.display  = '';
    processBtn.disabled        = true;
    downloadAllBtn.disabled    = true;
    progressWrap.style.display = '';
    setProgress(0, 'Starting…');
    setStatus('Applying redaction…', 'info');

    const total = files.length;

    for (let i = 0; i < total; i++) {
      const entry = files[i];

      // Per-file start: show file progress label
      setProgress((i / total) * 100, `(${i+1}/${total}) Loading ${entry.name}…`);

      let result;
      try {
        result = await EuaaPdfProcessor.process(
          entry.file,
          active,
          useOcr,
          padding,
          terms,
          (msg, pct) => {
            // pct is 0–100 within the current file
            const fileBase = (i / total) * 100;
            const fileSlice = (1 / total) * 100;
            if (pct !== undefined) {
              setProgress(fileBase + fileSlice * (pct / 100), msg);
            } else {
              setProgress(fileBase + fileSlice * 0.5, msg);
            }
          }
        );
      } catch (err) {
        console.error(err);
        result = {
          sourceName: entry.name,
          error:      true,
          message:    String(err?.message || err),
          downloads:  [],
          canvases:   [],
        };
      }

      session.results.push(result);
      setProgress(((i + 1) / total) * 100, `Done ${i+1}/${total}`);
      renderResultCard(result);
    }

    setProgress(100, 'Complete');
    setTimeout(() => { progressWrap.style.display = 'none'; }, 800);
    processBtn.disabled     = false;
    downloadAllBtn.disabled = session.results.every(r => !r.downloads.length);

    const ok  = session.results.filter(r => !r.error).length;
    const err = session.results.filter(r =>  r.error).length;
    const msg = err
      ? `✅ ${ok} file(s) redacted · ⚠️ ${err} error(s) — see details below`
      : `✅ ${ok} file(s) redacted. Use "Review & edit" to add manual bars, then download.`;
    setStatus(msg, err ? 'warn' : 'success');
  });

  // ── Render one result card ────────────────────────────────────────────────
  function renderResultCard(result) {
    const card = document.createElement('article');
    card.className = 'result-card';
    card.dataset.sourceName = result.sourceName;

    if (result.error) {
      card.innerHTML = `
        <div class="result-head">
          <h3>${escHtml(result.sourceName)}</h3>
          <span class="badge-redacted" style="background:#dc2626;">❌ Error</span>
        </div>
        <div style="padding:.85rem 1rem;font-size:.83rem;color:#dc2626;background:#fee2e2;font-family:monospace;white-space:pre-wrap;">${escHtml(result.message)}

Troubleshooting:
• Make sure the file is a valid PDF that opens in Acrobat or a PDF viewer.
• If it is a scanned PDF, enable the OCR fallback toggle.
• Encrypted or password-protected PDFs are not supported.</div>`;
    } else {
      card.innerHTML = `
        <div class="result-head">
          <h3>${escHtml(result.sourceName)}</h3>
          <span class="result-meta">${result.barCount || 0} bar(s) applied</span>
          <span class="badge-redacted">⬛ Redacted</span>
        </div>
        <div class="result-dl">
          <button class="dl-link btn-review" data-name="${escHtml(result.sourceName)}">
            <i class="fa-solid fa-pen-to-square"></i> Review &amp; add manual bars
          </button>
          <button class="dl-link btn-dl-single" data-name="${escHtml(result.sourceName)}">
            <i class="fa-solid fa-download"></i> Download redacted PDF
          </button>
        </div>`;

      // Wire download button
      card.querySelector('.btn-dl-single').addEventListener('click', function() {
        const r = session.results.find(x => x.sourceName === this.dataset.name);
        if (!r || !r.downloads.length) return;
        triggerDownload(r.downloads[0].blob, r.downloads[0].filename);
      });

      // Wire review button
      card.querySelector('.btn-review').addEventListener('click', function() {
        const r = session.results.find(x => x.sourceName === this.dataset.name);
        if (r) openReviewModal(r);
      });
    }

    resultsContainer.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Download all as ZIP ───────────────────────────────────────────────────
  downloadAllBtn.addEventListener('click', async () => {
    if (!session.results.length) return;
    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = '<span class="spinner"></span> Zipping…';
    try {
      const zip = new JSZip();
      for (const result of session.results) {
        for (const dl of result.downloads) {
          zip.file(dl.filename, dl.blob);
        }
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      triggerDownload(blob, `redacted-${new Date().toISOString().slice(0,10)}.zip`);
      setStatus('✅ ZIP download started.', 'success');
    } catch (err) {
      setStatus('ZIP error: ' + err.message, 'error');
    }
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download all (ZIP)';
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── Manual Review Modal ───────────────────────────────────────────────────
  // Shows each page as a canvas. User can draw additional black bars by
  // clicking and dragging. When done, re-encodes to PDF and downloads.
  // ══════════════════════════════════════════════════════════════════════════

  let modalResult   = null;   // result object being reviewed
  let modalCanvases = [];     // array of {canvas, extraBars:[]} per page
  let currentPage   = 0;
  let isDrawing     = false;
  let drawStart     = { x: 0, y: 0 };
  let drawRect      = null;
  let manualBarThickness = 6; // default bar thickness for manual draws

  function openReviewModal(result) {
    modalResult   = result;
    modalCanvases = (result.canvases || []).map(c => {
      // Deep-clone the canvas so we can draw on it without affecting original
      const clone = document.createElement('canvas');
      clone.width  = c.width;
      clone.height = c.height;
      clone.getContext('2d').drawImage(c, 0, 0);
      return { canvas: clone, extraBars: [] };
    });
    currentPage = 0;
    drawRect    = null;
    isDrawing   = false;

    const modal = $('reviewModal');
    modal.style.display = 'flex';
    renderModalPage();
    updateModalNav();
  }

  function closeReviewModal() {
    $('reviewModal').style.display = 'none';
    modalResult   = null;
    modalCanvases = [];
    drawRect      = null;
  }

  function renderModalPage() {
    const container = $('modalCanvasContainer');
    container.innerHTML = '';

    if (!modalCanvases.length) return;
    const { canvas } = modalCanvases[currentPage];

    // Display canvas scaled to fit the modal viewport
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:inline-block;';

    const display = document.createElement('canvas');
    display.id = 'modalDisplayCanvas';

    const maxW = container.clientWidth  - 32 || 800;
    const maxH = window.innerHeight     - 220;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);

    display.width  = Math.floor(canvas.width  * scale);
    display.height = Math.floor(canvas.height * scale);
    display.style.cssText = 'display:block;cursor:crosshair;touch-action:none;border-radius:4px;';

    // Redraw the source canvas (with existing bars) onto display canvas
    const dCtx = display.getContext('2d');
    dCtx.drawImage(canvas, 0, 0, display.width, display.height);

    // Draw overlay rect during drag
    const overlay = document.createElement('canvas');
    overlay.width  = display.width;
    overlay.height = display.height;
    overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    overlay.id = 'modalOverlayCanvas';

    wrapper.appendChild(display);
    wrapper.appendChild(overlay);
    container.appendChild(wrapper);

    // ── Mouse / touch events for drawing ──────────────────────────────────
    function getPos(e, el) {
      const rect = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top)  / scale,
      };
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawing = true;
      const pos  = getPos(e, display);
      drawStart  = pos;
      drawRect   = { x: pos.x, y: pos.y, w: 0, h: 0 };
    }

    function moveDraw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e, display);
      const x   = Math.min(drawStart.x, pos.x);
      const y   = Math.min(drawStart.y, pos.y);
      const w   = Math.abs(pos.x - drawStart.x);
      const h   = Math.abs(pos.y - drawStart.y);
      drawRect  = { x, y, w, h };

      // Draw preview overlay
      const oCtx = overlay.getContext('2d');
      oCtx.clearRect(0, 0, overlay.width, overlay.height);

      const thickness = parseInt($('modalBarThickness').value || '6', 10);
      const displayX  = x * scale;
      const displayY  = y * scale;
      const displayW  = w * scale;
      const displayH  = Math.max(h * scale, thickness * scale * 0.4);

      oCtx.fillStyle = 'rgba(0,0,0,0.85)';
      oCtx.fillRect(displayX, displayY, displayW, displayH);
    }

    function endDraw(e) {
      if (!isDrawing) return;
      isDrawing = false;
      const oCtx = overlay.getContext('2d');
      oCtx.clearRect(0, 0, overlay.width, overlay.height);

      if (!drawRect) return;
      const thickness = parseInt($('modalBarThickness').value || '6', 10);

      // Enforce minimum height = bar thickness (in source canvas coords)
      const srcX = drawRect.x;
      const srcY = drawRect.y;
      const srcW = Math.max(drawRect.w, 2);
      const srcH = Math.max(drawRect.h, thickness);

      if (srcW < 2 || srcH < 1) return; // ignore accidental clicks

      // Record bar in source canvas coords (not display coords)
      modalCanvases[currentPage].extraBars.push({ x: srcX, y: srcY, w: srcW, h: srcH });

      // Paint bar onto source canvas (permanent)
      const srcCtx = modalCanvases[currentPage].canvas.getContext('2d');
      srcCtx.fillStyle = '#000000';
      srcCtx.fillRect(Math.floor(srcX), Math.floor(srcY), Math.ceil(srcW), Math.ceil(srcH));

      // Redraw display
      dCtx.drawImage(canvas, 0, 0, display.width, display.height);

      drawRect = null;
    }

    display.addEventListener('mousedown',  startDraw);
    display.addEventListener('mousemove',  moveDraw);
    display.addEventListener('mouseup',    endDraw);
    display.addEventListener('mouseleave', endDraw);
    display.addEventListener('touchstart', startDraw, { passive: false });
    display.addEventListener('touchmove',  moveDraw,  { passive: false });
    display.addEventListener('touchend',   endDraw);

    // Page indicator
    $('modalPageInfo').textContent = `Page ${currentPage + 1} of ${modalCanvases.length}`;
  }

  function updateModalNav() {
    $('modalPrevBtn').disabled = currentPage === 0;
    $('modalNextBtn').disabled = currentPage === modalCanvases.length - 1;
    $('modalPageInfo').textContent = `Page ${currentPage + 1} of ${modalCanvases.length}`;
  }

  // ── Modal navigation ──────────────────────────────────────────────────────
  document.getElementById('modalPrevBtn').addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; renderModalPage(); updateModalNav(); }
  });
  document.getElementById('modalNextBtn').addEventListener('click', () => {
    if (currentPage < modalCanvases.length - 1) { currentPage++; renderModalPage(); updateModalNav(); }
  });
  document.getElementById('modalCloseBtn').addEventListener('click', closeReviewModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeReviewModal);

  // Close on backdrop click
  $('reviewModal').addEventListener('click', function(e) {
    if (e.target === this) closeReviewModal();
  });

  // Undo last bar on current page
  document.getElementById('modalUndoBtn').addEventListener('click', () => {
    const pg = modalCanvases[currentPage];
    if (!pg || !pg.extraBars.length) return;

    // Pop last bar from list
    pg.extraBars.pop();

    // We need to redraw the page from scratch (re-render original + re-apply all remaining bars)
    // The easiest approach: rebuild from the result's original canvas
    const origCanvas = (modalResult.canvases || [])[currentPage];
    if (!origCanvas) return;

    const c = pg.canvas;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(origCanvas, 0, 0);   // restore auto-redacted state

    // Re-apply remaining manual bars
    ctx.fillStyle = '#000000';
    for (const bar of pg.extraBars) {
      ctx.fillRect(Math.floor(bar.x), Math.floor(bar.y), Math.ceil(bar.w), Math.ceil(bar.h));
    }

    renderModalPage();
    updateModalNav();
  });

  // ── Modal: Finalize & download ────────────────────────────────────────────
  document.getElementById('modalDownloadBtn').addEventListener('click', async () => {
    if (!modalResult || !modalCanvases.length) return;

    const btn = $('modalDownloadBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Building PDF…';

    try {
      const { jsPDF } = window.jspdf;
      const SCALE     = EuaaPdfProcessor.SCALE || 2.5;
      let doc = null;
      let totalBars = (modalResult.barCount || 0);

      // Count extra manual bars
      for (const pg of modalCanvases) totalBars += pg.extraBars.length;

      for (let i = 0; i < modalCanvases.length; i++) {
        const canvas = modalCanvases[i].canvas;
        const mmW    = (canvas.width  / SCALE) * (25.4 / 96);
        const mmH    = (canvas.height / SCALE) * (25.4 / 96);
        const orient = mmW > mmH ? 'l' : 'p';
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (!doc) {
          doc = new jsPDF({ orientation: orient, unit: 'mm', format: [mmW, mmH], compress: true });
        } else {
          doc.addPage([mmW, mmH], orient);
        }
        doc.addImage(imgData, 'JPEG', 0, 0, mmW, mmH);
      }

      if (!doc) throw new Error('No pages to encode.');

      const outBuf  = doc.output('arraybuffer');
      const outName = (modalResult.sourceName || 'document').replace(/\.pdf$/i, '') + '_REDACTED.pdf';
      const blob    = new Blob([outBuf], { type: 'application/pdf' });

      // Update the result in session so "Download redacted PDF" button also gets the updated version
      modalResult.downloads = [{ filename: outName, blob, label: '⬛ Download redacted PDF' }];
      modalResult.barCount  = totalBars;

      // Update the card bar count display
      const card = resultsContainer.querySelector(`[data-source-name="${CSS.escape(modalResult.sourceName)}"]`) ||
                   [...resultsContainer.querySelectorAll('.result-card')].find(c => c.dataset.sourceName === modalResult.sourceName);
      if (card) {
        const meta = card.querySelector('.result-meta');
        if (meta) meta.textContent = `${totalBars} bar(s) applied`;
      }

      triggerDownload(blob, outName);
      closeReviewModal();
      setStatus(`✅ "${outName}" downloaded with all manual bars included.`, 'success');
    } catch (err) {
      console.error(err);
      setStatus('Error building final PDF: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-download"></i> Finalise &amp; download';
  });

  // ── Bar thickness live label ───────────────────────────────────────────────
  const modalThicknessSlider = $('modalBarThickness');
  const modalThicknessLabel  = $('modalBarThicknessVal');
  if (modalThicknessSlider) {
    modalThicknessSlider.addEventListener('input', function() {
      modalThicknessLabel.textContent = this.value + ' px';
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  setStatus('Upload PDF files above to get started.', 'info');

})();
