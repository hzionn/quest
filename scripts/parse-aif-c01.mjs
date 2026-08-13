// Ingests the AIF-C01 (AWS Certified AI Practitioner) bank from the two source
// PDFs in AIF/ and writes the ZH/EN question banks under public/data.
//
// The source is a bilingual "AI 解析版" dump: one ExamTopics question per
// section, English stem first, Chinese translation underneath, then the A–D
// options in the same pairing, then a Chinese coaching write-up that analyses
// every option one by one and restates the official answer.
//
// Two things make a naive line parser wrong here, and both are handled below:
//
//   * The text layer encodes many Han characters as Kangxi radicals (U+2F00…)
//     rather than unified ideographs, so `目` arrives as `⽬` and any regex over
//     the Chinese text silently misses. Only those blocks are NFKC-folded —
//     folding the whole string would also flatten the full-width punctuation
//     that the rest of the banks use.
//   * A question's coaching text runs across a page break, and the page footer,
//     the `Correct Answer:` line and the community-vote block all land in the
//     middle of it. Those are stripped before the per-option split so an
//     explanation cannot absorb a stray footer.
//
// The answer key is taken from the `Correct Answer:` line, never inferred from
// the Chinese verdict words in the write-up: that inference is what produced the
// unscoreable multi-answer records fixed in #211. `(Choose two.)` stems are
// typed `multiple` and cross-checked against the letter count.
//
// Usage:
//   node scripts/parse-aif-c01.mjs --report   # parse and print stats, write nothing
//   node scripts/parse-aif-c01.mjs            # parse and write public/data
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOTSPOT } from './aif-c01-hotspot-data.mjs'
import {
  extractPages, cleanLines, tidy, joinLines, splitLangs,
  OPTION_LINE, isAnalysisHead, ANALYSIS_END, parseAnalysis, answersWanted,
} from './lib/aizh-pdf.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, 'public/data')
const EXAM = 'AIF-C01'
const PDFS = [
  'AIF/AWS Certified AI Practitioner AIF-C01_aizh-1-400.pdf',
  'AIF/AWS Certified AI Practitioner AIF-C01_aizh-401-803.pdf',
]
// Chunk boundaries mirror the other banks: 100 per file, remainder in the last.
const CHUNK = 100
const reportOnly = process.argv.includes('--report')

// ── per-question parsing ───────────────────────────────────────────────────
// HOTSPOT sections carry no lettered options: the answer key comes from the
// transcribed widget in aif-c01-hotspot-data.mjs, and only the stem and the
// coaching text are taken from the PDF. Row-level explanations state the choice
// the widget marked; `_full` (rendered as 總覽) carries the write-up whole,
// because these write-ups label their rows too inconsistently to split per row
// without risking a paragraph being filed under the wrong one.
function parseHotspot(id, lines) {
  const spec = HOTSPOT[id]
  const headIndex = lines.findIndex(l => isAnalysisHead(l.trim()))
  const stemLines = (headIndex === -1 ? lines : lines.slice(0, headIndex))
    .filter(l => !/^(HOTSPOT|DRAG DROP|热点|Answer Area|-)$/.test(l.trim()))
  const question = splitLangs(stemLines)
  // Kept whole, section headings included, so 總覽 reads the way the write-up
  // was written rather than as orphaned paragraphs.
  const writeUp = headIndex === -1 ? '' : joinLines(lines.slice(headIndex))

  const ids = spec.pool.map((_, index) => `opt-${index + 1}`)
  const idFor = (text) => ids[spec.pool.indexOf(text)]
  const explanations = {}
  if (spec.kind === 'matching') {
    spec.rows.forEach(([useCase, choice], index) => {
      explanations[String(index + 1)] = `${useCase} → ${choice}`
    })
  } else {
    spec.rows.forEach((step, index) => { explanations[`步驟 ${index + 1}`] = step })
  }
  if (writeUp) explanations._full = writeUp

  const build = (stem) => {
    const record = { exam: EXAM, id, type: spec.kind, question: stem }
    if (spec.kind === 'matching') {
      record.available_options = spec.pool
      record.matches = spec.rows.map(([useCase, choice]) => ({
        use_case: useCase,
        correct_answer: choice,
        correct_option_id: idFor(choice),
      }))
      record.explanations = explanations
      record.available_option_ids = ids
    } else {
      record.available_steps = spec.pool
      record.ordered_steps = spec.rows
      record.explanations = explanations
      record.available_step_ids = ids
      record.ordered_step_ids = spec.rows.map(idFor)
    }
    return record
  }

  return {
    id,
    type: spec.kind,
    letters: [],
    need: null,
    missingAnalysis: [],
    zh: build(question.zh || question.en),
    en: build(question.en),
  }
}

