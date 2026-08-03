# EUAA PDF Redaction Tool — Enhanced Edition

A **privacy-first, browser-only** PDF redaction tool built for EUAA asylum and migration case-file review.

All processing happens entirely in the browser. No files or data ever leave your device.

---

## ✅ What's New in the Enhanced Edition

| Feature | Previous | Enhanced |
|---|---|---|
| OCR | Single-pass Tesseract | **4-pass multi-variant OCR** with image enhancement |
| Image quality | None | **Upscale → CLAHE contrast → deskew → unsharp mask** |
| Arabic names | Basic regex | **Full Arabic name engine** with Jaro-Winkler fuzzy matching |
| Languages | English only OCR | **11 languages**: Arabic, English, French, Somali, Tigrinya, Amharic, Urdu, Kurdish, Bengali, Turkish, Russian |
| Name recognition | Pattern matching | **Variant table** (Mohammed/Muhammad/Mohamed all linked) |
| Data extraction | Redaction only | **Extracts** names, DOB, passports, case numbers, nationalities, emails, phones, MRZ |
| Document classification | None | **Auto-classifies** passports, IDs, asylum forms, court decisions, medical reports |
| Confidence scores | None | **Per-field confidence %** with colour coding |
| Cross-page checks | None | **Flags** conflicting DOBs, spelling inconsistencies, invalid passport numbers |
| Reviewer sidebar | None | **Live extracted fields** shown alongside the review canvas |
| Result tabs | None | **4 tabs** per result: Extracted Data, Names, Alerts, Pages |

---

## 📁 File Structure

```
index.html                  Main UI (loads all modules as external files)
css/
  enhanced.css              All styles
js/
  image-enhancer.js         Image enhancement pipeline (upscale, CLAHE, deskew, unsharp mask)
  ocr-engine.js             Multi-pass OCR with language detection (Tesseract.js wrapper)
  name-engine.js            Arabic & multilingual name recognition + fuzzy matching
  data-extractor.js         Personal data extraction + document type classifier
  pdf-enhanced.js           PDF processor (PDF.js + all engines + jsPDF output)
  app-enhanced.js           App controller + reviewer UI + session management
  anonymizer.js             Entity detection for auto-redact categories
.nojekyll                   GitHub Pages configuration
get.html                    ZIP downloader for distributing files
```

---

## 🔧 How It Works

### Stage 1 — Image Enhancement (per page)
1. **Upscale** low-resolution pages to ≥1200px
2. **Grayscale** conversion
3. **CLAHE** adaptive contrast (tile-based histogram equalisation)
4. **Gaussian denoise** (box blur)
5. **Deskew** (projection profile angle detection, −10° to +10°)
6. **Unsharp mask** sharpening
7. Produces 4 variants: original, enhanced, high-contrast, sharpened

### Stage 2 — Multi-Pass OCR
1. Quick script detection scan (Latin / Arabic / Ethiopic / Bengali / Cyrillic)
2. Language string selected automatically (e.g. Arabic → `ara+eng+fra+urd+kur`)
3. **4 parallel OCR passes** on all image variants
4. Results merged by **per-word confidence** (highest confidence wins per bounding-box location)
5. Low-confidence words cropped, upscaled 3×, re-OCR'd for verification

### Stage 3 — Name Recognition
- **50+ Arabic/Somali/Eritrean name canonical entries** with full variant tables
- **Jaro-Winkler** + **phonetic normalisation** fuzzy matching
- Patronymic particle handling (ibn, bin, bint, abu, abd, al, el…)
- Cross-page name consistency checking — flags spelling inconsistencies

### Stage 4 — Personal Data Extraction
- Regex + context patterns for: passport numbers, case/refcom numbers, dates of birth, places of birth, nationalities, emails, phones
- **MRZ parser** (ICAO Type P passports — surname, given names, passport no., nationality, DOB)
- **Document type classifier** (12 types: passport, ID card, birth cert, asylum application, interview record, court decision, police report, medical report, travel doc, registration, marriage cert)
- **Consistency validation**: conflicting DOBs, invalid passport number formats, cross-page name spelling
- **Correction suggestions** generated for every flag

### Stage 5 — Black-bar Redaction
- PDF.js renders each page to canvas at 2.5× scale
- Detected entities → `fillRect()` black bars with configurable padding
- OCR words also checked against redaction categories
- jsPDF encodes canvas pages as JPEG → output PDF

---

## 🚀 Deployment

Push all files to GitHub and enable GitHub Pages (branch: `main`, folder: `/root`).

Use **`get.html`** to download all files as a ZIP for uploading to GitHub.

---

## 🌍 Supported Languages

| Language | Tesseract code | Script |
|---|---|---|
| Arabic | `ara` | Arabic (RTL) |
| English | `eng` | Latin |
| French | `fra` | Latin |
| Somali | `som` | Latin |
| Tigrinya | `tir` | Ethiopic |
| Amharic | `amh` | Ethiopic |
| Urdu | `urd` | Arabic (RTL) |
| Kurdish | `kur` | Arabic (RTL) |
| Bengali | `ben` | Bengali |
| Turkish | `tur` | Latin |
| Russian | `rus` | Cyrillic |

---

## ⚠️ Troubleshooting

| Problem | Fix |
|---|---|
| PDF says "no PDF header" | File corrupted or is HTML. Re-export as PDF. |
| Bars not covering text | Increase padding slider |
| Scanned PDF not redacted | Enable Enhanced OCR toggle |
| Download does nothing | Disable aggressive ad-blockers |
| Processing very slow | OCR on large scanned PDFs takes time. Disable OCR if not needed. |
| Arabic names not found | Ensure "Names / persons" checkbox is ticked and Arabic OCR is on |
| Low confidence scores | Document quality is poor — check enhanced image variant in Pages tab |
