/**
 * EUAA Enhanced PDF Processor
 */
const EuaaPdfEnhanced = (function () {
  'use strict';
  var SCALE = 2.5;
  function cloneCanvas(src){var c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c;}
  function blackBar(ctx,x,y,w,h,pad){ctx.fillStyle='#000';ctx.fillRect(Math.floor(x-pad),Math.floor(y-pad),Math.ceil(w+pad*2),Math.ceil(h+pad*2));}
  function buildManualRegex(terms){if(!terms||!terms.length)return null;return new RegExp(terms.map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|'),'gi');}
  function findPdfOffset(bytes){var lim=Math.min(bytes.length,4096);for(var i=0;i<lim-4;i++){if(bytes[i]===0x25&&bytes[i+1]===0x50&&bytes[i+2]===0x44&&bytes[i+3]===0x46)return i;}return -1;}
  function process(file,active,useOcr,padding,manTerms,onStatus){
    function status(msg,pct){if(onStatus)onStatus(msg,pct);}
    status('Loading "'+file.name+'"…',0);
    return file.arrayBuffer().then(function(buffer){
      var bytes=new Uint8Array(buffer);
      if(bytes.length===0)throw new Error('"'+file.name+'" is empty.');
      var hdr=new TextDecoder('latin1').decode(bytes.slice(0,Math.min(256,bytes.length)));
      if(/^\s*<!DOCTYPE|^\s*<html/i.test(hdr))throw new Error('"'+file.name+'" is an HTML page, not a PDF.');
      var offset=findPdfOffset(bytes);
      if(offset<0)throw new Error('"'+file.name+'" has no PDF header.');
      var buf=offset>0?bytes.slice(offset):bytes;
      return pdfjsLib.getDocument({data:buf,verbosity:0,stopAtErrors:false}).promise;
    }).then(function(pdf){
      var jsPDF=window.jspdf.jsPDF;
      var manRx=buildManualRegex(manTerms);
      var pad=Math.max(0,padding)*SCALE;
      var doc=null;var totalBars=0;var canvases=[];var pageData=[];var allPageNames=[];var allPageFields=[];
      var pageIndex=0;
      function nextPage(){
        if(pageIndex>=pdf.numPages){
          status('Running consistency checks…',97);
          var crossRef=null;
          if(window.EuaaNameEngine)crossRef=EuaaNameEngine.crossReferenceNames(allPageNames);
          var consistencyFlags=[];
          if(window.EuaaDataExtractor){consistencyFlags=EuaaDataExtractor.checkConsistency(allPageFields,allPageNames);consistencyFlags=EuaaDataExtractor.generateSuggestions(consistencyFlags);}
          if(!doc)throw new Error('"'+file.name+'" — no pages could be processed.');
          status('Encoding PDF…',98);
          var outBuf=doc.output('arraybuffer');
          var outName=file.name.replace(/\.pdf$/i,'')+' _REDACTED.pdf';
          status('Done!',100);
          var allNames=[].concat.apply([],allPageNames);
          var allFields=allPageFields.reduce(function(acc,pf){Object.keys(pf).forEach(function(k){if(!acc[k])acc[k]=[];acc[k]=acc[k].concat(pf[k]);});return acc;},{});
          return{sourceName:file.name,error:false,barCount:totalBars,canvases:canvases,pageData:pageData,downloads:[{filename:outName,blob:new Blob([outBuf],{type:'application/pdf'})}],summary:{pages:pdf.numPages,totalBars:totalBars,names:allNames,fields:allFields,crossRef:crossRef,flags:consistencyFlags}};
        }
        var pi=pageIndex;pageIndex++;var pageNum=pi+1;
        var pct=Math.round((pi/pdf.numPages)*85);
        status('Rendering page '+pageNum+'/'+pdf.numPages+'…',pct);
        return pdf.getPage(pageNum).then(function(pdfPage){
          var vp=pdfPage.getViewport({scale:SCALE});
          var canvas=document.createElement('canvas');
          canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
          var ctx=canvas.getContext('2d',{willReadFrequently:true});
          return pdfPage.render({canvasContext:ctx,viewport:vp}).promise.then(function(){
            return pdfPage.getTextContent();
          }).then(function(content){
            var pageText='';var pageHasText=false;var pageWords=[];
            content.items.forEach(function(item){
              var str=(item.str||'').trim();if(!str)return;
              pageHasText=true;pageText+=' '+str;
              var ents=(active.size&&window.EuaaAnonymizer)?EuaaAnonymizer.detectEntities(str,'demo-safe',active):[];
              var needsRedact=ents.length>0;
              if(!needsRedact&&manRx){manRx.lastIndex=0;needsRedact=manRx.test(str);manRx.lastIndex=0;}
              var t=pdfjsLib.Util.transform(vp.transform,item.transform);
              pageWords.push({text:str,confidence:95,bbox:{x0:t[4]*SCALE,y0:(t[5]-(item.height||10))*SCALE,x1:(t[4]+(item.width||str.length*5))*SCALE,y1:t[5]*SCALE}});
              if(needsRedact){var cx=t[4]*SCALE;var cy=t[5]*SCALE;var cw=Math.max((item.width||str.length*6)*SCALE,20);var ch=Math.max((item.height||Math.abs(t[3])||10)*SCALE,10);blackBar(ctx,cx,cy-ch,cw,ch,pad);totalBars++;}
            });
            var ocrPromise=Promise.resolve({text:pageText,words:pageWords,confidence:95,detectedScript:'latin'});
            if(useOcr&&window.EuaaOcrEngine&&(!pageHasText||active.has('ENHANCED_OCR'))){
              status('Enhanced OCR page '+pageNum+'…',pct+2);
              ocrPromise=EuaaOcrEngine.ocrCanvas(canvas,{},function(p,msg){status(msg||('OCR '+pageNum+'…'),pct+p*8);}).then(function(ocrResult){
                (ocrResult.words||[]).forEach(function(w){var str=(w.text||'').trim();if(!str)return;var ents=(active.size&&window.EuaaAnonymizer)?EuaaAnonymizer.detectEntities(str,'demo-safe',active):[];var needs=ents.length>0;if(!needs&&manRx){manRx.lastIndex=0;needs=manRx.test(str);manRx.lastIndex=0;}if(!needs)return;var b=w.bbox||{};blackBar(ctx,b.x0||0,b.y0||0,(b.x1||0)-(b.x0||0),(b.y1||0)-(b.y0||0),pad);totalBars++;});
                return{text:ocrResult.text||pageText,words:pageWords.concat(ocrResult.words||[]),confidence:ocrResult.confidence,detectedScript:ocrResult.detectedScript,passCount:ocrResult.passCount};
              }).catch(function(){return{text:pageText,words:pageWords,confidence:85,detectedScript:'latin'};});
            }
            return ocrPromise;
          }).then(function(ocrResult){
            var nameSpans=[];
            if(window.EuaaNameEngine&&ocrResult.words&&ocrResult.words.length)nameSpans=EuaaNameEngine.extractNameSpans(ocrResult.words);
            allPageNames.push(nameSpans);
            var fields={};
            if(window.EuaaDataExtractor&&ocrResult.text)fields=EuaaDataExtractor.extractAll(ocrResult.text,ocrResult.words);
            allPageFields.push(fields);
            var docType=null;
            if(pi===0&&window.EuaaDataExtractor)docType=EuaaDataExtractor.classifyDocument(ocrResult.text);
            canvases.push(cloneCanvas(canvas));
            pageData.push({pageNum:pageNum,text:ocrResult.text,confidence:ocrResult.confidence,detectedScript:ocrResult.detectedScript,passCount:ocrResult.passCount,nameSpans:nameSpans,fields:fields,docType:docType,bars:[]});
            var mmW=(canvas.width/SCALE)*(25.4/96);var mmH=(canvas.height/SCALE)*(25.4/96);
            var ori=mmW>mmH?'l':'p';
            var img=canvas.toDataURL('image/jpeg',0.92);
            if(!doc)doc=new jsPDF({orientation:ori,unit:'mm',format:[mmW,mmH],compress:true});
            else doc.addPage([mmW,mmH],ori);
            doc.addImage(img,'JPEG',0,0,mmW,mmH);
            return nextPage();
          });
        });
      }
      return nextPage();
    });
  }
  return{process:process,SCALE:SCALE};
})();
window.EuaaPdfEnhanced=EuaaPdfEnhanced;