/**
 * EUAA Monitoring Anonymiser — PDF Processor
 * ===========================================
 * Handles three modes:
 *   1. blackout  — draw black rectangles over sensitive text items
 *   2. rebuild   — extract text, anonymise, write new PDF
 *
 * Uses pdf.js (v3) for text extraction and PDF-lib for editing/writing.
 * All processing is client-side; nothing is uploaded.
 *
 * Key robustness improvements:
 *  - Tolerates PDFs with BOM / wrapper bytes before %PDF-
 *  - Provides a meaningful error message for each failure mode
 *  - OCR fallback via Tesseract for image-only pages
 */

const EuaaPdfProcessor = (() => {

  // ── PDF header detection ────────────────────────────────────────────────
  function findPdfHeaderOffset(bytes) {
    // Search within the first 4 KB for %PDF-
    const searchWindow = Math.min(bytes.length, 4096);
    for (let i = 0; i < searchWindow - 4; i++) {
      if (bytes[i] === 0x25   // %
       && bytes[i+1] === 0x50 // P
       && bytes[i+2] === 0x44 // D
       && bytes[i+3] === 0x46 // F
       && bytes[i+4] === 0x2D // -
      ) {
        return i;
      }
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
      looksLikeZip: bytes[0] === 0x50 && bytes[1] === 0x4B,
      preview: header.slice(0, 200),
    };
  }

  function buildPdfValidationError(fileName, info) {
    if (info.size === 0)
      return `"${fileName}" is empty. Please upload the original PDF.`;
    if (info.looksLikeHtml)
      return `"${fileName}" is an HTML page, not a PDF. You may have saved a download page instead of the actual PDF file. Open the PDF in a viewer, then use File → Save As to save a real PDF.`;
    if (info.looksLikeZip)
      return `"${fileName}" appears to be a ZIP/DOCX archive, not a PDF. Make sure the file extension is correct.`;
    if (!info.hasPdfHeader)
      return `"${fileName}" does not contain a valid PDF header. The file may be corrupted, partially downloaded, or saved via a non-standard export. Try opening it in a PDF viewer and using File → Save As PDF.`;
    return null;
  }

  /**
   * Load PDF bytes into PDF.js, tolerating leading junk before %PDF-.
   */
  async function loadWithPdfJs(fileName, bytes, onStatus) {
    const info = inspectPdfBytes(bytes);
    const validationError = buildPdfValidationError(fileName, info);
    if (validationError) throw new Error(validationError);

    // If there are leading bytes before %PDF-, slice them off
    let usableBytes = bytes;
    if (info.offset > 0) {
      if (onStatus) onStatus(`Trimming ${info.offset} wrapper bytes before PDF header…`);
      usableBytes = bytes.slice(info.offset);
    }

    try {
      const task = pdfjsLib.getDocument({
        data: usableBytes,
        verbosity: 0,
        // Allow damaged / cross-reference-table issues
        stopAtErrors: false,
      });
      const pdf = await task.promise;
      return { pdf, usableBytes, offset: info.offset };
    } catch (err) {
      // Try once more with a full copy (handles some ArrayBuffer detachment issues)
      try {
        const copy = usableBytes.slice(0);
        const pdf = await pdfjsLib.getDocument({ data: copy, verbosity: 0, stopAtErrors: false }).promise;
        return { pdf, usableBytes: copy, offset: info.offset };
      } catch (err2) {
        const msg = String(err2?.message || err2);
        if (msg.includes('No PDF header')) {
          throw new Error(`"${fileName}" — PDF header not found by parser. The file may have been exported incorrectly. Re-save from a PDF viewer using File → Save As PDF, then upload again.`);
        }
        throw new Error(`"${fileName}" — PDF parse error: ${msg}. The file may be encrypted, corrupted, or in a non-standard format.`);
      }
    }
  }

  // ── OCR helpers ──────────────────────────────────────────────────────────
  async function pageToCanvas(pdfPage, scale = 2.0) {
    const vp = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas, viewport: vp };
  }

  async function runOcr(canvas, pageLabel, onStatus) {
    if (!window.Tesseract) throw new Error('OCR library (Tesseract.js) has not loaded yet. Please wait and try again.');
    if (onStatus) onStatus(`OCR scanning ${pageLabel}…`);
    const result = await window.Tesseract.recognize(canvas, 'eng', {
      logger: () => {},  // silence verbose logs
    });
    return result.data;
  }

  function hasMeaningfulText(text) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t.length > 30;
  }

  // ── Extract text from all pages ──────────────────────────────────────────
  async function extractAllText(pdf, fileName, useOcr, onStatus) {
    const pages = [];
    let usedOcr = false;

    for (let i = 1; i <= pdf.numPages; i++) {
      if (onStatus) onStatus(`Extracting text from page ${i}/${pdf.numPages}…`);
      const page = await pdf.getPage(i);
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
  /**
   * Draws black rectangles over all text items that contain detected entities.
   * Returns the modified PDF as a Uint8Array.
   */
  async function applyBlackout(pdf, usableBytes, pdfLibDoc, level, active, useOcr, onStatus) {
    const pages = [];
    const allReplacements = [];

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
      const pageNum = pageIndex + 1;
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

        // Compute item position on the PDF-lib coordinate system
        // PDF.js gives transform [a,b,c,d,e,f], where e=x, f=y from bottom-left in pdf.js viewport
        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const itemX = transform[4];
        const itemY = transform[5];  // Y from top in viewport coords
        const itemH = Math.max(item.height || Math.abs(transform[3]) || 10, 10);
        const itemW = Math.max(item.width  || str.length * 5.5, 10);

        // Convert to PDF-lib coords (origin bottom-left)
        const pdfY = pageH - itemY;

        pdfLibPage.drawRectangle({
          x: itemX - 1,
          y: pdfY - itemH - 1,
          width:  itemW + 2,
          height: itemH + 2,
          color: PDFLib.rgb(0, 0, 0),
          opacity: 1,
        });

        for (const e of entities) {
          EuaaAnonymizer.makePlaceholder(e.text, e.cat); // register in entity map
          allReplacements.push({ ...e, replacement: 'BLACK BAR REDACTION' });
        }
      }

      // OCR fallback for image pages
      if (!hadMatches && useOcr && !hasMeaningfulText(pagePreview.join(' '))) {
        const { canvas } = await pageToCanvas(pdfJsPage);
        const ocrData = await runOcr(canvas, `page ${pageNum}`, onStatus);
        pagePreview.push((ocrData.text || '').trim());

        const pageW = pdfLibPage.getWidth();
        const scaleX = pageW / canvas.width;
        const scaleY = pageH / canvas.height;

        for (const line of (ocrData.lines || [])) {
          const lineText = (line.text || '').trim();
          if (!lineText) continue;
          const entities = EuaaAnonymizer.detectEntities(lineText, level, active);
          if (!entities.length) continue;

          const box = line.bbox || {};
          const lx = (box.x0 || 0) * scaleX;
          const lh = Math.max(((box.y1 || 0) - (box.y0 || 0)) * scaleY, 10);
          const lw = Math.max(((box.x1 || 0) - (box.x0 || 0)) * scaleX, 10);
          const ly = pageH - ((box.y1 || 0) * scaleY);

          pdfLibPage.drawRectangle({
            x: lx, y: ly, width: lw, height: lh,
            color: PDFLib.rgb(0, 0, 0), opacity: 1,
          });

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

    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), textW);
      for (const line of lines) {
        if (y + lineH > pageH - 40) {
          doc.addPage();
          y = marginT;
        }
        doc.text(line, marginL, y);
        y += lineH;
      }
      y += lineH * 0.5; // paragraph gap
    }

    return doc.output('arraybuffer');
  }

  // ── Public API ────────────────────────────────────────────────────────────
  /**
   * Process a PDF file.
   * @param {File}     file       - The File object
   * @param {string}   mode       - 'blackout' | 'rebuild'
   * @param {string}   level      - 'light' | 'standard' | 'demo-safe'
   * @param {Set}      active     - set of active category strings
   * @param {boolean}  useOcr    - whether to use OCR fallback
   * @param {Function} onStatus  - progress callback (message string)
   * @returns {Promise<{
   *   mode: string,
   *   previewText: string,
   *   replacements: Array,
   *   downloads: Array<{filename, blob, mimeType, dlClass}>
   * }>}
   */
  async function process(file, mode, level, active, useOcr, onStatus) {
    if (onStatus) onStatus(`Reading "${file.name}"…`);

    // Read file bytes
    const buffer = await file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);

    // Load with PDF.js (with header-offset tolerance)
    const { pdf, usableBytes } = await loadWithPdfJs(file.name, bytes, onStatus);

    if (mode === 'blackout') {
      // Load PDF-lib for editing
      let pdfLibDoc;
      try {
        pdfLibDoc = await PDFLib.PDFDocument.load(usableBytes, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
      } catch (e) {
        throw new Error(`"${file.name}" — could not open for editing (PDF-lib): ${e.message}`);
      }

      const { pages, allReplacements, outputBytes } =
        await applyBlackout(pdf, usableBytes, pdfLibDoc, level, active, useOcr, onStatus);

      return {
        mode: 'blackout',
        previewText: pages.join('\n\n'),
        replacements: allReplacements,
        downloads: [{
          filename: file.name.replace(/\.pdf$/i, '') + '_REDACTED.pdf',
          blob: new Blob([outputBytes], { type: 'application/pdf' }),
          mimeType: 'application/pdf',
          dlClass: 'dl-pdf',
          label: '⬛ Redacted PDF',
        }],
      };

    } else {
      // rebuild mode
      const { pages, usedOcr } = await extractAllText(pdf, file.name, useOcr, onStatus);
      const fullText = pages.join('\n\n');

      if (!hasMeaningfulText(fullText)) {
        throw new Error(
          `"${file.name}" — no readable text found. ` +
          (useOcr
            ? 'OCR was attempted but returned no usable text. The file may be a corrupted scan or image PDF.'
            : 'Enable OCR fallback to attempt scanning.')
        );
      }

      if (onStatus) onStatus(`Anonymising "${file.name}"…`);
      const { text: anonText, replacements } = EuaaAnonymizer.anonymizeText(fullText, level, active);
      const baseName = file.name.replace(/\.pdf$/i, '');
      const title    = `${file.name} (anonymised)`;

      // Build PDF output
      const pdfBytes = rebuildAsPdf(title, anonText);

      // Build DOCX output
      const docxBlob = await buildDocxBlob(title, anonText);

      return {
        mode: usedOcr ? 'rebuild-ocr' : 'rebuild',
        previewText: anonText,
        replacements,
        downloads: [
          {
            filename: `${baseName}_anonymised.pdf`,
            blob: new Blob([pdfBytes], { type: 'application/pdf' }),
            mimeType: 'application/pdf',
            dlClass: 'dl-pdf',
            label: '📄 Anonymised PDF',
          },
          {
            filename: `${baseName}_anonymised.docx`,
            blob: docxBlob,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            dlClass: 'dl-docx',
            label: '📝 Anonymised DOCX',
          },
        ],
      };
    }
  }

  // ── DOCX builder (shared with docx-processor) ───────────────────────────
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

  return { process };

})();

window.EuaaPdfProcessor = EuaaPdfProcessor;
