import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const PDF_FILE = 'GCP/Professional Cloud Architect_with_aizh-1-200.pdf';
const EXAM_CODE = 'PCA';

// Strip page footer / header noise. Each footer always ends with "Examtopics" then "  "
// Use minimal non-greedy match and tight start anchor.
const FOOTER_RES = [
  /IT\s*[认認]\s*证\s*轻\s*松\s*过[\s\S]{0,400}?Examtopics\s*"?/g,
  /Professional\s+Cloud\s+Architect\s*[\(（]\s*\d{4}\/\d{2}\/\d{2}\s*[\)）]/g,
  /淘\s*宝\s*:\s*"?\s*IT\s*[认認]证轻松[过辟][\s\S]{0,200}?Examtopics\s*"?/g,
  /wechat\s+wechat/gi,
];

async function readAllText(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ').replace(/\0/g, '') + ' ';
  }
  return text;
}

function cleanText(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function stripFooters(s) {
  let out = s;
  for (const re of FOOTER_RES) out = out.replace(re, ' ');
  return out;
}

// CJK fix: normalize NFKC + remove spaces between CJK
function fixCJK(text) {
  let r = text.normalize('NFKC');
  const cjk = '\\u4e00-\\u9fff\\u3400-\\u4dbf\\u3000-\\u303f\\uff01-\\uff60';
  for (let i = 0; i < 3; i++) {
    r = r.replace(new RegExp(`([${cjk}])\\s+([${cjk}])`, 'g'), '$1$2');
  }
  return r;
}

// Find first CJK char index
function firstCjkIdx(s) {
  const m = s.match(/[一-鿿]/);
  return m ? m.index : -1;
}

// Find last CJK char index
function lastCjkIdx(s) {
  let last = -1;
  for (let i = 0; i < s.length; i++) {
    if (/[一-鿿]/.test(s[i])) last = i;
  }
  return last;
}

// Locate option letter positions: A. / B. / C. / D. (standalone)
function findOptionBoundaries(text) {
  const positions = [];
  // Match letter dot at the start of an option chunk - must be preceded by whitespace/start
  // and followed by space then content
  const re = /(?:^|\s)([A-D])\.\s+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const letter = m[1];
    const idx = m.index + m[0].indexOf(letter);
    positions.push({ letter, idx, after: re.lastIndex });
  }
  // Pick best ABCD chain
  let bestChain = [];
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].letter !== 'A') continue;
    const chain = [positions[i]];
    let expected = 'B';
    for (let j = i + 1; j < positions.length && expected <= 'D'; j++) {
      if (positions[j].letter === expected && positions[j].idx > chain[chain.length - 1].idx) {
        chain.push(positions[j]);
        expected = String.fromCharCode(expected.charCodeAt(0) + 1);
      }
    }
    if (chain.length > bestChain.length) bestChain = chain;
  }
  return bestChain;
}

// For a single option chunk like:
// "Configure a new load balancer for the new version of the API   为新标本的 API 配置一个新的负载均衡器"
// or with "Most Voted" suffix on English part:
// "Help them define their requirements and assess viable logging tools   Most Voted  帮助他们..."
function splitOptionEnZh(rawChunk) {
  let chunk = rawChunk.trim();
  // Strip leading letter dot if any leftover
  chunk = chunk.replace(/^[A-D]\.\s*/, '');

  // Remove "Most Voted" marker (anywhere)
  chunk = chunk.replace(/\s*Most\s+Voted\s*/gi, ' ');

  const ci = firstCjkIdx(chunk);
  if (ci < 0) {
    return { en: cleanText(chunk), zh: '' };
  }
  const en = cleanText(chunk.substring(0, ci));
  const zh = cleanText(chunk.substring(ci));
  return { en, zh };
}

function extractAnswerLetters(block) {
  const candidates = [
    /Correct\s+Answer\s*[:：]\s*([A-D](?:\s*[A-D])*)/i,
    /正\s*[确確]\s*答\s*案\s*[:：]\s*([A-D](?:\s*[A-D])*)/,
    /官\s*方\s*答\s*案[:：]?\s*([A-D](?:\s*[A-D])*)/,
  ];
  for (const re of candidates) {
    const m = block.match(re);
    if (m) {
      const letters = m[1].match(/[A-D]/g);
      if (letters && letters.length) return letters;
    }
  }
  return null;
}

// Locate Chinese question / English question split
// Block layout (after marker): English question ... Chinese question ... A. ...
function splitQuestionEnZh(beforeFirstOption) {
  const text = beforeFirstOption.trim();
  const ci = firstCjkIdx(text);
  if (ci < 0) {
    return { en: cleanText(text), zh: '' };
  }
  // English is from start up to ci
  const en = cleanText(text.substring(0, ci));
  // Chinese is from ci to end (still may have trailing English fragments — clean up)
  const zh = cleanText(text.substring(ci));
  return { en, zh };
}

