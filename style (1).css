/* ────────────────────────────────────────────────────────────
   EUAA Monitoring Anonymiser — Main Stylesheet
   ──────────────────────────────────────────────────────────── */

/* ── Reset & tokens ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --col-bg:        #f0f4f8;
  --col-surface:   #ffffff;
  --col-border:    #d1dae6;
  --col-text:      #1a2233;
  --col-muted:     #6b7a96;
  --col-primary:   #1d4ed8;
  --col-primary-h: #1e40af;
  --col-primary-l: #dbeafe;
  --col-success:   #16a34a;
  --col-success-l: #dcfce7;
  --col-warn:      #d97706;
  --col-warn-l:    #fef3c7;
  --col-danger:    #dc2626;
  --col-danger-l:  #fee2e2;
  --col-accent:    #7c3aed;
  --col-accent-l:  #ede9fe;
  --radius-sm:     6px;
  --radius-md:     10px;
  --radius-lg:     16px;
  --shadow-sm:     0 1px 3px rgba(0,0,0,.08);
  --shadow-md:     0 4px 12px rgba(0,0,0,.10);
  --shadow-lg:     0 8px 24px rgba(0,0,0,.12);
  --font:          'Segoe UI', system-ui, -apple-system, sans-serif;
}

html { font-size: 16px; scroll-behavior: smooth; }

body {
  font-family: var(--font);
  background: var(--col-bg);
  color: var(--col-text);
  line-height: 1.6;
  min-height: 100vh;
}

/* ── Site header ── */
.site-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%);
  color: #fff;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-md);
}

.header-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  gap: 1rem;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand-icon {
  font-size: 2rem;
  line-height: 1;
  opacity: .9;
}

.brand-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: -.01em;
}

.brand-sub {
  font-size: .75rem;
  color: rgba(255,255,255,.7);
  margin-top: 1px;
}

.header-badges { display: flex; gap: .5rem; flex-wrap: wrap; }

/* ── Badges ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .25rem .7rem;
  border-radius: 20px;
  font-size: .72rem;
  font-weight: 600;
  letter-spacing: .02em;
}

.badge-green { background: rgba(22,163,74,.25); color: #4ade80; border: 1px solid rgba(74,222,128,.3); }
.badge-blue  { background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.2); }
.badge-dl    { background: rgba(124,58,237,.35); color: #e9d5ff; border: 1px solid rgba(167,139,250,.4); text-decoration: none; cursor: pointer; transition: background .15s; }
.badge-dl:hover { background: rgba(124,58,237,.55); }

/* ── Main wrap ── */
.main-wrap {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 0 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Cards ── */
.card {
  background: var(--col-surface);
  border: 1px solid var(--col-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  gap: .85rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--col-border);
  background: #f8fafc;
}

.card-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
  flex: 1;
}

.card-head-right {
  display: flex;
  align-items: center;
  gap: .75rem;
  margin-left: auto;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--col-primary);
  color: #fff;
  font-size: .8rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Upload area ── */
.upload-area {
  padding: 2.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .75rem;
  border-bottom: 1px solid var(--col-border);
  cursor: pointer;
  transition: background .15s;
}

.upload-area:hover, .upload-area.dragover {
  background: var(--col-primary-l);
}

.upload-area.dragover {
  border: 2px dashed var(--col-primary);
  border-radius: var(--radius-md);
}

.upload-icon {
  font-size: 3rem;
  color: var(--col-primary);
  line-height: 1;
}

.upload-label {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--col-text);
}

.upload-hint {
  font-size: .85rem;
  color: var(--col-muted);
}

.upload-btn-row {
  display: flex;
  gap: .75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: .5rem;
}

/* ── File queue ── */
.file-queue {
  padding: 1rem 1.5rem;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .75rem;
}

.queue-count {
  font-size: .85rem;
  font-weight: 600;
  color: var(--col-muted);
}

.file-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: .4rem;
  max-height: 280px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .5rem .75rem;
  border-radius: var(--radius-sm);
  background: var(--col-bg);
  border: 1px solid var(--col-border);
  font-size: .85rem;
}

