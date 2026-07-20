/**
 * EUAA Monitoring Anonymiser — Core Anonymisation Engine
 * ======================================================
 * All processing happens in the browser. Nothing is sent to any server.
 *
 * Handles:
 *  - Rule-based NER for legal / asylum case files
 *  - Consistent session-wide substitution mapping
 *  - Multiple detection categories with controllable depth
 *  - Ordinal date formats (03rd July 2017), Refcom numbers, nationality adjectives
 *  - Arabic/MENA names in Latin alphabet (Abu, Al-, Abd, Bin, Bint, El-, Um, etc.)
 *  - African names (Goodluck, Chukwuemeka, Ousmane, Seydou, Kofi, etc.)
 *  - Multi-word names (up to 4 tokens) with lowercase particles
 *  - Accented Latin characters used in name transliterations
 */

const EuaaAnonymizer = (() => {

  // ── Country / nationality lists ──────────────────────────────────────────
  const COUNTRIES = [
    'Afghanistan','Albania','Algeria','Armenia','Azerbaijan',
    'Bangladesh','Belarus','Belgium','Bosnia','Bulgaria',
    'Cameroon','Chad','Colombia','Croatia','Cyprus',
    'DRC','Egypt','Eritrea','Ethiopia',
    'France','Gambia','Georgia','Germany','Ghana','Greece',
    'Guinea','Hungary','India','Iran','Iraq','Israel','Italy',
    'Jordan','Kosovo','Lebanon','Libya','Mali','Malta',
    'Morocco','Nepal','Netherlands','Nigeria','Pakistan','Palestine',
    'Poland','Romania','Russia','Serbia','Sierra Leone','Somalia',
    'Spain','Sri Lanka','Sudan','Syria','Turkey','Uganda',
    'Ukraine','Vietnam','Yemen','Zimbabwe'
  ];

  // Nationality adjectives and demonyms mapped to their country placeholders
  const NATIONALITY_MAP = {
    'Afghan':'Afghanistan','Albanian':'Albania','Algerian':'Algeria',
    'Armenian':'Armenia','Azerbaijani':'Azerbaijan',
    'Bangladeshi':'Bangladesh','Belarusian':'Belarus','Belgian':'Belgium',
    'Bosnian':'Bosnia','Bulgarian':'Bulgaria',
    'Cameroonian':'Cameroon','Chadian':'Chad','Colombian':'Colombia',
    'Croatian':'Croatia','Cypriot':'Cyprus',
    'Congolese':'DRC','Egyptian':'Egypt','Eritrean':'Eritrea',
    'Ethiopian':'Ethiopia','French':'France','Gambian':'Gambia',
    'Georgian':'Georgia','German':'Germany','Ghanaian':'Ghana',
    'Greek':'Greece','Guinean':'Guinea','Hungarian':'Hungary',
    'Indian':'India','Iranian':'Iran','Iraqi':'Iraq',
    'Israeli':'Israel','Italian':'Italy','Jordanian':'Jordan',
    'Kosovar':'Kosovo','Lebanese':'Lebanon','Libyan':'Libya',
    'Malian':'Mali','Maltese':'Malta','Moroccan':'Morocco',
    'Nepalese':'Nepal','Nepali':'Nepal','Dutch':'Netherlands',
    'Nigerian':'Nigeria','Pakistani':'Pakistan','Palestinian':'Palestine',
    'Polish':'Poland','Romanian':'Romania','Russian':'Russia',
    'Serbian':'Serbia','Sierra Leonean':'Sierra Leone','Somali':'Somalia',
    'Spanish':'Spain','Sri Lankan':'Sri Lanka','Sudanese':'Sudan',
    'Syrian':'Syria','Turkish':'Turkey','Ugandan':'Uganda',
    'Ukrainian':'Ukraine','Vietnamese':'Vietnam','Yemeni':'Yemen',
    'Zimbabwean':'Zimbabwe'
  };

  // ── Arabic / MENA name particles (case-insensitive in matching) ─────────────
  // These connect name tokens: "Mohammed Al-Rashid", "Abd Al Karim", "Bin Laden"
  const ARABIC_PARTICLES = [
    'al','el','ul','abu','abd','abdu','abdi','bin','bint','ibn','um','umm',
    'ould','wuld','mac','mc','van','von','de','di','du','del','della','di',
    'ben','bat','bar'
  ];

  // Regex fragment: matches one Arabic/connector particle (with optional hyphen attachment)
  // e.g. "Al-", "al ", "Abd ", "Bin "
  const ARABIC_PARTICLE_RE_FRAG =
    '(?:' + ARABIC_PARTICLES.map(p =>
      p.charAt(0).toUpperCase() + p.slice(1) + '|' + p
    ).join('|') + ')';

  // ── African / West-African name patterns ─────────────────────────────────────
  // Many West/Central African names are single long tokens (Chukwuemeka, Ousmane)
  // or follow FirstName Surname patterns.  We extend the name character set to
  // include the full Latin extended block (accented chars) used in French/Arabic
  // transliterations: é ï ā ū ç ñ ö ü ô â etc.
  // Unicode property \p{L} would be ideal but has limited browser support without flags.
  // We use an explicit accented-char class instead.
  const NAME_CHAR = "[A-Za-zÀ-ÖØ-öø-ÿ'\\-]";   // Latin + Latin Extended + apostrophe + hyphen

  const FAMILY_TERMS = [
    'wife','husband','spouse','partner','daughter','son','children','child',
    'mother','father','brother','sister','grandfather','grandmother',
    'grandchild','nephew','niece','cousin','uncle','aunt','sibling','parents'
  ];

  const MONTH_NAMES = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const MONTH_SHORT  = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const ORDINAL_SUFF = '(?:st|nd|rd|th)';

  // ── Session state ─────────────────────────────────────────────────────────
  let _entityMap = new Map();   // key => { category, original, replacement }
  let _counters  = {};
  let _prefix    = 'Applicant';

  function resetSession() {
    _entityMap = new Map();
    _counters  = {
      person:0, official:0, country:0, location:0, route:0,
      facility:0, caseId:0, address:0, email:0, phone:0, generic:0
    };
  }

  function setPrefix(p) { _prefix = (p || 'Applicant').trim() || 'Applicant'; }

  // ── Alpha labels A B C … Z AA AB … ────────────────────────────────────────
  function toAlpha(n) {
    let r = '';
    while (n > 0) { r = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + r; n = Math.floor((n - 1) / 26); }
    return r;
  }

  // ── Date generalisation ───────────────────────────────────────────────────
  function generaliseDate(raw) {
    // "3rd July 2017" → "July 2017"
    const mFull = raw.match(new RegExp(
      `\\d{1,2}${ORDINAL_SUFF}?\\s+(${MONTH_NAMES})\\s+(\\d{4})`, 'i'
    ));
    if (mFull) return `${mFull[1]} ${mFull[2]}`;

    // "July 2017"
    const mMonthYear = raw.match(new RegExp(`(${MONTH_NAMES})\\s+(\\d{4})`, 'i'));
    if (mMonthYear) return `${mMonthYear[1]} ${mMonthYear[2]}`;

    // DD/MM/YYYY or DD-MM-YYYY
    const mSlash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (mSlash) {
      const yr = mSlash[3].length === 2 ? `20${mSlash[3]}` : mSlash[3];
      return `Year ${yr}`;
    }

    return 'Date Redacted';
  }

  // ── Placeholder generator ─────────────────────────────────────────────────
  function makePlaceholder(original, category) {
    const key = `${category}::${original.trim().toLowerCase()}`;
    if (_entityMap.has(key)) return _entityMap.get(key).replacement;

    let replacement;
    switch (category) {
      case 'PERSON':
        _counters.person++;
        replacement = `${_prefix} ${toAlpha(_counters.person)}`;
        break;
      case 'OFFICIAL_NAME':
      case 'ORGANISATION':
        _counters.official++;
        replacement = `Official ${toAlpha(_counters.official)}`;
        break;
      case 'COUNTRY':
        _counters.country++;
        replacement = `Country ${toAlpha(_counters.country)}`;
        break;
      case 'NATIONALITY': {
        // Reuse country placeholder for consistency
        const country = NATIONALITY_MAP[original] || original;
        const ck = `COUNTRY::${country.toLowerCase()}`;
        let cpl;
        if (_entityMap.has(ck)) {
          cpl = _entityMap.get(ck).replacement;
        } else {
          _counters.country++;
          cpl = `Country ${toAlpha(_counters.country)}`;
          _entityMap.set(ck, { category: 'COUNTRY', original: country, replacement: cpl });
        }
        replacement = `${cpl} national`;
        break;
      }
      case 'LOCATION':
        _counters.location++;
        replacement = `Location ${toAlpha(_counters.location)}`;
        break;
      case 'FACILITY':
        _counters.facility++;
        replacement = `Facility ${toAlpha(_counters.facility)}`;
        break;
      case 'ROUTE':
        _counters.route++;
        replacement = `Route ${_counters.route}`;
        break;
      case 'CASE_ID':
      case 'REFCOM':
      case 'FILE_NUMBER':
      case 'PASSPORT_OR_ID':
        _counters.caseId++;
        replacement = `Case File ${String(_counters.caseId).padStart(3, '0')}`;
        break;
      case 'ADDRESS':
        _counters.address++;
        replacement = `Address ${toAlpha(_counters.address)}`;
        break;
      case 'EMAIL':
        _counters.email++;
        replacement = `email-${String(_counters.email).padStart(3,'0')}@example.invalid`;
        break;
      case 'PHONE':
        _counters.phone++;
        replacement = `+000-000-${String(_counters.phone).padStart(4,'0')}`;
        break;
      case 'FAMILY_TERM':
        replacement = 'family member';
        break;
      case 'DATE_EXACT':
        replacement = generaliseDate(original);
        break;
      default:
        _counters.generic++;
        replacement = `[Redacted ${String(_counters.generic).padStart(3,'0')}]`;
    }

    _entityMap.set(key, { category, original: original.trim(), replacement });
    return replacement;
  }

  // ── Pattern builder ───────────────────────────────────────────────────────
  function buildPatterns(active) {
    const P = [];
    if (active.has('EMAIL'))
      P.push(['EMAIL', /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g]);

    if (active.has('PHONE'))
      P.push(['PHONE', /(?:\+|00)\d[\d\s().\-]{6,}\d|\b\d{3,4}[\s.\-]\d{3,4}[\s.\-]\d{3,4}\b/g]);

    // Refcom / IPAT / case reference numbers  e.g. "Refcom no 32939", "IPAT ref N/A"
    if (active.has('CASE_ID')) {
      P.push(['REFCOM',   /\bRefcom\s+(?:no\.?|number)?\s*\d{4,8}\b/gi]);
      P.push(['REFCOM',   /\bIPAT\s+reference\s*:\s*\S+/gi]);
      P.push(['CASE_ID',  /\b(?:Case|File|Ref|Reference)\s*(?:No\.?|Number|#)?\s*[:\-]?\s*[A-Z0-9]{2,}[\/\-]?\d{2,}\b/gi]);
      P.push(['CASE_ID',  /\b[A-Z]{1,4}[\/\-]\d{4}[\/\-]\d{2,6}\b/g]);
    }

    if (active.has('PASSPORT_OR_ID'))
      P.push(['PASSPORT_OR_ID', /\b(?:Passport|ID|Identity(?:\s+Card)?|Document)\s*(?:No\.?|Number)?\s*[:\-]?\s*[A-Z0-9]{5,20}\b/gi]);

    if (active.has('ADDRESS'))
      P.push(['ADDRESS',
        /\b\d{1,4}\s+[A-Z][A-Za-z0-9'.\-]+(?:\s+[A-Z][A-Za-z0-9'.\-]+){0,4}\s+(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Way|Place|Pl\.?|Drive|Dr\.?|Court|Ct\.?)\b/gi
      ]);

    if (active.has('DATE_EXACT')) {
      // "3rd July 2017", "03 July 2017", "3 Jul 2017"
      P.push(['DATE_EXACT', new RegExp(
        `\\b\\d{1,2}${ORDINAL_SUFF}?\\s+(?:${MONTH_NAMES}|${MONTH_SHORT})\\s+\\d{4}\\b`, 'gi'
      )]);
      // "July 2017"
      P.push(['DATE_EXACT', new RegExp(`\\b(?:${MONTH_NAMES}|${MONTH_SHORT})\\s+\\d{4}\\b`, 'gi')]);
      // DD/MM/YYYY or DD-MM-YYYY
      P.push(['DATE_EXACT', /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g]);
    }

    if (active.has('FACILITY'))
      P.push(['FACILITY',
        /\b(?:Reception\s+(?:Centre|Center)|Closed\s+Controlled\s+Access\s+(?:Centre|Center)|CCAC|Detention\s+(?:Centre|Center)|Open\s+Centre|Camp)\s+[A-Z][\w\s\-]{0,30}\b/gi
      ]);

    if (active.has('ROUTE'))
      P.push(['ROUTE',
        /\b(?:route\s+(?:via|through|from)\s+[A-Z][A-Za-z\-]+(?:\s*[–\-]\s*[A-Z][A-Za-z\-]+)*)\b/gi
      ]);

    return P;
  }

  // ── Main entity detector ──────────────────────────────────────────────────
  function detectEntities(text, level, active) {
    const entities = [];

    // Pattern-based (non-name, non-country)
    for (const [cat, re] of buildPatterns(active)) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        entities.push({ cat, text: m[0], start: m.index, end: m.index + m[0].length });
      }
    }

    // Countries (exact word match)
    if (active.has('COUNTRY')) {
      for (const cty of COUNTRIES) {
        const re = new RegExp(`\\b${escRe(cty)}\\b`, 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
          entities.push({ cat: 'COUNTRY', text: m[0], start: m.index, end: m.index + m[0].length });
        }
      }
    }

    // Nationalities (exact word match)
    if (active.has('COUNTRY')) {
      for (const [nat] of Object.entries(NATIONALITY_MAP)) {
        const re = new RegExp(`\\b${escRe(nat)}\\b`, 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
          entities.push({ cat: 'NATIONALITY', text: m[0], start: m.index, end: m.index + m[0].length });
        }
      }
    }

    // Locations (context-triggered)
    if (level !== 'light' && active.has('LOCATION')) {
      const re = /\b(?:in|at|from|to|arrived\s+in|departed\s+from|fled\s+from|left)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m[1]) {
          const s = m.index + m[0].length - m[1].length;
          entities.push({ cat: 'LOCATION', text: m[1], start: s, end: s + m[1].length });
        }
      }
    }

    // Family terms
    if (level !== 'light' && active.has('FAMILY_TERM')) {
      const re = new RegExp(`\\b(?:${FAMILY_TERMS.join('|')})\\b`, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        entities.push({ cat: 'FAMILY_TERM', text: m[0], start: m.index, end: m.index + m[0].length });
      }
    }

    // ── Person name detection — must come LAST to avoid over-matching ──────────
    if (active.has('PERSON')) {
      detectPersonNames(text, entities);
    }

    return dedupeEntities(entities);
  }

  // ── Name detection: Arabic/MENA + African + European names ─────────────────
  /**
   * Strategy:
   *  1. Build a candidate token list from the text: tokens that start with
   *     an uppercase letter OR are a known particle.
   *  2. Greedily consume consecutive name-like tokens (up to 5) into a
   *     candidate span.
   *  3. A candidate is a valid name if it:
   *       a) has ≥ 2 tokens total
   *       b) starts with an uppercase name token (not a particle alone)
   *       c) ends with an uppercase name token (not a particle alone)
   *       d) is NOT a known legal phrase
   *       e) is NOT a month name
   *       f) is NOT an all-uppercase abbreviation
   *       g) has at least one token that is long enough to be a real name (≥3 chars)
   *  4. We also separately match particle-prefixed tokens:
   *       "Al-Rashid", "Abd-Allah", "Um Kulthum" etc. even as stand-alone tokens.
   */
  function detectPersonNames(text, entities) {
    // Tokenise the text keeping track of offsets
    // A "token" here is a whitespace-separated chunk
    const tokenRe = /\S+/g;
    const tokens  = [];
    let m;
    while ((m = tokenRe.exec(text)) !== null) {
      tokens.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
    }

    const particleSet = new Set(ARABIC_PARTICLES);

    // Helper: strip punctuation at the start/end of a token for analysis
    function clean(s) { return s.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, ''); }

    // Is a token "name-like"? (starts uppercase, contains only name chars)
    function isNameToken(tok) {
      const c = clean(tok);
      if (!c) return false;
      if (!/^[A-ZÀ-ÖØ-Þ]/.test(c)) return false;       // must start uppercase (Latin + Latin Extended)
      if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-]+$/.test(c)) return false; // only name chars
      return true;
    }

    // Is a token an Arabic/MENA particle? (case-insensitive)
    function isParticle(tok) {
      const c = clean(tok).toLowerCase();
      return particleSet.has(c);
    }

    // Is a token an Arabic/MENA particle that is ATTACHED by hyphen e.g. "Al-Rashid"
    function isHyphenParticle(tok) {
      return /^(?:Al|El|Abd|Abu|Bin|Bint|Ibn|Um|Umm|Ould|Ben)-/i.test(clean(tok));
    }

    // Full token validity: uppercase start OR a particle
    function isValidNamePart(tok) {
      const c = clean(tok);
      if (!c) return false;
      if (isParticle(tok)) return true;
      return isNameToken(tok);
    }

    let i = 0;
    while (i < tokens.length) {
      const start = tokens[i];

      // Must start with an uppercase token or a hyphen-particle like "Al-Rashid"
      if (!isNameToken(start.raw) && !isHyphenParticle(start.raw)) { i++; continue; }

      // Greedily consume up to 5 consecutive valid name parts
      let j = i;
      while (j < tokens.length && j < i + 5 && isValidNamePart(tokens[j].raw)) {
        j++;
      }

      if (j === i) { i++; continue; }  // nothing consumed

      // Try longest match first, shrink from the right until we have a valid name
      while (j > i + 1) {
        // End token must be a real name token (not a lone particle)
        if (!isNameToken(tokens[j - 1].raw)) { j--; continue; }

        const span = text.slice(start.start, tokens[j - 1].end);
        const spanClean = span.trim();

        // Must have at least 2 real tokens (not counting particles as the only content)
        const realTokens = span.split(/\s+/).filter(t => isNameToken(t));
        if (realTokens.length < 1) { j--; continue; }

        // Single token must be long enough to be a name by itself — skip
        // (we only keep single-token matches if they are hyphen-particles)
        if (j - i === 1 && !isHyphenParticle(span.trim())) { j--; continue; }

        // Skip known false positives
        if (isLikelyLegalPhrase(spanClean)) { j--; continue; }

        // Skip if ALL tokens are uppercase (abbreviations: IPA, IPAT, UNHCR…)
        if (/^[A-Z\s\-]+$/.test(spanClean)) { j--; continue; }

        // Skip if first token is a month name
        const monthRe2 = new RegExp(`^(?:${MONTH_NAMES}|${MONTH_SHORT})\\b`, 'i');
        if (monthRe2.test(spanClean)) { j--; continue; }

        // Valid — push and advance
        entities.push({ cat: 'PERSON', text: spanClean, start: start.start, end: tokens[j-1].end });
        break;
      }

      // Move past the consumed range (or just one if nothing matched)
      i = j > i + 1 ? j : i + 1;
    }

    // ── Additional pass: standalone hyphen-particles like "Al-Rashid" ───────
    // These might appear alone at the start/end of a sentence and won't be
    // caught by the two-token requirement above.
    const hyphenRe = /\b(?:Al|El|Abd|Abu|Bin|Bint|Ibn|Um|Umm|Ben)-[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'\-]{1,}/g;
    let hm;
    while ((hm = hyphenRe.exec(text)) !== null) {
      // Only add if not already covered by a multi-token match
      const overlap = entities.some(e => hm.index >= e.start && hm.index < e.end);
      if (!overlap) {
        entities.push({ cat: 'PERSON', text: hm[0], start: hm.index, end: hm.index + hm[0].length });
      }
    }
  }

  // Deduplicate & resolve overlaps (longest wins, earlier position wins)
  function dedupeEntities(entities) {
    entities.sort((a, b) => a.start !== b.start
      ? a.start - b.start
      : (b.end - b.start) - (a.end - a.start)
    );
    const out = [];
    let lastEnd = -1;
    for (const e of entities) {
      if (e.start < lastEnd) continue;
      out.push(e);
      lastEnd = e.end;
    }
    return out;
  }

  // ── Legal / institutional phrase exclusion list ────────────────────────────
  // Phrases that look like TitleCase names but are known legal/institutional terms.
  // Add any recurring headings from your specific document types here.
  const LEGAL_PHRASES = new Set([
    // Procedure & institutions
    'Preliminary Considerations','Subsidiary Protection','Refugee Status',
    'International Protection','Qualification Directive','European Union',
    'United Nations','High Commissioner','Protection Agency',
    'Article Nine','Article Ten','Article Fifteen','Grounds Appeal',
    'Member States','Human Rights','Geneva Convention','Security Situation',
    'Risk Assessment','Personal Interview','Evaluation Report',
    'Protection Tribunal','Supreme Court','Administrative Court',
    'Country Guidance','Country Information','Home Area',
    'Appeal Submission','Reply Submissions','Protection Appeals',
    'Honourable Tribunal','Refugee Convention','Dublin Regulation',
    'Common European','Asylum System','Reception Conditions',
    'Procedural Directive','Return Directive','Border Procedure',
    'Accelerated Procedure','Admissibility Procedure',
    // Roles / titles that appear TitleCased
    'Case Worker','Case Officer','Presenting Officer','Legal Representative',
    'Asylum Seeker','Protection Officer','Country Expert',
    'Board Member','Tribunal Member','Panel Member',
    // Generic document-structure phrases
    'Summary Grounds','Grounds Appeal','Factual Background',
    'Legal Framework','Relevant Law','Applicable Law',
    'Legal Basis','Legal Arguments','Factual Summary',
    'Key Facts','Background Facts','Relevant Facts',
  ]);

  // Single-token words that should NEVER be a name on their own
  const LEGAL_SINGLE_WORDS = new Set([
    'The','This','That','These','Those','Their','There',
    'And','But','For','With','From','Into','Upon',
    'Her','His','She','Him','They','Them',
    'Yes','No','Not','Any','All','Each','Both',
    'Article','Section','Annex','Chapter','Part',
    'Directive','Convention','Regulation','Protocol','Act','Law',
    'Court','Tribunal','Agency','Board','Panel','Committee',
    'Applicant','Appellant','Respondent','Claimant','Defendant',
    'Ref','Case','File','No','Number','Para','Page',
    'Note','See','Ibid','Id','Op','Cit','Supra','Infra',
  ]);

  function isLikelyLegalPhrase(text) {
    if (!text) return true;
    if (LEGAL_PHRASES.has(text)) return true;
    // Single words from the exclusion list
    if (LEGAL_SINGLE_WORDS.has(text.trim())) return true;
    // Month + word  e.g. "January Agreement"
    const monthRe = new RegExp(`^(?:${MONTH_NAMES}|${MONTH_SHORT})\\b`, 'i');
    if (monthRe.test(text)) return true;
    // Starts with ALL-CAPS acronym token: "UNHCR Report", "IPA Decision"
    if (/^[A-Z]{2,}(?:\s|$)/.test(text)) return true;
    // Entire span is uppercase (e.g. "APPEAL REPLY SUBMISSIONS")
    if (/^[A-Z\s\-]+$/.test(text)) return true;
    // Ends with common non-name words  "Protection Act", "Security Situation"
    if (/\s+(?:Act|Law|Code|Rule|Order|Decree|Regulation|Directive|Convention|Protocol|Annex|Article|Section|Chapter|Part|Clause|Schedule|Appendix|Report|Decision|Assessment|Evaluation|Interview|Submission|Review|Notice|Letter|Form|Document|Certificate|Card|Permit|Visa|Status|Procedure|Process|Policy|Guidance|Instruction|Circular|Bulletin)$/.test(text)) return true;
    return false;
  }

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ── Text anonymisation ────────────────────────────────────────────────────
  function anonymizeText(text, level, active) {
    const entities = detectEntities(text, level, active);
    // Apply replacements right-to-left so indices stay valid
    const sorted = [...entities].sort((a, b) => b.start - a.start);
    let out = text;
    const replacements = [];
    for (const e of sorted) {
      const repl = makePlaceholder(e.text, e.cat);
      out = out.slice(0, e.start) + repl + out.slice(e.end);
      replacements.push({ ...e, replacement: repl });
    }

    // Extra demo-safe sweeps
    if (level === 'demo-safe' && active.has('FAMILY_TERM')) {
      out = out.replace(/\b\d+\s+children\b/gi, 'family members');
      out = out.replace(/\b\d{1,2}\s+years?\s+old\b/gi, 'minor person');
      out = out.replace(/\baged\s+\d{1,2}\b/gi, 'minor person');
    }

    return { text: out, replacements: replacements.reverse() };
  }

  // ── Exported helpers ──────────────────────────────────────────────────────
  function getEntityMap()    { return _entityMap; }
  function getSessionStats() {
    const counts = new Map();
    for (const { category } of _entityMap.values()) {
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return counts;
  }

  return {
    resetSession,
    setPrefix,
    anonymizeText,
    makePlaceholder,
    detectEntities,
    generaliseDate,
    getEntityMap,
    getSessionStats,
    COUNTRIES,
    NATIONALITY_MAP,
  };

})();

window.EuaaAnonymizer = EuaaAnonymizer;
