# EUAA PDF Redaction Tool

A **privacy-first, browser-only** PDF black-bar redaction tool built for EUAA monitoring.

All processing happens entirely in the browser — no files or data ever leave your device.

---

## ✅ Features

- **Auto redaction** — automatically detects and blacks out: names, case/Refcom numbers, IDs, addresses, emails, phones, dates, countries, locations, facilities, routes, family details
- **Manual terms** — type specific words/numbers (one per line) to black out all exact matches
- **Progress bar** — per-page progress indicator during processing
- **Review & manual bars** — after auto-processing, open a full-screen review panel for each file:
  - See every page rendered at high resolution
  - Click and drag to draw additional black bars anywhere
  - Adjust bar height with a slider (4–60 px)
  - Undo the last bar on any page
  - Finalise and download the updated PDF
- **Download** — per-file download button + "Download all as ZIP"
- **OCR fallback** — scanned/image-only PDFs handled via Tesseract.js
- PDF files only

---

## 📁 File Structure

```
index.html              Main UI
js/app.js               App controller (upload, process, review modal, download)
js/pdf-processor.js     PDF rendering + black-bar engine (PDF.js → canvas → jsPDF)
js/anonymizer.js        NER entity detection (used for auto-detect categories)
js/docx-processor.js    (legacy, not used)
css/style.css           (legacy, CSS now inlined in index.html)
download.html           ZIP downloader for distributing project files
.nojekyll               Disables Jekyll on GitHub Pages
```

---

## 🔧 How It Works

1. **PDF.js** renders each page to a `<canvas>` at 2.5× resolution
2. Text items are extracted with position data
3. `EuaaAnonymizer.detectEntities()` checks each text item against selected categories
4. Manual terms are matched via regex
5. A black `fillRect()` is drawn over each matched item (with configurable padding)
6. **jsPDF** encodes the canvas pages as JPEG and assembles the output PDF
7. The rendered canvases are stored so the manual review modal can display and modify them
8. OCR via **Tesseract.js** handles pages with no extractable text

---

## 🚀 Deployment

Push all files to GitHub and enable GitHub Pages (branch: `main`, folder: `/root`).  
The `.nojekyll` file disables Jekyll processing.

To download a ZIP of all current files: open `download.html`.

---

## ⚠️ Troubleshooting

| Problem | Fix |
|---|---|
| PDF says "no PDF header" | File may be corrupted or HTML. Re-save as PDF from source application. |
| Bars not covering text fully | Increase padding slider in settings |
| Scanned PDF not redacted | Enable OCR toggle |
| Download button does nothing | Ensure browser allows blob URL downloads (disable aggressive ad-blockers) |
| Processing very slow | OCR on large scanned PDFs takes time — disable OCR if not needed |
