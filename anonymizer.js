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
  const processBtn     = $('processBtn');
  const downloadAllBtn = $('downloadAllBtn');
  const clearSessionBtn= $('clearSessionBtn');
  const clearFilesBtn  = $('clearFilesBtn');
  const progressWrap   = $('progressWrap');
  const progressLabel  = $('progressLabel');
  const progressFill   = $('progressFill');
  const statusBanner   = $('statusBanner');
  const statusText     = $('statusText');
  const resultsCard    = $('results-card');
  const resultsContainer=$('resultsContainer');
  const ocrToggle      = $('ocrToggle');
  const barPadding     = $('barPadding');
  const manualTerms    = $('manualTerms');
  const entityToggles  = [...document.querySelectorAll('.entity-toggle')];

  // ── Session ───────────────────────────────────────────────────────────────
  const session = {
    get files() { return window._redactFiles || []; },
    results: [],
    objectUrls: [],
  };

  function blobUrl(blob) {
    const url = URL.createObjectURL(blob);
    session.objectUrls.push(url);
    return url;
  }
  function revokeBlobUrls() {
    session.objectUrls.forEach(u => URL.revokeObjectURL(u));
    session.objectUrls = [];
  }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1048576).toFixed(1)} MB`;
  }

  // ── Status ────────────────────────────────────────────────────────────────
  function setStatus(msg, type = '') {
    statusBanner.className = 'status-banner' + (type ? ' ' + type : '');
    statusText.textContent = msg;
  }
  function setProgress(pct, label) {
    progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    if (label) progressLabel.textContent = label;
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
    revokeBlobUrls();
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

    const active   = getActive();
    const padding  = getPadding();
    const terms    = getManualTerms();
    const useOcr   = ocrToggle?.checked !== false;

    revokeBlobUrls();
    session.results = [];
    resultsContainer.innerHTML = '';
    resultsCard.style.display  = '';
    processBtn.disabled     = true;
    downloadAllBtn.disabled = true;
    progressWrap.style.display = '';
    setProgress(0, 'Starting…');
    setStatus('Applying redaction…', 'info');

    const total = files.length;

    for (let i = 0; i < total; i++) {
      const entry = files[i];
      setProgress((i / total) * 100, `(${i+1}/${total}) Redacting ${entry.name}…`);

      let result;
      try {
        result = await EuaaPdfProcessor.process(
          entry.file,
          active,
          useOcr,
          padding,
          terms,
          msg => setStatus(msg, 'info')
        );
      } catch (err) {
        console.error(err);
        result = {
          sourceName: entry.name,
          error: true,
          message: String(err?.message || err),
          downloads: [],
        };
      }

      session.results.push(result);
      setProgress(((i + 1) / total) * 100, `Done ${i+1}/${total}`);
      renderResultCard(result);
    }

    progressWrap.style.display = 'none';
    processBtn.disabled     = false;
    downloadAllBtn.disabled = session.results.every(r => !r.downloads.length);

    const ok  = session.results.filter(r => !r.error).length;
    const err = session.results.filter(r =>  r.error).length;
    const msg = err
      ? `✅ ${ok} file(s) redacted · ⚠️ ${err} error(s) — see details below`
      : `✅ ${ok} file(s) redacted successfully. Review before use.`;
    setStatus(msg, err ? 'warn' : 'success');
  });

  // ── Render one result card ────────────────────────────────────────────────
  function renderResultCard(result) {
    const card = document.createElement('article');
    card.className = 'result-card';

    if (result.error) {
      card.innerHTML = `
        <div class="result-head">
          <h3>${escHtml(result.sourceName)}</h3>
          <span class="badge-redacted" style="background:#dc2626;">❌ Error</span>
        </div>
        <div style="padding:.85rem 1rem;font-size:.83rem;color:#dc2626;background:#fee2e2;font-family:monospace;white-space:pre-wrap;">
${escHtml(result.message)}

Troubleshooting:
• Make sure the file is a valid PDF that opens in Acrobat or a PDF viewer.
• If it is a scanned PDF, enable the OCR fallback toggle.
• Encrypted or password-protected PDFs are not supported.</div>`;
    } else {
      const dlHtml = result.downloads.map(dl => {
        const url = blobUrl(dl.blob);
        return `<a class="dl-link" href="${url}" download="${escHtml(dl.filename)}">
          <i class="fa-solid fa-download"></i> ${escHtml(dl.label)}</a>`;
      }).join('');

      card.innerHTML = `
        <div class="result-head">
          <h3>${escHtml(result.sourceName)}</h3>
          <span class="result-meta">${result.barCount || 0} black bar(s) applied</span>
          <span class="badge-redacted">⬛ Redacted</span>
        </div>
        ${dlHtml ? `<div class="result-dl">${dlHtml}</div>` : ''}`;
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
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `redacted-${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus('✅ ZIP download started.', 'success');
    } catch (err) {
      setStatus('ZIP error: ' + err.message, 'error');
    }
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download all (ZIP)';
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  setStatus('Upload PDF files above to get started.', 'info');

})();
