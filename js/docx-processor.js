/**
 * EUAA Monitoring Anonymiser — DOCX / TXT / XLSX Processor
 * ==========================================================
 * Handles Word documents, plain text files, and Excel spreadsheets.
 * All processing runs in the browser via Mammoth, docx.js and XLSX.js.
 */

const EuaaDocProcessor = (() => {

  // ── DOCX ─────────────────────────────────────────────────────────────────

  /**
   * Process a .docx file.
   * Uses Mammoth to extract styled HTML, then applies anonymisation,
   * and rebuilds output as both a Word .docx and a PDF.
   */
  async function processDocx(file, level, active, onStatus) {
    if (onStatus) onStatus(`Reading "${file.name}"…`);
    const buffer = await file.arrayBuffer();

    // Extract raw text via Mammoth
    let rawText = '';
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      rawText = result.value || '';
    } catch (err) {
      throw new Error(`"${file.name}" — could not read Word document: ${err.message}`);
    }

    if (!rawText.trim()) {
      throw new Error(`"${file.name}" — the document appears to be empty or unreadable.`);
    }

    if (onStatus) onStatus(`Anonymising "${file.name}"…`);
    const { text: anonText, replacements } = EuaaAnonymizer.anonymizeText(rawText, level, active);

    const baseName = file.name.replace(/\.docx$/i, '');
    const title    = `${file.name} (anonymised)`;

    const docxBlob = await buildDocxBlob(title, anonText);
    const pdfBlob  = buildPdfBlob(title, anonText);
    const txtBlob  = new Blob([anonText], { type: 'text/plain;charset=utf-8' });

    return {
      mode: 'docx',
      previewText: anonText,
      replacements,
      downloads: [
        {
          filename: `${baseName}_anonymised.docx`,
          blob: docxBlob,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dlClass: 'dl-docx',
          label: '📝 Anonymised DOCX',
        },
        {
          filename: `${baseName}_anonymised.pdf`,
          blob: pdfBlob,
          mimeType: 'application/pdf',
          dlClass: 'dl-pdf',
          label: '📄 Anonymised PDF',
        },
        {
          filename: `${baseName}_anonymised.txt`,
          blob: txtBlob,
          mimeType: 'text/plain',
          dlClass: 'dl-txt',
          label: '📃 Plain Text',
        },
      ],
    };
  }

  // ── TXT ──────────────────────────────────────────────────────────────────

  async function processTxt(file, level, active, onStatus) {
    if (onStatus) onStatus(`Reading "${file.name}"…`);
    let rawText = '';
    try {
      rawText = await file.text();
    } catch (err) {
      throw new Error(`"${file.name}" — could not read text file: ${err.message}`);
    }

    if (!rawText.trim()) {
      throw new Error(`"${file.name}" — the file appears to be empty.`);
    }

    if (onStatus) onStatus(`Anonymising "${file.name}"…`);
    const { text: anonText, replacements } = EuaaAnonymizer.anonymizeText(rawText, level, active);

    const baseName = file.name.replace(/\.txt$/i, '');
    const title    = `${file.name} (anonymised)`;

    const txtBlob  = new Blob([anonText], { type: 'text/plain;charset=utf-8' });
    const docxBlob = await buildDocxBlob(title, anonText);
    const pdfBlob  = buildPdfBlob(title, anonText);

    return {
      mode: 'txt',
      previewText: anonText,
      replacements,
      downloads: [
        {
          filename: `${baseName}_anonymised.txt`,
          blob: txtBlob,
          mimeType: 'text/plain',
          dlClass: 'dl-txt',
          label: '📃 Anonymised TXT',
        },
        {
          filename: `${baseName}_anonymised.docx`,
          blob: docxBlob,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dlClass: 'dl-docx',
          label: '📝 DOCX',
        },
        {
          filename: `${baseName}_anonymised.pdf`,
          blob: pdfBlob,
          mimeType: 'application/pdf',
          dlClass: 'dl-pdf',
          label: '📄 PDF',
        },
      ],
    };
  }

  // ── XLSX ─────────────────────────────────────────────────────────────────

  async function processXlsx(file, level, active, onStatus) {
    if (onStatus) onStatus(`Reading "${file.name}"…`);
    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (err) {
      throw new Error(`"${file.name}" — could not read file: ${err.message}`);
    }

    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'array' });
    } catch (err) {
      throw new Error(`"${file.name}" — could not parse spreadsheet: ${err.message}`);
    }

    if (onStatus) onStatus(`Anonymising "${file.name}"…`);

    const previewLines = [];
    const allReplacements = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet['!ref']) continue;
      const range = XLSX.utils.decode_range(sheet['!ref']);

      for (let row = range.s.r; row <= range.e.r; row++) {
        const rowData = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const addr = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = sheet[addr];
          if (!cell) { rowData.push(''); continue; }

          if (cell.t === 's' || (typeof cell.v === 'string' && !String(cell.v).startsWith('='))) {
            const cellText = String(cell.v || cell.w || '');
            if (cellText.trim()) {
              const { text: anonText, replacements } = EuaaAnonymizer.anonymizeText(cellText, level, active);
              cell.v = anonText;
              cell.w = anonText;
              if (cell.r) cell.r = undefined; // remove cached rich text
              rowData.push(anonText);
              allReplacements.push(...replacements);
            } else {
              rowData.push(cellText);
            }
          } else {
            rowData.push(String(cell.v ?? ''));
          }
        }
        if (rowData.some(v => v.trim())) previewLines.push(rowData.join(' │ '));
      }
    }

    const baseName    = file.name.replace(/\.xlsx$/i, '');
    const title       = `${file.name} (anonymised)`;
    const previewText = previewLines.join('\n');

    // Excel output
    const xlsxArray = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const xlsxBlob  = new Blob([xlsxArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const docxBlob = await buildDocxBlob(title, previewText);
    const pdfBlob  = buildPdfBlob(title, previewText);
    const txtBlob  = new Blob([previewText], { type: 'text/plain;charset=utf-8' });

    return {
      mode: 'xlsx',
      previewText,
      replacements: allReplacements,
      downloads: [
        {
          filename: `${baseName}_anonymised.xlsx`,
          blob: xlsxBlob,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dlClass: 'dl-xlsx',
          label: '📊 Anonymised XLSX',
        },
        {
          filename: `${baseName}_anonymised.docx`,
          blob: docxBlob,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dlClass: 'dl-docx',
          label: '📝 DOCX',
        },
        {
          filename: `${baseName}_anonymised.pdf`,
          blob: pdfBlob,
          mimeType: 'application/pdf',
          dlClass: 'dl-pdf',
          label: '📄 PDF',
        },
        {
          filename: `${baseName}_anonymised.txt`,
          blob: txtBlob,
          mimeType: 'text/plain',
          dlClass: 'dl-txt',
          label: '📃 TXT',
        },
      ],
    };
  }

  // ── Shared output builders ────────────────────────────────────────────────

  async function buildDocxBlob(title, text) {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = window.docx;
    const children = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: title, bold: true })],
      }),
      new Paragraph({ text: '' }),
    ];

    // Detect numbered paragraphs and preserve them
    const lines = text.split(/\n+/);
    for (const line of lines) {
      if (!line.trim()) {
        children.push(new Paragraph({ text: '' }));
        continue;
      }

      // Detect bold/heading-like lines (ALL CAPS or ending with colon after short text)
      const isHeading = /^[A-Z][A-Z\s,.\-:]{5,}$/.test(line.trim())
                     || (/^.{3,60}:$/.test(line.trim()) && !line.trim().includes(' '));

      children.push(new Paragraph({
        children: [new TextRun({
          text: line,
          bold: isHeading,
          size: isHeading ? 24 : 22,
        })],
      }));
    }

    const doc = new Document({
      sections: [{ children }],
      styles: {
        default: {
          document: {
            run: { font: 'Arial', size: 22 },
          },
        },
      },
    });
    return Packer.toBlob(doc);
  }

  function buildPdfBlob(title, text) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const marginL = 50, marginR = 50, marginT = 70, lineH = 14;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const textW = pageW - marginL - marginR;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, marginL, marginT, { maxWidth: textW });
    let y = marginT + 26;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
      if (!para.trim()) { y += lineH * 0.5; continue; }

      const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), textW);
      for (const line of lines) {
        if (y + lineH > pageH - 50) { doc.addPage(); y = marginT; }
        doc.text(line, marginL, y);
        y += lineH;
      }
      y += lineH * 0.4; // paragraph gap
    }

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text('ANONYMISED — For EUAA monitoring demonstration purposes only', marginL, pageH - 30);
      doc.text(`Page ${p} of ${totalPages}`, pageW - marginR, pageH - 30, { align: 'right' });
    }
    doc.setTextColor(0);

    return doc.output('blob');
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    processDocx,
    processTxt,
    processXlsx,
    buildDocxBlob,
    buildPdfBlob,
  };

})();

window.EuaaDocProcessor = EuaaDocProcessor;
