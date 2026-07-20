/**
 * EUAA Monitoring Anonymiser — App Controller
 * =============================================
 * Orchestrates file intake, processing pipeline, UI updates, and downloads.
 * Privacy: no XMLHttpRequest, no fetch to external endpoints with file data.
 */

(() => {
  'use strict';

  // ── DOM refs ────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const dropZone       = $('dropZone');
  const fileInput      = $('fileInput');
  const folderInput    = $('folderInput');
  const fileQueue      = $('fileQueue');
  const fileList       = $('fileList');
  const fileCount      = $('fileCount');
  const clearFilesBtn  = $('clearFilesBtn');
  const processBtn     = $('processBtn');
  const downloadAllBtn = $('downloadAllBtn');
  const clearSessionBtn= $('clearSessionBtn');
  const downloadMapBtn = $('downloadMapBtn');
  const progressWrap   = $('progressWrap');
  const progressLabel  = $('progressLabel');
  const progressFill   = $('progressFill');
  const statusBanner   = $('statusBanner');
  const statusText     = $('statusText');
  const resultsCard    = $('results-card');
  const resultsContainer=$('resultsContainer');
  const mapCard        = $('map-card');
  const mapBody        = $('mapBody');
  const statsRow       = $('statsRow');
  const personPrefix   = $('personPrefix');
  const ocrToggle      = $('ocrToggle');

  const entityToggles  = [...document.querySelectorAll('.entity-toggle')];
  const levelRadios    = [...document.querySelectorAll('input[name="level"]')];
  const pdfModeRadios  = [...document.querySelectorAll('input[name="pdfMode"]')];

  // ── Session state ────────────────────────────────────────────────────────
  // _euaaFiles is owned by the inline upload script in index.html (no CDN deps).
  // We reference it here via window._euaaFiles so upload works even if app.js
  // fails to parse, and so that files added before app.js loads are preserved.
  const session = {
    get files()      { return window._euaaFiles || []; },
    set files(v)     { window._euaaFiles = v; },
    results:    [],
    objectUrls: [],
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const SUPPORTED_EXTS = new Set(['docx','pdf','txt','xlsx']);
  const EXT_ICONS = { pdf:'🔴', docx:'📘', xlsx:'📗', txt:'⬜' };

  function getLevel()   { return levelRadios.find(r => r.checked)?.value   || 'demo-safe'; }
  function getPdfMode() { return pdfModeRadios.find(r => r.checked)?.value || 'blackout'; }
  function getActive()  { return new Set(entityToggles.filter(t => t.checked).map(t => t.value)); }
  function useOcr()     { return ocrToggle.checked; }

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
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function fmtBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n/1024).toFixed(1)} KB`;
    return `${(n/1048576).toFixed(1)} MB`;
  }

  // ── Status UI ────────────────────────────────────────────────────────────
  function setStatus(msg, type = 'info') {
    statusBanner.className = `status-banner ${type}`;
    statusText.textContent = msg;
  }

  function setProgress(pct, label) {
    progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    progressLabel.textContent = label || '';
  }

  // ── Preset buttons ────────────────────────────────────────────────────────
  const PRESET_DIRECT      = ['PERSON','CASE_ID','PASSPORT_OR_ID','ADDRESS','EMAIL','PHONE'];
  const PRESET_RECOMMENDED = ['PERSON','CASE_ID','PASSPORT_OR_ID','ADDRESS','EMAIL','PHONE','DATE_EXACT','COUNTRY','LOCATION','FACILITY','ROUTE','FAMILY_TERM'];
  const PRESET_ALL         = PRESET_RECOMMENDED;

  function applyPreset(values) {
    const set = new Set(values);
    entityToggles.forEach(t => { t.checked = set.has(t.value); });
    // Update category item styling
    updateCatItemStyles();
  }

  function updateCatItemStyles() {
    entityToggles.forEach(t => {
      const label = t.closest('.cat-item');
      // CSS :has() handles this in modern browsers already
    });
  }

  $('presetDirect').addEventListener('click', () => applyPreset(PRESET_DIRECT));
  $('presetRecommended').addEventListener('click', () => applyPreset(PRESET_RECOMMENDED));
  $('presetAll').addEventListener('click', () => applyPreset(PRESET_ALL));

  // Processing level — update radio card selection state
  levelRadios.forEach(r => r.addEventListener('change', () => {
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    r.closest('.radio-card')?.classList.add('selected');
  }));

  pdfModeRadios.forEach(r => r.addEventListener('change', () => {
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    r.closest('.radio-card')?.classList.add('selected');
  }));

  // ── File handling — delegates to window.addFilesToQueue (inline script in index.html)
  // That script runs before any CDN libs, so upload always works.
  function addFiles(rawFiles) {
    if (typeof window.addFilesToQueue === 'function') {
      window.addFilesToQueue(rawFiles);
    }
  }

  function renderFileQueue() {
    // Rendering is handled by the inline upload script.
    // This stub exists so processAll / clearSession can call it without errors.
  }

  // Clear files only (not session results)
  clearFilesBtn.addEventListener('click', () => {
    window._euaaFiles = [];
    // Trigger a re-render via the inline upload script
    if (typeof window.addFilesToQueue === 'function') window.addFilesToQueue([]);
    processBtn.disabled = true;
    setStatus('File queue cleared.', 'info');
  });

  // ── Main processing pipeline ──────────────────────────────────────────────
  processBtn.addEventListener('click', processAll);

  async function processAll() {
    if (!session.files.length) { setStatus('Add files before processing.', 'warn'); return; }
    const active = getActive();
    if (!active.size) { setStatus('Select at least one anonymisation category.', 'warn'); return; }

    // Reset session results
    revokeBlobUrls();
    session.results = [];
    EuaaAnonymizer.resetSession();
    EuaaAnonymizer.setPrefix(personPrefix.value.trim() || 'Applicant');

    renderResultsContainer();
    renderMapTable();
    statsRow.innerHTML = '';
    resultsCard.style.display = '';
    mapCard.style.display = '';
    processBtn.disabled = true;
    downloadAllBtn.disabled = true;
    progressWrap.style.display = '';
    setProgress(0, 'Starting…');
    setStatus('Processing files…', 'info');

    const level   = getLevel();
    const pdfMode = getPdfMode();
    const ocr     = useOcr();
    const total   = session.files.length;

    for (let i = 0; i < total; i++) {
      const entry = session.files[i];
      const pctBase = (i / total) * 100;

      const statusUpdater = msg => {
        setProgress(pctBase + (1 / total) * 50, msg);
        setStatus(msg, 'info');
      };

      setProgress(pctBase, `(${i+1}/${total}) Processing ${entry.relativePath}…`);

      let result;
      try {
        result = await processOne(entry, level, pdfMode, active, ocr, statusUpdater);
      } catch (err) {
        console.error(err);
        result = {
          sourceName: entry.relativePath,
          mode: 'error',
          previewText: buildErrorMessage(err),
          replacements: [],
          downloads: [],
        };
      }

      session.results.push(result);
      setProgress(((i + 1) / total) * 100, `Completed ${i + 1}/${total}`);
      renderResultCard(result);
      renderMapTable();
    }

    renderStats();
    progressWrap.style.display = 'none';
    processBtn.disabled = false;
    downloadAllBtn.disabled = session.results.every(r => !r.downloads.length);
    setStatus(`✅ Finished — ${total} file(s) processed entirely in your browser. Review output before use.`, 'success');
  }

  function buildErrorMessage(err) {
    const base = String(err?.message || err || 'Unknown error');
    return [
      base,
      '',
      'Troubleshooting tips:',
      '• Confirm the file opens normally in its native application (Word, Acrobat, Excel).',
      '• For PDFs: use File → Save As / Export → PDF (not print-to-PDF) for best results.',
      '• For scanned PDFs: ensure OCR fallback is enabled.',
      '• If the file was downloaded from a web portal, re-save the actual document and upload that copy.',
      '• Encrypted or password-protected files are not supported.',
    ].join('\n');
  }

  async function processOne(entry, level, pdfMode, active, ocr, onStatus) {
    switch (entry.ext) {
      case 'pdf':
        return EuaaPdfProcessor.process(entry.file, pdfMode, level, active, ocr, onStatus);
      case 'docx':
        return EuaaDocProcessor.processDocx(entry.file, level, active, onStatus);
      case 'txt':
        return EuaaDocProcessor.processTxt(entry.file, level, active, onStatus);
      case 'xlsx':
        return EuaaDocProcessor.processXlsx(entry.file, level, active, onStatus);
      default:
        throw new Error(`Unsupported file type: .${entry.ext}`);
    }
  }

  // ── Render result cards ───────────────────────────────────────────────────
  function renderResultsContainer() {
    resultsContainer.innerHTML = '';
  }

  function renderResultCard(result) {
    const card = document.createElement('article');
    card.className = 'result-card';

    const modeLabels = {
      'blackout':    ['⬛ Black-bar redaction', 'mode-blackout'],
      'rebuild':     ['📝 Anonymised & rebuilt', 'mode-rebuild'],
      'rebuild-ocr': ['🔍 Anonymised + OCR', 'mode-ocr'],
      'docx':        ['📘 Word anonymised', 'mode-docx'],
      'txt':         ['📃 Text anonymised', 'mode-txt'],
      'xlsx':        ['📊 Spreadsheet anonymised', 'mode-xlsx'],
      'error':       ['❌ Processing error', 'mode-error'],
    };

    const [modeLabel, modeCls] = modeLabels[result.mode] || ['Processed', 'mode-rebuild'];
    const replCount = result.replacements?.length || 0;

    // Downloads
    const dlHtml = result.downloads.map(dl => {
      const url = blobUrl(dl.blob);
      return `<a class="download-link ${dl.dlClass}" href="${url}" download="${escHtml(dl.filename)}">${dl.label}</a>`;
    }).join('');

    const isError = result.mode === 'error';

    card.innerHTML = `
      <div class="result-card-head">
        <div style="flex:1;min-width:0;">
          <h3>${escHtml(result.sourceName)}</h3>
          <span class="result-meta">${replCount} substitution(s)</span>
        </div>
        <span class="result-mode ${modeCls}">${modeLabel}</span>
      </div>
      ${dlHtml ? `<div class="result-downloads">${dlHtml}</div>` : ''}
      <pre class="result-preview${isError ? ' error-preview' : ''}">${escHtml(
        (result.previewText || '').slice(0, 8000) || '(no preview)'
      )}</pre>
    `;

    resultsContainer.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Replacement map ────────────────────────────────────────────────────────
  function renderMapTable() {
    const map = EuaaAnonymizer.getEntityMap();
    mapBody.innerHTML = '';
    if (!map.size) return;

    const rows = [...map.values()].sort((a, b) =>
      a.category.localeCompare(b.category) || a.original.localeCompare(b.original)
    );

    for (const row of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="cat-tag cat-${escHtml(row.category)}">${escHtml(row.category)}</span></td>
        <td>${escHtml(row.original)}</td>
        <td><strong>${escHtml(row.replacement)}</strong></td>
      `;
      mapBody.appendChild(tr);
    }
  }

  function renderStats() {
    const counts = EuaaAnonymizer.getSessionStats();
    statsRow.innerHTML = '';
    for (const [cat, n] of [...counts.entries()].sort()) {
      const chip = document.createElement('span');
      chip.className = 'stat-chip';
      chip.textContent = `${cat}: ${n}`;
      statsRow.appendChild(chip);
    }
  }

  // ── Download map ──────────────────────────────────────────────────────────
  downloadMapBtn.addEventListener('click', () => {
    const map = EuaaAnonymizer.getEntityMap();
    if (!map.size) { setStatus('No replacements to export yet.', 'warn'); return; }

    const lines = ['Category\tOriginal\tReplacement'];
    for (const row of map.values()) {
      lines.push(`${row.category}\t${row.original}\t${row.replacement}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'anonymisation-map.tsv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  // ── Download all (ZIP) ────────────────────────────────────────────────────
  downloadAllBtn.addEventListener('click', async () => {
    if (!session.results.length) return;
    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = '<span class="spinner"></span> Zipping…';

    try {
      const zip = new JSZip();

      for (const result of session.results) {
        for (const dl of result.downloads) {
          const folder = result.sourceName.includes('/') ? result.sourceName.split('/').slice(0, -1).join('/') + '/' : '';
          zip.file(folder + dl.filename, dl.blob);
        }
      }

      // Add the replacement map
      const map = EuaaAnonymizer.getEntityMap();
      if (map.size) {
        const mapLines = ['Category\tOriginal\tReplacement'];
        for (const row of map.values()) {
          mapLines.push(`${row.category}\t${row.original}\t${row.replacement}`);
        }
        zip.file('anonymisation-map.tsv', mapLines.join('\n'));
      }

      // Add a README
      zip.file('README.txt', [
        'EUAA Monitoring Anonymiser — Output Bundle',
        '==========================================',
        `Generated: ${new Date().toISOString()}`,
        `Files processed: ${session.results.length}`,
        '',
        'This ZIP contains anonymised versions of your documents.',
        'All processing was done in your browser. No data was sent to any server.',
        '',
        'Always review output before using it in any official context.',
      ].join('\n'));

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `anonymised-output-${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus('✅ ZIP download started.', 'success');
    } catch (err) {
      setStatus(`ZIP error: ${err.message}`, 'error');
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download all (ZIP)';
    }
  });

  // ── Clear session ─────────────────────────────────────────────────────────
  clearSessionBtn.addEventListener('click', () => {
    revokeBlobUrls();
    window._euaaFiles = [];
    session.results = [];
    EuaaAnonymizer.resetSession();
    if (typeof window.addFilesToQueue === 'function') window.addFilesToQueue([]);
    renderResultsContainer();
    renderMapTable();
    statsRow.innerHTML = '';
    resultsCard.style.display     = 'none';
    mapCard.style.display         = 'none';
    progressWrap.style.display    = 'none';
    processBtn.disabled    = true;
    downloadAllBtn.disabled = true;
    setStatus('Session cleared. No data retained.', 'info');
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    applyPreset(PRESET_RECOMMENDED);
    setStatus('Add files above to get started.', 'info');
    // Mark default radio cards as selected
    document.querySelectorAll('input[name="level"]:checked, input[name="pdfMode"]:checked').forEach(r => {
      r.closest('.radio-card')?.classList.add('selected');
    });

    // Verify all required DOM elements exist — catch GitHub Pages deploy issues early
    const required = ['fileInput','folderInput','dropZone','processBtn','downloadAllBtn',
                      'clearSessionBtn','statusBanner','statusText','progressWrap'];
    const missing = required.filter(id => !document.getElementById(id));
    if (missing.length) {
      console.error('EUAA Anonymiser: missing DOM elements:', missing);
    }
  }

  // Always wait for full DOM — safe whether scripts are in <head> or <body>
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Upload is handled entirely by the inline <script> in index.html — no fallback needed here.

})();
