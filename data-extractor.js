/**
 * EUAA Personal Data Extraction & Document Intelligence Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Extracts and validates personal data from OCR text:
 *   - Full names, aliases, DOB, POB, nationality
 *   - Passport / ID / case numbers
 *   - Document type classification
 *   - Confidence scoring per field
 *   - Contextual validation & error flagging
 */
const EuaaDataExtractor = (function () {
  'use strict';

  // ── Document type signatures ───────────────────────────────────────────────
  var DOC_TYPES = [
    {
      id: 'PASSPORT',
      label: 'Passport',
      icon: '🛂',
      keywords: ['passport','جواز','passeport','pasaporte','reisepass','paspoort'],
      mrz: true,
    },
    {
      id: 'NATIONAL_ID',
      label: 'National Identity Card',
      icon: '🪪',
      keywords: ['identity card','national id','carte nationale','personalausweis','هوية','بطاقة'],
    },
    {
      id: 'BIRTH_CERT',
      label: 'Birth Certificate',
      icon: '📜',
      keywords: ['birth certificate','certificate of birth','شهادة ميلاد','extrait de naissance','geburtsurkunde'],
    },
    {
      id: 'MARRIAGE_CERT',
      label: 'Marriage Certificate',
      icon: '💒',
      keywords: ['marriage certificate','عقد زواج','acte de mariage','heiratsurkunde'],
    },
    {
      id: 'ASYLUM_APPLICATION',
      label: 'Asylum Application',
      icon: '📋',
      keywords: ['asylum application','application for international protection','refugee status','international protection','طلب اللجوء','demande d\'asile'],
    },
    {
      id: 'INTERVIEW_RECORD',
      label: 'Interview Record',
      icon: '🗣',
      keywords: ['interview record','substantive interview','personal interview','interview transcript','hearing record'],
    },
    {
      id: 'COURT_DECISION',
      label: 'Court / Tribunal Decision',
      icon: '⚖️',
      keywords: ['tribunal','court decision','appeal decision','judgment','ruling','decision of the','international protection appeals'],
    },
    {
      id: 'POLICE_REPORT',
      label: 'Police / Security Report',
      icon: '🚔',
      keywords: ['police report','garda','constabulary','تقرير الشرطة','rapport de police','security report'],
    },
    {
      id: 'MEDICAL_REPORT',
      label: 'Medical Report',
      icon: '🏥',
      keywords: ['medical report','clinical report','health assessment','psychological assessment','psychiatric assessment','médical'],
    },
    {
      id: 'TRAVEL_DOC',
      label: 'Travel Document',
      icon: '✈️',
      keywords: ['travel document','laissez-passer','emergency travel','convention travel'],
    },
    {
      id: 'REGISTRATION',
      label: 'Registration Form',
      icon: '📝',
      keywords: ['registration form','registration card','eurodac','دبلن','dublin regulation'],
    },
    {
      id: 'UNKNOWN',
      label: 'Unknown Document',
      icon: '📄',
      keywords: [],
    },
  ];

  // ── Regex patterns for personal data ──────────────────────────────────────
  var MONTHS_EN = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  var MONTHS_FR = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';

  var PATTERNS = {
    // Passport / travel document number: 1–2 letters + 6–9 digits
    PASSPORT_NO: /\b([A-Z]{1,2}\d{6,9}|[A-Z0-9]{9})\b/g,
    // National ID card numbers (flexible)
    NATIONAL_ID_NO: /\b([A-Z]{0,3}\s?-?\s?\d{5,12}[A-Z]?)\b/g,
    // Refcom / case numbers
    CASE_ID: /\b(?:Refcom|Case|Ref|File|Application|IPAT|INIS|ORAC|IPO)\s*(?:No\.?|Number|#|:)?\s*[:\-]?\s*([A-Z0-9\/\-]{4,20})\b/gi,
    // DOB patterns — multiple formats
    DOB_LONG_EN:  new RegExp('\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:' + MONTHS_EN + ')\\s+\\d{4})\\b', 'gi'),
    DOB_LONG_FR:  new RegExp('\\b(\\d{1,2}\\s+(?:' + MONTHS_FR + ')\\s+\\d{4})\\b', 'gi'),
    DOB_SHORT:    /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g,
    DOB_ISO:      /\b(\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g,
    // Nationalities
    // Email addresses
    EMAIL:        /\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/g,
    // Phone numbers
    PHONE:        /(?:\+|00)\d[\d\s().\-]{6,}\d|\b\d{3,4}[\s.\-]\d{3,4}[\s.\-]\d{3,4}\b/g,
    // MRZ line detection
    MRZ:          /[A-Z0-9<]{30,44}/g,
    // Place of birth (contextual)
    POB:          /\b(?:born\s+in|place\s+of\s+birth\s*[:=]|birthplace\s*[:=]|né\s+à|née\s+à)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/gi,
  };

  // ── Nationality list ───────────────────────────────────────────────────────
  var NATIONALITIES = {
    'Afghan':'Afghanistan','Albanian':'Albania','Algerian':'Algeria','Armenian':'Armenia',
    'Azerbaijani':'Azerbaijan','Bangladeshi':'Bangladesh','Belarusian':'Belarus',
    'Bosnian':'Bosnia','Bulgarian':'Bulgaria','Cameroonian':'Cameroon','Chadian':'Chad',
    'Colombian':'Colombia','Croatian':'Croatia','Cypriot':'Cyprus','Congolese':'DRC',
    'Egyptian':'Egypt','Eritrean':'Eritrea','Ethiopian':'Ethiopia','French':'France',
    'Gambian':'Gambia','Georgian':'Georgia','German':'Germany','Ghanaian':'Ghana',
    'Greek':'Greece','Guinean':'Guinea','Hungarian':'Hungary','Indian':'India',
    'Iranian':'Iran','Iraqi':'Iraq','Israeli':'Israel','Italian':'Italy',
    'Jordanian':'Jordan','Kosovar':'Kosovo','Lebanese':'Lebanon','Libyan':'Libya',
    'Malian':'Mali','Maltese':'Malta','Moroccan':'Morocco','Nepalese':'Nepal',
    'Nepali':'Nepal','Dutch':'Netherlands','Nigerian':'Nigeria','Pakistani':'Pakistan',
    'Palestinian':'Palestine','Polish':'Poland','Romanian':'Romania','Russian':'Russia',
    'Serbian':'Serbia','Somali':'Somalia','Spanish':'Spain','Sri Lankan':'Sri Lanka',
    'Sudanese':'Sudan','Syrian':'Syria','Turkish':'Turkey','Ugandan':'Uganda',
    'Ukrainian':'Ukraine','Vietnamese':'Vietnam','Yemeni':'Yemen','Zimbabwean':'Zimbabwe',
    'Rwandan':'Rwanda','Burundian':'Burundi','Kenyan':'Kenya','Tanzanian':'Tanzania',
    'Congolese':'Congo','Ivorian':'Ivory Coast','Senegalese':'Senegal','Guinean':'Guinea',
    'Sierra Leonean':'Sierra Leone','Liberian':'Liberia','Mauritanian':'Mauritania',
    'Malawian':'Malawi','Mozambican':'Mozambique','Zimbabwean':'Zimbabwe',
  };

  // ── MRZ parser ────────────────────────────────────────────────────────────
  function parseMRZ(lines) {
    // ICAO MRZ: passport type 1 (3 lines, 30 chars) or type 3 (2 lines, 44 chars)
    var mrzLines = lines.filter(function (l) { return /^[A-Z0-9<]{29,44}$/.test(l.replace(/\s/g,'')); });
    if (mrzLines.length < 2) return null;
    // Normalise < to space
    var L1 = mrzLines[0].replace(/\s/g,'').padEnd(44,'<');
    var L2 = mrzLines[1].replace(/\s/g,'').padEnd(44,'<');
    // Type P passport (2 lines × 44)
    if (L1[0] === 'P') {
      var surname_given = L1.slice(5).split('<<');
      var surname = (surname_given[0] || '').replace(/</g,' ').trim();
      var given   = (surname_given[1] || '').replace(/</g,' ').trim();
      var passNo  = L2.slice(0,9).replace(/</g,'').trim();
      var nation  = L2.slice(10,13).replace(/</g,'').trim();
      var dobRaw  = L2.slice(13,19);
      var dob     = parseMRZDate(dobRaw);
      return {
        surname: surname, givenNames: given, passportNo: passNo,
        nationality: nation, dob: dob, source: 'MRZ', confidence: 92,
      };
    }
    return null;
  }

  function parseMRZDate(s) {
    // YYMMDD
    if (!/^\d{6}$/.test(s)) return null;
    var yy = parseInt(s.slice(0,2), 10);
    var mm = parseInt(s.slice(2,4), 10);
    var dd = parseInt(s.slice(4,6), 10);
    var year = yy > 30 ? 1900 + yy : 2000 + yy;
    return year + '-' + String(mm).padStart(2,'0') + '-' + String(dd).padStart(2,'0');
  }

  // ── Field extraction ───────────────────────────────────────────────────────
  function extractAll(text, words) {
    var fields = {};

    // Passport numbers
    var passNos = [];
    var m; var re;
    re = new RegExp(PATTERNS.PASSPORT_NO.source, 'g');
    while ((m = re.exec(text)) !== null) passNos.push({ value: m[1]||m[0], confidence: 85, source: 'regex' });
    if (passNos.length) fields.passportNumbers = dedupe(passNos);

    // Case / reference numbers
    var caseNos = [];
    re = new RegExp(PATTERNS.CASE_ID.source, 'gi');
    while ((m = re.exec(text)) !== null) caseNos.push({ value: m[0], confidence: 90, source: 'regex' });
    if (caseNos.length) fields.caseNumbers = dedupe(caseNos);

    // Dates of birth
    var dobs = [];
    [PATTERNS.DOB_LONG_EN, PATTERNS.DOB_LONG_FR, PATTERNS.DOB_SHORT, PATTERNS.DOB_ISO].forEach(function (p) {
      re = new RegExp(p.source, p.flags || 'gi');
      while ((m = re.exec(text)) !== null) {
        var raw = m[1] || m[0];
        var validated = validateDate(raw);
        if (validated) dobs.push({ value: raw, normalised: validated, confidence: 82, source: 'regex' });
      }
    });
    if (dobs.length) fields.datesOfBirth = dedupe(dobs);

    // Place of birth
    var pobs = [];
    re = new RegExp(PATTERNS.POB.source, 'gi');
    while ((m = re.exec(text)) !== null) pobs.push({ value: m[1], confidence: 75, source: 'regex' });
    if (pobs.length) fields.placesOfBirth = dedupe(pobs);

    // Nationalities
    var nats = [];
    Object.keys(NATIONALITIES).forEach(function (nat) {
      var r = new RegExp('\\b' + escRe(nat) + '\\b', 'gi');
      while ((m = r.exec(text)) !== null) {
        nats.push({ value: nat, country: NATIONALITIES[nat], confidence: 88, source: 'regex' });
      }
    });
    // Also check for country names used as nationality
    if (nats.length) fields.nationalities = dedupe(nats, 'value');

    // Emails
    var emails = [];
    re = new RegExp(PATTERNS.EMAIL.source, 'g');
    while ((m = re.exec(text)) !== null) emails.push({ value: m[1]||m[0], confidence: 97, source: 'regex' });
    if (emails.length) fields.emails = dedupe(emails);

    // Phones
    var phones = [];
    re = new RegExp(PATTERNS.PHONE.source, 'g');
    while ((m = re.exec(text)) !== null) phones.push({ value: m[0].trim(), confidence: 80, source: 'regex' });
    if (phones.length) fields.phones = dedupe(phones);

    // MRZ lines
    var mrzLines = [];
    re = new RegExp(PATTERNS.MRZ.source, 'g');
    while ((m = re.exec(text)) !== null) mrzLines.push(m[0]);
    var mrzResult = parseMRZ(mrzLines);
    if (mrzResult) fields.mrz = mrzResult;

    return fields;
  }

  // ── Document type classification ───────────────────────────────────────────
  function classifyDocument(text) {
    if (!text) return DOC_TYPES[DOC_TYPES.length - 1]; // UNKNOWN
    var lower = text.toLowerCase();
    var scores = DOC_TYPES.map(function (dt) {
      var score = 0;
      dt.keywords.forEach(function (kw) {
        if (lower.includes(kw.toLowerCase())) score += 1;
      });
      // MRZ lines strongly indicate passport/travel doc
      if (dt.mrz && /[A-Z0-9<]{30,44}/.test(text)) score += 3;
      return { type: dt, score: score };
    });
    scores.sort(function (a, b) { return b.score - a.score; });
    var best = scores[0];
    return {
      type: best.type,
      confidence: best.score === 0 ? 0 : Math.min(95, 50 + best.score * 15),
    };
  }

  // ── Validation helpers ─────────────────────────────────────────────────────
  function validateDate(raw) {
    if (!raw) return null;
    // Try to parse to a Date object
    var d = new Date(raw.replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/, function(_, d, m, y) {
      if (y.length === 2) y = parseInt(y) > 30 ? '19'+y : '20'+y;
      return y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0');
    }));
    if (isNaN(d.getTime())) return null;
    var year = d.getFullYear();
    if (year < 1900 || year > new Date().getFullYear()) return null;
    return d.toISOString().split('T')[0];
  }

  function validatePassportNumber(no) {
    var clean = no.replace(/\s/g,'').toUpperCase();
    // Standard ICAO: 1-2 alpha + 6-9 digits, or 9 alphanum for some countries
    if (/^[A-Z]{1,2}\d{6,9}$/.test(clean)) return { valid: true, clean: clean };
    if (/^[A-Z0-9]{8,9}$/.test(clean)) return { valid: true, clean: clean, note: 'Non-standard format' };
    return { valid: false, clean: clean, issue: 'Unexpected passport number format' };
  }

  // ── Consistency checks ─────────────────────────────────────────────────────
  function checkConsistency(allPageFields, allPageNames) {
    var flags = [];

    // Collect all DOBs across pages
    var allDobs = [];
    allPageFields.forEach(function (pf, pi) {
      if (pf.datesOfBirth) {
        pf.datesOfBirth.forEach(function (d) {
          allDobs.push({ page: pi+1, value: d.normalised, raw: d.value });
        });
      }
    });
    var uniqueDobs = allDobs.map(function (d) { return d.normalised; })
                            .filter(function (v, i, a) { return a.indexOf(v) === i && v; });
    if (uniqueDobs.length > 1) {
      flags.push({
        type: 'CONFLICTING_DOB', severity: 'error',
        message: 'Conflicting dates of birth found: ' + uniqueDobs.join(', '),
        occurrences: allDobs,
      });
    }

    // Collect all passport numbers
    var allPassports = [];
    allPageFields.forEach(function (pf, pi) {
      if (pf.passportNumbers) pf.passportNumbers.forEach(function (p) { allPassports.push({ page: pi+1, value: p.value }); });
    });
    allPassports.forEach(function (p) {
      var v = validatePassportNumber(p.value);
      if (!v.valid) {
        flags.push({
          type: 'INVALID_PASSPORT_NO', severity: 'warn',
          message: 'Possible OCR error in passport number "' + p.value + '" (page ' + p.page + '): ' + v.issue,
          value: p.value, page: p.page,
        });
      }
    });

    return flags;
  }

  // ── Generate correction suggestions ───────────────────────────────────────
  function generateSuggestions(flags) {
    return flags.map(function (flag) {
      var suggestion = '';
      switch (flag.type) {
        case 'CONFLICTING_DOB':
          suggestion = 'Review pages listed and confirm correct date of birth. Check if one date is a document issue date.';
          break;
        case 'INVALID_PASSPORT_NO':
          suggestion = 'Possible OCR confusion: 0/O, 1/I/L, 8/B. Manually verify against original document image.';
          break;
        case 'SPELLING_INCONSISTENCY':
          suggestion = 'Verify spelling against primary identity document. Record all known aliases.';
          break;
        default:
          suggestion = 'Manual review required.';
      }
      return Object.assign({}, flag, { suggestion: suggestion });
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function dedupe(arr, key) {
    key = key || 'value';
    var seen = new Set();
    return arr.filter(function (item) {
      var k = item[key];
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  return {
    extractAll:           extractAll,
    classifyDocument:     classifyDocument,
    checkConsistency:     checkConsistency,
    generateSuggestions:  generateSuggestions,
    validatePassportNumber: validatePassportNumber,
    validateDate:         validateDate,
    DOC_TYPES:            DOC_TYPES,
    NATIONALITIES:        NATIONALITIES,
  };
})();
