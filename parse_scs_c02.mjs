import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';

const PDF_FILES = [
  { file: 'SCS-C02/SCS-C02_1-100.pdf', offset: 0, maxLocal: 100 },
  { file: 'SCS-C02/SCS-C02_101-200.pdf', offset: 100, maxLocal: 100 },
  { file: 'SCS-C02/SCS_C02_201-307.pdf', offset: 200, maxLocal: 107 },
];

async function extractAllPages(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pages.push(text);
  }
  return pages;
}

function cleanText(text) {
  return text.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
}

function stripNulls(text) {
  return text.replace(/\0/g, '');
}

function findOptions(rawText) {
  // Strip null chars that appear in the PDF between option letters and text
  const text = stripNulls(rawText);
  const options = {};
  const positions = [];

  // Collect all candidate option letters
  const candidates = [];

  // Pattern: standalone letter followed by dot or 2+ spaces
  // Must not be preceded by alphanumeric (avoid "S3.", "EC2.", etc.)
  const combined = /(?:^|[^a-zA-Z0-9])([A-F])(?:\.|\s{2,})\s*/g;
  let m;
  while ((m = combined.exec(text)) !== null) {
    const letter = m[1];
    const letterIdx = m.index + m[0].indexOf(letter);
    // Double check: letter is not part of a word
    if (letterIdx > 0 && /[a-zA-Z0-9]/.test(text[letterIdx - 1])) continue;
    candidates.push({ letter, index: letterIdx });
  }

  // Build ALL possible A-starting sequential chains, pick the longest one
  const chains = [];
  for (let ci = 0; ci < candidates.length; ci++) {
    if (candidates[ci].letter !== 'A') continue;
    const chain = [candidates[ci]];
    let expectedNext = 'B';
    for (let cj = ci + 1; cj < candidates.length && expectedNext <= 'F'; cj++) {
      if (candidates[cj].letter === expectedNext && candidates[cj].index > chain[chain.length - 1].index) {
        chain.push(candidates[cj]);
        expectedNext = String.fromCharCode(expectedNext.charCodeAt(0) + 1);
      }
    }
    if (chain.length >= 2) {
      chains.push(chain);
    }
  }

  if (chains.length === 0) return { options, positions: [] };

  // Pick the longest chain; if tie, pick the one that appears later (options come after question text)
  chains.sort((a, b) => b.length - a.length || b[0].index - a[0].index);
  const best = chains[0];

  for (let i = 0; i < best.length; i++) {
    const letter = best[i].letter;
    const start = best[i].index;
    const end = i + 1 < best.length ? best[i + 1].index : text.length;
    let optText = text.substring(start, end).trim();
    optText = optText.replace(/^[A-F][\.\s]+/, '').trim();
    optText = cleanText(optText);
    if (optText) {
      options[letter] = optText;
      positions.push(best[i]);
    }
  }

  return { options, positions };
}

