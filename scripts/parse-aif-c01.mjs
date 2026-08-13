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
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOTSPOT } from './aif-c01-hotspot-data.mjs'

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

// ── text extraction ────────────────────────────────────────────────────────
// Fold only the ranges that carry look-alike Han characters (CJK Radicals
// Supplement, Kangxi Radicals, CJK Compatibility Ideographs). Full-width
// punctuation is deliberately left alone.
const foldLookalikes = (text) => text.replace(/[⺀-⿿豈-﫿]/gu, ch => ch.normalize('NFKC'))

async function extractPages(file) {
  const data = new Uint8Array(readFileSync(resolve(root, file)))
  const pdf = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    let text = ''
    for (const item of content.items) {
      if (item.str !== undefined) text += item.str
      if (item.hasEOL) text += '\n'
    }
    pages.push(foldLookalikes(text))
  }
  return pages
}

// Watermark/footer furniture, the restated answer line, and the vote block.
// These interleave with the coaching text at every page break.
// The page furniture is scrubbed inline rather than by dropping whole lines,
// because the text layer regularly merges the last line of real content with the
// watermark beside it ("⼀次或不选择。淘宝/闲鱼: IT认证轻松过，微信: Examtopics").
// Dropping that line would silently swallow the end of a stem. The answer key is
// read off the raw block before any of this runs.
const INLINE_NOISE = [
  /\s*淘宝\/?闲鱼\s*[:：]\s*IT认证轻松过\s*[，,]?\s*微信\s*[:：]\s*Examt(?:opics)?/g,
  /\s*淘宝\/?闲鱼\s*[:：]\s*IT认证轻松过/g,
  /\s*微信\s*[:：]\s*Examt(?:opics)?/g,
  /\s*IT认证轻松过/g,
  /\s*Most Voted/g,
  /\s*Community vote distribution/gi,
  /\s*社区投票分[布发]/g,
  /\s*Correct Answer\s*[:：]\s*[A-F]*/g,
  /\s*正确答案\s*[:：]\s*[A-F]*/g,
  /\s*🗳/g,
]
const scrub = (line) => INLINE_NOISE.reduce((text, re) => text.replace(re, ' '), line)

// What is left over once the furniture is scrubbed: standalone fragments of the
// watermark, the vote histogram, and the cover page.
const NOISE = [
  /^opics$/,
  /^Examtopics$/,
  /^(?:淘宝|咸鱼|闲鱼|微信)$/,
  /^社区投票分[布发]$/,
  /^Community vote distribution$/i,
  /^(?:[A-F]{1,3}\s*\(\d+%\)\s*\(?\s*)+$/,
  /^扫码关注.*$/,
  /^中文AI解析版$/,
  /^下载时间.*$/,
  /^使用指南$/,
]
const isNoise = (line) => NOISE.some(re => re.test(line.trim()))

// Collapse the spacing the text layer sprinkles between runs, then close up the
// gaps it leaves inside CJK text and around full-width punctuation.
function tidy(text) {
  return text
    .replace(/[ \t ]+/g, ' ')
    .replace(/(?<=[㐀-鿿])\s+(?=[㐀-鿿])/gu, '')
    .replace(/\s+(?=[，。、？！：；）』」》%])/gu, '')
    .replace(/(?<=[（『「《])\s+/gu, '')
    .trim()
}

// Line breaks in the source are real separators — one sentence ends and the next
// begins — so each line is tidied on its own and then joined with a space.
// Tidying the joined string instead would swallow the boundary between two Han
// characters and run "自动扩展推理端点" straight into "此选项与…".
const joinLines = (lines) => lines.map(tidy).filter(Boolean).join(' ').trim()

const hasHan = (line) => /[㐀-鿿]/u.test(line)

// Split a stem or option body into its English half and its Chinese half. The
// source always puts English first, so the first Han-bearing line is the seam.
function splitLangs(lines) {
  const seam = lines.findIndex(hasHan)
  if (seam === -1) return { en: joinLines(lines), zh: '' }
  return {
    en: joinLines(lines.slice(0, seam)),
    zh: joinLines(lines.slice(seam)),
  }
}

// ── per-question parsing ───────────────────────────────────────────────────
const OPTION_LINE = /^([A-F])[.、:：]\s*(.*)$/
// The coaching write-up opens with one of a handful of labels — sometimes the
// "题目解析/题目分析" banner, sometimes a bare or numbered "考察的知识点", and in
// a few sections just "知识点". Any numbered Chinese section heading also marks
// the boundary, since nothing in a stem or option is numbered that way.
const ANALYSIS_HEAD = [
  /^题目(?:解析|分析)/,
  /^知识点$/,
  /^(?:\d+\s*[.)、]\s*)?(?:本题|这题)?考察(?:的)?知识点/,
  /^\d+\s*[.)、]\s*[㐀-鿿]/u,
]
const isAnalysisHead = (line) => ANALYSIS_HEAD.some(re => re.test(line))
// Where the per-option analysis stops and the answer recap begins. Anchored to
// the whole line: several write-ups open a paragraph with "官方答案可能不正确…",
// and a prefix match there would truncate the analysis. `结论` is deliberately
// absent — it appears *inside* each option's analysis.
const ANALYSIS_END = /^(?:\d+\s*[.)、]\s*)?(?:推荐答案|建议答案|官方答案|我的答案|我选的答案|我选择的答案|我的选择|最终答案|比较与验证|比较与分析|与官方答案.{0,6}(?:比较|一致)|复盘)\s*[:：]?\s*$/
const SECTION_HEAD = /^\d+\s*[.、]\s*/
const wanted = (text) => {
  const en = text.match(/\(?\s*(?:choose|select|pick)\s+(two|three|four|five|2|3|4|5)\s*\.?\s*\)?/i)
  const words = { two: 2, three: 3, four: 4, five: 5 }
  if (en) return words[en[1].toLowerCase()] ?? Number(en[1])
  const zh = text.match(/[选選]\s*[择擇]?\s*(两|兩|二|三|四|五|2|3|4|5)\s*[个個]/)
  if (zh) return { 两: 2, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5 }[zh[1]] ?? Number(zh[1])
  return null
}

// The write-up analyses each option under a heading that repeats the option
// text ("B. Partial dependence plots (PDPs)(部分依赖图)"). Capture the body
// under each heading, stopping at the next option or the next numbered section.
function parseAnalysis(lines) {
  const found = new Map()
  let current = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (ANALYSIS_END.test(line)) break
    const option = line.match(OPTION_LINE)
    // A heading is an option letter whose body is not itself prose about
    // several options; treat any `X.`-led line as the start of that option.
    if (option && /^[A-F]$/.test(option[1])) {
      current = option[1]
      if (!found.has(current)) found.set(current, [])
      // The heading restates the option before the analysis, either on the same
      // line ("A. Nova Lite: Nova Lite 通常是…") or on its own. Keep whatever
      // followed the letter; only the letter prefix itself is dropped.
      if (option[2]) found.get(current).push(option[2])
      continue
    }
    if (SECTION_HEAD.test(line)) { current = null; continue }
    if (current) found.get(current).push(line)
  }
  const out = {}
  for (const [letter, body] of found) {
    const text = joinLines(body)
    if (text) out[letter] = text
  }
  return out
}

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
  const lines = block.split('\n')
    .map(l => scrub(l).replace(/\s+$/, ''))
    .filter(l => l.trim() && !isNoise(l))

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
  const need = wanted(question.en) ?? wanted(question.zh)
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
for (const file of PDFS) pages.push(...await extractPages(file))
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
