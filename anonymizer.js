/**
 * EUAA Monitoring Anonymiser — Core Anonymisation Engine
 * All processing happens in the browser. Nothing is sent to any server.
 */
const EuaaAnonymizer = (() => {
  const COUNTRIES = ['Afghanistan','Albania','Algeria','Armenia','Azerbaijan','Bangladesh','Belarus','Belgium','Bosnia','Bulgaria','Cameroon','Chad','Colombia','Croatia','Cyprus','DRC','Egypt','Eritrea','Ethiopia','France','Gambia','Georgia','Germany','Ghana','Greece','Guinea','Hungary','India','Iran','Iraq','Israel','Italy','Jordan','Kosovo','Lebanon','Libya','Mali','Malta','Morocco','Nepal','Netherlands','Nigeria','Pakistan','Palestine','Poland','Romania','Russia','Serbia','Sierra Leone','Somalia','Spain','Sri Lanka','Sudan','Syria','Turkey','Uganda','Ukraine','Vietnam','Yemen','Zimbabwe'];
  const NATIONALITY_MAP = {'Afghan':'Afghanistan','Albanian':'Albania','Algerian':'Algeria','Armenian':'Armenia','Azerbaijani':'Azerbaijan','Bangladeshi':'Bangladesh','Belarusian':'Belarus','Belgian':'Belgium','Bosnian':'Bosnia','Bulgarian':'Bulgaria','Cameroonian':'Cameroon','Chadian':'Chad','Colombian':'Colombia','Croatian':'Croatia','Cypriot':'Cyprus','Congolese':'DRC','Egyptian':'Egypt','Eritrean':'Eritrea','Ethiopian':'Ethiopia','French':'France','Gambian':'Gambia','Georgian':'Georgia','German':'Germany','Ghanaian':'Ghana','Greek':'Greece','Guinean':'Guinea','Hungarian':'Hungary','Indian':'India','Iranian':'Iran','Iraqi':'Iraq','Israeli':'Israel','Italian':'Italy','Jordanian':'Jordan','Kosovar':'Kosovo','Lebanese':'Lebanon','Libyan':'Libya','Malian':'Mali','Maltese':'Malta','Moroccan':'Morocco','Nepalese':'Nepal','Nepali':'Nepal','Dutch':'Netherlands','Nigerian':'Nigeria','Pakistani':'Pakistan','Palestinian':'Palestine','Polish':'Poland','Romanian':'Romania','Russian':'Russia','Serbian':'Serbia','Sierra Leonean':'Sierra Leone','Somali':'Somalia','Spanish':'Spain','Sri Lankan':'Sri Lanka','Sudanese':'Sudan','Syrian':'Syria','Turkish':'Turkey','Ugandan':'Uganda','Ukrainian':'Ukraine','Vietnamese':'Vietnam','Yemeni':'Yemen','Zimbabwean':'Zimbabwe'};
  const ARABIC_PARTICLES = ['al','el','ul','abu','abd','abdu','abdi','bin','bint','ibn','um','umm','ould','wuld','mac','mc','van','von','de','di','du','del','della','di','ben','bat','bar'];
  const NAME_CHAR = "[A-Za-zÀ-ÖØ-öø-ÿ'\\-]";
  const FAMILY_TERMS = ['wife','husband','spouse','partner','daughter','son','children','child','mother','father','brother','sister','grandfather','grandmother','grandchild','nephew','niece','cousin','uncle','aunt','sibling','parents'];
  const MONTH_NAMES = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const MONTH_SHORT  = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const ORDINAL_SUFF = '(?:st|nd|rd|th)';
  let _entityMap = new Map();
  let _counters  = {};
  let _prefix    = 'Applicant';
  function resetSession() { _entityMap = new Map(); _counters = {person:0,official:0,country:0,location:0,route:0,facility:0,caseId:0,address:0,email:0,phone:0,generic:0}; }
  function setPrefix(p) { _prefix = (p || 'Applicant').trim() || 'Applicant'; }
  function toAlpha(n) { let r=''; while(n>0){r=String.fromCharCode(64+((n-1)%26+1))+r;n=Math.floor((n-1)/26);} return r; }
  function generaliseDate(raw) {
    const mFull = raw.match(new RegExp(`\\d{1,2}${ORDINAL_SUFF}?\\s+(${MONTH_NAMES})\\s+(\\d{4})`,'i'));
    if(mFull) return `${mFull[1]} ${mFull[2]}`;
    const mMonthYear = raw.match(new RegExp(`(${MONTH_NAMES})\\s+(\\d{4})`,'i'));
    if(mMonthYear) return `${mMonthYear[1]} ${mMonthYear[2]}`;
    const mSlash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(mSlash){const yr=mSlash[3].length===2?`20${mSlash[3]}`:mSlash[3];return `Year ${yr}`;}
    return 'Date Redacted';
  }
  function makePlaceholder(original,category){
    const key=`${category}::${original.trim().toLowerCase()}`;
    if(_entityMap.has(key)) return _entityMap.get(key).replacement;
    let replacement;
    switch(category){
      case 'PERSON': _counters.person++; replacement=`${_prefix} ${toAlpha(_counters.person)}`; break;
      case 'OFFICIAL_NAME': case 'ORGANISATION': _counters.official++; replacement=`Official ${toAlpha(_counters.official)}`; break;
      case 'COUNTRY': _counters.country++; replacement=`Country ${toAlpha(_counters.country)}`; break;
      case 'NATIONALITY':{const country=NATIONALITY_MAP[original]||original;const ck=`COUNTRY::${country.toLowerCase()}`;let cpl;if(_entityMap.has(ck)){cpl=_entityMap.get(ck).replacement;}else{_counters.country++;cpl=`Country ${toAlpha(_counters.country)}`;_entityMap.set(ck,{category:'COUNTRY',original:country,replacement:cpl});}replacement=`${cpl} national`;break;}
      case 'LOCATION': _counters.location++; replacement=`Location ${toAlpha(_counters.location)}`; break;
      case 'FACILITY': _counters.facility++; replacement=`Facility ${toAlpha(_counters.facility)}`; break;
      case 'ROUTE': _counters.route++; replacement=`Route ${_counters.route}`; break;
      case 'CASE_ID': case 'REFCOM': case 'FILE_NUMBER': case 'PASSPORT_OR_ID': _counters.caseId++; replacement=`Case File ${String(_counters.caseId).padStart(3,'0')}`; break;
      case 'ADDRESS': _counters.address++; replacement=`Address ${toAlpha(_counters.address)}`; break;
      case 'EMAIL': _counters.email++; replacement=`email-${String(_counters.email).padStart(3,'0')}@example.invalid`; break;
      case 'PHONE': _counters.phone++; replacement=`+000-000-${String(_counters.phone).padStart(4,'0')}`; break;
      case 'FAMILY_TERM': replacement='family member'; break;
      case 'DATE_EXACT': replacement=generaliseDate(original); break;
      default: _counters.generic++; replacement=`[Redacted ${String(_counters.generic).padStart(3,'0')}]`;
    }
    _entityMap.set(key,{category,original:original.trim(),replacement});
    return replacement;
  }
  function buildPatterns(active){
    const P=[];
    if(active.has('EMAIL')) P.push(['EMAIL',/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g]);
    if(active.has('PHONE')) P.push(['PHONE',/(?:\+|00)\d[\d\s().\-]{6,}\d|\b\d{3,4}[\s.\-]\d{3,4}[\s.\-]\d{3,4}\b/g]);
    if(active.has('CASE_ID')){P.push(['REFCOM',/\bRefcom\s*(?:no\.?|number|num\.?|#|:)?\s*:?\s*\d{3,10}\b/gi]);P.push(['REFCOM',/\bRefcom\s*[\/\-]\s*\d{3,10}\b/gi]);P.push(['REFCOM',/\bRefcom\b[^\n\r]{0,30}?(\d{4,10})\b/gi]);P.push(['REFCOM',/\b[A-Z]{2,4}[\/\-]\d{4}[\/\-]\d{3,8}\b/g]);P.push(['REFCOM',/\bIPAT\s+(?:reference|ref\.?)\s*[:\-]?\s*\S+/gi]);P.push(['CASE_ID',/\b(?:Case|File|Ref|Reference)\s*(?:No\.?|Number|Num\.?|#)?\s*[:\-]?\s*[A-Z0-9]{2,}[\/\-]?\d{2,}\b/gi]);P.push(['CASE_ID',/\b[A-Z]{1,4}[\/\-]\d{4}[\/\-]\d{2,6}\b/g]);}
    if(active.has('PASSPORT_OR_ID')) P.push(['PASSPORT_OR_ID',/\b(?:Passport|ID|Identity(?:\s+Card)?|Document)\s*(?:No\.?|Number)?\s*[:\-]?\s*[A-Z0-9]{5,20}\b/gi]);
    if(active.has('ADDRESS')) P.push(['ADDRESS',/\b\d{1,4}\s+[A-Z][A-Za-z0-9'.\-]+(?:\s+[A-Z][A-Za-z0-9'.\-]+){0,4}\s+(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Way|Place|Pl\.?|Drive|Dr\.?|Court|Ct\.?)\b/gi]);
    if(active.has('DATE_EXACT')){P.push(['DATE_EXACT',new RegExp(`\\b\\d{1,2}${ORDINAL_SUFF}?\\s+(?:${MONTH_NAMES}|${MONTH_SHORT})\\s+\\d{4}\\b`,'gi')]);P.push(['DATE_EXACT',new RegExp(`\\b(?:${MONTH_NAMES}|${MONTH_SHORT})\\s+\\d{4}\\b`,'gi')]);P.push(['DATE_EXACT',/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g]);}
    if(active.has('FACILITY')) P.push(['FACILITY',/\b(?:Reception\s+(?:Centre|Center)|Closed\s+Controlled\s+Access\s+(?:Centre|Center)|CCAC|Detention\s+(?:Centre|Center)|Open\s+Centre|Camp)\s+[A-Z][\w\s\-]{0,30}\b/gi]);
    if(active.has('ROUTE')) P.push(['ROUTE',/\b(?:route\s+(?:via|through|from)\s+[A-Z][A-Za-z\-]+(?:\s*[–\-]\s*[A-Z][A-Za-z\-]+)*)\b/gi]);
    return P;
  }
  function detectEntities(text,level,active){
    const entities=[];
    for(const [cat,re] of buildPatterns(active)){re.lastIndex=0;let m;while((m=re.exec(text))!==null){entities.push({cat,text:m[0],start:m.index,end:m.index+m[0].length});}}
    if(active.has('COUNTRY')){for(const cty of COUNTRIES){const re=new RegExp(`\\b${escRe(cty)}\\b`,'g');let m;while((m=re.exec(text))!==null){entities.push({cat:'COUNTRY',text:m[0],start:m.index,end:m.index+m[0].length});}}}
    if(active.has('COUNTRY')){for(const [nat] of Object.entries(NATIONALITY_MAP)){const re=new RegExp(`\\b${escRe(nat)}\\b`,'g');let m;while((m=re.exec(text))!==null){entities.push({cat:'NATIONALITY',text:m[0],start:m.index,end:m.index+m[0].length});}}}
    if(level!=='light'&&active.has('LOCATION')){const re=/\b(?:in|at|from|to|arrived\s+in|departed\s+from|fled\s+from|left)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g;let m;while((m=re.exec(text))!==null){if(m[1]){const s=m.index+m[0].length-m[1].length;entities.push({cat:'LOCATION',text:m[1],start:s,end:s+m[1].length});}}}
    if(level!=='light'&&active.has('FAMILY_TERM')){const re=new RegExp(`\\b(?:${FAMILY_TERMS.join('|')})\\b`,'gi');let m;while((m=re.exec(text))!==null){entities.push({cat:'FAMILY_TERM',text:m[0],start:m.index,end:m.index+m[0].length});}}
    if(active.has('PERSON')) detectPersonNames(text,entities);
    return dedupeEntities(entities);
  }
  function detectPersonNames(text,entities){
    const tokenRe=/\S+/g;const tokens=[];let m;
    while((m=tokenRe.exec(text))!==null){tokens.push({raw:m[0],start:m.index,end:m.index+m[0].length});}
    const particleSet=new Set(ARABIC_PARTICLES);
    function clean(s){return s.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g,'');}
    function isNameToken(tok){const c=clean(tok);if(!c)return false;if(!/^[A-ZÀ-ÖØ-Þ]/.test(c))return false;if(!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-]+$/.test(c))return false;return true;}
    function isParticle(tok){return particleSet.has(clean(tok).toLowerCase());}
    function isHyphenParticle(tok){return /^(?:Al|El|Abd|Abu|Bin|Bint|Ibn|Um|Umm|Ould|Ben)-/i.test(clean(tok));}
    function isValidNamePart(tok){const c=clean(tok);if(!c)return false;if(isParticle(tok))return true;return isNameToken(tok);}
    let i=0;
    while(i<tokens.length){
      const start=tokens[i];
      if(!isNameToken(start.raw)&&!isHyphenParticle(start.raw)){i++;continue;}
      let j=i;
      while(j<tokens.length&&j<i+5&&isValidNamePart(tokens[j].raw)){j++;}
      if(j===i){i++;continue;}
      while(j>i+1){
        if(!isNameToken(tokens[j-1].raw)){j--;continue;}
        const span=text.slice(start.start,tokens[j-1].end);
        const spanClean=span.trim();
        const realTokens=span.split(/\s+/).filter(t=>isNameToken(t));
        if(realTokens.length<1){j--;continue;}
        if(j-i===1&&!isHyphenParticle(span.trim())){j--;continue;}
        if(isLikelyLegalPhrase(spanClean)){j--;continue;}
        if(/^[A-Z\s\-]+$/.test(spanClean)){j--;continue;}
        const monthRe2=new RegExp(`^(?:${MONTH_NAMES}|${MONTH_SHORT})\\b`,'i');
        if(monthRe2.test(spanClean)){j--;continue;}
        entities.push({cat:'PERSON',text:spanClean,start:start.start,end:tokens[j-1].end});
        break;
      }
      i=j>i+1?j:i+1;
    }
    const hyphenRe=/\b(?:Al|El|Abd|Abu|Bin|Bint|Ibn|Um|Umm|Ben)-[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'\-]{1,}/g;
    let hm;
    while((hm=hyphenRe.exec(text))!==null){const overlap=entities.some(e=>hm.index>=e.start&&hm.index<e.end);if(!overlap){entities.push({cat:'PERSON',text:hm[0],start:hm.index,end:hm.index+hm[0].length});}}
  }
  function dedupeEntities(entities){entities.sort((a,b)=>a.start!==b.start?a.start-b.start:(b.end-b.start)-(a.end-a.start));const out=[];let lastEnd=-1;for(const e of entities){if(e.start<lastEnd)continue;out.push(e);lastEnd=e.end;}return out;}
  const LEGAL_PHRASES=new Set(['Preliminary Considerations','Subsidiary Protection','Refugee Status','International Protection','Qualification Directive','European Union','United Nations','High Commissioner','Protection Agency','Article Nine','Article Ten','Article Fifteen','Grounds Appeal','Member States','Human Rights','Geneva Convention','Security Situation','Risk Assessment','Personal Interview','Evaluation Report','Protection Tribunal','Supreme Court','Administrative Court','Country Guidance','Country Information','Home Area','Appeal Submission','Reply Submissions','Protection Appeals','Honourable Tribunal','Refugee Convention','Dublin Regulation','Common European','Asylum System','Reception Conditions','Procedural Directive','Return Directive','Border Procedure','Accelerated Procedure','Admissibility Procedure','Case Worker','Case Officer','Presenting Officer','Legal Representative','Asylum Seeker','Protection Officer','Country Expert','Board Member','Tribunal Member','Panel Member','Summary Grounds','Grounds Appeal','Factual Background','Legal Framework','Relevant Law','Applicable Law','Legal Basis','Legal Arguments','Factual Summary','Key Facts','Background Facts','Relevant Facts']);
  const LEGAL_SINGLE_WORDS=new Set(['The','This','That','These','Those','Their','There','And','But','For','With','From','Into','Upon','Her','His','She','Him','They','Them','Yes','No','Not','Any','All','Each','Both','Article','Section','Annex','Chapter','Part','Directive','Convention','Regulation','Protocol','Act','Law','Court','Tribunal','Agency','Board','Panel','Committee','Applicant','Appellant','Respondent','Claimant','Defendant','Ref','Case','File','No','Number','Para','Page','Note','See','Ibid','Id','Op','Cit','Supra','Infra']);
  function isLikelyLegalPhrase(text){if(!text)return true;if(LEGAL_PHRASES.has(text))return true;if(LEGAL_SINGLE_WORDS.has(text.trim()))return true;const monthRe=new RegExp(`^(?:${MONTH_NAMES}|${MONTH_SHORT})\\b`,'i');if(monthRe.test(text))return true;if(/^[A-Z]{2,}(?:\s|$)/.test(text))return true;if(/^[A-Z\s\-]+$/.test(text))return true;if(/\s+(?:Act|Law|Code|Rule|Order|Decree|Regulation|Directive|Convention|Protocol|Annex|Article|Section|Chapter|Part|Clause|Schedule|Appendix|Report|Decision|Assessment|Evaluation|Interview|Submission|Review|Notice|Letter|Form|Document|Certificate|Card|Permit|Visa|Status|Procedure|Process|Policy|Guidance|Instruction|Circular|Bulletin)$/.test(text))return true;return false;}
  function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function anonymizeText(text,level,active){const entities=detectEntities(text,level,active);const sorted=[...entities].sort((a,b)=>b.start-a.start);let out=text;const replacements=[];for(const e of sorted){const repl=makePlaceholder(e.text,e.cat);out=out.slice(0,e.start)+repl+out.slice(e.end);replacements.push({...e,replacement:repl});}if(level==='demo-safe'&&active.has('FAMILY_TERM')){out=out.replace(/\b\d+\s+children\b/gi,'family members');out=out.replace(/\b\d{1,2}\s+years?\s+old\b/gi,'minor person');out=out.replace(/\baged\s+\d{1,2}\b/gi,'minor person');}return{text:out,replacements:replacements.reverse()};}
  function getEntityMap(){return _entityMap;}
  function getSessionStats(){const counts=new Map();for(const{category}of _entityMap.values()){counts.set(category,(counts.get(category)||0)+1);}return counts;}
  return{resetSession,setPrefix,anonymizeText,makePlaceholder,detectEntities,generaliseDate,getEntityMap,getSessionStats,COUNTRIES,NATIONALITY_MAP};
})();
window.EuaaAnonymizer = EuaaAnonymizer;