// Extract per-option explanations from analysis section
function extractExplanations(analysisText, letters) {
  const out = {};
  // For each letter, find a chunk like "A. ... " or "A   ..." that starts an analysis paragraph,
  // ending at next letter or known terminators.
  for (let i = 0; i < letters.length; i++) {
    const L = letters[i];
    const nextL = letters[i + 1] || null;
    // Match "X." or "X " heading
    const startRe = new RegExp(
      `(?:^|[^A-Za-z0-9])${L}[\\.、\\)]?\\s+`,
      'g'
    );
    // Find all starts, pick the first one inside analysis (skip ones that look like option restatement)
    const matches = [...analysisText.matchAll(startRe)];
    if (matches.length === 0) continue;
    // Pick last match (final analysis is usually last). Actually pick first match that has Chinese after it within 30 chars.
    let chosen = null;
    for (const m of matches) {
      const after = analysisText.substring(m.index + m[0].length, m.index + m[0].length + 200);
      if (/[一-鿿]/.test(after)) {
        chosen = m;
        break;
      }
    }
    if (!chosen) chosen = matches[matches.length - 1];

    const start = chosen.index + chosen[0].length;
    let end;
    if (nextL) {
      // Find next letter marker after start
      const tailRe = new RegExp(
        `(?:^|[^A-Za-z0-9])${nextL}[\\.、\\)]?\\s+`,
        'g'
      );
      tailRe.lastIndex = start;
      const nm = tailRe.exec(analysisText);
      end = nm ? nm.index : analysisText.length;
    } else {
      // Terminators for the last option
      const tailRe = /(?:我[选選的][择擇的的]?答?案|我的[选选擇][择擇]|官\s*方\s*答|与官|4\.\s*我的|5\.\s*官方|比[较較]与思考|Community vote|$)/;
      const tail = analysisText.substring(start);
      const tm = tail.search(tailRe);
      end = tm >= 0 ? start + tm : analysisText.length;
    }
    let expl = analysisText.substring(start, end).trim();
    expl = cleanText(expl);
    if (expl.length >= 5) out[L] = expl;
  }
  return out;
}