.file-item-icon { font-size: 1rem; flex-shrink: 0; }
.file-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-item-size { color: var(--col-muted); font-size: .78rem; flex-shrink: 0; }
.file-item-ext {
  font-size: .7rem;
  font-weight: 700;
  padding: .1rem .4rem;
  border-radius: 4px;
  flex-shrink: 0;
  text-transform: uppercase;
}
.ext-pdf  { background: #fee2e2; color: #b91c1c; }
.ext-docx { background: #dbeafe; color: #1d4ed8; }
.ext-xlsx { background: #dcfce7; color: #166534; }
.ext-txt  { background: #f3f4f6; color: #374151; }

/* ── Options ── */
#options-card .card-head { border-bottom: none; }

.option-group {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--col-border);
}

.option-label {
  display: block;
  font-size: .85rem;
  font-weight: 600;
  color: var(--col-muted);
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: .75rem;
}

.option-label i { margin-right: .4rem; }

/* Radio cards */
.radio-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: .75rem;
}

.radio-card {
  display: flex;
  flex-direction: column;
  gap: .25rem;
  padding: .9rem 1rem;
  border: 2px solid var(--col-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color .15s, background .15s;
}

.radio-card input { display: none; }
.radio-card:hover { border-color: var(--col-primary); }
.radio-card.selected, .radio-card:has(input:checked) {
  border-color: var(--col-primary);
  background: var(--col-primary-l);
}

.radio-title {
  font-size: .9rem;
  font-weight: 700;
}

.radio-desc {
  font-size: .8rem;
  color: var(--col-muted);
  line-height: 1.4;
}

/* Toggle */
.inline-group { display: flex; align-items: flex-start; }

.toggle-label {
  display: flex;
  align-items: flex-start;
  gap: .85rem;
  cursor: pointer;
}

.toggle-input { display: none; }

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.toggle-switch::before {
  content: '';
  position: absolute;
  inset: 0;
  background: #d1d5db;
  border-radius: 12px;
  transition: background .2s;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  top: 3px;
  left: 3px;
  transition: transform .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.25);
}

.toggle-input:checked + .toggle-switch::before { background: var(--col-primary); }
.toggle-input:checked + .toggle-switch::after  { transform: translateX(20px); }

/* Text input */
.text-input {
  width: 100%;
  max-width: 320px;
  padding: .6rem .85rem;
  border: 1px solid var(--col-border);
  border-radius: var(--radius-sm);
  font-size: .9rem;
  font-family: var(--font);
  background: var(--col-bg);
  color: var(--col-text);
  transition: border-color .15s, box-shadow .15s;
}

.text-input:focus {
  outline: none;
  border-color: var(--col-primary);
  box-shadow: 0 0 0 3px rgba(29,78,216,.12);
}

.field-hint {
  font-size: .8rem;
  color: var(--col-muted);
  margin-top: .4rem;
}

/* Categories */
.categories-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: .5rem;
  margin-bottom: .75rem;
}

.categories-head .option-label { margin-bottom: 0; }

.preset-btns { display: flex; gap: .4rem; }

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: .45rem;
}

.cat-item {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .55rem .75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--col-border);
  cursor: pointer;
  font-size: .88rem;
  background: var(--col-bg);
  transition: background .12s, border-color .12s;
  user-select: none;
}

.cat-item:hover { background: var(--col-primary-l); border-color: var(--col-primary); }
.cat-item:has(input:checked) { background: var(--col-primary-l); border-color: var(--col-primary); font-weight: 600; }
.cat-item input { accent-color: var(--col-primary); width: 15px; height: 15px; flex-shrink: 0; cursor: pointer; }
.cat-item i { color: var(--col-primary); font-size: .85rem; flex-shrink: 0; }

/* ── Action card ── */
#action-card .card-head { border-bottom: none; }

.action-row {
  padding: 1rem 1.5rem 1.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: .75rem;
  align-items: center;
}

/* Progress */
.progress-wrap {
  padding: 0 1.5rem 1rem;
}