function parseBlock(id, block) {
  const lines = cleanLines(block)

  const answerMatch = block.match(/Correct Answer\s*[:：]\s*([A-F](?:\s*[,、]?\s*[A-F])*)/)
  const letters = answerMatch ? [...new Set(answerMatch[1].replace(/[^A-F]/g, '').split(''))] : []

  const firstOption = lines.findIndex(l => OPTION_LINE.test(l.trim()) && l.trim().startsWith('A'))
  const hotspot = lines.some(l => /^(HOTSPOT|DRAG DROP|热点)$/.test(l.trim()))
  if (firstOption === -1 || letters.length === 0) {
    if (HOTSPOT[id]) return parseHotspot(id, lines)
    return { id, skipped: hotspot ? 'hotspot' : 'no options/answer' }
  }

  // The option list ends at whichever comes first: the write-up's opening
  // label, or an option letter that breaks the A→B→C ascent (the write-up
  // restating the options as its own headings).
  let expected = 1
  let boundary = lines.length
  for (let i = firstOption + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (isAnalysisHead(line)) { boundary = i; break }
    const m = line.match(OPTION_LINE)
    if (!m) continue
    const index = m[1].charCodeAt(0) - 65
    if (index === expected) expected += 1
    else { boundary = i; break }
  }
  const stemLines = lines.slice(0, boundary)
  const analysisLines = lines.slice(boundary)

  const question = splitLangs(stemLines.slice(0, firstOption).filter(l => !/^-$/.test(l.trim())))

  // Group the option region by letter, keeping source order.
  const optionLines = stemLines.slice(firstOption)
  const groups = []
  for (const raw of optionLines) {
    const line = raw.trim().replace(/\s*Most Voted\s*/g, ' ')
    const m = line.match(OPTION_LINE)
    if (m) groups.push({ letter: m[1], lines: [m[2]] })
    else if (groups.length) groups.at(-1).lines.push(line)
  }
  const optionsEn = {}
  const optionsZh = {}
  for (const { letter, lines: body } of groups) {
    const { en, zh } = splitLangs(body.filter(Boolean))
    optionsEn[letter] = en
    optionsZh[letter] = zh || en
  }

  const analysis = parseAnalysis(analysisLines)
  const optionLetters = Object.keys(optionsEn)
  const need = answersWanted(question.en) ?? answersWanted(question.zh)
  const type = letters.length > 1 || (need !== null && need > 1) ? 'multiple' : 'single'

  // Verdicts come from the answer key, not from the Chinese wording, so a
  // garbled write-up can never flip an option's polarity.
  const explanationsZh = {}
  const explanationsEn = {}
  for (const letter of optionLetters) {
    // Kept verbatim, including the write-up's own restatement of the option:
    // the DEA-C01 and SAA-C03 banks read the same way, and trimming the repeat
    // risks cutting the subject off a sentence that legitimately opens with the
    // option's name ("威胁检测是合规性的重要组成部分…").
    const body = analysis[letter] || ''
    const correct = letters.includes(letter)
    // #401's write-up is cut off mid-sentence in the source PDF, so a few
    // options have no reasoning to quote. State the verdict alone rather than
    // leaving a dangling colon.
    explanationsZh[letter] = body ? `${correct ? '正确' : '错误'}：${body}` : (correct ? '正确' : '错误')
    explanationsEn[letter] = body ? `${correct ? 'Correct.' : 'Incorrect.'} ${body}` : (correct ? 'Correct.' : 'Incorrect.')
  }

  return {
    id,
    type,
    letters,
    need,
    missingAnalysis: optionLetters.filter(l => !analysis[l]),
    zh: {
      exam: EXAM, id, type,
      question: question.zh || question.en,
      options: optionsZh,
      answer: type === 'multiple' ? letters : letters[0],
      explanations: explanationsZh,
    },
    en: {
      exam: EXAM, id, type,
      question: question.en,
      options: optionsEn,
      answer: type === 'multiple' ? letters : letters[0],
      explanations: explanationsEn,
    },
  }
}

