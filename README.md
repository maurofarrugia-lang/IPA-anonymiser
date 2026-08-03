# EUAA Monitoring Anonymiser

A **privacy-first, browser-only** document anonymisation tool built for EUAA monitoring demonstrations.

## ✅ Live App

This is a hosted static web app. Deploy it to any static host (Netlify, Vercel, GitHub Pages, or Cloudflare Pages) and it works immediately.

---

## Features

| Feature | Details |
|---|---|
| **Supported formats** | DOCX, PDF, TXT, XLSX |
| **PDF modes** | Black-bar redaction (keeps original layout) OR Anonymise & rebuild |
| **OCR fallback** | Tesseract.js for scanned / image PDFs — runs in browser |
| **Consistent substitution** | "Applicant A", "Country B", "Case File 001" etc. — same entity always gets same replacement |
| **Replacement map** | Downloadable TSV of every original → replacement |
| **Bulk download** | All outputs bundled as a ZIP |
| **Privacy** | Zero server-side storage — all processing in the browser |

## Anonymisation categories

- 👤 Names / persons
- 🔢 Case / file / Refcom numbers
- 🪪 IDs / passports
- 🏠 Addresses
- 📧 Emails
- 📞 Phone numbers
- 📅 Exact dates (generalised to month/year)
- 🌍 Countries and nationalities
- 📍 Locations
- 🏢 Facilities / reception centres
- 🛣️ Travel routes
- 👨‍👩‍👧 Family details

## File structure

```
index.html          ← App entry point
css/
  style.css         ← All styles
js/
  anonymizer.js     ← Core NER + substitution engine
  pdf-processor.js  ← PDF parsing, blackout, rebuild modes
  docx-processor.js ← DOCX / TXT / XLSX processing
  app.js            ← UI controller
README.md
```

## Deployment

### Option A — GitHub Pages (free)
1. Push this repository to GitHub.
2. Go to **Settings → Pages → Source = main branch / root**.
3. Your app is live at `https://yourusername.github.io/repo-name/`.

### Option B — Netlify (free, one-click)
1. Create a Netlify account.
2. Drag and drop the project folder onto Netlify's dashboard.
3. Instant live URL.

### Option C — Vercel (free)
1. `npm i -g vercel`
2. `cd` into the project folder and run `vercel`.
3. Follow prompts — done.

### Option D — Local preview
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

---

## Usage

1. **Add files** — drag & drop or use the file/folder pickers.
2. **Choose options** — processing level, PDF mode, which categories to anonymise.
3. **Click "Anonymise files"** — watch the progress bar.
4. **Download** — individual files or the full ZIP bundle.
5. **Review** — always check output before using in any official context.

---

## Recommended settings for EUAA demos

| Setting | Value |
|---|---|
| Processing level | Demonstration-safe |
| PDF mode | Black-bar redaction (safest) or Anonymise & rebuild |
| OCR | ON (for scanned PDFs) |
| Preset | Recommended (all 12 categories) |

---

## Troubleshooting (GitHub Pages / static hosts)

| Problem | Fix applied |
|---|---|
| File upload buttons do nothing | **v11 fix**: Buttons now use explicit `onclick="document.getElementById('fileInput').click()"` — no `<label>` wrapping required |
| CDN scripts blocked page | All JS libraries moved to bottom of `<body>` — `<head>` only loads CSS |
| CSS/theme missing | All CSS inlined in `<style>` tag in `index.html` — no external `css/` dependency |
| "No PDF header found" | PDF-lib searches first 4 KB for `%PDF-` header — tolerates wrapper bytes |
| Arabic names not detected | Token-based greedy NER with `ARABIC_PARTICLES` list (Al-, Abu-, Abd, Bin, Bint…) |

## Notes & limitations

- **Scanned PDFs**: OCR works in the browser via Tesseract.js but is slower.
- **Encrypted PDFs**: not supported — decrypt before upload.
- **Name detection**: uses capitalised word-pair heuristics + Arabic/MENA particle scanner; may occasionally false-positive on legal headings. Review output.
- **This is a demo/operational tool**: always review anonymised output before external use. It does not constitute legal redaction.

---

## Privacy statement

> All processing occurs entirely in your browser using JavaScript.  
> No files, text, or personal data are transmitted to any server.  
> Session data is cleared when you click "Clear session" or close the tab.  
> No analytics, no tracking, no cookies.