function parseQuestionBlock(blockText, qId) {
  let block = stripNulls(blockText);

  // Remove page markers like "1~100 5", "101~200 3"
  block = block.replace(/\d+~\d+\s+\d+/g, ' ').trim();

  // Remove leading ID and 英文 (with optional colon)
  block = block.replace(/^\d+\s+英\s*[⽂文]\s*[:：]?\s*/, '').trim();

  // Split at 中文 (with optional colon)
  const zhIdx = block.search(/中\s*[⽂文]\s*[:：]?/);
  if (zhIdx < 0) return null;

  const enSection = block.substring(0, zhIdx).trim();
  const zhMatch = block.substring(zhIdx).match(/^中\s*[⽂文]\s*[:：]?\s*/);
  const afterZh = block.substring(zhIdx + (zhMatch ? zhMatch[0].length : 3)).trim();

  // Split at answer marker: 解答 or 答案
  const answerMarkerIdx = afterZh.search(/(?:解\s*答|答\s*案\s*[:：]?)/);
  let zhSection, analysisSection;
  if (answerMarkerIdx >= 0) {
    zhSection = afterZh.substring(0, answerMarkerIdx).trim();
    analysisSection = afterZh.substring(answerMarkerIdx).trim();
  } else {
    zhSection = afterZh;
    analysisSection = '';
  }

  // Parse English options
  const { options: enOptions, positions: enPositions } = findOptions(enSection);
  if (Object.keys(enOptions).length < 2) return null;

  const enQuestion = cleanText(enSection.substring(0, enPositions[0].index));
  if (!enQuestion || enQuestion.length < 10) return null;

  // Parse Chinese options
  const { options: zhOptions, positions: zhPositions } = findOptions(zhSection);
  let zhQuestion;
  if (zhPositions.length >= 2) {
    zhQuestion = cleanText(zhSection.substring(0, zhPositions[0].index));
  } else {
    zhQuestion = cleanText(zhSection);
  }

  // Extract answer letters
  let answerLetters = null;
  const answerPatterns = [
    /解\s*答\s+([A-F](?:\s*[A-F])*)/,
    /答\s*案\s*[:：]?\s*(?:\d+~\d+\s+\d+\s*)?([A-F](?:\s*[A-F])*)/,
    /官\s*[⽅方]\s*答\s*案\s*[:：]?\s*([A-F](?:\s*[A-F])*)/,
    /正确答案\s*[:：]?\s*([A-F](?:\s*[A-F])*)/,
    /Correct\s+Answer\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
  ];

  for (const source of [analysisSection, block]) {
    if (answerLetters) break;
    for (const pat of answerPatterns) {
      const m = source.match(pat);
      if (m) {
        answerLetters = m[1].match(/[A-F]/g)?.map(l => l.toUpperCase());
        if (answerLetters && answerLetters.length > 0) break;
      }
    }
  }

  if (!answerLetters || answerLetters.length === 0) return null;

  const isMultiple = answerLetters.length > 1;
  const type = isMultiple ? 'multiple' : 'single';

  // Extract per-option explanations
  const zhExplanations = {};
  const enExplanations = {};

  const analysisStart = analysisSection.search(/选项分析|考察的知识点/);
  if (analysisStart >= 0) {
    const analysisText = analysisSection.substring(analysisStart);
    const optLetters = Object.keys(enOptions);

    for (let oi = 0; oi < optLetters.length; oi++) {
      const letter = optLetters[oi];
      const nextLetter = oi + 1 < optLetters.length ? optLetters[oi + 1] : null;

      const endMarkers = '我选的答案|我的答案|我的选择|官\\s*[⽅方]\\s*答|与官|$';
      let pat;
      if (nextLetter) {
        pat = new RegExp(`${letter}[\\.\\)\\s]\\s*([\\s\\S]*?)(?=${nextLetter}[\\.\\)\\s]\\s)`, 'i');
      } else {
        pat = new RegExp(`${letter}[\\.\\)\\s]\\s*([\\s\\S]*?)(?=${endMarkers})`, 'i');
      }

      const m = pat.exec(analysisText);
      if (m) {
        const expl = cleanText(m[1]);
        if (expl.length > 5) {
          zhExplanations[letter] = expl;
          enExplanations[letter] = expl;
        }
      }
    }
  }

  const finalZhOptions = Object.keys(zhOptions).length >= Object.keys(enOptions).length ? zhOptions : enOptions;

  return {
    zh: {
      exam: 'SCS-C02', id: qId, type,
      question: zhQuestion,
      options: finalZhOptions,
      answer: isMultiple ? answerLetters : answerLetters[0],
      explanations: zhExplanations,
    },
    en: {
      exam: 'SCS-C02', id: qId, type,
      question: enQuestion,
      options: enOptions,
      answer: isMultiple ? answerLetters : answerLetters[0],
      explanations: enExplanations,
    },
  };
}

function splitIntoQuestionBlocks(allText, offset, maxLocal) {
  const pattern = /(?:(?:\d+~\d+)\s+)?(\d+)\s+英\s*[⽂文]\s*[:：]?/g;
  const splits = [];
  let m;
  while ((m = pattern.exec(allText)) !== null) {
    const localId = parseInt(m[1]);
    if (localId > maxLocal || localId < 1) continue;
    splits.push({ id: localId + offset, localId, index: m.index });
  }

  // Deduplicate: keep first occurrence of each local ID
  const seen = new Set();
  const unique = [];
  for (const s of splits) {
    if (!seen.has(s.localId)) {
      seen.add(s.localId);
      unique.push(s);
    }
  }

  const blocks = [];
  for (let i = 0; i < unique.length; i++) {
    const start = unique[i].index;
    const end = i + 1 < unique.length ? unique[i + 1].index : allText.length;
    blocks.push({ id: unique[i].id, text: allText.substring(start, end).trim() });
  }

  return blocks;
}