// ── run ────────────────────────────────────────────────────────────────────
const pages = []
for (const file of PDFS) pages.push(...await extractPages(resolve(root, file)))
const full = pages.join('\n')
const parts = full.split(/Topic\s*\d+\s*Question\s*#(\d+)/)
const blocks = new Map()
for (let i = 1; i < parts.length; i += 2) blocks.set(Number(parts[i]), parts[i + 1])

const parsed = []
const skipped = []
for (const id of [...blocks.keys()].sort((a, b) => a - b)) {
  const result = parseBlock(id, blocks.get(id))
  if (result.skipped) skipped.push(result)
  else parsed.push(result)
}

console.log(`pages: ${pages.length}, question sections: ${blocks.size}`)
console.log(`parsed: ${parsed.length}, skipped: ${skipped.length}`)
const countOf = (type) => parsed.filter(q => q.type === type).length
console.log(`  types: single=${countOf('single')} multiple=${countOf('multiple')} matching=${countOf('matching')} ordering=${countOf('ordering')}`)

const lettered = parsed.filter(q => q.zh.options)
const mismatched = parsed.filter(q => q.need !== null && q.letters.length !== q.need)
const emptyAnalysis = parsed.filter(q => q.missingAnalysis.length)
const shortStem = parsed.filter(q => !q.zh.question || !q.en.question ||
  [q.zh, q.en].some(record => Object.values(record.options || {}).some(text => !text)))
const optionCount = lettered.filter(q => Object.keys(q.en.options).length < 4)
console.log(`  stem asks N but letters differ: ${mismatched.length}${mismatched.length ? ' -> ' + mismatched.map(q => `#${q.id}(${q.letters.join('')}/${q.need})`).join(' ') : ''}`)
console.log(`  options with no analysis text: ${emptyAnalysis.length}${emptyAnalysis.length ? ' -> ' + emptyAnalysis.slice(0, 15).map(q => `#${q.id}[${q.missingAnalysis.join('')}]`).join(' ') : ''}`)
console.log(`  empty stem or option text: ${shortStem.length}${shortStem.length ? ' -> ' + shortStem.map(q => '#' + q.id).join(' ') : ''}`)
console.log(`  fewer than 4 options: ${optionCount.length}${optionCount.length ? ' -> ' + optionCount.map(q => `#${q.id}(${Object.keys(q.en.options).join('')})`).join(' ') : ''}`)
// Anything still skipped would be a HOTSPOT section with no entry in
// aif-c01-hotspot-data.mjs — the answer key for those lives only in the page
// bitmap, so it has to be transcribed there before the section can be emitted.
console.log(`  skipped (no transcribed widget): ${skipped.length}${skipped.length ? ' -> ' + skipped.map(q => q.id).join(' ') : ''}`)

// Leak checks: nothing that belongs to the page furniture, the answer recap or
// the vote block may survive into a record the user reads.
const LEAKS = [
  ['footer', /淘宝|闲鱼|IT认证轻松过|Examt|^opics$/],
  // Only the literal artifact counts here: "是正确答案" is ordinary prose in
  // these write-ups and must not be flagged.
  ['answer recap', /Correct Answer\s*[:：]|^正确答案\s*[:：]/],
  ['vote marker', /Most Voted|社区投票|vote distribution/i],
  ['section number', /^\d+\s*[.、]\s*(?:考察|本题|独立|逐个|选项分析)/],
]
for (const [label, re] of LEAKS) {
  const hits = []
  for (const q of parsed) {
    for (const record of [q.zh, q.en]) {
      const fields = [
        record.question,
        ...Object.values(record.options || {}),
        ...Object.values(record.explanations),
        ...(record.available_options || []),
        ...(record.available_steps || []),
        ...(record.matches || []).map(match => match.use_case),
      ]
      if (fields.some(text => re.test(text))) { hits.push(q.id); break }
    }
  }
  console.log(`  ${label} leaked into a record: ${hits.length}${hits.length ? ' -> ' + [...new Set(hits)].slice(0, 20).join(' ') : ''}`)
}
const emptyBody = parsed.filter(q => Object.values(q.zh.explanations).some(text => text === '正确' || text === '错误'))
console.log(`  verdict-only explanations (source truncated): ${emptyBody.length}${emptyBody.length ? ' -> ' + emptyBody.map(q => '#' + q.id).join(' ') : ''}`)

if (reportOnly) {
  const sample = parsed.find(q => q.id === 1)
  console.log('\n── sample #1 (zh) ──')
  console.log(JSON.stringify(sample.zh, null, 1).slice(0, 1800))
  const multi = parsed.find(q => q.type === 'multiple')
  console.log('\n── sample multiple #' + multi.id + ' (en) ──')
  console.log(JSON.stringify(multi.en, null, 1).slice(0, 1400))
  process.exit(0)
}

// Write in the same shape as the other banks: 1-space indent, no trailing newline.
const ids = parsed.map(q => q.id)
const chunks = []
for (let start = 0; start < ids.length; start += CHUNK) {
  chunks.push(parsed.slice(start, start + CHUNK))
}
const written = []
for (const chunk of chunks) {
  const first = chunk[0].id
  const last = chunk.at(-1).id
  for (const [lang, key] of [['', 'zh'], ['en_', 'en']]) {
    const name = `aif_c01_${lang}${first}_${last}.json`
    writeFileSync(resolve(dataDir, name), JSON.stringify(chunk.map(q => q[key]), null, 1))
    written.push(name)
  }
}
console.log(`\nwrote ${written.length} files:`)
for (const name of written) console.log('  ' + name)
