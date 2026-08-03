/**
 * EUAA Monitoring Anonymiser — PDF Processor v12
 * ===============================================
 * BLACK-BAR REDACTION: renders each PDF page to canvas, draws black
 * rectangles over detected text, then saves as a new PDF image-based document.
 * This approach works on ALL PDFs regardless of PDF-lib compatibility.
 *
 * REBUILD MODE: extracts text, anonymises, writes new text PDF.
 *
 * Both modes also redact any Refcom numbers supplied manually in the UI.
 */

const EuaaPdfProcessor = (() => {

  // ── PDF header detection ─────────────────────────────────────────────────
  function findPdfHeaderOffset(bytes) {
    const limit = Math.min(bytes.length, 4096);
    for (let i = 0; i < limit - 4; i++) {
      if (bytes[i]===0x25 && bytes[i+1]===0x50 && bytes[i+2]===0x44 && bytes[i+3]===0x46 && bytes[i+4]===0x2D)
        return i;
    }
    return -1;
  }

  function inspectPdfBytes(bytes) {
    const offset = findPdfHeaderOffset(bytes);
    const header = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(512, bytes.length)));
    return {
      size: bytes.length, offset,
      hasPdfHeader:  offset >= 0,
      looksLikeHtml: /^\s*<!DOCTYPE|^\s*<html/i.test(header),
      looksLikeZip:  bytes[0] === 0x50 && bytes[1] === 0x4B,
    };
  }

  function buildPdfValidationError(fileName, info) {
    if (info.size === 0)
      return `"${fileName}" is empty (0 bytes). Please upload the original PDF.`;
    if (info.looksLikeHtml)
      return `"${fileName}" is an HTML page, not a PDF. Save the actual document with File → Save As → PDF.`;
    if (info.looksLikeZip)
      return `"${fileName}" looks like a ZIP/DOCX archive, not a PDF.`;
    if (!info.hasPdfHeader)
      return `"${fileName}" has no valid PDF header. The file may be corrupted or partially downloaded.`;
    return null;
  }

  // ── Load with PDF.js ─────────────────────────────────────────────────────
  async function loadWithPdfJs(fileName, bytes, onStatus) {
    const info = inspectPdfBytes(bytes);
    const err  = buildPdfValidationError(fileName, info);
    if (err) throw new Error(err);

    let usableBytes = info.offset > 0 ? bytes.slice(info.offset) : bytes;
    if (info.offset > 0 && onStatus)
      onStatus(`Trimming ${info.offset} wrapper bytes…`);

    for (const buf of [usableBytes, usableBytes.slice(0)]) {
      try {
        const pdf = await pdfjsLib.getDocument({ data: buf, verbosity: 0, stopAtErrors: false }).promise;
        return { pdf, usableBytes: buf };
      } catch (_) {}
    }
    throw new Error(`"${fileName}" — PDF.js could not parse this file. It may be encrypted or corrupted.`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function hasMeaningfulText(text) {
    return (text || '').replace(/\s+/g, ' ').trim().length > 30;
  }

  async function pageToCanvas(pdfPage, scale) {
    scale = scale || 2.0;
    const vp = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await pdfPage.render({
      canvasContext: canvas.getContext('2d', { willReadFrequently: true }),
      viewport: vp
    }).promise;
    return { canvas, viewport: vp, scale };
  }

  async function runOcr(canvas, label, onStatus) {
    if (!window.Tesseract) throw new Error('Tesseract.js not loaded yet.');
    if (onStatus) onStatus(`OCR: ${label}…`);
    const r = await window.Tesseract.recognize(canvas, 'eng', { logger: () => {} });
    return r.data;
  }

  // ── Get manual Refcom numbers from the UI input ──────────────────────────
  function getManualRefcoms() {
    const el = document.getElementById('manualRefcoms');
    if (!el || !el.value.trim()) return [];
    return el.value
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // Build a combined regex that matches any of the manual strings (exact, case-insensitive)
  function buildManualRegex(refcoms) {
    if (!refcoms.length) return null;
    const escaped = refcoms.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(escaped.join('|'), 'gi');
  }

  // ── Mode 1: Canvas-based black-bar redaction ─────────────────────────────
  // Renders every page to a high-res canvas, draws black rectangles over
  // detected text items, then encodes each page as a JPEG inside a new PDF.
  // Works on ALL PDFs — no PDF-lib editing required.
  async function applyBlackoutCanvas(pdf, fileName, level, active, useOcr, onStatus) {
    const { jsPDF } = window.jspdf;
    const manualRefcoms = getManualRefcoms();
    const manualRx      = buildManualRegex(manualRefcoms);

    const allReplacements = [];
    const pageTexts = [];
    let doc = null; // jsPDF document

    const SCALE = 2.0; // render resolution (2× = 144dpi)

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
      const pageNum = pageIndex + 1;
      if (onStatus) onStatus(`Redacting page ${pageNum}/${pdf.numPages} of "${fileName}"…`);

      const pdfJsPage = await pdf.getPage(pageNum);
      const { canvas, viewport, scale } = await pageToCanvas(pdfJsPage, SCALE);
      const ctx = canvas.getContext('2d');

      // Get text items with positions
      const content = await pdfJsPage.getTextContent();
      const pageText = [];

      for (const item of content.items) {
        const str = (item.str || '').trim();
        if (!str) continue;
        pageText.push(str);

        // Detect entities from NER engine
        const entities = EuaaAnonymizer.detectEntities(str, level, active);

        // Also check manual Refcom matches
        let hasManual = false;
        if (manualRx) {
          manualRx.lastIndex = 0;
          hasManual = manualRx.test(str);
          manualRx.lastIndex = 0;
        }

        if (!entities.length && !hasManual) continue;

        // Convert PDF.js transform → canvas pixel coordinates
        const t = pdfjsLib.Util.transform(viewport.transform, item.transform);
        // t[4] = x, t[5] = y (both in viewport/CSS pixels)
        // Multiply by scale to get canvas pixels
        const cx = t[4] * scale;
        const cy = t[5] * scale;
        const cw = Math.max((item.width  || str.length * 5.5) * scale, 10);
        const ch = Math.max((item.height || Math.abs(t[3])    || 10)  * scale, 10);

        // Draw black rectangle (add small padding)
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - 2, cy - ch - 2, cw + 4, ch + 6);

        for (const e of entities) {
          EuaaAnonymizer.makePlaceholder(e.text, e.cat);
          allReplacements.push({ ...e, replacement: '█ REDACTED' });
        }
        if (hasManual) {
          allReplacements.push({ text: str, cat: 'REFCOM', replacement: '█ REDACTED (manual)' });
        }
      }

      // OCR fallback for image-only pages
      if (!hasMeaningfulText(pageText.join(' ')) && useOcr) {
        const ocrData = await runOcr(canvas, `page ${pageNum}`, onStatus);
        pageText.push((ocrData.text || '').trim());

        for (const word of (ocrData.words || [])) {
          const wordText = (word.text || '').trim();
          if (!wordText) continue;
          const entities = EuaaAnonymizer.detectEntities(wordText, level, active);
          let hasManual = false;
          if (manualRx) { manualRx.lastIndex = 0; hasManual = manualRx.test(wordText); manualRx.lastIndex = 0; }
          if (!entities.length && !hasManual) continue;

          const b = word.bbox || {};
          ctx.fillStyle = '#000000';
          ctx.fillRect(b.x0 * scale, b.y0 * scale, (b.x1 - b.x0) * scale, (b.y1 - b.y0) * scale);
          for (const e of entities) {
            EuaaAnonymizer.makePlaceholder(e.text, e.cat);
            allReplacements.push({ ...e, replacement: '█ REDACTED (OCR)' });
          }
        }
      }

      pageTexts.push(pageText.join(' '));

      // Add page to jsPDF
      // Convert canvas to JPEG data URL
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      // Page dimensions in mm (jsPDF uses mm by default)
      const pxToMm = 25.4 / 96; // 96dpi → mm
      const mmW = (canvas.width  / SCALE) * pxToMm;
      const mmH = (canvas.height / SCALE) * pxToMm;

      if (!doc) {
        doc = new jsPDF({
          orientation: mmW > mmH ? 'l' : 'p',
          unit: 'mm',
          format: [mmW, mmH],
          compress: true,
        });
      } else {
        doc.addPage([mmW, mmH], mmW > mmH ? 'l' : 'p');
      }

      doc.addImage(imgData, 'JPEG', 0, 0, mmW, mmH);
    }

    if (!doc) throw new Error(`"${fileName}" — no pages could be processed.`);

    const outputBuffer = doc.output('arraybuffer');
    return { pageTexts, allReplacements, outputBuffer };
  }

  // ── Mode 2: Rebuild as text PDF ──────────────────────────────────────────
  async function extractAllText(pdf, fileName, useOcr, onStatus) {
    const pages = [];
    let usedOcr = false;
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onStatus) onStatus(`Extracting page ${i}/${pdf.numPages}…`);
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = content.items.map(it => it.str).join(' ').trim();
      if (!hasMeaningfulText(text) && useOcr) {
        const { canvas } = await pageToCanvas(page);
        const ocr = await runOcr(canvas, `page ${i}`, onStatus);
        text = (ocr.text || '').trim();
        usedOcr = true;
      }
      pages.push(text);
    }
    return { pages, usedOcr };
  }

  function rebuildAsPdf(title, text) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const mL = 50, mR = 50, mT = 60, lH = 14;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(title, mL, mT);
    let y = mT + 22;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    for (const para of text.split(/\n\n+/)) {
      for (const line of doc.splitTextToSize(para.replace(/\n/g,' '), pageW - mL - mR)) {
        if (y + lH > pageH - 40) { doc.addPage(); y = mT; }
        doc.text(line, mL, y); y += lH;
      }
      y += lH * 0.5;
    }
    return doc.output('arraybuffer');
  }

  async function buildDocxBlob(title, text) {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = window.docx;
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: '' }),
      ...text.split(/\n+/).map(l => new Paragraph({ children: [new TextRun({ text: l || ' ', size: 22 })] })),
    ]}]});
    return Packer.toBlob(doc);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function process(file, mode, level, active, useOcr, onStatus) {
    if (onStatus) onStatus(`Reading "${file.name}"…`);
    const buffer = await file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    const { pdf, usableBytes } = await loadWithPdfJs(file.name, bytes, onStatus);

    // ── BLACKOUT: canvas-render approach — works on ALL PDFs ─────────────
    if (mode === 'blackout') {
      const { pageTexts, allReplacements, outputBuffer } =
        await applyBlackoutCanvas(pdf, file.name, level, active, useOcr, onStatus);
      return {
        mode: 'blackout',
        previewText: pageTexts.join('\n\n'),
        replacements: allReplacements,
        downloads: [{
          filename: file.name.replace(/\.pdf$/i, '') + '_REDACTED.pdf',
          blob:     new Blob([outputBuffer], { type: 'application/pdf' }),
          mimeType: 'application/pdf',
          dlClass:  'dl-pdf',
          label:    '⬛ Redacted PDF',
        }],
      };
    }

    // ── REBUILD ──────────────────────────────────────────────────────────
    const { pages, usedOcr } = await extractAllText(pdf, file.name, useOcr, onStatus);
    const fullText = pages.join('\n\n');
    if (!hasMeaningfulText(fullText))
      throw new Error(`"${file.name}" — no readable text found. ${useOcr ? 'OCR returned no usable text.' : 'Try enabling OCR fallback.'}`);

    if (onStatus) onStatus(`Anonymising "${file.name}"…`);
    const { text: anonText, replacements } = EuaaAnonymizer.anonymizeText(fullText, level, active);
    const baseName = file.name.replace(/\.pdf$/i, '');
    const title    = `${file.name} (anonymised)`;

    return {
      mode: usedOcr ? 'rebuild-ocr' : 'rebuild',
      previewText: anonText,
      replacements,
      downloads: [
        {
          filename: `${baseName}_anonymised.pdf`,
          blob:     new Blob([rebuildAsPdf(title, anonText)], { type: 'application/pdf' }),
          mimeType: 'application/pdf',
          dlClass:  'dl-pdf',
          label:    '📄 Anonymised PDF',
        },
        {
          filename: `${baseName}_anonymised.docx`,
          blob:     await buildDocxBlob(title, anonText),
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dlClass:  'dl-docx',
          label:    '📝 Anonymised DOCX',
        },
      ],
    };
  }

  return { process };
})();

window.EuaaPdfProcessor = EuaaPdfProcessor;
