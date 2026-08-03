<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EUAA PDF Redaction Tool</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⬛</text></svg>" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" />
  <style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f0f4f8;--surface:#fff;--border:#d1dae6;--text:#1a2233;--muted:#6b7a96;
  --primary:#1d4ed8;--primary-h:#1e40af;--primary-l:#dbeafe;
  --success:#16a34a;--success-l:#dcfce7;
  --danger:#dc2626;--danger-l:#fee2e2;
  --black:#111827;
  --r-sm:6px;--r-md:10px;--r-lg:16px;
  --sh-sm:0 1px 3px rgba(0,0,0,.08);--sh-md:0 4px 12px rgba(0,0,0,.10);
  --font:'Segoe UI',system-ui,-apple-system,sans-serif;
}
html{font-size:16px;scroll-behavior:smooth}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh}

/* ── Header ── */
.site-header{background:linear-gradient(135deg,#111827 0%,#1d4ed8 100%);color:#fff;padding:0 1.5rem;position:sticky;top:0;z-index:100;box-shadow:var(--sh-md)}
.header-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;min-height:68px;gap:1rem}
.brand{display:flex;align-items:center;gap:.85rem}
.brand-icon{font-size:1.9rem;opacity:.9}
.brand-title{font-size:1.15rem;font-weight:700;color:#fff}
.brand-sub{font-size:.72rem;color:rgba(255,255,255,.65);margin-top:1px}
.badge{display:inline-flex;align-items:center;gap:.3rem;padding:.22rem .65rem;border-radius:20px;font-size:.7rem;font-weight:600}
.badge-green{background:rgba(22,163,74,.25);color:#4ade80;border:1px solid rgba(74,222,128,.3)}
.badge-dark{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.18)}

/* ── Layout ── */
.wrap{max-width:1100px;margin:2rem auto;padding:0 1.5rem 4rem;display:flex;flex-direction:column;gap:1.5rem}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--sh-sm);overflow:hidden}
.card-head{display:flex;align-items:center;gap:.85rem;padding:1.2rem 1.5rem;border-bottom:1px solid var(--border);background:#f8fafc}
.card-head h2{font-size:1rem;font-weight:700;flex:1}
.step{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--black);color:#fff;font-size:.78rem;font-weight:700;flex-shrink:0}

/* ── Upload ── */
.upload-area{padding:2.5rem 1.5rem;display:flex;flex-direction:column;align-items:center;gap:.7rem;border-bottom:1px solid var(--border);transition:background .15s}
.upload-area.dragover{background:var(--primary-l);border:2px dashed var(--primary);border-radius:var(--r-md)}
.upload-icon{font-size:2.8rem;color:var(--primary)}
.upload-label{font-size:1.05rem;font-weight:600}
.upload-hint{font-size:.83rem;color:var(--muted)}
.upload-btn-row{display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center;margin-top:.4rem}

/* ── File queue ── */
.file-queue{padding:1rem 1.5rem}
.queue-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem}
.queue-count{font-size:.83rem;font-weight:600;color:var(--muted)}
.file-list{list-style:none;display:flex;flex-direction:column;gap:.35rem;max-height:260px;overflow-y:auto}
.file-item{display:flex;align-items:center;gap:.7rem;padding:.45rem .7rem;border-radius:var(--r-sm);background:var(--bg);border:1px solid var(--border);font-size:.83rem}
.file-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-item-size{color:var(--muted);font-size:.75rem;flex-shrink:0}
.file-item-ext{font-size:.68rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;flex-shrink:0;text-transform:uppercase;background:#fee2e2;color:#b91c1c}

/* ── Options ── */
.opt-group{padding:1.1rem 1.5rem;border-top:1px solid var(--border)}
.opt-label{display:block;font-size:.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.7rem}
.opt-label i{margin-right:.4rem}
.field-hint{font-size:.78rem;color:var(--muted);margin-top:.35rem}

/* ── Category grid ── */
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.4rem}
.cat-item{display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem;border-radius:var(--r-sm);border:1px solid var(--border);cursor:pointer;font-size:.86rem;background:var(--bg);transition:background .12s,border-color .12s;user-select:none}
.cat-item:hover{background:var(--primary-l);border-color:var(--primary)}
.cat-item:has(input:checked){background:var(--primary-l);border-color:var(--primary);font-weight:600}
.cat-item input{accent-color:var(--primary);width:15px;height:15px;flex-shrink:0;cursor:pointer}
.cat-item i{color:var(--primary);font-size:.82rem;flex-shrink:0}