function parseBlock(block, qId, opts0 = {}) {
  // Remove footer noise
  block = stripFooters(block);

  // Strip the leading marker
  block = block.replace(/^Topic\s+\d+\s+Question\s+#\d+\s*/, '');

  // Find option boundaries
  const opts = findOptionBoundaries(block);
  if (opts0.debug) console.error(`DBG Q${qId} opts found:`, opts.length, opts.map(o => o.letter));
  if (opts.length < 3) return null;

  // English+Chinese question is before opts[0]
  const beforeFirst = block.substring(0, opts[0].idx);
  const { en: enQ, zh: zhQ } = splitQuestionEnZh(beforeFirst);
  if (!enQ || enQ.length < 10) return null;

  // Build options text segments (from this letter's content to before next letter)
  const enOptions = {};
  const zhOptions = {};
  for (let i = 0; i < opts.length; i++) {
    const start = opts[i].after; // after "A. " match
    const end = i + 1 < opts.length ? opts[i + 1].idx : block.length;
    let chunk = block.substring(start, end);
    // Truncate chunk before any analysis heading (题目分析/题目解析 etc.)
    const cutIdx = chunk.search(/(?:[题題]\s*目\s*[解分][析答]|1[\.、]\s*[考栲][察][的]?[知][识識])/);
    if (cutIdx >= 0) chunk = chunk.substring(0, cutIdx);
    const { en, zh } = splitOptionEnZh(chunk);
    enOptions[opts[i].letter] = en;
    zhOptions[opts[i].letter] = zh || en; // fallback if no Chinese
  }

  // Need at least 3 options with non-empty English
  const validEn = Object.values(enOptions).filter(v => v && v.length > 0).length;
  if (opts0.debug) console.error(`DBG Q${qId} validEn=${validEn}, enOptions=`, enOptions);
  if (validEn < 3) return null;

  // Extract answer
  const answerLetters = extractAnswerLetters(block);
  if (opts0.debug) console.error(`DBG Q${qId} answerLetters=`, answerLetters);
  if (!answerLetters || answerLetters.length === 0) return null;

  // Restrict to A-D only
  const filtered = answerLetters.filter(l => 'ABCD'.includes(l));
  if (filtered.length === 0) return null;
  const isMulti = filtered.length > 1;
  const type = isMulti ? 'multiple' : 'single';

  // Find analysis text — between "选项分析" or "独立分析每个选项" and end
  let analysisText = '';
  const headingIdx = block.search(/(?:[选選]\s*[项項]\s*分\s*析|[选選]\s*[项項]\s*逐\s*个\s*分\s*析|独立\s*分析\s*[每][个個]\s*[选選][项項])/);
  if (headingIdx >= 0) {
    analysisText = block.substring(headingIdx);
  } else {
    // Fallback: everything after first "Correct Answer:" line
    const ca = block.search(/Correct\s+Answer/i);
    if (ca >= 0) analysisText = block.substring(ca);
  }
  // Strip footers and noise inside analysis
  analysisText = stripFooters(analysisText);
  analysisText = analysisText
    .replace(/Correct\s+Answer\s*[:：]\s*[A-D](?:\s*[A-D])*/gi, ' ')
    .replace(/正\s*[确確]\s*答\s*案\s*[:：]\s*[A-D](?:\s*[A-D])*/g, ' ')
    .replace(/Community\s+vote\s+distribution[\s\S]{0,200}?\([0-9]+%\)(?:\s*[A-D]\s*\([0-9]+%\))*\s*[0-9%]*/gi, ' ')
    .replace(/[社畱][区區]投[票畵]分布[\s\S]{0,200}?\([0-9]+%\)(?:\s*[A-D]\s*\([0-9]+%\))*\s*[0-9%]*/g, ' ')
    .replace(/[3456][\.、]\s*(?:我的(?:答案|选择|[选選][择擇])|官方答案|[与与]?官方答案[的]?[比較较](?:与思考)?|比[较較][与与]?(?:思考|重新思考)?)/g, 'STOP');
  // Use STOP marker to truncate
  const stopIdx = analysisText.indexOf('STOP');
  if (stopIdx >= 0) analysisText = analysisText.substring(0, stopIdx);

  const enExplanations = {};
  const zhExplanations = {};
  const exp = extractExplanations(analysisText, ['A', 'B', 'C', 'D']);
  for (const [k, v] of Object.entries(exp)) {
    zhExplanations[k] = v;
    enExplanations[k] = v;
  }

  // Apply CJK fixes to Chinese fields
  const fixedZhQ = fixCJK(zhQ || enQ);
  const fixedZhOpts = {};
  for (const [k, v] of Object.entries(zhOptions)) fixedZhOpts[k] = fixCJK(v);
  const fixedZhExp = {};
  for (const [k, v] of Object.entries(zhExplanations)) fixedZhExp[k] = fixCJK(v);

  return {
    zh: {
      exam: EXAM_CODE,
      id: qId,
      type,
      question: fixedZhQ,
      options: fixedZhOpts,
      answer: isMulti ? filtered : filtered[0],
      explanations: fixedZhExp,
    },
    en: {
      exam: EXAM_CODE,
      id: qId,
      type,
      question: cleanText(enQ),
      options: enOptions,
      answer: isMulti ? filtered : filtered[0],
      explanations: enExplanations,
    },
  };
}

async function main() {
  console.log(`Reading ${PDF_FILE}...`);
  const fullText = await readAllText(PDF_FILE);
  console.log(`Total chars: ${fullText.length}`);

  const markers = [...fullText.matchAll(/Topic\s+(\d+)\s+Question\s+#(\d+)/g)];
  console.log(`Found ${markers.length} question markers`);

  const zhQuestions = [];
  const enQuestions = [];
  const failures = [];

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const qId = parseInt(m[2], 10);
    const start = m.index;
    const end = i + 1 < markers.length ? markers[i + 1].index : fullText.length;
    const blockText = fullText.substring(start, end);
    try {
      const parsed = parseBlock(blockText, qId);
      if (parsed) {
        zhQuestions.push(parsed.zh);
        enQuestions.push(parsed.en);
      } else {
        failures.push(qId);
      }
    } catch (err) {
      failures.push({ qId, error: err.message });
    }
  }

  console.log(`Parsed ${zhQuestions.length} of ${markers.length}; failed: ${failures.length}`);
  if (failures.length) console.log('Failures:', failures);

  zhQuestions.sort((a, b) => a.id - b.id);
  enQuestions.sort((a, b) => a.id - b.id);

  fs.writeFileSync('public/data/pca_1_98.json', JSON.stringify(zhQuestions, null, 2));
  fs.writeFileSync('public/data/pca_en_1_98.json', JSON.stringify(enQuestions, null, 2));
  console.log('Wrote public/data/pca_1_98.json and public/data/pca_en_1_98.json');
}

main().catch(e => { console.error(e); process.exit(1); });
