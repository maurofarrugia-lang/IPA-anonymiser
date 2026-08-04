/* EUAA Enhanced App Controller */
window.addEventListener('load', function () {
  'use strict';
  if(!document.getElementById('processBtn')) return; // not on app page
  var processBtn=document.getElementById('processBtn');
  var downloadAllBtn=document.getElementById('downloadAllBtn');
  var clearFilesBtn=document.getElementById('clearFilesBtn');
  var clearSessionBtn=document.getElementById('clearSessionBtn');
  var progressWrap=document.getElementById('progressWrap');
  var progressFill=document.getElementById('progressFill');
  var progressLabel=document.getElementById('progressLabel');
  var statusBanner=document.getElementById('statusBanner');
  var statusText=document.getElementById('statusText');
  var resultsCard=document.getElementById('results-card');
  var resultsContainer=document.getElementById('resultsContainer');
  var fileQueue=document.getElementById('fileQueue');
  var fileCount=document.getElementById('fileCount');
  var fileList=document.getElementById('fileList');
  var summaryCard=document.getElementById('summary-card');
  var summaryGrid=document.getElementById('summaryGrid');
  var sessionResults=[];
  window._redactFiles=window._redactFiles||[];
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fmtSize(n){if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB';}
  function setStatus(msg,type){statusBanner.className='status-banner'+(type?' '+type:'');statusText.textContent=msg;}
  function showProgress(pct,lbl){progressWrap.style.display='';progressFill.style.width=Math.min(100,Math.max(0,pct))+'%';if(lbl!==undefined)progressLabel.textContent=lbl;}
  function hideProgress(){progressWrap.style.display='none';}
  function confClass(c){return c>=80?'conf-high':c>=55?'conf-med':'conf-low';}
  function confLabel(c){return Math.round(c)+'%';}
  function triggerDownload(blob,filename){var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},90000);}
  function refreshQueue(){var files=window._redactFiles||[];var n=files.length;fileCount.textContent=n+' file'+(n===1?'':'s')+' queued';fileList.innerHTML='';files.forEach(function(f){var li=document.createElement('li');li.className='file-item';li.innerHTML='<i class="fa-solid fa-file-pdf" style="color:#dc2626;flex-shrink:0"></i><span class="file-item-name">'+esc(f.name)+'</span><span class="file-item-size">'+fmtSize(f.size)+'</span>';fileList.appendChild(li);});fileQueue.style.display=n>0?'':'none';processBtn.disabled=n===0;}
  function addFiles(raw){var seen=new Set((window._redactFiles||[]).map(function(f){return f.name;}));raw.forEach(function(f){var name=f.webkitRelativePath||f.name||'';var ext=(name.split('.').pop()||'').toLowerCase();if(ext!=='pdf'||seen.has(name))return;window._redactFiles.push({file:f,name:name,size:f.size});seen.add(name);});refreshQueue();if(window._redactFiles.length>0)setStatus(window._redactFiles.length+' PDF(s) ready. Configure settings then click Apply.','info');}
  var fileInput=document.getElementById('fileInput');
  fileInput.addEventListener('change',function(){addFiles(Array.prototype.slice.call(this.files));this.value='';});
  var dropZone=document.getElementById('dropZone');
  document.addEventListener('dragover',function(e){e.preventDefault();});
  document.addEventListener('drop',function(e){e.preventDefault();});
  dropZone.addEventListener('dragenter',function(e){e.preventDefault();dropZone.classList.add('dragover');});
  dropZone.addEventListener('dragover',function(e){e.preventDefault();dropZone.classList.add('dragover');});
  dropZone.addEventListener('dragleave',function(e){if(!dropZone.contains(e.relatedTarget))dropZone.classList.remove('dragover');});
  dropZone.addEventListener('drop',function(e){e.preventDefault();e.stopPropagation();dropZone.classList.remove('dragover');var dt=e.dataTransfer;if(dt&&dt.files)addFiles(Array.prototype.slice.call(dt.files));});
  clearFilesBtn.addEventListener('click',function(){window._redactFiles=[];refreshQueue();setStatus('File list cleared.','');});
  clearSessionBtn.addEventListener('click',function(){window._redactFiles=[];sessionResults=[];refreshQueue();resultsContainer.innerHTML='';resultsCard.style.display='none';summaryCard.style.display='none';downloadAllBtn.disabled=true;hideProgress();setStatus('Session cleared.','');});
  var padSlider=document.getElementById('barPadding');var padVal=document.getElementById('barPaddingVal');var padPreview=document.getElementById('barPreview');
  function updatePad(){var v=parseInt(padSlider.value,10);padVal.textContent=v+' px';padPreview.style.height=(10+v*2)+'px';}
  padSlider.addEventListener('input',updatePad);updatePad();
  var ta=document.getElementById('manualTerms');var chipRow=document.getElementById('termChips');
  function updateChips(){var vals=ta.value.split(/[\n,;]+/).map(function(s){return s.trim();}).filter(function(s){return s.length>0;});chipRow.innerHTML='';vals.forEach(function(v){var chip=document.createElement('span');chip.className='chip';var lbl=document.createTextNode(v);var del=document.createElement('button');del.className='chip-del';del.textContent='×';del.addEventListener('click',function(){ta.value=ta.value.split(/[\n,;]+/).map(function(s){return s.trim();}).filter(function(s){return s.length>0&&s!==v;}).join('\n');updateChips();});chip.appendChild(lbl);chip.appendChild(del);chipRow.appendChild(chip);});}
  ta.addEventListener('input',updateChips);
  processBtn.addEventListener('click',function(){
    var files=window._redactFiles||[];
    if(!files.length){setStatus('Add PDF files first.','warn');return;}
    var active=new Set();
    document.querySelectorAll('.entity-toggle').forEach(function(t){if(t.checked)active.add(t.value);});
    var padding=parseInt(document.getElementById('barPadding').value,10)||4;
    var mt=document.getElementById('manualTerms').value.trim();
    var terms=mt?mt.split(/[\n,;]+/).map(function(s){return s.trim();}).filter(function(s){return s.length>0;}):'';
    var useOcr=document.getElementById('ocrToggle').checked;
    sessionResults=[];resultsContainer.innerHTML='';resultsCard.style.display='';summaryCard.style.display='none';
    processBtn.disabled=true;downloadAllBtn.disabled=true;showProgress(0,'Starting…');setStatus('Applying enhanced redaction…','info');
    var total=files.length,idx=0;
    function next(){
      if(idx>=total){showProgress(100,'Complete');setTimeout(hideProgress,1200);processBtn.disabled=false;var ok=sessionResults.filter(function(r){return !r.error;}).length;var bad=sessionResults.filter(function(r){return r.error;}).length;downloadAllBtn.disabled=ok===0;renderSummary();setStatus(bad?'✅ '+ok+' done · ⚠️ '+bad+' error(s)':'✅ '+ok+' file(s) redacted. Review extraction results below.',bad?'warn':'success');return;}
      var entry=files[idx],myIdx=idx;
      showProgress((myIdx/total)*100,'('+( myIdx+1)+'/'+total+') '+entry.name);
      var processor=window.EuaaPdfEnhanced||window.EuaaPdfProcessor;
      if(!processor){setStatus('PDF processor not loaded. Please refresh.','error');return;}
      processor.process(entry.file,active,useOcr,padding,terms,function(msg,pct){var base=(myIdx/total)*100,slice=(1/total)*100;showProgress(base+slice*((pct||50)/100),msg);}).then(function(result){sessionResults.push(result);showProgress(((myIdx+1)/total)*100,'Done '+(myIdx+1)+'/'+total);renderCard(result);idx++;next();}).catch(function(err){console.error(err);sessionResults.push({sourceName:entry.name,error:true,message:String(err&&err.message?err.message:err),downloads:[],canvases:[]});renderCard(sessionResults[sessionResults.length-1]);idx++;next();});
    }
    next();
  });
  function renderCard(result){
    var card=document.createElement('article');card.className='result-card';card.dataset.sourceName=result.sourceName;
    if(result.error){card.innerHTML='<div class="result-head"><h3>'+esc(result.sourceName)+'</h3><span class="badge-redacted" style="background:#dc2626">&#10060; Error</span></div><div style="padding:.85rem 1rem;font-size:.82rem;color:#dc2626;background:#fee2e2;font-family:monospace;white-space:pre-wrap">'+esc(result.message)+'</div>';resultsContainer.appendChild(card);return;}
    var summary=result.summary||{};var docType=(result.pageData&&result.pageData[0]&&result.pageData[0].docType)||null;
    var avgConf=result.pageData?Math.round(result.pageData.reduce(function(s,p){return s+(p.confidence||0);},0)/(result.pageData.length||1)):0;
    var allFlags=summary.flags||[];var errorCount=allFlags.filter(function(f){return f.severity==='error';}).length;var warnCount=allFlags.filter(function(f){return f.severity==='warn';}).length;
    var headHtml='<div class="result-head"><h3>'+esc(result.sourceName)+'</h3><span class="result-meta">'+(result.barCount||0)+' bar(s) · '+(summary.pages||0)+' page(s)</span><span class="conf-badge '+confClass(avgConf)+'">OCR '+confLabel(avgConf)+'</span>';
    if(errorCount)headHtml+='<span class="conf-badge conf-low">⚠ '+errorCount+' error(s)</span>';
    if(warnCount)headHtml+='<span class="conf-badge conf-med">! '+warnCount+' warning(s)</span>';
    headHtml+='<span class="badge-redacted">&#9632; Redacted</span></div>';
    var tabsHtml='<div class="result-tabs"><div class="result-tab active" data-tab="extraction">📊 Extracted Data</div><div class="result-tab" data-tab="names">👤 Names</div><div class="result-tab" data-tab="flags">🚩 Alerts</div><div class="result-tab" data-tab="pages">📄 Pages</div></div>';
    var fields=summary.fields||{};
    var extractHtml='<div class="result-tab-content active" data-content="extraction">';
    if(docType&&docType.type){extractHtml+='<div class="doc-type-banner"><span class="doc-type-icon">'+docType.type.icon+'</span><span class="doc-type-label">'+esc(docType.type.label)+'</span><span class="doc-type-conf">'+(docType.confidence||0)+'% confidence</span></div>';}
    extractHtml+='<table class="data-table"><thead><tr><th>Field</th><th>Value</th><th>Confidence</th></tr></thead><tbody>';
    var fieldDefs=[{key:'passportNumbers',label:'🛂 Passport No.'},{key:'caseNumbers',label:'📋 Case / Ref No.'},{key:'datesOfBirth',label:'📅 Date of Birth'},{key:'placesOfBirth',label:'📍 Place of Birth'},{key:'nationalities',label:'🌍 Nationality'},{key:'emails',label:'📧 Email'},{key:'phones',label:'📞 Phone'}];
    var hasFields=false;
    fieldDefs.forEach(function(fd){var vals=fields[fd.key]||[];vals.forEach(function(v){hasFields=true;var dispVal=v.value||'';if(v.country)dispVal+=' ('+v.country+')';if(v.normalised&&v.normalised!==v.value)dispVal+=' → '+v.normalised;extractHtml+='<tr><td class="field-label">'+esc(fd.label)+'</td><td class="field-value">'+esc(dispVal)+'</td><td><span class="conf-badge '+confClass(v.confidence||0)+'">'+confLabel(v.confidence||0)+'</span></td></tr>';});});
    if(fields.mrz){hasFields=true;var mrz=fields.mrz;if(mrz.surname)extractHtml+='<tr><td class="field-label">🛂 MRZ Surname</td><td class="field-value">'+esc(mrz.surname)+'</td><td><span class="conf-badge conf-high">'+confLabel(mrz.confidence||92)+'</span></td></tr>';if(mrz.givenNames)extractHtml+='<tr><td class="field-label">🛂 MRZ Given Names</td><td class="field-value">'+esc(mrz.givenNames)+'</td><td><span class="conf-badge conf-high">'+confLabel(mrz.confidence||92)+'</span></td></tr>';if(mrz.passportNo)extractHtml+='<tr><td class="field-label">🛂 MRZ Passport No.</td><td class="field-value">'+esc(mrz.passportNo)+'</td><td><span class="conf-badge conf-high">'+confLabel(mrz.confidence||92)+'</span></td></tr>';if(mrz.nationality)extractHtml+='<tr><td class="field-label">🛂 MRZ Nationality</td><td class="field-value">'+esc(mrz.nationality)+'</td><td><span class="conf-badge conf-high">'+confLabel(mrz.confidence||92)+'</span></td></tr>';if(mrz.dob)extractHtml+='<tr><td class="field-label">🛂 MRZ DOB</td><td class="field-value">'+esc(mrz.dob)+'</td><td><span class="conf-badge conf-high">'+confLabel(mrz.confidence||92)+'</span></td></tr>';}
    if(!hasFields)extractHtml+='<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:1rem">No structured fields extracted.</td></tr>';
    extractHtml+='</tbody></table></div>';
    var allNames=summary.names||[];
    var namesHtml='<div class="result-tab-content" data-content="names"><div class="name-span-list">';
    if(!allNames.length){namesHtml+='<div style="color:var(--muted);font-size:.83rem;padding:.5rem">No name spans detected.</div>';}
    else{allNames.slice(0,60).forEach(function(ns){var canon=ns.canonical;namesHtml+='<div class="name-span"><span class="name-text">'+esc(ns.text)+'</span>'+(canon?'<span class="name-canon">→ '+esc(canon.canonical)+'</span><span class="name-method">('+esc(canon.method)+' '+Math.round((canon.score||0)*100)+'%)</span>':'')+'<span class="conf-badge '+confClass(ns.confidence||0)+'" style="margin-left:auto">'+confLabel(ns.confidence||0)+'</span></div>';});if(allNames.length>60)namesHtml+='<div style="color:var(--muted);font-size:.78rem;padding:.3rem">…and '+(allNames.length-60)+' more</div>';}
    var xref=summary.crossRef;if(xref&&xref.flags&&xref.flags.length){namesHtml+='<div style="margin-top:.75rem"><strong style="font-size:.8rem">Cross-page inconsistencies:</strong>';xref.flags.forEach(function(f){namesHtml+='<div class="flag-item warn" style="margin-top:.35rem"><span class="flag-icon">⚠</span><div><div class="flag-msg">'+esc(f.message)+'</div></div></div>';});namesHtml+='</div>';}
    namesHtml+='</div></div>';
    var flagsHtml='<div class="result-tab-content" data-content="flags"><div class="flag-list">';
    if(!allFlags.length){flagsHtml+='<div class="flag-item info"><span class="flag-icon">✅</span><div><div class="flag-msg">No consistency issues detected.</div></div></div>';}
    else{allFlags.forEach(function(f){var icon=f.severity==='error'?'🔴':'🟡';flagsHtml+='<div class="flag-item '+esc(f.severity||'info')+'"><span class="flag-icon">'+icon+'</span><div><div class="flag-msg">'+esc(f.message)+'</div>'+(f.suggestion?'<div class="flag-suggestion">💡 '+esc(f.suggestion)+'</div>':'')+'</div></div>';});}
    flagsHtml+='</div></div>';
    var pagesHtml='<div class="result-tab-content" data-content="pages"><div class="img-strip">';
    (result.pageData||[]).forEach(function(pd,i){pagesHtml+='<div class="img-thumb" data-page="'+i+'"><div class="img-thumb-label">Page '+(i+1)+' · <span class="conf-badge '+confClass(pd.confidence||0)+'">'+confLabel(pd.confidence||0)+'</span>'+(pd.detectedScript?' · '+esc(pd.detectedScript):'')+' </div></div>';});
    if(!result.pageData||!result.pageData.length)pagesHtml+='<div style="color:var(--muted);font-size:.83rem;padding:.5rem">No page data available.</div>';
    pagesHtml+='</div></div>';
    var dlHtml='<div class="result-dl"><button class="dl-btn dl-btn-blue btn-review" type="button"><i class="fa-solid fa-pen-to-square"></i> Review &amp; add bars</button><button class="dl-btn dl-btn-dark btn-dl" type="button"><i class="fa-solid fa-download"></i> Download PDF</button></div>';
    card.innerHTML=headHtml+tabsHtml+extractHtml+namesHtml+flagsHtml+pagesHtml+dlHtml;
    card.querySelectorAll('.result-tab').forEach(function(tab){tab.addEventListener('click',function(){card.querySelectorAll('.result-tab').forEach(function(t){t.classList.remove('active');});card.querySelectorAll('.result-tab-content').forEach(function(c){c.classList.remove('active');});tab.classList.add('active');var key=tab.dataset.tab;var content=card.querySelector('[data-content="'+key+'"]');if(content)content.classList.add('active');});});
    card.querySelectorAll('.img-thumb').forEach(function(th){th.addEventListener('click',function(){openReviewModal(result,parseInt(th.dataset.page,10));});});
    if(result.canvases&&result.canvases.length){card.querySelectorAll('.img-thumb').forEach(function(th){var pi=parseInt(th.dataset.page,10);var src=result.canvases[pi];if(!src)return;var thumbCanvas=document.createElement('canvas');var maxW=200;var scale=Math.min(1,maxW/src.width);thumbCanvas.width=Math.floor(src.width*scale);thumbCanvas.height=Math.floor(src.height*scale);thumbCanvas.getContext('2d').drawImage(src,0,0,thumbCanvas.width,thumbCanvas.height);th.insertBefore(thumbCanvas,th.firstChild);});}
    var res=result;
    card.querySelector('.btn-dl').addEventListener('click',function(){if(!res.downloads||!res.downloads.length){setStatus('No download available.','error');return;}triggerDownload(res.downloads[0].blob,res.downloads[0].filename);});
    card.querySelector('.btn-review').addEventListener('click',function(){openReviewModal(res,0);});
    resultsContainer.appendChild(card);card.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function renderSummary(){var totalPages=sessionResults.reduce(function(s,r){return s+(r.summary?r.summary.pages||0:0);},0);var totalBars=sessionResults.reduce(function(s,r){return s+(r.barCount||0);},0);var totalNames=sessionResults.reduce(function(s,r){return s+(r.summary&&r.summary.names?r.summary.names.length:0);},0);var totalFlags=sessionResults.reduce(function(s,r){return s+(r.summary&&r.summary.flags?r.summary.flags.length:0);},0);var avgConf=sessionResults.length?Math.round(sessionResults.reduce(function(s,r){var c=r.pageData?r.pageData.reduce(function(a,p){return a+(p.confidence||0);},0)/(r.pageData.length||1):0;return s+c;},0)/sessionResults.length):0;summaryGrid.innerHTML=stat(totalPages,'Pages processed')+stat(totalBars,'Black bars applied')+stat(totalNames,'Names detected')+stat(avgConf+'%','Avg. OCR confidence')+stat(totalFlags,'Alerts / flags');summaryCard.style.display='';}
  function stat(val,label){return '<div class="summary-stat"><div class="summary-stat-val">'+esc(String(val))+'</div><div class="summary-stat-label">'+esc(label)+'</div></div>';}
  downloadAllBtn.addEventListener('click',function(){if(!sessionResults.length)return;downloadAllBtn.disabled=true;downloadAllBtn.innerHTML='<span class="spinner"></span> Zipping…';var zip=new JSZip();sessionResults.forEach(function(r){(r.downloads||[]).forEach(function(dl){zip.file(dl.filename,dl.blob);});});zip.generateAsync({type:'blob',compression:'DEFLATE'}).then(function(blob){triggerDownload(blob,'redacted-'+new Date().toISOString().slice(0,10)+'.zip');setStatus('✅ ZIP download started.','success');downloadAllBtn.disabled=false;downloadAllBtn.innerHTML='<i class="fa-solid fa-download"></i> Download all (ZIP)';}).catch(function(e){setStatus('ZIP error: '+e.message,'error');downloadAllBtn.disabled=false;downloadAllBtn.innerHTML='<i class="fa-solid fa-download"></i> Download all (ZIP)';});});
  var modal={result:null,canvases:[],origCvs:[],page:0,drawing:false,sx:0,sy:0,scale:1};
  function openReviewModal(result,startPage){if(!result.canvases||!result.canvases.length){setStatus('No page previews available.','warn');return;}modal.result=result;modal.page=startPage||0;modal.drawing=false;modal.origCvs=result.canvases;modal.canvases=result.canvases.map(function(src){var dst=document.createElement('canvas');dst.width=src.width;dst.height=src.height;dst.getContext('2d').drawImage(src,0,0);return{canvas:dst,bars:[]};});var pd=result.pageData&&result.pageData[modal.page]?result.pageData[modal.page]:null;renderModalSidebar(pd,result.summary);document.getElementById('modalTitle').textContent='Review: '+result.sourceName;var el=document.getElementById('reviewModal');el.style.display='flex';el.classList.add('open');renderModalPage();updateModalNav();}
  function renderModalSidebar(pd,summary){var sb=document.getElementById('modalSidebar');if(!sb)return;var html='<h3>Extracted Fields</h3>';if(pd&&pd.fields){var fields=pd.fields;var defs=[{key:'passportNumbers',label:'Passport No.'},{key:'caseNumbers',label:'Case / Ref'},{key:'datesOfBirth',label:'Date of Birth'},{key:'nationalities',label:'Nationality'},{key:'placesOfBirth',label:'Place of Birth'},{key:'emails',label:'Email'},{key:'phones',label:'Phone'}];defs.forEach(function(d){var vals=fields[d.key]||[];vals.forEach(function(v){html+='<div class="modal-field-item"><div class="modal-field-key">'+esc(d.label)+'</div><div class="modal-field-val">'+esc(v.value||'')+'</div></div>';});});}if(summary&&summary.flags&&summary.flags.length){html+='<h3 style="margin-top:.8rem">Alerts</h3>';summary.flags.forEach(function(f){html+='<div class="modal-field-item" style="border-color:'+(f.severity==='error'?'#f87171':'#fcd34d')+'"><div class="modal-field-key">'+(f.severity==='error'?'🔴':'🟡')+' '+esc(f.type||'')+'</div><div class="modal-field-val" style="font-size:.75rem">'+esc(f.message||'')+'</div></div>';});}sb.innerHTML=html;}
  function closeReviewModal(){var el=document.getElementById('reviewModal');el.style.display='none';el.classList.remove('open');modal.result=null;modal.canvases=[];modal.origCvs=[];}
  function renderModalPage(){var container=document.getElementById('modalCanvasContainer');container.innerHTML='';var pg=modal.canvases[modal.page];if(!pg)return;var src=pg.canvas;var maxW=Math.max(container.clientWidth-40,400);var maxH=Math.max(window.innerHeight-260,300);var scale=Math.min(maxW/src.width,maxH/src.height,1);modal.scale=scale;var wrap=document.createElement('div');wrap.style.cssText='position:relative;display:inline-block;user-select:none';var disp=document.createElement('canvas');disp.width=Math.floor(src.width*scale);disp.height=Math.floor(src.height*scale);disp.style.cssText='display:block;cursor:crosshair;touch-action:none;border-radius:4px;box-shadow:0 0 0 2px #374151,0 8px 32px rgba(0,0,0,.5)';var dCtx=disp.getContext('2d');dCtx.drawImage(src,0,0,disp.width,disp.height);var ovl=document.createElement('canvas');ovl.width=disp.width;ovl.height=disp.height;ovl.style.cssText='position:absolute;top:0;left:0;pointer-events:none';var oCtx=ovl.getContext('2d');wrap.appendChild(disp);wrap.appendChild(ovl);container.appendChild(wrap);
  function getPos(e){var r=disp.getBoundingClientRect();var cx=e.touches?e.touches[0].clientX:e.clientX;var cy=e.touches?e.touches[0].clientY:e.clientY;return{x:(cx-r.left)/scale,y:(cy-r.top)/scale};}
  function thick(){var el=document.getElementById('modalBarThickness');return el?parseInt(el.value,10):16;}
  disp.addEventListener('mousedown',function(e){e.preventDefault();modal.drawing=true;var p=getPos(e);modal.sx=p.x;modal.sy=p.y;});
  disp.addEventListener('mousemove',function(e){if(!modal.drawing)return;var p=getPos(e);var x=Math.min(modal.sx,p.x),y=Math.min(modal.sy,p.y);var w=Math.abs(p.x-modal.sx),h=Math.max(Math.abs(p.y-modal.sy),thick());oCtx.clearRect(0,0,ovl.width,ovl.height);oCtx.fillStyle='rgba(0,0,0,.85)';oCtx.fillRect(x*scale,y*scale,w*scale,h*scale);});
  function endDraw(e){if(!modal.drawing)return;modal.drawing=false;oCtx.clearRect(0,0,ovl.width,ovl.height);var p=getPos(e);var x=Math.min(modal.sx,p.x),y=Math.min(modal.sy,p.y);var w=Math.abs(p.x-modal.sx),h=Math.max(Math.abs(p.y-modal.sy),thick());if(w<2)return;pg.bars.push({x:x,y:y,w:w,h:h});src.getContext('2d').fillStyle='#000';src.getContext('2d').fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));dCtx.drawImage(src,0,0,disp.width,disp.height);}
  disp.addEventListener('mouseup',endDraw);disp.addEventListener('mouseleave',endDraw);
  document.getElementById('modalPageInfo').textContent='Page '+(modal.page+1)+' of '+modal.canvases.length;}
  function updateModalNav(){document.getElementById('modalPrevBtn').disabled=modal.page===0;document.getElementById('modalNextBtn').disabled=modal.page>=modal.canvases.length-1;document.getElementById('modalPageInfo').textContent='Page '+(modal.page+1)+' of '+modal.canvases.length;}
  document.getElementById('modalPrevBtn').addEventListener('click',function(){if(modal.page>0){modal.page--;renderModalPage();updateModalNav();var pd=modal.result&&modal.result.pageData?modal.result.pageData[modal.page]:null;renderModalSidebar(pd,modal.result&&modal.result.summary);}});
  document.getElementById('modalNextBtn').addEventListener('click',function(){if(modal.page<modal.canvases.length-1){modal.page++;renderModalPage();updateModalNav();var pd=modal.result&&modal.result.pageData?modal.result.pageData[modal.page]:null;renderModalSidebar(pd,modal.result&&modal.result.summary);}});
  document.getElementById('modalCloseBtn').addEventListener('click',closeReviewModal);
  document.getElementById('modalCancelBtn').addEventListener('click',closeReviewModal);
  document.getElementById('reviewModal').addEventListener('click',function(e){if(e.target===this)closeReviewModal();});
  document.getElementById('modalUndoBtn').addEventListener('click',function(){var pg=modal.canvases[modal.page];if(!pg||!pg.bars.length)return;pg.bars.pop();var orig=modal.origCvs[modal.page];var dst=pg.canvas;var ctx=dst.getContext('2d');ctx.clearRect(0,0,dst.width,dst.height);ctx.drawImage(orig,0,0);ctx.fillStyle='#000';pg.bars.forEach(function(b){ctx.fillRect(Math.floor(b.x),Math.floor(b.y),Math.ceil(b.w),Math.ceil(b.h));});renderModalPage();updateModalNav();});
  document.getElementById('modalDownloadBtn').addEventListener('click',function(){if(!modal.result||!modal.canvases.length)return;var btn=document.getElementById('modalDownloadBtn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Building…';var SCALE=(window.EuaaPdfEnhanced||{}).SCALE||2.5;var jsPDF=window.jspdf.jsPDF;var doc=null;try{modal.canvases.forEach(function(pg){var canvas=pg.canvas;var mmW=(canvas.width/SCALE)*(25.4/96);var mmH=(canvas.height/SCALE)*(25.4/96);var ori=mmW>mmH?'l':'p';var img=canvas.toDataURL('image/jpeg',0.92);if(!doc)doc=new jsPDF({orientation:ori,unit:'mm',format:[mmW,mmH],compress:true});else doc.addPage([mmW,mmH],ori);doc.addImage(img,'JPEG',0,0,mmW,mmH);});var outBuf=doc.output('arraybuffer');var outName=(modal.result.sourceName||'document').replace(/\.pdf$/i,'')+'_REDACTED.pdf';var blob=new Blob([outBuf],{type:'application/pdf'});modal.result.downloads=[{filename:outName,blob:blob}];triggerDownload(blob,outName);closeReviewModal();setStatus('✅ Downloaded: '+outName,'success');}catch(err){setStatus('PDF error: '+err.message,'error');console.error(err);}btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-download"></i> Finalise &amp; download';});
  document.getElementById('modalBarThickness').addEventListener('input',function(){document.getElementById('modalBarThicknessVal').textContent=this.value+' px';});
  refreshQueue();setStatus('Upload PDF files above to get started.','info');hideProgress();
  if(window.pdfjsLib){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';}
});