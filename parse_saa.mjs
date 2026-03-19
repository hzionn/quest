import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';

const PDF_FILES = [
  'SAA-C03_with_aizh_1-250.pdf',
  'SAA-C03_with_aizh_251-500.pdf',
  'SAA-C03_with_aizh_501-750.pdf',
  'SAA-C03_with_aizh_751-1000.pdf',
  'SAA-C03_with_aizh_1000-1250.pdf',
  'SAA-C03_with_aizh_1251-1500.pdf',
  'SAA-C03_with_aizh_1501-1750.pdf',
  'SAA-C03_with_aizh_1751-2000.pdf',
  'SAA-C03_with_aizh_2001-2124.pdf',
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
  return text.replace(/\s+/g, ' ').trim();
}

function splitEnZh(text) {
  // Split a mixed English/Chinese text into English and Chinese parts
  // In these PDFs, English comes first, then Chinese translation
  // We look for the transition point where Chinese characters start appearing heavily

  // Try to find where the Chinese translation begins
  // Pattern: English sentence ends with ? or . then Chinese starts
  const questionMarkSplit = text.match(/^(.*?\?)\s+([\u4e00-\u9fff].*)$/s);
  if (questionMarkSplit) {
    return { en: cleanText(questionMarkSplit[1]), zh: cleanText(questionMarkSplit[2]) };
  }

  const periodSplit = text.match(/^(.*?\.)\s+([\u4e00-\u9fff].*)$/s);
  if (periodSplit) {
    return { en: cleanText(periodSplit[1]), zh: cleanText(periodSplit[2]) };
  }

  // For options: English text followed by Chinese text
  // Look for first substantial Chinese character sequence
  const firstChinese = text.search(/[\u4e00-\u9fff]{2,}/);
  if (firstChinese > 10) {
    return {
      en: cleanText(text.substring(0, firstChinese)),
      zh: cleanText(text.substring(firstChinese))
    };
  }

  return { en: cleanText(text), zh: cleanText(text) };
}

function parseQuestions(pages) {
  const questions = new Map(); // qId -> { zh, en }

  // Join all pages with a marker
  const PAGE_SEP = '\n<<<PAGE>>>\n';
  const allText = pages.join(PAGE_SEP);

  // Find all question blocks by "Topic X Question #N"
  const questionPattern = /Topic\s+\d+\s+Question\s+#(\d+)/g;
  const splits = [];
  let match;
  while ((match = questionPattern.exec(allText)) !== null) {
    splits.push({ id: parseInt(match[1]), index: match.index });
  }

  console.log(`  Found ${splits.length} question markers`);

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].index;
    const end = i + 1 < splits.length ? splits[i + 1].index : allText.length;
    const block = allText.substring(start, end).trim();
    const qId = splits[i].id;

    try {
      const parsed = parseQuestionBlock(block, qId);
      if (parsed) {
        // Only keep the first occurrence (question page), merge with explanation
        if (!questions.has(qId)) {
          questions.set(qId, parsed);
        }
      }
    } catch (e) {
      console.log(`  Error parsing Q#${qId}: ${e.message}`);
    }
  }

  return Array.from(questions.values());
}

