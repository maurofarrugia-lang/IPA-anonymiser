/**
 * EUAA Multi-Pass OCR Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates Tesseract.js across 4 image variants, merges results by
 * confidence, performs language detection, and returns a unified word-level
 * result with per-word confidence scores.
 *
 * Supported languages: Arabic, English, French, Somali, Tigrinya, Amharic,
 *   Urdu, Kurdish, Bengali, Turkish, Russian
 *
 * Requires: Tesseract.js v5 (global window.Tesseract)
 *           EuaaImageEnhancer (global)
 */
const EuaaOcrEngine = (function () {
  'use strict';

  // ── Language configuration ──────────────────────────────────────────────────
  // Maps Tesseract language codes to human labels and script families.
  // Tesseract uses ISO 639-3 codes; combined strings ('ara+eng') run both.
  var LANG_PROFILES = [
    { id: 'ara',         label: 'Arabic',      script: 'arabic',  rtl: true  },
    { id: 'eng',         label: 'English',     script: 'latin',   rtl: false },
    { id: 'fra',         label: 'French',      script: 'latin',   rtl: false },
    { id: 'som',         label: 'Somali',      script: 'latin',   rtl: false },
    { id: 'tir',         label: 'Tigrinya',    script: 'ethiopic',rtl: false },
    { id: 'amh',         label: 'Amharic',     script: 'ethiopic',rtl: false },
    { id: 'urd',         label: 'Urdu',        script: 'arabic',  rtl: true  },
    { id: 'kur',         label: 'Kurdish',     script: 'arabic',  rtl: true  },
    { id: 'ben',         label: 'Bengali',     script: 'bengali', rtl: false },
    { id: 'tur',         label: 'Turkish',     script: 'latin',   rtl: false },
    { id: 'rus',         label: 'Russian',     script: 'cyrillic',rtl: false },
  ];

  // Language detection heuristics based on character ranges
  var SCRIPT_RANGES = [
    { script: 'arabic',   re: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/u },
    { script: 'ethiopic', re: /[\u1200-\u137F\u1380-\u139F]/u },
    { script: 'bengali',  re: /[\u0980-\u09FF]/u },
    { script: 'cyrillic', re: /[\u0400-\u04FF]/u },
    { script: 'latin',    re: /[A-Za-z]/ },
  ];

  // Tesseract CDN base for language data (use fast CDN path)
  var TESS_LANG_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tessdata/';

  // ── Scoring helpers ────────────────────────────────────────────────────────

  function meanConf(words) {
    if (!words || !words.length) return 0;
    var s = 0;
    words.forEach(function (w) { s += (w.confidence || 0); });
    return s / words.length;
  }

  // ── Language detection from extracted text ─────────────────────────────────
  function detectScript(text) {
    if (!text) return 'latin';
    var counts = {};
    SCRIPT_RANGES.forEach(function (sr) {
      var m = text.match(new RegExp(sr.re.source, 'gu'));
      counts[sr.script] = m ? m.length : 0;
    });
    var best = 'latin', bestN = 0;
    Object.keys(counts).forEach(function (s) { if (counts[s] > bestN) { bestN = counts[s]; best = s; } });
    return best;
  }

  function pickLangForScript(script) {
    var map = {
      arabic:   'ara+eng+fra+urd+kur',
      ethiopic: 'amh+tir+eng',
      bengali:  'ben+eng',
      cyrillic: 'rus+eng',
      latin:    'eng+fra+som+tur',
    };
    return map[script] || 'eng';
  }

  // ── Single Tesseract pass ──────────────────────────────────────────────────
  function runTesseract(canvas, langStr, onProgress) {
    return new Promise(function (resolve) {
      if (!window.Tesseract) { resolve({ text: '', words: [], confidence: 0, lang: langStr }); return; }
      window.Tesseract.recognize(canvas, langStr, {
        logger: function (m) {
          if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
        },
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        langPath:   'https://tessdata.projectnaptha.com/4.0.0',
        corePath:   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
      }).then(function (result) {
        var data = result.data;
        var words = [];
        if (data.words) {
          data.words.forEach(function (w) {
            if ((w.text || '').trim()) {
              words.push({
                text:       w.text.trim(),
                confidence: w.confidence || 0,
                bbox:       w.bbox || {},
                lang:       langStr,
              });
            }
          });
        }
        resolve({
          text:       data.text || '',
          words:      words,
          confidence: data.confidence || meanConf(words),
          lang:       langStr,
          lines:      data.lines || [],
          blocks:     data.blocks || [],
        });
      }).catch(function (err) {
        resolve({ text: '', words: [], confidence: 0, lang: langStr, error: err.message });
      });
    });
  }

  // ── Multi-pass merge ───────────────────────────────────────────────────────
  // Merges results from multiple passes by picking the highest-confidence
  // word at each approximate bounding-box location.
  function mergeResults(passes) {
    // Sort passes descending by overall confidence
    var sorted = passes.slice().sort(function (a, b) {
      return (b.confidence || 0) - (a.confidence || 0);
    });

    // Best overall pass is the primary
    var primary = sorted[0];
    if (!primary) return { text: '', words: [], confidence: 0, passCount: passes.length };

    // Build merged word list: for each primary word, see if a secondary pass
    // has a higher-confidence replacement at approximately the same location
    var merged = primary.words.map(function (pw) {
      var best = pw;
      for (var i = 1; i < sorted.length; i++) {
        var alt = findOverlappingWord(sorted[i].words, pw.bbox);
        if (alt && alt.confidence > best.confidence + 5) best = alt;
      }
      return best;
    });

    // Also append any high-confidence words from secondary passes not found in primary
    for (var i = 1; i < sorted.length; i++) {
      sorted[i].words.forEach(function (sw) {
        if (sw.confidence < 60) return;
        var overlap = findOverlappingWord(primary.words, sw.bbox);
        if (!overlap) merged.push(sw);
      });
    }

    // Reconstruct text from merged words (preserving line order)
    merged.sort(function (a, b) {
      var ay = a.bbox ? (a.bbox.y0 || 0) : 0;
      var by = b.bbox ? (b.bbox.y0 || 0) : 0;
      if (Math.abs(ay - by) > 10) return ay - by;
      return (a.bbox ? (a.bbox.x0 || 0) : 0) - (b.bbox ? (b.bbox.x0 || 0) : 0);
    });

    var text = merged.map(function (w) { return w.text; }).join(' ');

    return {
      text:       text,
      words:      merged,
      confidence: meanConf(merged),
      passCount:  passes.length,
      passes:     sorted.map(function (p) { return { lang: p.lang, confidence: p.confidence }; }),
    };
  }

  function findOverlappingWord(words, bbox) {
    if (!bbox || !words || !words.length) return null;
    var bx0 = bbox.x0 || 0, by0 = bbox.y0 || 0, bx1 = bbox.x1 || bx0 + 1, by1 = bbox.y1 || by0 + 1;
    var best = null, bestIOU = 0;
    words.forEach(function (w) {
      var b = w.bbox;
      if (!b) return;
      var ix0 = Math.max(bx0, b.x0 || 0), iy0 = Math.max(by0, b.y0 || 0);
      var ix1 = Math.min(bx1, b.x1 || 0), iy1 = Math.min(by1, b.y1 || 0);
      if (ix1 <= ix0 || iy1 <= iy0) return;
      var inter = (ix1 - ix0) * (iy1 - iy0);
      var union = (bx1 - bx0) * (by1 - by0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
      var iou = inter / (union || 1);
      if (iou > 0.4 && iou > bestIOU) { bestIOU = iou; best = w; }
    });
    return best;
  }

  // ── Secondary verification for low-confidence words ───────────────────────
  // Crops the word region, re-runs OCR with alternative settings
  function verifyLowConfidence(words, allCanvases, langStr) {
    var LOW_THRESH = 55;
    var toVerify = words.filter(function (w) { return w.confidence < LOW_THRESH && w.bbox && (w.bbox.x1 - w.bbox.x0) > 10; });
    if (!toVerify.length || !window.Tesseract) return Promise.resolve(words);

    // Process up to 20 low-confidence words
    var promises = toVerify.slice(0, 20).map(function (w) {
      var canvas = allCanvases.sharpened || allCanvases.enhanced;
      var b = w.bbox;
      var pad = 8;
      var crop = document.createElement('canvas');
      crop.width = Math.max(1, (b.x1 - b.x0) + pad * 2);
      crop.height = Math.max(1, (b.y1 - b.y0) + pad * 2);
      var ctx = crop.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, crop.width, crop.height);
      ctx.drawImage(canvas, b.x0 - pad, b.y0 - pad, crop.width, crop.height, 0, 0, crop.width, crop.height);
      // Scale up 3× for better single-word OCR
      var big = document.createElement('canvas');
      big.width = crop.width * 3; big.height = crop.height * 3;
      var bctx = big.getContext('2d');
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(crop, 0, 0, big.width, big.height);
      return runTesseract(big, langStr, null).then(function (r) {
        if (r.words && r.words.length) {
          var best = r.words.reduce(function (a, b) { return b.confidence > a.confidence ? b : a; });
          if (best.confidence > w.confidence + 10) {
            w.text = best.text;
            w.confidence = best.confidence;
            w.verified = true;
          }
        }
        return w;
      });
    });

    return Promise.all(promises).then(function () { return words; });
  }

  // ── Main entry point ───────────────────────────────────────────────────────
  /**
   * ocrCanvas(canvas, options, onProgress) → Promise<OcrResult>
   *
   * OcrResult: { text, words, confidence, passCount, detectedScript, detectedLang, passes }
   */
  function ocrCanvas(canvas, options, onProgress) {
    options = options || {};
    var forceLang = options.lang || null;
    var skipEnhance = options.skipEnhance || false;

    var enhanceP = skipEnhance
      ? Promise.resolve({ original: canvas, enhanced: canvas, highContrast: canvas, sharpened: canvas })
      : EuaaImageEnhancer.enhance(canvas);

    return enhanceP.then(function (variants) {
      // Quick pre-scan with English+Arabic to detect script
      return runTesseract(variants.enhanced, 'eng+ara', null).then(function (probe) {
        var script = detectScript(probe.text);
        var langStr = forceLang || pickLangForScript(script);

        if (onProgress) onProgress(0.1, 'Script detected: ' + script + ' → ' + langStr);

        // Run 4 passes in parallel across image variants
        var passes = [
          runTesseract(variants.original,     langStr, null),
          runTesseract(variants.enhanced,     langStr, function (p) { if (onProgress) onProgress(0.1 + p * 0.5, 'OCR pass 2…'); }),
          runTesseract(variants.highContrast, langStr, null),
          runTesseract(variants.sharpened,    langStr, null),
        ];

        // If Arabic/RTL, also run a dedicated Arabic-only pass on high-contrast
        if (script === 'arabic') {
          passes.push(runTesseract(variants.highContrast, 'ara', null));
        }

        return Promise.all(passes).then(function (results) {
          if (onProgress) onProgress(0.85, 'Merging OCR passes…');
          var merged = mergeResults(results);
          return verifyLowConfidence(merged.words, variants, langStr).then(function (verifiedWords) {
            merged.words = verifiedWords;
            merged.detectedScript = script;
            merged.detectedLang = langStr;
            merged.variants = variants;
            if (onProgress) onProgress(1.0, 'OCR complete');
            return merged;
          });
        });
      });
    });
  }

  return {
    ocrCanvas:       ocrCanvas,
    detectScript:    detectScript,
    LANG_PROFILES:   LANG_PROFILES,
  };
})();