/* ── Bar size control ── */
.bar-size-row{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
.bar-size-row label{font-size:.86rem;font-weight:600;color:var(--text)}
.range-wrap{display:flex;align-items:center;gap:.6rem;flex:1;min-width:180px}
input[type=range]{flex:1;accent-color:var(--black);height:4px;cursor:pointer}
.range-val{min-width:3rem;font-size:.86rem;font-weight:700;color:var(--black);font-family:monospace;text-align:right}
.bar-preview{height:18px;background:var(--black);border-radius:2px;transition:height .15s}

/* ── Manual terms ── */
.refcom-box{width:100%;padding:.6rem .8rem;border:1px solid var(--border);border-radius:var(--r-sm);font-size:.86rem;font-family:'Consolas','Courier New',monospace;background:var(--bg);color:var(--text);resize:vertical;transition:border-color .15s,box-shadow .15s;line-height:1.7;min-height:80px}
.refcom-box:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(29,78,216,.12)}
.chip-row{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem;min-height:1.2rem}
.chip{display:inline-flex;align-items:center;gap:.25rem;background:var(--black);color:#f9fafb;font-size:.73rem;font-family:'Consolas','Courier New',monospace;padding:.15rem .5rem;border-radius:3px;font-weight:600}
.chip-del{cursor:pointer;opacity:.55;background:none;border:none;color:inherit;padding:0 0 0 .15rem;font-size:.9rem;line-height:1}
.chip-del:hover{opacity:1}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.55rem 1.1rem;border-radius:var(--r-sm);font-family:var(--font);font-size:.88rem;font-weight:600;border:1px solid transparent;cursor:pointer;transition:background .15s,opacity .15s;text-decoration:none;white-space:nowrap}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-black{background:var(--black);color:#fff;border-color:var(--black)}
.btn-black:hover:not(:disabled){background:#374151}
.btn-outline{background:#fff;color:var(--primary);border-color:var(--primary)}
.btn-outline:hover:not(:disabled){background:var(--primary-l)}
.btn-ghost{background:transparent;color:var(--muted);border-color:var(--border)}
.btn-ghost:hover:not(:disabled){background:var(--bg);color:var(--text)}
.btn-lg{padding:.75rem 1.5rem;font-size:.98rem}
.btn-sm{padding:.3rem .65rem;font-size:.78rem}

/* ── Action ── */
.action-row{padding:1rem 1.5rem;display:flex;flex-wrap:wrap;gap:.7rem;align-items:center}

/* ── Progress bar ── */
.progress-wrap{padding:.5rem 1.5rem 1rem}
.progress-label{font-size:.8rem;color:var(--muted);margin-bottom:.4rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.progress-bar-track{height:8px;background:var(--border);border-radius:4px;overflow:hidden}
.progress-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#1d4ed8,#111827);border-radius:4px;transition:width .25s ease}

/* ── Status ── */
.status-banner{display:flex;align-items:center;gap:.55rem;padding:.8rem 1.5rem;background:#f8fafc;border-top:1px solid var(--border);font-size:.86rem;color:var(--muted)}
.status-banner.info{background:#f0f7ff;color:var(--primary);border-color:#bfdbfe}
.status-banner.success{background:var(--success-l);color:var(--success);border-color:#bbf7d0}
.status-banner.warn{background:#fef3c7;color:#d97706;border-color:#fde68a}
.status-banner.error{background:var(--danger-l);color:var(--danger);border-color:#fecaca}

/* ── Results ── */
#resultsContainer{padding:1rem 1.5rem;display:flex;flex-direction:column;gap:1rem}
.result-card{border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden}
.result-head{display:flex;align-items:center;gap:.7rem;padding:.8rem 1rem;background:#f8fafc;border-bottom:1px solid var(--border);flex-wrap:wrap}
.result-head h3{font-size:.88rem;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.result-meta{font-size:.76rem;color:var(--muted)}
.badge-redacted{background:#111827;color:#f9fafb;font-size:.73rem;padding:.12rem .45rem;border-radius:3px;font-weight:700;flex-shrink:0}
.result-dl{display:flex;gap:.4rem;flex-wrap:wrap;padding:.55rem 1rem;background:#fafbfc}
.dl-link{display:inline-flex;align-items:center;gap:.3rem;padding:.32rem .7rem;background:var(--black);color:#fff;border-radius:var(--r-sm);font-size:.82rem;font-weight:600;text-decoration:none;border:none;cursor:pointer;transition:background .12s;font-family:var(--font)}
.dl-link:hover:not(:disabled){background:#374151}
.btn-review{background:#1d4ed8;color:#fff}
.btn-review:hover:not(:disabled){background:#1e40af}

/* ── Spinner ── */
.spinner{display:inline-block;width:15px;height:15px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ══════════════════════════════════════════════════════════
   REVIEW MODAL
   ══════════════════════════════════════════════════════════ */
.modal-backdrop{
  display:none;
  position:fixed;inset:0;
  background:rgba(0,0,0,.75);
  z-index:9000;
  align-items:stretch;
  justify-content:stretch;
  flex-direction:column;
}
.modal-backdrop.open{display:flex;}
.modal-shell{
  display:flex;flex-direction:column;
  background:#1a2233;
  width:100%;height:100%;
  overflow:hidden;
}
/* top bar */
.modal-topbar{
  display:flex;align-items:center;gap:.75rem;
  padding:.7rem 1.2rem;
  background:#111827;
  border-bottom:1px solid #374151;
  flex-shrink:0;
  flex-wrap:wrap;
}
.modal-title{color:#f9fafb;font-size:.95rem;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.modal-hint{color:#9ca3af;font-size:.78rem;flex-shrink:0}

/* canvas area */
.modal-canvas-area{
  flex:1;overflow:auto;
  display:flex;align-items:flex-start;justify-content:center;
  padding:1.2rem;
  background:#1a2233;
  min-height:0;
}
#modalCanvasContainer{
  display:flex;align-items:flex-start;justify-content:center;
  width:100%;
}
#modalDisplayCanvas{
  box-shadow:0 0 0 2px #374151, 0 8px 32px rgba(0,0,0,.5);
  border-radius:4px;
  max-width:100%;
}

/* bottom toolbar */
.modal-toolbar{
  display:flex;align-items:center;gap:.6rem;
  padding:.7rem 1.2rem;
  background:#111827;
  border-top:1px solid #374151;
  flex-shrink:0;
  flex-wrap:wrap;
}
.modal-nav-group{display:flex;align-items:center;gap:.5rem}
.modal-page-info{color:#d1d5db;font-size:.85rem;font-weight:600;min-width:100px;text-align:center}

/* dark modal buttons */
.btn-modal{
  display:inline-flex;align-items:center;gap:.35rem;
  padding:.4rem .85rem;
  border-radius:6px;font-size:.83rem;font-weight:600;
  border:1px solid transparent;cursor:pointer;
  transition:background .12s;font-family:var(--font);
  white-space:nowrap;
}
.btn-modal:disabled{opacity:.35;cursor:not-allowed}
.btn-modal-ghost{background:transparent;color:#d1d5db;border-color:#374151}
.btn-modal-ghost:hover:not(:disabled){background:#374151;color:#f9fafb}
.btn-modal-danger{background:#7f1d1d;color:#fca5a5;border-color:#991b1b}
.btn-modal-danger:hover:not(:disabled){background:#991b1b}
.btn-modal-primary{background:#1d4ed8;color:#fff;border-color:#1d4ed8}
.btn-modal-primary:hover:not(:disabled){background:#1e40af}
.btn-modal-success{background:#15803d;color:#fff;border-color:#15803d}
.btn-modal-success:hover:not(:disabled){background:#166534}

/* thickness row inside modal */
.modal-thickness-row{display:flex;align-items:center;gap:.5rem;color:#d1d5db;font-size:.8rem}
.modal-thickness-row input[type=range]{width:90px;accent-color:#6366f1}
.modal-thickness-val{font-family:monospace;font-weight:700;color:#a5b4fc;min-width:32px}

/* separator */
.modal-sep{width:1px;height:24px;background:#374151;flex-shrink:0}

/* ── Footer ── */
.site-footer{text-align:center;padding:1.5rem 1rem;font-size:.78rem;color:var(--muted);border-top:1px solid var(--border);background:var(--surface);margin-top:2rem}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
@media(max-width:680px){
  .wrap{padding:0 1rem 3rem}
  .cat-grid{grid-template-columns:1fr 1fr}
  .action-row{flex-direction:column;align-items:stretch}
  .btn-lg{justify-content:center}
  .modal-toolbar{gap:.35rem}
  .modal-thickness-row input[type=range]{width:60px}
}
  </style>
</head>
<body>

<!-- ── HEADER ── -->
<header class="site-header">
  <div class="header-inner">
    <div class="brand">
      <span class="brand-icon">⬛</span>
      <div>
        <div class="brand-title">EUAA PDF Redaction Tool</div>
        <div class="brand-sub">Black-bar redaction · Browser-only · No server storage</div>
      </div>
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <span class="badge badge-green"><i class="fa-solid fa-lock"></i> Client-side only</span>
      <span class="badge badge-dark"><i class="fa-solid fa-file-pdf"></i> PDF only</span>
    </div>
  </div>
</header>

<main class="wrap">

  <!-- ── STEP 1: Upload ── -->
  <section class="card" id="upload-card">
    <div class="card-head">
      <span class="step">1</span>
      <h2>Upload PDF files</h2>
    </div>

    <div class="upload-area" id="dropZone">
      <div class="upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
      <p class="upload-label">Drag &amp; drop PDF files here</p>
      <p class="upload-hint">Only PDF files are supported</p>
      <div class="upload-btn-row">
        <label class="btn btn-outline" style="cursor:pointer;">
          <i class="fa-solid fa-file-pdf"></i> Select PDF files
          <input id="fileInput" type="file" multiple accept=".pdf" style="display:none;" />
        </label>
        <label class="btn btn-outline" style="cursor:pointer;">
          <i class="fa-solid fa-folder-open"></i> Select folder
          <input id="folderInput" type="file" webkitdirectory directory multiple style="display:none;" />
        </label>
      </div>
    </div>

    <script>
    (function(){
      window._redactFiles = [];
      function fmtBytes(n){if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB';}
      function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
      window.addFilesToQueue = function(raw){
        var seen=new Set(window._redactFiles.map(function(f){return f.name;}));
        var added=0;
        for(var i=0;i<raw.length;i++){
          var f=raw[i];
          var name=f.webkitRelativePath||f.relativePath||f.name||'';
          var ext=(name.split('.').pop()||'').toLowerCase();
          if(ext!=='pdf')continue;
          if(seen.has(name))continue;
          window._redactFiles.push({file:f,name:name,size:f.size});
          seen.add(name); added++;
        }
        renderQ();
        if(added>0){
          var sb=document.getElementById('statusText');
          if(sb)sb.textContent=window._redactFiles.length+' PDF(s) ready.';
          var bn=document.getElementById('statusBanner');
          if(bn)bn.className='status-banner info';
        }
        var pb=document.getElementById('processBtn');
        if(pb)pb.disabled=window._redactFiles.length===0;
      };
      function renderQ(){
        var n=window._redactFiles.length;
        var cnt=document.getElementById('fileCount');
        var lst=document.getElementById('fileList');
        var qw=document.getElementById('fileQueue');
        if(!cnt||!lst||!qw)return;
        cnt.textContent=n+' file'+(n===1?'':'s')+' queued';
        lst.innerHTML='';
        window._redactFiles.forEach(function(f){
          var li=document.createElement('li');
          li.className='file-item';
          li.innerHTML='<i class="fa-solid fa-file-pdf" style="color:#dc2626;flex-shrink:0"></i>'+
            '<span class="file-item-name" title="'+esc(f.name)+'">'+esc(f.name)+'</span>'+
            '<span class="file-item-size">'+fmtBytes(f.size)+'</span>'+
            '<span class="file-item-ext">pdf</span>';
          lst.appendChild(li);
        });
        qw.style.display=n>0?'':'none';
      }
      function wire(id){
        var el=document.getElementById(id);
        if(!el)return;
        el.addEventListener('change',function(){
          if(this.files&&this.files.length)window.addFilesToQueue(Array.prototype.slice.call(this.files));
          this.value='';
        });
      }
      wire('fileInput'); wire('folderInput');
      document.addEventListener('dragover',function(e){e.preventDefault();});
      document.addEventListener('drop',function(e){e.preventDefault();});
      var zone=document.getElementById('dropZone');
      if(zone){
        zone.addEventListener('dragenter',function(e){e.preventDefault();zone.classList.add('dragover');});
        zone.addEventListener('dragover',function(e){e.preventDefault();zone.classList.add('dragover');});
        zone.addEventListener('dragleave',function(e){if(!zone.contains(e.relatedTarget))zone.classList.remove('dragover');});
        zone.addEventListener('drop',function(e){
          e.preventDefault();e.stopPropagation();zone.classList.remove('dragover');
          var files=[];
          var items=e.dataTransfer&&e.dataTransfer.items;
          if(items&&items.length&&items[0].webkitGetAsEntry){
            var pending=0;
            function walk(entry,prefix){
              prefix=prefix||'';
              if(entry.isFile){pending++;entry.file(function(f){
                try{Object.defineProperty(f,'relativePath',{value:prefix+f.name,configurable:true});}catch(ex){}
                files.push(f);pending--;if(pending===0)window.addFilesToQueue(files);
              },function(){pending--;if(pending===0)window.addFilesToQueue(files);});}
              else if(entry.isDirectory){pending++;var r=entry.createReader();
                r.readEntries(function(ents){pending--;
                  for(var j=0;j<ents.length;j++)walk(ents[j],prefix+entry.name+'/');
                  if(pending===0)window.addFilesToQueue(files);
                },function(){pending--;if(pending===0)window.addFilesToQueue(files);});}
            }
            var any=false;
            for(var i=0;i<items.length;i++){var ent=items[i].webkitGetAsEntry&&items[i].webkitGetAsEntry();if(ent){any=true;walk(ent,'');}}
            if(!any)window.addFilesToQueue([]);
          } else {
            var dt=e.dataTransfer&&e.dataTransfer.files;
            if(dt)window.addFilesToQueue(Array.prototype.slice.call(dt));
          }
        });
      }
    })();
    </script>

    <div class="file-queue" id="fileQueue" style="display:none;">
      <div class="queue-header">
        <span id="fileCount" class="queue-count">0 files</span>
        <button class="btn btn-ghost btn-sm" id="clearFilesBtn"><i class="fa-solid fa-xmark"></i> Clear list</button>
      </div>
      <ul class="file-list" id="fileList"></ul>
    </div>
  </section>

  <!-- ── STEP 2: Redaction settings ── -->
  <section class="card" id="options-card">
    <div class="card-head">
      <span class="step">2</span>
      <h2>Redaction settings</h2>
    </div>

    <!-- Auto-detect categories -->
    <div class="opt-group">
      <label class="opt-label"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-detect &amp; black out</label>
      <p class="field-hint" style="margin-bottom:.75rem;">Select which types of information to automatically find and cover with a black bar.</p>
      <div class="cat-grid">
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="PERSON" checked /><i class="fa-solid fa-user"></i> Names / persons</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="CASE_ID" checked /><i class="fa-solid fa-hashtag"></i> Case / Refcom numbers</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="PASSPORT_OR_ID" checked /><i class="fa-solid fa-id-card"></i> IDs / passports</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="ADDRESS" checked /><i class="fa-solid fa-map-marker-alt"></i> Addresses</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="EMAIL" checked /><i class="fa-solid fa-envelope"></i> Email addresses</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="PHONE" checked /><i class="fa-solid fa-phone"></i> Phone numbers</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="DATE_EXACT" checked /><i class="fa-solid fa-calendar-day"></i> Exact dates</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="COUNTRY" checked /><i class="fa-solid fa-flag"></i> Countries / nationalities</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="LOCATION" checked /><i class="fa-solid fa-location-dot"></i> Locations / cities</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="FACILITY" checked /><i class="fa-solid fa-building"></i> Facilities / centres</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="ROUTE" checked /><i class="fa-solid fa-route"></i> Travel routes</label>
        <label class="cat-item"><input type="checkbox" class="entity-toggle" value="FAMILY_TERM" checked /><i class="fa-solid fa-people-group"></i> Family details</label>
      </div>
    </div>

    <!-- Manual terms to black out -->
    <div class="opt-group">
      <label class="opt-label" for="manualTerms"><i class="fa-solid fa-keyboard"></i> Manual terms to auto black out</label>
      <p class="field-hint" style="margin-bottom:.6rem;">Type specific words, numbers or phrases — one per line. Every exact match in the PDF will be blacked out automatically.</p>
      <textarea id="manualTerms" class="refcom-box" rows="4" spellcheck="false" autocomplete="off"
        placeholder="e.g.&#10;32939&#10;MTL/2024/12345&#10;John Smith&#10;SYR-2023-00456"></textarea>
      <div class="chip-row" id="termChips"></div>
    </div>

    <!-- Black bar thickness -->
    <div class="opt-group">
      <label class="opt-label"><i class="fa-solid fa-expand"></i> Auto-bar thickness (padding)</label>
      <p class="field-hint" style="margin-bottom:.75rem;">Increase if bars are not fully covering text. The bar extends above and below each detected word.</p>
      <div class="bar-size-row">
        <label>Padding (px):</label>
        <div class="range-wrap">
          <input type="range" id="barPadding" min="0" max="20" value="4" step="1" />
          <span class="range-val" id="barPaddingVal">4 px</span>
        </div>
        <div>
          <div style="font-size:.75rem;color:var(--muted);margin-bottom:.3rem;">Preview:</div>
          <div class="bar-preview" id="barPreview" style="width:120px;height:18px;"></div>
        </div>
      </div>
    </div>

    <!-- OCR toggle -->
    <div class="opt-group" style="display:flex;align-items:flex-start;gap:1rem;">
      <label style="display:flex;align-items:flex-start;gap:.8rem;cursor:pointer;">
        <input type="checkbox" id="ocrToggle" checked style="width:16px;height:16px;margin-top:3px;accent-color:var(--black);cursor:pointer;" />
        <span>
          <strong>OCR fallback for scanned PDFs</strong><br>
          <span style="font-size:.8rem;color:var(--muted);">Enables redaction on image-based / scanned PDFs. Slower but thorough.</span>
        </span>
      </label>
    </div>
  </section>

  <!-- ── STEP 3: Redact ── -->
  <section class="card" id="action-card">
    <div class="card-head">
      <span class="step">3</span>
      <h2>Apply redaction &amp; download</h2>
    </div>
    <div class="action-row">
      <button class="btn btn-black btn-lg" id="processBtn" disabled>
        <i class="fa-solid fa-square"></i> Apply black bars
      </button>
      <button class="btn btn-outline btn-lg" id="downloadAllBtn" disabled>
        <i class="fa-solid fa-download"></i> Download all (ZIP)
      </button>
      <button class="btn btn-ghost btn-lg" id="clearSessionBtn">
        <i class="fa-solid fa-rotate-left"></i> Clear session
      </button>
    </div>
    <div class="progress-wrap" id="progressWrap" style="display:none;">
      <div class="progress-label" id="progressLabel">Processing…</div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" id="progressFill" style="width:0%"></div>
      </div>
    </div>
    <div class="status-banner info" id="statusBanner">
      <i class="fa-solid fa-circle-info"></i>
      <span id="statusText">Upload PDF files above to get started.</span>
    </div>
  </section>

  <!-- ── STEP 4: Results ── -->
  <section class="card" id="results-card" style="display:none;">
    <div class="card-head">
      <span class="step">4</span>
      <h2>Redacted files</h2>
      <div style="margin-left:auto;display:flex;align-items:center;gap:.5rem;">
        <span style="font-size:.78rem;color:var(--muted);">Processed in browser only</span>
        <i class="fa-solid fa-lock" style="color:var(--success)"></i>
      </div>
    </div>
    <div id="resultsContainer"></div>
  </section>

</main>

<footer class="site-footer">
  EUAA PDF Redaction Tool — All processing is done entirely in your browser. No files or data are transmitted to any server.
</footer>


<!-- ══════════════════════════════════════════════════════════════════════════
     MANUAL REVIEW MODAL
     Full-screen overlay. Shows each page as a canvas.
     User draws black bars by clicking + dragging.
     ══════════════════════════════════════════════════════════════════════════ -->
<div id="reviewModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Manual bar review">
  <div class="modal-shell">

    <!-- Top bar -->
    <div class="modal-topbar">
      <span class="modal-title" id="modalTitle">Review &amp; add manual bars</span>
      <span class="modal-hint"><i class="fa-solid fa-hand-pointer"></i> Click &amp; drag to draw a black bar</span>
      <button class="btn-modal btn-modal-ghost" id="modalCloseBtn" title="Close without saving"><i class="fa-solid fa-xmark"></i> Close</button>
    </div>

    <!-- Canvas area -->
    <div class="modal-canvas-area">
      <div id="modalCanvasContainer"></div>
    </div>

    <!-- Bottom toolbar -->
    <div class="modal-toolbar">
      <!-- Page navigation -->
      <div class="modal-nav-group">
        <button class="btn-modal btn-modal-ghost" id="modalPrevBtn" title="Previous page">
          <i class="fa-solid fa-chevron-left"></i> Prev
        </button>
        <span class="modal-page-info" id="modalPageInfo">Page 1 of 1</span>
        <button class="btn-modal btn-modal-ghost" id="modalNextBtn" title="Next page">
          Next <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <div class="modal-sep"></div>

      <!-- Bar thickness for manual draws -->
      <div class="modal-thickness-row">
        <i class="fa-solid fa-minus" style="font-size:.7rem"></i>
        <label for="modalBarThickness" style="white-space:nowrap;">Bar height:</label>
        <input type="range" id="modalBarThickness" min="4" max="60" value="16" step="1" />
        <i class="fa-solid fa-plus" style="font-size:.7rem"></i>
        <span class="modal-thickness-val" id="modalBarThicknessVal">16 px</span>
      </div>

      <div class="modal-sep"></div>

      <!-- Undo last bar on this page -->
      <button class="btn-modal btn-modal-danger" id="modalUndoBtn" title="Undo last bar on this page">
        <i class="fa-solid fa-rotate-left"></i> Undo
      </button>

      <div style="flex:1"></div>

      <!-- Cancel -->
      <button class="btn-modal btn-modal-ghost" id="modalCancelBtn">
        Cancel
      </button>

      <!-- Finalise + download -->
      <button class="btn-modal btn-modal-success" id="modalDownloadBtn">
        <i class="fa-solid fa-download"></i> Finalise &amp; download
      </button>
    </div>

  </div>
</div>


<!-- ── Inline scripts (no CDN needed) ── -->
<script>
(function(){
  /* Bar padding preview */
  var slider  = document.getElementById('barPadding');
  var valLbl  = document.getElementById('barPaddingVal');
  var preview = document.getElementById('barPreview');
  function updateBarPreview(){
    var v = parseInt(slider.value,10);
    valLbl.textContent = v + ' px';
    preview.style.height = (10 + v*2) + 'px';
  }
  slider.addEventListener('input', updateBarPreview);
  updateBarPreview();

  /* Manual terms chips */
  var ta      = document.getElementById('manualTerms');
  var chipRow = document.getElementById('termChips');
  function updateChips(){
    var vals = ta.value.split(/[\n,;]+/).map(function(s){return s.trim();}).filter(function(s){return s.length>0;});
    chipRow.innerHTML = '';
    vals.forEach(function(v){
      var chip = document.createElement('span');
      chip.className = 'chip';
      var lbl = document.createTextNode(v);
      var del = document.createElement('button');
      del.className = 'chip-del';
      del.textContent = '×';
      del.title = 'Remove "'+v+'"';
      del.addEventListener('click', function(){
        var lines = ta.value.split(/[\n,;]+/).map(function(s){return s.trim();}).filter(function(s){return s.length>0 && s!==v;});
        ta.value = lines.join('\n');
        updateChips();
      });
      chip.appendChild(lbl);
      chip.appendChild(del);
      chipRow.appendChild(chip);
    });
  }
  ta.addEventListener('input', updateChips);

  /* Modal bar-thickness live label */
  var mSlider = document.getElementById('modalBarThickness');
  var mLbl    = document.getElementById('modalBarThicknessVal');
  mSlider.addEventListener('input', function(){
    mLbl.textContent = this.value + ' px';
  });
})();
</script>

<!-- ── CDN libraries ── -->
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
<script>
  if(typeof pdfjsLib!=='undefined')
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
</script>
<script src="js/anonymizer.js"></script>
<script src="js/pdf-processor.js"></script>
<script src="js/app.js"></script>
<script src="https://www.genspark.ai/sandbox_inspect.js"></script></body>
</html>
