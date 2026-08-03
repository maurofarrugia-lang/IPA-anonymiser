/**
 * EUAA Arabic & Multilingual Name Recognition Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles:
 *   - Arabic script detection and transliteration normalisation
 *   - Patronymic / compound name structures (ibn, bin, bint, abu, abd…)
 *   - Regional spelling variants (Mohammed / Muhammad / Mohamed…)
 *   - Fuzzy matching with Jaro-Winkler + phonetic hashing
 *   - Name cross-referencing across document pages
 *   - Confidence scoring per name token
 */
const EuaaNameEngine = (function () {
  'use strict';

  // ── Arabic root → canonical Latin equivalents ─────────────────────────────
  // Each entry: { roots: [arabic_strings], variants: [latin_spellings], canonical }
  var ARABIC_NAME_TABLE = [
    { canonical: 'Muhammad',  variants: ['Muhammad','Mohammed','Mohammad','Mohamed','Mohamad','Mohammedh','Muhamad','Muhammed','Mouhamed','Muhamed','Mohamud','Maxamed','Mahamed','Muhammet','Mehmed','Mehmet'] },
    { canonical: 'Abdullah',  variants: ['Abdullah','Abdallah','Abdellah','Abdalla','Abdulla','Abdoulah','Abduallah','Abdulah'] },
    { canonical: 'Abdul',     variants: ['Abdul','Abdel','Abdal','Abdu','Abdo','Abdoul','Abd'] },
    { canonical: 'Ali',       variants: ['Ali','Aly','Aliy','Alee','Aali'] },
    { canonical: 'Hassan',    variants: ['Hassan','Hasan','Hasen','Hassin','Hazan','Hussan','Hussen','Hussein','Husein','Husayn','Houssain','Hussain','Hussien'] },
    { canonical: 'Ibrahim',   variants: ['Ibrahim','Ibrахим','Ibraheem','Brahim','Ebrahim','Abrahim','Ebraheem'] },
    { canonical: 'Omar',      variants: ['Omar','Umar','Omer','Oumar','Amr','Amar'] },
    { canonical: 'Ahmad',     variants: ['Ahmad','Ahmed','Ahmet','Ahamed','Ahmod','Ahmmad','Achmad','Akhmed'] },
    { canonical: 'Yusuf',     variants: ['Yusuf','Yousuf','Yousef','Yusef','Youssef','Josef','Yosef','Yousouf'] },
    { canonical: 'Khalid',    variants: ['Khalid','Khaled','Halid','Halide','Xaaliid','Kalid'] },
    { canonical: 'Abdi',      variants: ['Abdi','Abdie','Abdy','Abdye'] },
    { canonical: 'Farah',     variants: ['Farah','Faarax','Fara','Farax'] },
    { canonical: 'Noor',      variants: ['Noor','Nur','Nour','Noura','Noura'] },
    { canonical: 'Saleh',     variants: ['Saleh','Salih','Salehm','Salahuddin','Sali'] },
    { canonical: 'Mustafa',   variants: ['Mustafa','Mustaffa','Mustaphar','Moustafa','Moustaphar'] },
    { canonical: 'Ismail',    variants: ['Ismail','Ismaeel','Ismaiel','Ismael','Esmail','Esmaiel'] },
    { canonical: 'Dawit',     variants: ['Dawit','David','Dawood','Daud','Daowd'] },
    { canonical: 'Haile',     variants: ['Haile','Hailet','Hayle','Hayile'] },
    { canonical: 'Tesfaye',   variants: ['Tesfaye','Tesfae','Tesfai','Testfaye'] },
    { canonical: 'Aisha',     variants: ['Aisha','Ayesha','Aysha','Aiesha','Isha','Iisha'] },
    { canonical: 'Fatima',    variants: ['Fatima','Fatimah','Fathima','Fatma','Fatume','Fadumo'] },
    { canonical: 'Maryam',    variants: ['Maryam','Mariam','Maryem','Meriam','Miriam','Marem'] },
    { canonical: 'Amina',     variants: ['Amina','Aminah','Aamina','Amena','Amyna'] },
    { canonical: 'Rahel',     variants: ['Rahel','Rachel','Rakel','Raheil'] },
    { canonical: 'Zainab',    variants: ['Zainab','Zaynab','Zineb','Zenab','Zeynep'] },
    { canonical: 'Samir',     variants: ['Samir','Sameer','Samer','Samear'] },
    { canonical: 'Tariq',     variants: ['Tariq','Tarik','Tareck','Tariq','Tarek'] },
    { canonical: 'Bashir',    variants: ['Bashir','Basheer','Beshir','Besheer','Besher'] },
    { canonical: 'Nasir',     variants: ['Nasir','Nasser','Nasr','Naseer','Naser','Nassir'] },
    { canonical: 'Rahim',     variants: ['Rahim','Raheem','Rahman','Abdirahman','Abdurahman','Abdurrahman'] },
    { canonical: 'Idris',     variants: ['Idris','Idriss','Idriss','Edriss','Edris'] },
    { canonical: 'Hamid',     variants: ['Hamid','Hameed','Hamede','Abdul Hamid'] },
    { canonical: 'Jamal',     variants: ['Jamal','Gamal','Djamal','Cemal','Camal'] },
    { canonical: 'Kareem',    variants: ['Kareem','Karim','Karem','Kerim'] },
    { canonical: 'Mahdi',     variants: ['Mahdi','Mehdi','Mehdee','Mahdee'] },
    { canonical: 'Rashid',    variants: ['Rashid','Rasheed','Rasheid','Rasid','Rašid'] },
    { canonical: 'Suleiman',  variants: ['Suleiman','Suleyman','Soliman','Sulayman','Süleyman','Suleman'] },
    { canonical: 'Yusra',     variants: ['Yusra','Yousra','Yousra','Yusra'] },
    { canonical: 'Hodan',     variants: ['Hodan','Hodon','Hodhan'] },
    { canonical: 'Saado',     variants: ['Saado','Saada','Saade'] },
    { canonical: 'Habibo',    variants: ['Habibo','Habiba','Habiibo'] },
    { canonical: 'Asad',      variants: ['Asad','Assad','Asaad','Assaad'] },
    { canonical: 'Osman',     variants: ['Osman','Usman','Othman','Uthman','Ousman'] },
    { canonical: 'Elias',     variants: ['Elias','Ilyas','Iliyas','Eliyas','Ilias'] },
    { canonical: 'Yohannes',  variants: ['Yohannes','Johannes','Yohanes','Yihannes'] },
    { canonical: 'Meles',     variants: ['Meles','Meles','Melesse','Meless'] },
    { canonical: 'Berhe',     variants: ['Berhe','Berhane','Berhanu','Berhie'] },
    { canonical: 'Ghirmay',   variants: ['Ghirmay','Ghirmai','Girmay','Girmai'] },
    { canonical: 'Tekle',     variants: ['Tekle','Teklai','Teklay','Teklu'] },
    { canonical: 'Biniam',    variants: ['Biniam','Binyam','Binyam','Beniam'] },
    { canonical: 'Hidri',     variants: ['Hidri','Hedri','Hidrey'] },
  ];

  // Build lookup map: lowercase variant → canonical
  var VARIANT_MAP = {};
  ARABIC_NAME_TABLE.forEach(function (entry) {
    entry.variants.forEach(function (v) {
      VARIANT_MAP[v.toLowerCase()] = entry.canonical;
    });
  });

  // ── Patronymic particles ───────────────────────────────────────────────────
  var PARTICLES = new Set([
    'ibn', 'bin', 'bint', 'abu', 'abd', 'abdi', 'abdu', 'abdel', 'abdal',
    'um', 'umm', 'ben', 'beni', 'al', 'el', 'ul', 'ould', 'weld', 'mac', 'mc',
    'de', 'di', 'du', 'van', 'von', 'te', 'ter',
  ]);

  // ── Jaro-Winkler distance ─────────────────────────────────────────────────
  function jaro(s1, s2) {
    if (s1 === s2) return 1;
    var l1 = s1.length, l2 = s2.length;
    if (!l1 || !l2) return 0;
    var matchDist = Math.floor(Math.max(l1, l2) / 2) - 1;
    if (matchDist < 0) matchDist = 0;
    var s1Matches = new Array(l1).fill(false);
    var s2Matches = new Array(l2).fill(false);
    var matches = 0, transpositions = 0;
    for (var i = 0; i < l1; i++) {
      var start = Math.max(0, i - matchDist);
      var end   = Math.min(i + matchDist + 1, l2);
      for (var j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true; s2Matches[j] = true; matches++; break;
      }
    }
    if (!matches) return 0;
    var k = 0;
    for (var i = 0; i < l1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    return (matches/l1 + matches/l2 + (matches - transpositions/2)/matches) / 3;
  }

  function jaroWinkler(s1, s2) {
    var j = jaro(s1, s2);
    var prefix = 0;
    for (var i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
      if (s1[i] === s2[i]) prefix++; else break;
    }
    return j + prefix * 0.1 * (1 - j);
  }

  // ── Phonetic normalisation ─────────────────────────────────────────────────
  // Collapses common Arabic transliteration variations to a shared root
  function phoneticNorm(str) {
    return str.toLowerCase()
      .replace(/ph/g,   'f')
      .replace(/ck/g,   'k')
      .replace(/ae/g,   'a')
      .replace(/oe/g,   'u')
      .replace(/ou/g,   'u')
      .replace(/oo/g,   'u')
      .replace(/ee|ei/g,'i')
      .replace(/gh/g,   'g')
      .replace(/kh/g,   'k')
      .replace(/dh/g,   'd')
      .replace(/th/g,   't')
      .replace(/sh/g,   'sh')
      .replace(/ch/g,   'sh')
      .replace(/[aeiou]+/g, function(m){ return m[0]; }) // vowel reduction
      .replace(/(.)\1+/g,   '$1')   // deduplicate
      .replace(/[^a-z]/g,   '');    // strip non-alpha
  }

  // ── Canonical name lookup ─────────────────────────────────────────────────
  function canonicalise(name) {
    if (!name) return null;
    var low = name.toLowerCase().trim();
    // Direct match
    if (VARIANT_MAP[low]) return { canonical: VARIANT_MAP[low], method: 'direct', score: 1.0 };
    // Fuzzy match against all known variants
    var bestScore = 0, bestCanonical = null;
    var normInput = phoneticNorm(low);
    Object.keys(VARIANT_MAP).forEach(function (variant) {
      var jw = jaroWinkler(low, variant);
      var ph = jaroWinkler(normInput, phoneticNorm(variant));
      var combined = jw * 0.6 + ph * 0.4;
      if (combined > bestScore) { bestScore = combined; bestCanonical = VARIANT_MAP[variant]; }
    });
    if (bestScore >= 0.82) return { canonical: bestCanonical, method: 'fuzzy', score: bestScore };
    return null;
  }

  // ── Name span extraction from OCR word list ───────────────────────────────
  var LEGAL_WORDS = new Set([
    'the','this','that','these','their','and','but','for','with','from',
    'her','his','she','they','yes','no','not','any','all','article','section',
    'court','tribunal','agency','applicant','appellant','respondent','claimant',
    'ref','case','file','page','date','born','nationality','passport','id',
    'number','name','surname','family','given','address','form','application',
    'interview','hearing','decision','appeal','status','refugee','asylum',
    'document','certificate','birth','marriage','death','police','report',
    'medical','note','letter','office','ministry','authority','government',
    'country','city','place','signature','signed','issued','valid','issued',
  ]);

  function isNameToken(tok) {
    var clean = tok.replace(/[^A-Za-z'\-]/g, '');
    if (clean.length < 2) return false;
    if (!/^[A-Z]/.test(tok)) return false;
    if (LEGAL_WORDS.has(clean.toLowerCase())) return false;
    if (/^\d/.test(tok)) return false;
    if (/^[A-Z\s\-]+$/.test(tok) && clean.length > 4) return false; // All-caps headings
    return true;
  }

  // ── Extract name spans from word array ────────────────────────────────────
  function extractNameSpans(words) {
    var spans = [];
    var i = 0;
    while (i < words.length) {
      var w = words[i];
      var clean = (w.text || '').replace(/[^A-Za-z'\-]/g, '');
      var isParticle = PARTICLES.has(clean.toLowerCase());
      if (!isNameToken(w.text) && !isParticle) { i++; continue; }

      // Start of potential name span
      var j = i;
      while (j < words.length && j < i + 6) {
        var c = (words[j].text || '').replace(/[^A-Za-z'\-]/g, '').toLowerCase();
        if (isNameToken(words[j].text) || PARTICLES.has(c)) j++;
        else break;
      }

      // Need at least 2 tokens, last must be proper name token
      if (j > i + 1 && isNameToken(words[j-1].text)) {
        var spanWords = words.slice(i, j);
        var spanText = spanWords.map(function (w) { return w.text; }).join(' ');
        var spanConf = spanWords.reduce(function (s, w) { return s + w.confidence; }, 0) / spanWords.length;
        var canon = null;
        spanWords.forEach(function (sw) {
          var c = canonicalise(sw.text);
          if (c && (!canon || c.score > canon.score)) canon = c;
        });
        spans.push({
          text:       spanText,
          words:      spanWords,
          confidence: spanConf,
          canonical:  canon,
          bbox:       {
            x0: spanWords[0].bbox ? spanWords[0].bbox.x0 : 0,
            y0: spanWords[0].bbox ? spanWords[0].bbox.y0 : 0,
            x1: spanWords[j-1-i] && spanWords[j-1-i].bbox ? spanWords[j-1-i].bbox.x1 : 0,
            y1: spanWords[0].bbox ? spanWords[0].bbox.y1 : 0,
          }
        });
        i = j;
      } else {
        i++;
      }
    }
    return spans;
  }

  // ── Cross-page name consistency check ─────────────────────────────────────
  function crossReferenceNames(allPageNames) {
    // Build a list of all unique canonical names seen across pages
    var canonical = {};
    allPageNames.forEach(function (pageNames, pageIdx) {
      pageNames.forEach(function (span) {
        var key = span.canonical ? span.canonical.canonical : span.text.toLowerCase();
        if (!canonical[key]) canonical[key] = [];
        canonical[key].push({ page: pageIdx + 1, text: span.text, conf: span.confidence });
      });
    });

    var flags = [];
    Object.keys(canonical).forEach(function (key) {
      var occurrences = canonical[key];
      if (occurrences.length < 2) return;
      // Check for spelling inconsistencies
      var texts = occurrences.map(function (o) { return o.text.toLowerCase(); });
      var unique = texts.filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (unique.length > 1) {
        flags.push({
          type:    'SPELLING_INCONSISTENCY',
          key:     key,
          occurrences: occurrences,
          message: 'Name "' + key + '" appears with different spellings across pages: ' + unique.join(', '),
          severity: 'warn',
        });
      }
    });

    return { canonical: canonical, flags: flags };
  }

  // ── Similarity scoring for two name strings ───────────────────────────────
  function nameSimilarity(a, b) {
    if (!a || !b) return 0;
    var direct = jaroWinkler(a.toLowerCase(), b.toLowerCase());
    var phon   = jaroWinkler(phoneticNorm(a), phoneticNorm(b));
    var canA = canonicalise(a), canB = canonicalise(b);
    var canon = (canA && canB && canA.canonical === canB.canonical) ? 1.0 : 0;
    return Math.max(direct, phon * 0.9, canon);
  }

  return {
    extractNameSpans:     extractNameSpans,
    canonicalise:         canonicalise,
    crossReferenceNames:  crossReferenceNames,
    nameSimilarity:       nameSimilarity,
    jaroWinkler:          jaroWinkler,
    phoneticNorm:         phoneticNorm,
    ARABIC_NAME_TABLE:    ARABIC_NAME_TABLE,
  };
})();