.progress-label {
  font-size: .82rem;
  color: var(--col-muted);
  margin-bottom: .45rem;
}

.progress-bar-track {
  height: 8px;
  background: var(--col-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--col-primary), #7c3aed);
  border-radius: 4px;
  transition: width .3s ease;
}

/* Status banner */
.status-banner {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .85rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid var(--col-border);
  font-size: .88rem;
  color: var(--col-muted);
}

.status-banner.info    { background: #f0f7ff; color: #1d4ed8; border-color: #bfdbfe; }
.status-banner.success { background: var(--col-success-l); color: var(--col-success); border-color: #bbf7d0; }
.status-banner.warn    { background: var(--col-warn-l); color: var(--col-warn); border-color: #fde68a; }
.status-banner.error   { background: var(--col-danger-l); color: var(--col-danger); border-color: #fecaca; }

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  padding: .6rem 1.2rem;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: .9rem;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background .15s, opacity .15s, box-shadow .15s;
  text-decoration: none;
  white-space: nowrap;
}

.btn:disabled { opacity: .45; cursor: not-allowed; }

.btn-primary {
  background: var(--col-primary);
  color: #fff;
  border-color: var(--col-primary);
}
.btn-primary:hover:not(:disabled) { background: var(--col-primary-h); }

.btn-outline {
  background: #fff;
  color: var(--col-primary);
  border-color: var(--col-primary);
}
.btn-outline:hover:not(:disabled) { background: var(--col-primary-l); }

.btn-ghost {
  background: transparent;
  color: var(--col-muted);
  border-color: var(--col-border);
}
.btn-ghost:hover:not(:disabled) { background: var(--col-bg); color: var(--col-text); }

.btn-danger {
  background: var(--col-danger);
  color: #fff;
  border-color: var(--col-danger);
}
.btn-danger:hover:not(:disabled) { background: #b91c1c; }

.btn-lg { padding: .8rem 1.6rem; font-size: 1rem; }
.btn-sm { padding: .35rem .7rem; font-size: .8rem; }
.btn-xs { padding: .2rem .55rem; font-size: .75rem; }

/* ── Results ── */
#results-card .card-head { border-bottom: 1px solid var(--col-border); }
#resultsContainer { padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }

.result-card {
  border: 1px solid var(--col-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.result-card-head {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .85rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid var(--col-border);
  flex-wrap: wrap;
}

.result-card-head h3 {
  font-size: .9rem;
  font-weight: 700;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meta {
  font-size: .78rem;
  color: var(--col-muted);
}

.result-mode {
  font-size: .75rem;
  padding: .15rem .5rem;
  border-radius: 4px;
  font-weight: 600;
  flex-shrink: 0;
}

.mode-blackout { background: #1f2937; color: #f9fafb; }
.mode-rebuild  { background: var(--col-primary-l); color: var(--col-primary); }
.mode-ocr      { background: var(--col-accent-l); color: var(--col-accent); }
.mode-error    { background: var(--col-danger-l); color: var(--col-danger); }
.mode-docx     { background: #dbeafe; color: #1d4ed8; }
.mode-xlsx     { background: #dcfce7; color: #166534; }
.mode-txt      { background: #f3f4f6; color: #374151; }

.result-downloads {
  display: flex;
  gap: .4rem;
  flex-wrap: wrap;
  padding: .6rem 1rem;
  border-bottom: 1px solid var(--col-border);
  background: #fafbfc;
}

.download-link {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .35rem .65rem;
  background: var(--col-primary);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: .78rem;
  font-weight: 600;
  text-decoration: none;
  transition: background .12s;
}

.download-link:hover { background: var(--col-primary-h); }
.download-link.dl-pdf  { background: #dc2626; }
.download-link.dl-pdf:hover  { background: #b91c1c; }
.download-link.dl-docx { background: #2563eb; }
.download-link.dl-docx:hover { background: #1d4ed8; }
.download-link.dl-xlsx { background: #16a34a; }
.download-link.dl-xlsx:hover { background: #15803d; }
.download-link.dl-txt  { background: #6b7280; }
.download-link.dl-txt:hover  { background: #4b5563; }

.result-preview {
  padding: .85rem 1rem;
  font-size: .82rem;
  font-family: 'Consolas', 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: #374151;
  background: #f9fafb;
  max-height: 280px;
  overflow-y: auto;
  line-height: 1.55;
  border-top: 1px solid var(--col-border);
}

.result-preview.error-preview {
  color: var(--col-danger);
  background: var(--col-danger-l);
}

/* ── Map table ── */
#map-card { overflow: visible; }
#map-card .card-head { border-bottom: 1px solid var(--col-border); }

.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  padding: .75rem 1.5rem;
  border-bottom: 1px solid var(--col-border);
}

.stat-chip {
  font-size: .78rem;
  font-weight: 600;
  padding: .2rem .55rem;
  border-radius: 4px;
  background: var(--col-primary-l);
  color: var(--col-primary);
}

.table-scroll {
  overflow-x: auto;
  padding: 1rem 1.5rem;
}

.map-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
}

.map-table th, .map-table td {
  padding: .55rem .75rem;
  text-align: left;
  border-bottom: 1px solid var(--col-border);
  vertical-align: top;
}

.map-table th {
  font-size: .75rem;
  font-weight: 700;
  color: var(--col-muted);
  text-transform: uppercase;
  letter-spacing: .05em;
  background: #f8fafc;
  position: sticky;
  top: 0;
}

.map-table td:first-child {
  font-weight: 600;
  font-size: .78rem;
  white-space: nowrap;
}

.map-table tr:hover td { background: #f8fafc; }

.cat-tag {
  display: inline-block;
  padding: .12rem .4rem;
  border-radius: 4px;
  font-size: .72rem;
  font-weight: 700;
}

/* category colours */
.cat-PERSON       { background: #fce7f3; color: #be185d; }
.cat-CASE_ID      { background: #e0e7ff; color: #3730a3; }
.cat-PASSPORT_OR_ID { background: #e0e7ff; color: #3730a3; }
.cat-ADDRESS      { background: #fef9c3; color: #a16207; }
.cat-EMAIL        { background: #dcfce7; color: #15803d; }
.cat-PHONE        { background: #dcfce7; color: #15803d; }
.cat-DATE_EXACT   { background: #fef3c7; color: #b45309; }
.cat-COUNTRY      { background: #dbeafe; color: #1d4ed8; }
.cat-LOCATION     { background: #dbeafe; color: #1d4ed8; }
.cat-FACILITY     { background: #f3e8ff; color: #6d28d9; }
.cat-ROUTE        { background: #f3e8ff; color: #6d28d9; }
.cat-FAMILY_TERM  { background: #fff1f2; color: #be123c; }

/* ── Misc ── */
.chip {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .25rem .65rem;
  border-radius: 20px;
  font-size: .75rem;
  font-weight: 600;
}

.chip-green { background: var(--col-success-l); color: var(--col-success); border: 1px solid #bbf7d0; }

.muted-text { color: var(--col-muted); }
.small-text { font-size: .8rem; }

/* ── Footer ── */
.site-footer {
  text-align: center;
  padding: 1.5rem 1rem;
  font-size: .8rem;
  color: var(--col-muted);
  border-top: 1px solid var(--col-border);
  background: var(--col-surface);
  margin-top: 2rem;
}

/* ── Responsive ── */
@media (max-width: 680px) {
  .header-inner { flex-direction: column; align-items: flex-start; padding: .75rem 0; }
  .radio-group { grid-template-columns: 1fr; }
  .category-grid { grid-template-columns: 1fr 1fr; }
  .action-row { flex-direction: column; align-items: stretch; }
  .btn-lg { justify-content: center; }
  .result-card-head { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 440px) {
  .category-grid { grid-template-columns: 1fr; }
  .preset-btns { flex-wrap: wrap; }
}

/* ── Scrollbar styling ── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--col-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--col-muted); }

/* ── Loading spinner ── */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin .6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
