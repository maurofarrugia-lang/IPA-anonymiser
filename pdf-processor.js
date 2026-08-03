/**
 * EUAA PDF Redaction Tool — PDF Processor
 * ========================================
 * BLACK-BAR ONLY. No text replacement. No rebuild mode.
 *
 * How it works:
 *  1. PDF.js renders every page to a high-resolution canvas (SCALE×)
 *  2. For each text item, EuaaAnonymizer detects entities AND manual terms
 *  3. A solid black rectangle is drawn over matching text on the canvas
 *  4. The bar height = text height + user-controlled padding on all sides
 *  5. Each canvas page is encoded as JPEG and assembled into a new PDF via jsPDF
 *  6. Original canvases are stored so the manual review modal can show + redraw them
 *
 * This approach works on ALL valid PDFs — no PDF-lib editing required.
 * OCR fallback handles image-only / scanned PDFs via Tesseract.js.
 */

const EuaaPdfProcessor = (() => {

  const SCALE = 2.5;   // high-resolution render factor (exported so app.js can use it)

  // ── PDF header check ─────────────────────────────────────────────────────
  function findPdfOffset(bytes) {
    const limit = Math.min(bytes.length, 4096);
    for (let i = 0; i < limit - 4; i++) {
      if (bytes[i]===0x25&&bytes[i+1]===0x50&&bytes[i+2]===0x44&&bytes[i+3]===0x46&&bytes[i+4]===0x2D)
        return i;
    }
    return -1;
  }

  function validatePdf(fileName, bytes) {
    if (bytes.length === 0)
      throw new Error(`"${fileName}" is empty (0 bytes).`);
    const header = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(256, bytes.length)));
    if (/^\s*<!DOCTYPE|^\s*<html/i.test(header))
      throw new Error(`"${fileName}" is an HTML page, not a PDF.`);
    if (bytes[0]===0x50 && bytes[1]===0x4B)
      throw new Error(`"${fileName}" looks like a ZIP/DOCX archive, not a PDF.`);
    if (findPdfOffset(bytes) < 0)
      throw new Error(`"${fileName}" has no PDF header. The file may be corrupted.`);
  }

  // ── Load with PDF.js ─────────────────────────────────────────────────────
  async function loadPdf(fileName, bytes, onStatus) {
    validatePdf(fileName, bytes);
    const offset = findPdfOffset(bytes);
    let buf = offset > 0 ? bytes.slice(offset) : bytes;
    if (offset > 0 && onStatus) onStatus(`Trimming ${offset} leading bytes…`);

    for (const b of [buf, buf.slice(0)]) {
      try {
        const pdf = await pdfjsLib.getDocument({ data: b, verbosity: 0, stopAtErrors: false }).promise;
        return { pdf, buf: b };
      } catch (_) {}
    }
    throw new Error(`"${fileName}" — PDF.js could not parse this file. It may be encrypted or severely corrupted.`);
  }

  // ── Render page to canvas ─────────────────────────────────────────────────
  async function renderPage(pdfPage, scale) {
    const vp = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas, ctx, vp, scale };
  }

  // ── OCR ──────────────────────────────────────────────────────────────────
  async function runOcr(canvas, label, onStatus) {
    if (!window.Tesseract) throw new Error('Tesseract.js not loaded.');
    if (onStatus) onStatus(`OCR: ${label}…`);
    const r = await window.Tesseract.recognize(canvas, 'eng', { logger: () => {} });
    return r.data;
  }

  function hasMeaningfulText(text) {
    return (text || '').replace(/\s+/g, ' ').trim().length > 20;
  }

  // ── Build manual terms regex ──────────────────────────────────────────────
  function buildManualRegex(terms) {
    if (!terms || !terms.length) return null;
    const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(escaped.join('|'), 'gi');
  }

  // ── Draw black bar over a canvas region ──────────────────────────────────
  function blackBar(ctx, x, y, w, h, pad) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(
      Math.floor(x - pad),
      Math.floor(y - pad),
      Math.ceil(w  + pad * 2),
      Math.ceil(h  + pad * 2)
    );
  }

  // ── Clone a canvas ────────────────────────────────────────────────────────
  function cloneCanvas(src) {
    const dst = document.createElement('canvas');
    dst.width  = src.width;
    dst.height = src.height;
    dst.getContext('2d').drawImage(src, 0, 0);
    return dst;
  }

  // ── Main public function ──────────────────────────────────────────────────
  /**
   * @param {File}     file       PDF file object
   * @param {Set}      active     Active NER categories
   * @param {boolean}  useOcr     Enable OCR fallback
   * @param {number}   padding    Extra px around each bar (0–20)
   * @param {string[]} manTerms   Manual strings to black out
   * @param {Function} onStatus   Progress callback(msg, pct 0-100)
   * @returns {Promise<{sourceName, error, barCount, canvases, downloads}>}
   */
  async function process(file, active, useOcr, padding, manTerms, onStatus) {
    if (onStatus) onStatus(`Loading "${file.name}"…`, 0);

    const buffer = await file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    const { pdf } = await loadPdf(file.name, bytes, onStatus);

    const { jsPDF } = window.jspdf;
    const manRx   = buildManualRegex(manTerms);
    const pad     = Math.max(0, padding) * SCALE;

    let doc        = null;
    let totalBars  = 0;
    const canvases = [];   // store rendered+redacted canvases for manual review

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
      const pageNum = pageIndex + 1;
      const pct     = Math.round((pageIndex / pdf.numPages) * 90);   // 0–90%, leave 10% for encoding
      if (onStatus) onStatus(`Redacting page ${pageNum}/${pdf.numPages} of "${file.name}"…`, pct);

      const pdfPage = await pdf.getPage(pageNum);
      const { canvas, ctx, vp } = await renderPage(pdfPage, SCALE);

      // ── Process text items ──────────────────────────────────────────────
      const content = await pdfPage.getTextContent();
      let pageHasText = false;

      for (const item of content.items) {
        const str = (item.str || '').trim();
        if (!str) continue;
        pageHasText = true;

        // Check NER + manual
        const entities = active.size ? EuaaAnonymizer.detectEntities(str, 'demo-safe', active) : [];
        let   needsBar = entities.length > 0;

        if (!needsBar && manRx) {
          manRx.lastIndex = 0;
          needsBar = manRx.test(str);
          manRx.lastIndex = 0;
        }

        if (!needsBar) continue;

        // Convert PDF.js item transform to canvas pixel coords
        const t  = pdfjsLib.Util.transform(vp.transform, item.transform);
        const cx = t[4] * SCALE;
        const cy = t[5] * SCALE;
        const cw = Math.max((item.width  || str.length * 6) * SCALE, 20);
        const ch = Math.max((item.height || Math.abs(t[3]) || 10) * SCALE, 10);

        blackBar(ctx, cx, cy - ch, cw, ch, pad);
        totalBars++;
      }

      // ── OCR fallback for image-only pages ───────────────────────────────
      if (!pageHasText && useOcr) {
        if (onStatus) onStatus(`OCR scanning page ${pageNum}/${pdf.numPages}…`, pct);
        const ocrData = await runOcr(canvas, `page ${pageNum}`, onStatus);

        if (hasMeaningfulText(ocrData.text || '')) {
          for (const word of (ocrData.words || [])) {
            const wt = (word.text || '').trim();
            if (!wt) continue;

            const entities = active.size ? EuaaAnonymizer.detectEntities(wt, 'demo-safe', active) : [];
            let   needsBar = entities.length > 0;
            if (!needsBar && manRx) { manRx.lastIndex = 0; needsBar = manRx.test(wt); manRx.lastIndex = 0; }
            if (!needsBar) continue;

            const b  = word.bbox || {};
            const wx = (b.x0 || 0) * SCALE;
            const wy = (b.y0 || 0) * SCALE;
            const ww = ((b.x1 || 0) - (b.x0 || 0)) * SCALE;
            const wh = ((b.y1 || 0) - (b.y0 || 0)) * SCALE;
            blackBar(ctx, wx, wy, ww, wh, pad);
            totalBars++;
          }
        }
      }

      // Store canvas for manual review (clone so jsPDF encoding doesn't affect it)
      canvases.push(cloneCanvas(canvas));

      // ── Add canvas page to PDF ──────────────────────────────────────────
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

    if (onStatus) onStatus('Encoding PDF…', 95);
    if (!doc) throw new Error(`"${file.name}" — no pages processed.`);

    const outBuf  = doc.output('arraybuffer');
    const outName = file.name.replace(/\.pdf$/i, '') + '_REDACTED.pdf';

    if (onStatus) onStatus(`Done: "${file.name}"`, 100);

    return {
      sourceName: file.name,
      error:      false,
      barCount:   totalBars,
      canvases,                          // ← needed by manual review modal
      downloads: [{
        filename: outName,
        blob:     new Blob([outBuf], { type: 'application/pdf' }),
        label:    '⬛ Download redacted PDF',
      }],
    };
  }

  return { process, SCALE };

})();

window.EuaaPdfProcessor = EuaaPdfProcessor;