function parseQuestionBlock(block, qId) {
  // Remove page separators and clean up
  const text = block.replace(/<<<PAGE>>>/g, ' ').replace(/\s+/g, ' ');

  // Remove ad headers
  const headerCleaned = text
    .replace(/IT\s*认证轻松过.*?(?:Examtopics)\s*/g, '')
    .replace(/AWS Certified Solutions Architect.*?(?:xianyu\s*shop|Examtopics)\s*/g, '')
    .replace(/淘宝\s*:\s*"[^"]*"\s*https:\/\/shop[^\s]*\s*/g, '')
    .replace(/棃宝\s*:\s*"[^"]*"\s*https:\/\/shop[^\s]*\s*/g, '')
    .replace(/淘孨\s*:\s*"[^"]*"\s*https:\/\/shop[^\s]*\s*/g, '')
    .replace(/咸鱼\s*:\s*"[^"]*"\s*https:\/\/www\.goofish[^\s]*\s*/g, '')
    .replace(/咸轼\s*:\s*"[^"]*"\s*https:\/\/www\.goofish[^\s]*\s*/g, '')
    .replace(/微信\s*:\s*"[^"]*"\s*/g, '')
    .replace(/嬄信\s*:\s*"[^"]*"\s*/g, '')
    .replace(/wechat\s+Taobao\s+shop\s+xianyu\s+shop\s*/gi, '')
    .replace(/Community\s+vote\s+distribution.*?(?:\d+%)/g, '')
    .replace(/社区投票分[布害].*?(?:\d+%)/g, '')
    .trim();

  // Remove the "Topic X Question #N" header
  const afterHeader = headerCleaned.replace(/^Topic\s+\d+\s+Question\s+#\d+\s*/, '').trim();

  // Find option positions: A. B. C. D. E. F.
  // Options in these PDFs are marked as "A." at word boundary
  const optionPositions = [];
  const optRegex = /(?:^|\s)([A-F])\.\s/g;
  let optMatch;
  while ((optMatch = optRegex.exec(afterHeader)) !== null) {
    const letter = optMatch[1];
    // Only count if it's a real option (not part of a sentence like "U.S." or "S3.")
    // Check that the letter is followed by a reasonable option text
    const beforeChar = afterHeader[optMatch.index] || '';
    // Skip if preceded by another letter (like "S3." or "EC2.")
    if (optMatch.index > 0 && /[a-z0-9]/i.test(afterHeader[optMatch.index - 1])) continue;
    // Only accept if this letter hasn't been seen yet or is in order
    if (optionPositions.length === 0 && letter === 'A') {
      optionPositions.push({ letter, index: optMatch.index });
    } else if (optionPositions.length > 0) {
      const lastLetter = optionPositions[optionPositions.length - 1].letter;
      if (letter.charCodeAt(0) === lastLetter.charCodeAt(0) + 1) {
        optionPositions.push({ letter, index: optMatch.index });
      }
    }
  }

  if (optionPositions.length < 2) return null;

  // Question text is before the first option
  const questionText = afterHeader.substring(0, optionPositions[0].index).trim();
  if (!questionText || questionText.length < 10) return null;

  // Extract each option's text
  const enOptions = {};
  const zhOptions = {};

  for (let i = 0; i < optionPositions.length; i++) {
    const letter = optionPositions[i].letter;
    const optStart = optionPositions[i].index;
    const optEnd = i + 1 < optionPositions.length
      ? optionPositions[i + 1].index
      : findAnalysisOrEnd(afterHeader, optionPositions[i].index);

    let optText = afterHeader.substring(optStart, optEnd).trim();
    // Remove the "A. " prefix
    optText = optText.replace(/^[A-F]\.\s*/, '').trim();
    // Remove "Most Voted" tag
    optText = optText.replace(/\s*Most\s+Voted\s*/gi, ' ').trim();

    if (optText) {
      const { en, zh } = splitEnZh(optText);
      enOptions[letter] = en;
      zhOptions[letter] = zh;
    }
  }

  if (Object.keys(enOptions).length < 2) return null;

  // Find answer
  let answerLetters = null;

  const answerPatterns = [
    /Correct\s+Answer\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
    /正确答案\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
    /桭确答案\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
    /桭确答栾\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
    /官方答案\s*(?:[:：是])\s*[:：]?\s*([A-F](?:\s*[,、&]\s*[A-F])*)/i,
    /4\.\s*官方答案\s+([A-F](?:\s*[,、&,]\s*[A-F])*)/i,
    /我选的答案\s*(?:[:：])?\s*([A-F](?:\s*[,、&,]\s*[A-F])*)/i,
    /我的答案\s*(?:[:：])?\s*([A-F](?:\s*[,、&,]\s*[A-F])*)/i,
    /我的选择\s*(?:[:：])?\s*([A-F](?:\s*[,、&,]\s*[A-F])*)/i,
    /3\.\s*我选的答案\s+([A-F])/i,
    /3\.\s*我的答案\s+([A-F])/i,
  ];

  for (const pattern of answerPatterns) {
    const m = text.match(pattern); // Search in original text to include analysis pages
    if (m) {
      answerLetters = m[1].match(/[A-F]/gi)?.map(l => l.toUpperCase());
      break;
    }
  }

  // Fallback: Most Voted
  if (!answerLetters) {
    const mvMatch = text.match(/([A-F])\.\s+[^.]*?Most\s+Voted/i);
    if (mvMatch) {
      answerLetters = [mvMatch[1].toUpperCase()];
    }
  }

  if (!answerLetters || answerLetters.length === 0) return null;

  // Check for multi-select
  const selectMatch = questionText.match(/(?:Select|Choose|选择)\s+(?:TWO|THREE|FOUR|two|three|four|两|三|四|2|3|4)/i);
  const isMultiple = answerLetters.length > 1;

  // Split question text into English and Chinese
  const { en: enQuestion, zh: zhQuestion } = splitEnZh(questionText);

  // Extract per-option explanations from analysis section
  const zhExplanations = {};
  const enExplanations = {};

  // Find analysis section in the full block
  const analysisStart = text.search(/(?:2\.\s*选项分析|选项分析|题目分析与解答)/);
  if (analysisStart > 0) {
    // The end of analysis: before "3. 我选的答案" or "3. 我的答案"
    const analysisEndMatch = text.search(/(?:3\.\s*(?:我选的答案|我的答案|我的选择)|4\.\s*官方答案|Community\s+vote)/i);
    const analysisSection = text.substring(
      analysisStart,
      analysisEndMatch > analysisStart ? analysisEndMatch : text.length
    );

    // Parse per-option explanations
    for (const letter of Object.keys(enOptions)) {
      // Find this option's analysis block
      const nextLetterCode = letter.charCodeAt(0) + 1;
      const nextLetter = String.fromCharCode(nextLetterCode);

      // Pattern: "A. text" or "A. " at start of explanation for this option
      const letterRegex = new RegExp(
        `${letter}[.)]\\s+([\\s\\S]*?)(?=${nextLetter}[.)]\\s|$)`,
        'i'
      );
      // More robust: find between option letter boundaries
      const startPattern = new RegExp(`(?:^|\\s)${letter}\\.\\s`, 'g');
      let letterStart = -1;
      let startM;
      // Find the right occurrence in analysis section (not the option definition)
      while ((startM = startPattern.exec(analysisSection)) !== null) {
        letterStart = startM.index + startM[0].length;
      }

      if (letterStart >= 0) {
        // Find end: next option letter or end of analysis
        const endPattern = new RegExp(`(?:^|\\s)${nextLetter}\\.\\s`);
        const endMatch = analysisSection.substring(letterStart).match(endPattern);
        const letterEnd = endMatch ? letterStart + endMatch.index : analysisSection.length;
        const explText = cleanText(analysisSection.substring(letterStart, letterEnd));
        if (explText && explText.length > 5) {
          zhExplanations[letter] = explText;
          enExplanations[letter] = explText;
        }
      }
    }
  }

  const zhQ = {
    exam: 'SAA-C03',
    id: qId,
    type: isMultiple ? 'multiple' : 'single',
    question: zhQuestion,
    options: zhOptions,
    answer: isMultiple ? answerLetters : answerLetters[0],
    explanations: zhExplanations,
  };

  const enQ = {
    exam: 'SAA-C03',
    id: qId,
    type: isMultiple ? 'multiple' : 'single',
    question: enQuestion,
    options: enOptions,
    answer: isMultiple ? answerLetters : answerLetters[0],
    explanations: enExplanations,
  };

  return { zh: zhQ, en: enQ };
}

function findAnalysisOrEnd(text, fromIndex) {
  // Find where the analysis section begins or text ends
  const markers = [
    '题目分析与解答',
    '题目分析',
    'Correct Answer',
    '正确答案',
    '桭确答案',
    '桭确答栾',
    'Community vote',
    '社区投票',
  ];

  let earliest = text.length;
  for (const marker of markers) {
    const idx = text.indexOf(marker, fromIndex);
    if (idx !== -1 && idx < earliest) {
      earliest = idx;
    }
  }
  return earliest;
}

async function main() {
  const allZhQuestions = [];
  const allEnQuestions = [];
  const seenIds = new Set();

  for (const pdfFile of PDF_FILES) {
    const filePath = path.join('.', pdfFile);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}, skipping`);
      continue;
    }

    console.log(`Processing: ${pdfFile}`);
    const pages = await extractAllPages(filePath);
    console.log(`  ${pages.length} pages`);

    const questions = parseQuestions(pages);
    console.log(`  Parsed ${questions.length} questions`);

    for (const q of questions) {
      if (!seenIds.has(q.zh.id)) {
        seenIds.add(q.zh.id);
        allZhQuestions.push(q.zh);
        allEnQuestions.push(q.en);
      } else {
        // If we already have this ID, check if the new one has better explanations
        const existingIdx = allZhQuestions.findIndex(x => x.id === q.zh.id);
        if (existingIdx >= 0) {
          const existing = allZhQuestions[existingIdx];
          if (Object.keys(existing.explanations).length < Object.keys(q.zh.explanations).length) {
            allZhQuestions[existingIdx] = q.zh;
            allEnQuestions[existingIdx] = q.en;
          }
        }
      }
    }
  }

  // Sort by ID
  allZhQuestions.sort((a, b) => a.id - b.id);
  allEnQuestions.sort((a, b) => a.id - b.id);

  console.log(`\nTotal unique questions: ${allZhQuestions.length}`);

  // Stats
  let withExpl = 0, withAnswer = 0, multiCount = 0;
  for (const q of allZhQuestions) {
    if (Object.keys(q.explanations).length > 0) withExpl++;
    if (q.answer) withAnswer++;
    if (q.type === 'multiple') multiCount++;
  }
  console.log(`With explanations: ${withExpl}`);
  console.log(`With answers: ${withAnswer}`);
  console.log(`Multiple choice: ${multiCount}`);

  // Write in chunks of 250
  const chunkSize = 250;
  const dataDir = path.join('.', 'public', 'data');

  const zhFiles = [];
  const enFiles = [];

  for (let i = 0; i < allZhQuestions.length; i += chunkSize) {
    const chunk = allZhQuestions.slice(i, i + chunkSize);
    const startId = chunk[0].id;
    const endId = chunk[chunk.length - 1].id;
    const fileName = `saa_c03_${startId}_${endId}.json`;
    fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(chunk, null, 2), 'utf-8');
    console.log(`Wrote ${fileName} (${chunk.length} questions)`);
    zhFiles.push(fileName);
  }

  for (let i = 0; i < allEnQuestions.length; i += chunkSize) {
    const chunk = allEnQuestions.slice(i, i + chunkSize);
    const startId = chunk[0].id;
    const endId = chunk[chunk.length - 1].id;
    const fileName = `saa_c03_en_${startId}_${endId}.json`;
    fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(chunk, null, 2), 'utf-8');
    console.log(`Wrote ${fileName} (${chunk.length} questions)`);
    enFiles.push(fileName);
  }

  // Print sample question
  if (allZhQuestions.length > 0) {
    console.log('\n--- Sample Question (zh) ---');
    console.log(JSON.stringify(allZhQuestions[0], null, 2).substring(0, 1000));
    console.log('\n--- Sample Question (en) ---');
    console.log(JSON.stringify(allEnQuestions[0], null, 2).substring(0, 1000));
  }

  console.log('\n--- Manifest entries ---');
  console.log('files:', JSON.stringify(zhFiles));
  console.log('enFiles:', JSON.stringify(enFiles));
}

main().catch(console.error);
