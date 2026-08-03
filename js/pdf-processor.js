/**
 * EUAA Monitoring Anonymiser — PDF Processor
 * ===========================================
 * Handles two modes:
 *   1. blackout  — draw black rectangles over sensitive text items
 *   2. rebuild   — extract text, anonymise, write new PDF
 *
 * Uses pdf.js (v3) for text extraction and PDF-lib for editing/writing.
 * All processing is client-side; nothing is uploaded.
 *
 * Robustness:
 *  - Tolerates PDFs with BOM / wrapper bytes before %PDF-
 *  - PDF-lib tried with 6 option combinations before giving up
 *  - If PDF-lib fails entirely, silently falls back to rebuild mode
 *  - OCR fallback via Tesseract for image-only pages
 */

const EuaaPdfProcessor = (() => {

  // ── PDF header detection ─────────────────────────────────────────────────
  function findPdfHeaderOffset(bytes) {
    const searchWindow = Math.min(bytes.length, 4096);
    for (let i = 0; i < searchWindow - 4; i++) {
      if (bytes[i]   === 0x25   // %
       && bytes[i+1] === 0x50   // P
       && bytes[i+2] === 0x44   // D
       && bytes[i+3] === 0x46   // F
       && bytes[i+4] === 0x2D   // -
      ) return i;
    }
    return -1;
  }

  function inspectPdfBytes(bytes) {
    const offset = findPdfHeaderOffset(bytes);
    const header = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(512, bytes.length)));
    return {
      size: bytes.length,
      offset,
      hasPdfHeader: offset >= 0,
      looksLikeHtml: /^\s*<!DOCTYPE|^\s*<html/i.test(header),
      looksLikeZip:  bytes[0] === 0x50 && bytes[1] === 0x4B,
    };
  }

  function buildPdfValidationError(fileName, info) {
    if (info.size === 0)
      return `"${fileName}" is empty (0 bytes). Please upload the original PDF file.`;
    if (info.looksLikeHtml)
      return `"${fileName}" is an HTML page, not a PDF. You may have saved a download page instead of the actual document. Open the PDF in a viewer and use File → Save As → PDF.`;
    if (info.looksLikeZip)
      return `"${fileName}" looks like a ZIP or DOCX archive, not a PDF. Check the file extension.`;
    if (!info.hasPdfHeader)
      return `"${fileName}" has no valid PDF header. The file may be corrupted or only partially downloaded. Try opening it in a PDF viewer and re-saving with File → Save As → PDF.`;
    return null;
  }

  // ── Load with PDF.js (tolerates leading junk before %PDF-) ──────────────
  async function loadWithPdfJs(fileName, bytes, onStatus) {
    const info = inspectPdfBytes(bytes);
    const validationError = buildPdfValidationError(fileName, info);
    if (validationError) throw new Error(validationError);

    let usableBytes = bytes;
    if (info.offset > 0) {
      if (onStatus) onStatus(`Trimming ${info.offset} wrapper bytes before PDF header…`);
      usableBytes = bytes.slice(info.offset);
    }

    // First attempt
    try {
      const pdf = await pdfjsLib.getDocument({ data: usableBytes, verbosity: 0, stopAtErrors: false }).promise;
      return { pdf, usableBytes };
    } catch (_) {}

    // Second attempt with a fresh copy (handles ArrayBuffer detachment)
    try {
      const copy = usableBytes.slice(0);
      const pdf = await pdfjsLib.getDocument({ data: copy, verbosity: 0, stopAtErrors: false }).promise;
      return { pdf, usableBytes: copy };
    } catch (err2) {
      const msg = String(err2?.message || err2);
      throw new Error(`"${fileName}" — PDF.js could not parse this file: ${msg}. The file may be encrypted, corrupted, or in a non-standard format.`);
    }
  }

  // ── Try to load with PDF-lib (needed for blackout mode) ──────────────────
  // PDF-lib is stricter than PDF.js. We try 6 combinations (2 byte variants
  // × 3 option sets). If all fail we return null and caller falls back to rebuild.
  async function tryLoadPdfLib(usableBytes, rawBytes) {
    const buffers = [usableBytes, rawBytes];
    const optSets = [
      { ignoreEncryption: true,  updateMetadata: false },
      { ignoreEncryption: true,  updateMetadata: false, throwOnInvalidObject: false },
      { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: false },
    ];
    for (const buf of buffers) {
      for (const opts of optSets) {
        try {
          const doc = await PDFLib.PDFDocument.load(buf, opts);
          return doc; // success
        } catch (_) { /* try next combination */ }
      }
    }
    return null; // all 6 attempts failed
  }

  // ── OCR helpers ──────────────────────────────────────────────────────────
  async function pageToCanvas(pdfPage, scale = 2.0) {
    const vp = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await pdfPage.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true }), viewport: vp }).promise;
    return { canvas, viewport: vp };
  }

  async function runOcr(canvas, pageLabel, onStatus) {
    if (!window.Tesseract) throw new Error('OCR library (Tesseract.js) has not loaded yet. Please wait and try again.');
    if (onStatus) onStatus(`OCR scanning ${pageLabel}…`);
    const result = await window.Tesseract.recognize(canvas, 'eng', { logger: () => {} });
    return result.data;
  }

  function hasMeaningfulText(text) {
    return (text || '').replace(/\s+/g, ' ').trim().length > 30;
  }

  // ── Extract text from all pages ──────────────────────────────────────────
  async function extractAllText(pdf, fileName, useOcr, onStatus) {
    const pages = [];
    let usedOcr = false;
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onStatus) onStatus(`Extracting text from page ${i}/${pdf.numPages}…`);
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = content.items.map(item => item.str).join(' ').trim();
      if (!hasMeaningfulText(text) && useOcr) {
        const { canvas } = await pageToCanvas(page);
        const ocr = await runOcr(canvas, `page ${i} of "${fileName}"`, onStatus);
        text = (ocr.text || '').trim();
        usedOcr = true;
      }
      pages.push(text);
    }
    return { pages, usedOcr };
  }

  // ── Mode 1: Black-bar redaction ──────────────────────────────────────────
  async function applyBlackout(pdf, usableBytes, pdfLibDoc, level, active, useOcr, onStatus) {
    const pages = [];
    const allReplacements = [];

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
      const pageNum    = pageIndex + 1;
      if (onStatus) onStatus(`Redacting page ${pageNum}/${pdf.numPages}…`);
      const pdfJsPage  = await pdf.getPage(pageNum);
      const viewport   = pdfJsPage.getViewport({ scale: 1 });
      const content    = await pdfJsPage.getTextContent();
      const pdfLibPage = pdfLibDoc.getPage(pageIndex);
      const pageH      = pdfLibPage.getHeight();
      const pagePreview = [];
      let hadMatches = false;

      for (const item of content.items) {
        const str = (item.str || '').trim();
        if (!str) continue;
        pagePreview.push(str);
        const entities = EuaaAnonymizer.detectEntities(str, level, active);
        if (!entities.length) continue;
        hadMatches = true;

        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const itemX = transform[4];
        const itemY = transform[5];
        const itemH = Math.max(item.height || Math.abs(transform[3]) || 10, 10);
        const itemW = Math.max(item.width  || str.length * 5.5, 10);
        const pdfY  = pageH - itemY;

        pdfLibPage.drawRectangle({
          x: itemX - 1, y: pdfY - itemH - 1,
          width: itemW + 2, height: itemH + 2,
          color: PDFLib.rgb(0, 0, 0), opacity: 1,
        });

        for (const e of entities) {
          EuaaAnonymizer.makePlaceholder(e.text, e.cat);
          allReplacements.push({ ...e, replacement: 'BLACK BAR REDACTION' });
        }
      }

      // OCR fallback for image-only pages
      if (!hadMatches && useOcr && !hasMeaningfulText(pagePreview.join(' '))) {
        const { canvas } = await pageToCanvas(pdfJsPage);
        const ocrData = await runOcr(canvas, `page ${pageNum}`, onStatus);
        pagePreview.push((ocrData.text || '').trim());
        const pageW  = pdfLibPage.getWidth();
        const scaleX = pageW  / canvas.width;
        const scaleY = pageH  / canvas.height;

        for (const line of (ocrData.lines || [])) {
          const lineText = (line.text || '').trim();
          if (!lineText) continue;
          const entities = EuaaAnonymizer.detectEntities(lineText, level, active);
          if (!entities.length) continue;
          const box = line.bbox || {};
          const lx  = (box.x0 || 0) * scaleX;
          const lh  = Math.max(((box.y1 || 0) - (box.y0 || 0)) * scaleY, 10);
          const lw  = Math.max(((box.x1 || 0) - (box.x0 || 0)) * scaleX, 10);
          const ly  = pageH - ((box.y1 || 0) * scaleY);
          pdfLibPage.drawRectangle({ x: lx, y: ly, width: lw, height: lh, color: PDFLib.rgb(0, 0, 0), opacity: 1 });
          for (const e of entities) {
            EuaaAnonymizer.makePlaceholder(e.text, e.cat);
            allReplacements.push({ ...e, replacement: 'BLACK BAR REDACTION (OCR)' });
          }
        }
      }
      pages.push(pagePreview.join(' '));
    }

    const outputBytes = await pdfLibDoc.save({ useObjectStreams: false });
    return { pages, allReplacements, outputBytes };
  }

  // ── Mode 2: Rebuild as new PDF ───────────────────────────────────────────
  function rebuildAsPdf(title, text) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const marginL = 50, marginR = 50, marginT = 60, lineH = 14;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const textW = pageW - marginL - marginR;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, marginL, marginT);
    let y = marginT + 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const para of text.split(/\n\n+/)) {
      const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), textW);
      for (const line of lines) {
        if (y + lineH > pageH - 40) { doc.addPage(); y = marginT; }
        doc.text(line, marginL, y);
        y += lineH;
      }
      y += lineH * 0.5;
    }
    return doc.output('arraybuffer');
  }

  // ── DOCX builder ─────────────────────────────────────────────────────────
  async function buildDocxBlob(title, text) {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = window.docx;
    const paragraphs = [
      new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: '' }),
      ...text.split(/\n+/).map(line =>
        new Paragraph({ children: [new TextRun({ text: line || ' ', size: 22 })] })
      ),
    ];
    const doc = new Document({ sections: [{ children: paragraphs }] });
    return Packer.toBlob(doc);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function process(file, mode, level, active, useOcr, onStatus) {
    if (onStatus) onStatus(`Reading "${file.name}"…`);

    const buffer = await file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);

    // PDF.js load (tolerates leading bytes before %PDF-)
    const { pdf, usableBytes } = await loadWithPdfJs(file.name, bytes, onStatus);

    // ── Blackout mode ─────────────────────────────────────────────────────
    if (mode === 'blackout') {
      if (onStatus) onStatus(`Opening "${file.name}" for redaction…`);

      // Try PDF-lib with 6 combinations; null = all failed
      const pdfLibDoc = await tryLoadPdfLib(usableBytes, bytes);

      if (!pdfLibDoc) {
        // PDF-lib cannot edit this file — fall back to rebuild silently
        if (onStatus) onStatus(`"${file.name}": black-bar redaction not possible for this PDF format — switching to rebuild mode…`);
        mode = 'rebuild';
      } else {
        const { pages, allReplacements, outputBytes } =
          await applyBlackout(pdf, usableBytes, pdfLibDoc, level, active, useOcr, onStatus);
        return {
          mode: 'blackout',
          previewText: pages.join('\n\n'),
          replacements: allReplacements,
          downloads: [{
            filename: file.name.replace(/\.pdf$/i, '') + '_REDACTED.pdf',
            blob:     new Blob([outputBytes], { type: 'application/pdf' }),
            mimeType: 'application/pdf',
            dlClass:  'dl-pdf',
            label:    '⬛ Redacted PDF',
          }],
        };
      }
    }

    // ── Rebuild mode (user choice OR fallback from failed blackout) ───────
    const { pages, usedOcr } = await extractAllText(pdf, file.name, useOcr, onStatus);
    const fullText = pages.join('\n\n');

    if (!hasMeaningfulText(fullText)) {
      throw new Error(
        `"${file.name}" — no readable text found. ` +
        (useOcr
          ? 'OCR was attempted but returned no usable text. The scan may be too low-resolution or the file may be corrupted.'
          : 'Try enabling OCR fallback for scanned PDFs.')
      );
    }

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