async function main() {
  const allZh = [];
  const allEn = [];
  const seenIds = new Set();
  let totalBlocks = 0;
  let parseErrors = 0;

  for (const { file: pdfFile, offset, maxLocal } of PDF_FILES) {
    if (!fs.existsSync(pdfFile)) {
      console.log(`File not found: ${pdfFile}, skipping`);
      continue;
    }

    console.log(`Processing: ${pdfFile} (offset: ${offset})`);
    const pages = await extractAllPages(pdfFile);
    console.log(`  ${pages.length} pages`);

    const allText = pages.join('\n');
    const blocks = splitIntoQuestionBlocks(allText, offset, maxLocal);
    console.log(`  Found ${blocks.length} question blocks`);
    totalBlocks += blocks.length;

    let parsed = 0;
    const failed = [];
    for (const block of blocks) {
      try {
        const result = parseQuestionBlock(block.text, block.id);
        if (result) {
          if (!seenIds.has(block.id)) {
            seenIds.add(block.id);
            allZh.push(result.zh);
            allEn.push(result.en);
            parsed++;
          }
        } else {
          failed.push(block.id);
          parseErrors++;
        }
      } catch (e) {
        failed.push(block.id);
        parseErrors++;
      }
    }
    console.log(`  Parsed ${parsed}/${blocks.length}`);
    if (failed.length > 0) console.log(`  Failed: ${failed.join(', ')}`);
  }

  allZh.sort((a, b) => a.id - b.id);
  allEn.sort((a, b) => a.id - b.id);

  console.log(`\n=== Summary ===`);
  console.log(`Total blocks: ${totalBlocks}`);
  console.log(`Parsed: ${allZh.length}`);
  console.log(`Errors: ${parseErrors}`);

  let withExpl = 0, multiCount = 0;
  const noZhOpts = [];
  for (const q of allZh) {
    if (Object.keys(q.explanations).length > 0) withExpl++;
    if (q.type === 'multiple') multiCount++;
  }
  console.log(`With explanations: ${withExpl}`);
  console.log(`Multiple choice: ${multiCount}`);

  // Check if Chinese options look good (sample check)
  let zhOptCount = 0;
  for (const q of allZh) {
    const firstOpt = Object.values(q.options)[0] || '';
    if (/[\u4e00-\u9fff]/.test(firstOpt)) zhOptCount++;
  }
  console.log(`Questions with Chinese options: ${zhOptCount}/${allZh.length}`);

  // Write chunks
  const chunkSize = 100;
  const dataDir = path.join('.', 'public', 'data');
  const zhFiles = [];
  const enFiles = [];

  for (let i = 0; i < allZh.length; i += chunkSize) {
    const chunk = allZh.slice(i, i + chunkSize);
    const startId = chunk[0].id;
    const endId = chunk[chunk.length - 1].id;
    const fileName = `scs_c02_${startId}_${endId}.json`;
    fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(chunk, null, 2), 'utf-8');
    console.log(`Wrote ${fileName} (${chunk.length} questions)`);
    zhFiles.push(fileName);
  }

  for (let i = 0; i < allEn.length; i += chunkSize) {
    const chunk = allEn.slice(i, i + chunkSize);
    const startId = chunk[0].id;
    const endId = chunk[chunk.length - 1].id;
    const fileName = `scs_c02_en_${startId}_${endId}.json`;
    fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(chunk, null, 2), 'utf-8');
    console.log(`Wrote ${fileName} (${chunk.length} questions)`);
    enFiles.push(fileName);
  }

  // Sample
  if (allZh.length > 0) {
    console.log('\n--- Sample Q (zh) ---');
    console.log(JSON.stringify(allZh[0], null, 2).substring(0, 800));
  }

  // Missing IDs
  const ids = new Set(allZh.map(q => q.id));
  const missing = [];
  for (let i = 1; i <= 307; i++) {
    if (!ids.has(i)) missing.push(i);
  }
  if (missing.length > 0) {
    console.log(`\nMissing IDs (${missing.length}/307): ${missing.join(', ')}`);
  }

  console.log('\n--- Manifest ---');
  console.log('files:', JSON.stringify(zhFiles));
  console.log('enFiles:', JSON.stringify(enFiles));
}

main().catch(console.error);
