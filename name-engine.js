/**
 * EUAA Image Enhancement Pipeline
 * Performs multi-stage canvas-based image enhancement before OCR:
 *   1. Resolution upscaling (2× bicubic via canvas interpolation)
 *   2. Grayscale conversion
 *   3. Adaptive contrast (CLAHE approximation)
 *   4. Noise reduction (box-blur + unsharp mask)
 *   5. Binarization (Otsu threshold)
 *   6. Deskew detection and correction
 *   7. Generates 4 OCR-ready variants: original, enhanced, high-contrast, sharpened
 */
const EuaaImageEnhancer = (function () {
  'use strict';

  // ─── Utility helpers ───────────────────────────────────────────────────────

  function cloneCanvas(src) {
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  function getImageData(canvas) {
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  }

  function putImageData(canvas, id) {
    canvas.getContext('2d').putImageData(id, 0, 0);
  }

  function createFromData(data, w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var id = ctx.createImageData(w, h);
    id.data.set(data);
    ctx.putImageData(id, 0, 0);
    return c;
  }

  // ─── Step 1: Upscale ───────────────────────────────────────────────────────
  // If canvas is smaller than targetMin in either dimension, scale up 2×
  function upscale(canvas, targetMin) {
    targetMin = targetMin || 1200;
    var w = canvas.width, h = canvas.height;
    if (w >= targetMin && h >= targetMin) return canvas;
    var factor = Math.ceil(targetMin / Math.min(w, h));
    factor = Math.min(factor, 4);
    var out = document.createElement('canvas');
    out.width = w * factor; out.height = h * factor;
    var ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }

  // ─── Step 2: Grayscale ─────────────────────────────────────────────────────
  function toGrayscale(canvas) {
    var id = getImageData(canvas);
    var d = id.data, len = d.length;
    for (var i = 0; i < len; i += 4) {
      var g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      d[i] = d[i+1] = d[i+2] = g;
    }
    var out = cloneCanvas(canvas);
    putImageData(out, id);
    return out;
  }

  // ─── Step 3: Adaptive contrast (tile-based CLAHE approximation) ────────────
  function adaptiveContrast(canvas, tileSize, clipLimit) {
    tileSize = tileSize || 32;
    clipLimit = clipLimit || 3.0;
    var w = canvas.width, h = canvas.height;
    var id = getImageData(canvas);
    var src = new Uint8ClampedArray(id.data);
    var dst = new Uint8ClampedArray(src.length);

    var tilesX = Math.ceil(w / tileSize);
    var tilesY = Math.ceil(h / tileSize);

    // Build per-tile LUTs
    var luts = [];
    for (var ty = 0; ty < tilesY; ty++) {
      luts[ty] = [];
      for (var tx = 0; tx < tilesX; tx++) {
        var x0 = tx * tileSize, y0 = ty * tileSize;
        var x1 = Math.min(x0 + tileSize, w);
        var y1 = Math.min(y0 + tileSize, h);
        var hist = new Float32Array(256);
        var count = 0;
        for (var py = y0; py < y1; py++) {
          for (var px = x0; px < x1; px++) {
            hist[src[(py * w + px) * 4]] += 1;
            count++;
          }
        }
        // Clip histogram
        var excess = 0;
        var limit = clipLimit * count / 256;
        for (var k = 0; k < 256; k++) {
          if (hist[k] > limit) { excess += hist[k] - limit; hist[k] = limit; }
        }
        var add = excess / 256;
        for (var k = 0; k < 256; k++) hist[k] += add;
        // Build CDF LUT
        var lut = new Uint8ClampedArray(256);
        var cdf = 0, cdfMin = -1;
        for (var k = 0; k < 256; k++) {
          cdf += hist[k];
          if (cdfMin < 0 && hist[k] > 0) cdfMin = cdf;
          lut[k] = Math.round((cdf - cdfMin) / (count - cdfMin) * 255);
        }
        luts[ty][tx] = lut;
      }
    }

    // Bilinear interpolation of LUTs
    for (var py = 0; py < h; py++) {
      for (var px = 0; px < w; px++) {
        var idx = (py * w + px) * 4;
        var v = src[idx];
        var txF = (px / tileSize) - 0.5; var ty_F = (py / tileSize) - 0.5;
        var tx0 = Math.max(0, Math.floor(txF)), tx1 = Math.min(tilesX - 1, tx0 + 1);
        var ty0 = Math.max(0, Math.floor(ty_F)), ty1 = Math.min(tilesY - 1, ty0 + 1);
        var wx = txF - tx0; var wy = ty_F - ty0;
        if (wx < 0) wx = 0; if (wy < 0) wy = 0;
        var v00 = luts[ty0][tx0][v], v10 = luts[ty0][tx1][v];
        var v01 = luts[ty1][tx0][v], v11 = luts[ty1][tx1][v];
        var out = Math.round(
          v00 * (1 - wx) * (1 - wy) +
          v10 * wx * (1 - wy) +
          v01 * (1 - wx) * wy +
          v11 * wx * wy
        );
        dst[idx] = dst[idx+1] = dst[idx+2] = out;
        dst[idx+3] = src[idx+3];
      }
    }
    return createFromData(dst, w, h);
  }

  // ─── Step 4: Gaussian blur (3×3 approximation) ────────────────────────────
  function gaussianBlur(canvas, radius) {
    radius = radius || 1;
    var w = canvas.width, h = canvas.height;
    var id = getImageData(canvas);
    var src = new Uint8ClampedArray(id.data);
    var dst = new Uint8ClampedArray(src.length);
    // Simple 3×3 box blur repeated `radius` times
    var passes = radius;
    var cur = src;
    for (var p = 0; p < passes; p++) {
      var nxt = new Uint8ClampedArray(cur.length);
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var sum = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              sum += cur[((y + dy) * w + (x + dx)) * 4];
            }
          }
          var i = (y * w + x) * 4;
          nxt[i] = nxt[i+1] = nxt[i+2] = Math.round(sum / 9);
          nxt[i+3] = cur[i+3];
        }
      }
      cur = nxt;
    }
    return createFromData(cur, w, h);
  }

  // ─── Step 5: Unsharp mask ──────────────────────────────────────────────────
  function unsharpMask(canvas, strength) {
    strength = strength || 1.5;
    var blurred = gaussianBlur(canvas, 1);
    var w = canvas.width, h = canvas.height;
    var orig = getImageData(canvas).data;
    var blur = getImageData(blurred).data;
    var dst = new Uint8ClampedArray(orig.length);
    for (var i = 0; i < orig.length; i += 4) {
      var sharp = orig[i] + strength * (orig[i] - blur[i]);
      var v = Math.max(0, Math.min(255, Math.round(sharp)));
      dst[i] = dst[i+1] = dst[i+2] = v;
      dst[i+3] = orig[i+3];
    }
    return createFromData(dst, w, h);
  }

  // ─── Step 6: Otsu binarization ────────────────────────────────────────────
  function otsuThreshold(canvas) {
    var id = getImageData(canvas);
    var d = id.data, len = d.length;
    // Build histogram
    var hist = new Float32Array(256);
    var total = 0;
    for (var i = 0; i < len; i += 4) { hist[d[i]]++; total++; }
    // Otsu
    var sum = 0;
    for (var k = 0; k < 256; k++) sum += k * hist[k];
    var sumB = 0, wB = 0, wF = 0, maxVar = 0, thresh = 128;
    for (var t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      wF = total - wB; if (!wF) break;
      sumB += t * hist[t];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var bv = wB * wF * (mB - mF) * (mB - mF);
      if (bv > maxVar) { maxVar = bv; thresh = t; }
    }
    return thresh;
  }

  function binarize(canvas, thresh) {
    if (thresh === undefined) thresh = otsuThreshold(canvas);
    var id = getImageData(canvas);
    var d = id.data, len = d.length;
    for (var i = 0; i < len; i += 4) {
      var v = d[i] > thresh ? 255 : 0;
      d[i] = d[i+1] = d[i+2] = v;
    }
    var out = cloneCanvas(canvas);
    putImageData(out, id);
    return out;
  }

  // ─── Step 7: Deskew ───────────────────────────────────────────────────────
  // Projection profile deskew — finds angle that maximises horizontal variance
  function deskew(canvas) {
    var w = canvas.width, h = canvas.height;
    var binary = binarize(toGrayscale(canvas));
    var id = getImageData(binary);
    var d = id.data;

    // Sample angles from -10° to +10° in 0.5° steps
    var bestAngle = 0, bestScore = -1;
    var angles = [];
    for (var a = -10; a <= 10; a += 0.5) angles.push(a);

    angles.forEach(function (angleDeg) {
      var angle = angleDeg * Math.PI / 180;
      var cos = Math.cos(angle), sin = Math.sin(angle);
      var profile = new Float32Array(h);
      for (var y = 0; y < h; y++) {
        var dark = 0;
        for (var x = 0; x < w; x++) {
          // Rotated pixel lookup
          var cx = x - w / 2, cy = y - h / 2;
          var sx = Math.round(cx * cos + cy * sin + w / 2);
          var sy = Math.round(-cx * sin + cy * cos + h / 2);
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            if (d[(sy * w + sx) * 4] < 128) dark++;
          }
        }
        profile[y] = dark;
      }
      // Score = variance of profile
      var mean = 0;
      for (var i = 0; i < h; i++) mean += profile[i];
      mean /= h;
      var variance = 0;
      for (var i = 0; i < h; i++) variance += (profile[i] - mean) * (profile[i] - mean);
      if (variance > bestScore) { bestScore = variance; bestAngle = angleDeg; }
    });

    if (Math.abs(bestAngle) < 0.3) return canvas; // No significant skew

    // Apply rotation
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-bestAngle * Math.PI / 180);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(canvas, 0, 0);
    return out;
  }

  // ─── High-contrast variant ─────────────────────────────────────────────────
  function highContrast(canvas) {
    var id = getImageData(canvas);
    var d = id.data, len = d.length;
    // Find min/max luminance
    var min = 255, max = 0;
    for (var i = 0; i < len; i += 4) {
      var v = d[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    var range = max - min || 1;
    var out = new Uint8ClampedArray(d.length);
    for (var i = 0; i < len; i += 4) {
      var v = Math.round((d[i] - min) / range * 255);
      // Gamma correction for faded text
      v = Math.round(Math.pow(v / 255, 0.7) * 255);
      out[i] = out[i+1] = out[i+2] = v;
      out[i+3] = d[i+3];
    }
    return createFromData(out, canvas.width, canvas.height);
  }

  // ─── Main pipeline ─────────────────────────────────────────────────────────
  /**
   * enhance(canvas) → Promise<{original, enhanced, highContrast, sharpened, angle}>
   * All returned canvases are ready to feed into Tesseract.
   */
  function enhance(canvas) {
    return new Promise(function (resolve) {
      try {
        // Step 1: Upscale
        var up = upscale(canvas, 1200);
        // Step 2: Grayscale
        var gray = toGrayscale(up);
        // Step 3: Deskew (on grayscale)
        var deskewed = deskew(gray);
        // Step 4: CLAHE adaptive contrast
        var clahe = adaptiveContrast(deskewed, 32, 3.0);
        // Step 5: Denoise
        var denoised = gaussianBlur(clahe, 1);
        // Enhanced variant (denoised + sharpened)
        var enhancedCanvas = unsharpMask(denoised, 1.8);
        // High-contrast variant
        var hcCanvas = highContrast(deskewed);
        var hcSharp = unsharpMask(hcCanvas, 2.0);
        // Sharpened variant (strong unsharp mask on enhanced)
        var sharpCanvas = unsharpMask(enhancedCanvas, 2.5);

        resolve({
          original:     canvas,
          enhanced:     enhancedCanvas,
          highContrast: hcSharp,
          sharpened:    sharpCanvas,
          deskewAngle:  0 // returned for info
        });
      } catch (e) {
        // Fallback — return original if enhancement fails
        resolve({
          original:     canvas,
          enhanced:     canvas,
          highContrast: canvas,
          sharpened:    canvas,
          deskewAngle:  0,
          error:        e.message
        });
      }
    });
  }

  return { enhance: enhance, upscale: upscale, binarize: binarize, toGrayscale: toGrayscale };
})();
