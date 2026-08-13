// Ingests the AZ-305 bank from the two source PDFs in AZ-305/ and writes the
// ZH/EN question banks under public/data. Shares its PDF reading with the
// AIF-C01 ingest via scripts/lib/aizh-pdf.mjs — same publisher, same layout.
//
// Three things are specific to this source:
//
//   * Sections are numbered per topic ("Topic 4Question #12"), and the numbering
//     restarts in each of the 16 topics. Ids are therefore assigned sequentially
//     in source order, because every other bank in this repo uses integer ids.
//     The topic each id came from is printed in the run report.
//   * The Chinese translation of an option sits either directly above or
//     directly below its English line, and which one it is varies question by
//     question — the overlay is positioned per paragraph, not per line. Pairing
//     by reading order alone mislabels whole questions, so the two orderings are
//     scored against each other by how many Latin tokens (service names, cmdlet
//     names) each pairing shares with the English option it would attach to.
//   * Topics 5-16 are case studies. Each of their questions repeats the whole
//     "Introductory Info" scenario in its own section, so the records stay
//     self-contained and no scenario has to be threaded between questions.
//
// HOTSPOT / DRAG DROP sections are not emitted here: their candidate lists are
// drawn in page bitmaps rather than the text layer. They are counted and listed
// by the report so they can be transcribed separately, the way the AIF-C01
// widgets were.
//
// Usage:
//   node scripts/parse-az305.mjs --report   # parse and print stats, write nothing
//   node scripts/parse-az305.mjs            # parse and write public/data
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  extractPages, cleanLines, joinLines, splitLangs,
  OPTION_LINE, isAnalysisHead, parseAnalysis, answersWanted, tidy,
} from './lib/aizh-pdf.mjs'
import { HOTSPOT as TRANSCRIBED } from './az305-hotspot-data.mjs'
import { EXHIBITS } from './az305-exhibits.mjs'

// A stem that says "shown in the following table" is referring to a bitmap, so
// the extracted text alone leaves the reader without the data. Append the
// transcribed rows, labelled, in the shape AZ-104 uses for its exhibits.
const withExhibit = (stem, id, lang) => {
  const rows = EXHIBITS[id]
  if (!rows) return stem
  const heading = lang === 'zh' ? '【題目附表】' : 'Referenced table:'
  return `${stem}\n\n${heading}\n${rows.map(row => `・${row}`).join('\n')}`
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, 'public/data')
const EXAM = 'AZ-305'
const PDFS = [
  'AZ-305/AZ-305_aizh-1-300.pdf',
  'AZ-305/AZ-305_aizh-301-671.pdf',
]
const CHUNK = 100
const reportOnly = process.argv.includes('--report')

// Latin tokens are what survives translation: service names, cmdlet names,
// SKUs. Comparing them is how an option's Chinese line is matched to its English
// one when the two orderings are otherwise indistinguishable.
const STOP = new Set(['the', 'and', 'for', 'that', 'with', 'from', 'into', 'this', 'use', 'using', 'create', 'configure'])
const tokensOf = (text) => new Set(
  (text.match(/[A-Za-z][A-Za-z0-9-]{2,}/g) || [])
    .map(token => token.toLowerCase())
    .filter(token => !STOP.has(token)),
)
const overlap = (a, b) => {
  let hits = 0
  for (const token of a) if (b.has(token)) hits += 1
  return hits
}

// Group the option region into { letter, en, zhBefore, zhAfter } so the two
// orderings can be scored before either is committed to.
function groupOptions(lines) {
  const groups = []
  let pending = []
  for (const raw of lines) {
    const line = raw.trim()
    const match = line.match(OPTION_LINE)
    if (match) {
      groups.push({ letter: match[1], en: match[2], before: pending, after: [] })
      pending = []
    } else if (groups.length) {
      groups.at(-1).after.push(line)
      pending.push(line)
    } else {
      pending.push(line)
    }
  }
  // `after` and the next group's `before` are the same lines; keep both views.
  for (let i = 0; i < groups.length; i++) {
    if (i + 1 < groups.length) groups[i].after = groups[i + 1].before
  }
  return groups
}

// Which side the Chinese line sits on is decided structurally: if a non-option
// line follows the *last* option marker, the translations trail their English
// lines; if the last marker runs straight into the write-up, they lead. Token
// overlap is kept only as a cross-check, because it is silent on the Yes/No
// questions ("A. Yes" / "是" share nothing) that a score-based rule gets wrong.
function resolveOptionLangs(groups) {
  const score = (key) => groups.reduce((total, group) => {
    const zh = joinLines(group[key] || [])
    return total + (zh ? overlap(tokensOf(group.en), tokensOf(zh)) : 0)
  }, 0)
  const beforeScore = score('before')
  const afterScore = score('after')
  const trailing = groups.at(-1)?.after?.length ?? 0
  const key = trailing > 0 ? 'after' : 'before'
  const tokenPick = beforeScore === afterScore ? null : (beforeScore > afterScore ? 'before' : 'after')
  return { key, beforeScore, afterScore, tokenDisagrees: tokenPick !== null && tokenPick !== key }
}

// ── HOTSPOT sections ───────────────────────────────────────────────────────
// Unlike the AIF-C01 widgets, these write-ups spell the whole thing out in text:
// the "官方答案" section lists每 row as "<label>: <choice>", and the option
// analysis lists every candidate for that row with its verdict. That is the row
// labels, the candidate pool (distractors included) and the answer key, so these
// records are built from the text and the page bitmap is used to spot-check.
//
// Nothing is emitted unless the structure holds: at least two rows, every chosen
// value present in the pool, and a pool at least as large as the row count.
// Anything that fails drops through to the skipped list rather than guessing.
const SECTION_BODY = (lines, labelRe) => {
  const start = lines.findIndex(l => new RegExp(`^\\d+\\s*[.、]\\s*${labelRe}`).test(l.trim()))
  if (start === -1) return []
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(l => /^\d+\s*[.、]\s*/.test(l.trim()))
  return (end === -1 ? rest : rest.slice(0, end)).map(l => l.trim())
}

const ROW_LINE = /^(.{2,90}?)\s*[:：]\s*(\S.*)$/
// A candidate heading is short, has no sentence punctuation, and is not prose.
const CANDIDATE_PREFIX = /^(?!此|虽然|因此|在|由于|该|这|如果|综合|注意)(?=.*[A-Za-z])(.{2,70}?)\s*[:：]/

// A widget transcribed from the page bitmap in az305-hotspot-data.mjs. This
// takes precedence over the text-derived path: the bitmap is the official key,
// and where the two disagree (#24) the bitmap is what the exam scores.
function parseTranscribed({ topic, num, id, text }) {
  const spec = TRANSCRIBED[id]
  if (!spec) return null
  const lines = cleanLines(text)
  const headIndex = lines.findIndex(l => isAnalysisHead(l.trim()))
  const stemLines = (headIndex === -1 ? lines : lines.slice(0, headIndex))
    .filter(l => !/^(HOTSPOT|DRAG DROP|热点|拖放|Answer Area|-)$/.test(l.trim()))
  const question = splitLangs(stemLines)
  const writeUp = headIndex === -1 ? '' : joinLines(lines.slice(headIndex))
  const ids = spec.pool.map((_, index) => `opt-${index + 1}`)
  const idFor = (value) => ids[spec.pool.indexOf(value)]

  const explanations = {}
  if (spec.kind === 'matching') {
    spec.rows.forEach(([label, value], index) => { explanations[String(index + 1)] = `${label} → ${value}` })
  } else if (spec.kind === 'ordering') {
    spec.rows.forEach((value, index) => { explanations[`步驟 ${index + 1}`] = value })
  }
  if (writeUp) explanations._full = writeUp

  const letterFor = (value) => String.fromCharCode(65 + spec.pool.indexOf(value))
  const build = (stem) => {
    const record = { exam: EXAM, id, type: spec.kind, question: stem }
    if (spec.kind === 'matching') {
      record.available_options = spec.pool
      record.matches = spec.rows.map(([label, value]) => ({
        use_case: label, correct_answer: value, correct_option_id: idFor(value),
      }))
      record.explanations = explanations
      record.available_option_ids = ids
    } else if (spec.kind === 'ordering') {
      record.available_steps = spec.pool
      record.ordered_steps = spec.rows
      record.explanations = explanations
      record.available_step_ids = ids
      record.ordered_step_ids = spec.rows.map(idFor)
    } else {
      // A "which three…" set: lettered options graded order-insensitively.
      record.options = Object.fromEntries(spec.pool.map((text, index) => [String.fromCharCode(65 + index), text]))
      record.answer = spec.rows.map(letterFor).sort()
      record.explanations = Object.fromEntries(spec.pool.map((text, index) => {
        const letter = String.fromCharCode(65 + index)
        const correct = spec.rows.includes(text)
        return [letter, correct ? '正确' : '错误']
      }))
      if (writeUp) record.explanations._full = writeUp
    }
    return record
  }

  return {
    topic, num, id, type: spec.kind, letters: [], need: null,
    langKey: 'widget', langMargin: 0, tokenDisagrees: false, missingAnalysis: [],
    zh: build(withExhibit(question.zh || question.en, id, 'zh')),
    en: build(withExhibit(question.en, id, 'en')),
  }
}

function parseHotspot({ topic, num, id, text }) {
  const lines = cleanLines(text)
  const headIndex = lines.findIndex(l => isAnalysisHead(l.trim()))
  if (headIndex === -1) return null

  const officialRaw = []
  for (const line of SECTION_BODY(lines, '官方答案')) {
    const m = line.match(ROW_LINE)
    if (!m) continue
    const label = tidyish(m[1])
    const value = tidyish(m[2])
    // The write-ups often close with reference links, and "https://docs…" reads
    // as a label/value pair. Those are not rows.
    if (/^https?$/i.test(label) || /\/\//.test(label) || /^\/\//.test(value)) continue
    if (/docs\.microsoft\.com|learn\.microsoft\.com/i.test(label + value)) continue
    officialRaw.push([label, value])
  }
  if (officialRaw.length < 2) return null

  const labels = new Set(officialRaw.map(([label]) => label))
  const analysis = lines.slice(headIndex)
  // Candidates are read from the option-analysis section only. Scanning the whole
  // write-up also picks up "框 1:" (box 1), reference URLs and any prose that
  // happens to contain a colon.
  const analysisBody = SECTION_BODY(lines, '(?:选项分析|独立分析每个选项|逐个选项分析|逐个分析选项|步骤分析|选项逐个分析)')
  const candidates = []
  for (const raw of (analysisBody.length ? analysisBody : analysis)) {
    // Row labels sometimes run onto the end of the previous candidate's line, so
    // clip them out before reading a candidate name off the front.
    let line = raw.trim()
    for (const label of labels) line = line.split(label).join(' ')
    const m = line.match(CANDIDATE_PREFIX)
    if (!m) continue
    const name = tidyish(m[1])
    if (!name || labels.has(name) || name.length < 3) continue
    if (/[。；]/u.test(name) || /^(?:https?|框|box\b)/i.test(name)) continue
    candidates.push(name)
  }

  // The write-up may name the same choice with and without its acronym
  // ("… Privileged Identity Management" / "… (PIM)"). Those are one option, not
  // two: keep the longest spelling and answer with that one.
  const baseOf = (name) => name.replace(/\s*\([A-Za-z0-9 /-]{2,10}\)\s*$/u, '').trim().toLowerCase()
  const byBase = new Map()
  for (const name of candidates) {
    const base = baseOf(name)
    const kept = byBase.get(base)
    if (!kept || name.length > kept.length) byBase.set(base, name)
  }
  const pool = []
  for (const name of candidates) {
    const canonical = byBase.get(baseOf(name))
    if (!pool.includes(canonical)) pool.push(canonical)
  }

  // Rows come from the analysis section, which groups the candidates under one
  // heading per dropdown and marks exactly one of them 正确. The recap section is
  // only a cross-check: it repeats itself and paraphrases, so reading rows off it
  // invents dropdowns that the widget does not have (#150 has two; its recap
  // yields six "label: value" lines).
  const rows = []
  let heading = null
  let picked = null
  let seen = 0
  const flush = () => {
    if (heading && picked && seen === 1) rows.push([heading, picked])
    picked = null
    seen = 0
  }
  for (const raw of analysisBody) {
    let line = raw.trim()
    // A heading is a label with nothing after its colon; the next row's heading
    // can also be glued to the end of the previous candidate's line.
    for (const label of labels) {
      const at = line.indexOf(label)
      if (at === -1) continue
      const rest = line.slice(at + label.length).replace(/^[\s:：]+/u, '')
      line = line.slice(0, at).trim()
      if (line) {
        const inner = line.match(CANDIDATE_PREFIX)
        if (inner) {
          const name = byBase.get(baseOf(tidyish(inner[1])))
          if (name && /(?<!不)正确/u.test(line)) { picked = name; seen += 1 }
        }
      }
      flush()
      heading = label
      line = rest
      break
    }
    if (!line) continue
    const m = line.match(CANDIDATE_PREFIX)
    if (!m) continue
    const name = byBase.get(baseOf(tidyish(m[1])))
    if (!name) continue
    if (/(?<!不)正确/u.test(line) && !/错误/u.test(line)) { picked = name; seen += 1 }
  }
  flush()

  if (rows.length < 2) return null
  if (pool.length < rows.length) return null
  // Cross-check against the recap: every row the recap does state must agree.
  const recap = new Map(officialRaw.map(([label, value]) => [label, byBase.get(baseOf(value))]))
  for (const [label, value] of rows) {
    if (recap.has(label) && recap.get(label) && recap.get(label) !== value) return null
  }

  const stemLines = lines.slice(0, headIndex)
    .filter(l => !/^(HOTSPOT|DRAG DROP|热点|拖放|Answer Area|-)$/.test(l.trim()))
  const question = splitLangs(stemLines)
  const ids = pool.map((_, index) => `opt-${index + 1}`)
  const explanations = {}
  rows.forEach(([label, value], index) => { explanations[String(index + 1)] = `${label} → ${value}` })
  const writeUp = joinLines(analysis)
  if (writeUp) explanations._full = writeUp

  const build = (stem) => ({
    exam: EXAM, id, type: 'matching', question: stem,
    available_options: pool,
    matches: rows.map(([label, value]) => ({
      use_case: label,
      correct_answer: value,
      correct_option_id: ids[pool.indexOf(value)],
    })),
    explanations,
    available_option_ids: ids,
  })

  return {
    topic, num, id, type: 'matching', letters: [], need: null,
    langKey: 'n/a', langMargin: 0, tokenDisagrees: false, missingAnalysis: [],
    rowCount: rows.length, poolSize: pool.length,
    zh: build(withExhibit(question.zh || question.en, id, 'zh')),
    en: build(withExhibit(question.en, id, 'en')),
  }
}

const tidyish = (text) => tidy(text).replace(/[。，,；;]+$/u, '').trim()

function parseBlock({ topic, num, id, text }) {
  const lines = cleanLines(text)

  const answerMatch = text.match(/Correct Answer\s*[:：]\s*([A-F](?:\s*[,、]?\s*[A-F])*)/)
  const letters = answerMatch ? [...new Set(answerMatch[1].replace(/[^A-F]/g, '').split(''))] : []
  const hotspot = lines.some(l => /^(HOTSPOT|DRAG DROP|热点|拖放)$/.test(l.trim()))

  const firstOption = lines.findIndex(l => {
    const m = l.trim().match(OPTION_LINE)
    return m && m[1] === 'A'
  })
  if (firstOption === -1 || letters.length === 0) {
    const fromWidget = parseTranscribed({ topic, num, id, text })
    if (fromWidget) return fromWidget
    const fromText = parseHotspot({ topic, num, id, text })
    if (fromText) return fromText
    return { topic, num, id, skipped: hotspot ? 'hotspot' : 'no options/answer' }
  }

  // The option list ends at the write-up's opening label, or where an option
  // letter breaks the A→B→C ascent (the write-up restating the options).
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

  // When the Chinese option text sits above its English line, option A's
  // translation is the line *before* the "A." marker — it would otherwise be
  // read as the last line of the stem. Look back by as many lines as the other
  // options use for their own translation, so the lookback mirrors the layout
  // instead of guessing, then let the scoring decide whether to keep them.
  const spans = groupOptions(lines.slice(firstOption, boundary))
    .slice(1)
    .map(group => group.before.length)
  const perOption = spans.length ? Math.max(...spans) : 1
  let lookback = 0
  while (lookback < perOption && firstOption - lookback - 1 >= 0 &&
         !OPTION_LINE.test(lines[firstOption - lookback - 1].trim())) lookback += 1

  const groups = groupOptions(lines.slice(firstOption - lookback, boundary))
  const { key, beforeScore, afterScore, tokenDisagrees } = resolveOptionLangs(groups)
  const stemEnd = key === 'before' ? firstOption - lookback : firstOption
  const question = splitLangs(lines.slice(0, Math.max(stemEnd, 0)).filter(l => !/^-$/.test(l.trim())))

  const optionsEn = {}
  const optionsZh = {}
  for (const group of groups) {
    const zh = joinLines(group[key] || [])
    optionsEn[group.letter] = joinLines([group.en])
    optionsZh[group.letter] = zh || joinLines([group.en])
  }

  const analysis = parseAnalysis(lines.slice(boundary))
  const optionLetters = Object.keys(optionsEn)
  const need = answersWanted(question.en) ?? answersWanted(question.zh)
  const type = letters.length > 1 || (need !== null && need > 1) ? 'multiple' : 'single'

  // Verdicts come from the answer key, not from the Chinese wording, so a
  // garbled write-up can never flip an option's polarity.
  const explanationsZh = {}
  const explanationsEn = {}
  for (const letter of optionLetters) {
    const body = analysis[letter] || ''
    const correct = letters.includes(letter)
    explanationsZh[letter] = body ? `${correct ? '正确' : '错误'}：${body}` : (correct ? '正确' : '错误')
    explanationsEn[letter] = body ? `${correct ? 'Correct.' : 'Incorrect.'} ${body}` : (correct ? 'Correct.' : 'Incorrect.')
  }

  const answer = type === 'multiple' ? letters : letters[0]
  return {
    topic, num, id, type, letters, need,
    langKey: key,
    langMargin: Math.abs(beforeScore - afterScore),
    tokenDisagrees,
    missingAnalysis: optionLetters.filter(l => !analysis[l]),
    zh: { exam: EXAM, id, type, question: withExhibit(question.zh || question.en, id, 'zh'), options: optionsZh, answer, explanations: explanationsZh },
    en: { exam: EXAM, id, type, question: withExhibit(question.en, id, 'en'), options: optionsEn, answer, explanations: explanationsEn },
  }
}

// ── run ────────────────────────────────────────────────────────────────────
const pages = []
for (const file of PDFS) pages.push(...await extractPages(resolve(root, file)))
const full = pages.join('\n')

const markers = [...full.matchAll(/Topic\s*(\d+)\s*Question\s*#(\d+)/g)]
const sections = markers.map((match, index) => ({
  topic: Number(match[1]),
  num: Number(match[2]),
  id: index + 1,
  text: full.slice(match.index + match[0].length, markers[index + 1]?.index ?? full.length),
}))

const parsed = []
const skipped = []
for (const section of sections) {
  const result = parseBlock(section)
  if (result.skipped) skipped.push(result)
  else parsed.push(result)
}

const countOf = (type) => parsed.filter(q => q.type === type).length
console.log(`pages: ${pages.length}, question sections: ${sections.length}`)
console.log(`parsed: ${parsed.length}, skipped: ${skipped.length}`)
console.log(`  types: single=${countOf('single')} multiple=${countOf('multiple')} matching=${countOf('matching')} ordering=${countOf('ordering')}`)
console.log(`  widgets transcribed from bitmaps: ${Object.keys(TRANSCRIBED).length}`)
console.log(`  topics: ${[...new Set(sections.map(s => s.topic))].length} (ids run in source order; case studies are topics 5+)`)

const mismatched = parsed.filter(q => q.need !== null && q.letters.length !== q.need)
const emptyAnalysis = parsed.filter(q => q.missingAnalysis.length)
const emptyText = parsed.filter(q => !q.zh.question || !q.en.question ||
  [q.zh, q.en].some(record => Object.values(record.options || {}).some(text => !text)))
const lettered = parsed.filter(q => q.en.options)
const fewOptions = lettered.filter(q => Object.keys(q.en.options).length < 3)
const disagree = parsed.filter(q => q.tokenDisagrees)
console.log(`  stem asks N but letters differ: ${mismatched.length}${mismatched.length ? ' -> ' + mismatched.map(q => `#${q.id}(${q.letters.join('')}/${q.need})`).join(' ') : ''}`)
console.log(`  options with no analysis text: ${emptyAnalysis.length}${emptyAnalysis.length ? ' -> ' + emptyAnalysis.slice(0, 20).map(q => `#${q.id}[${q.missingAnalysis.join('')}]`).join(' ') : ''}`)
console.log(`  empty stem or option text: ${emptyText.length}${emptyText.length ? ' -> ' + emptyText.map(q => '#' + q.id).join(' ') : ''}`)
console.log(`  fewer than 3 options: ${fewOptions.length}${fewOptions.length ? ' -> ' + fewOptions.map(q => `#${q.id}(${Object.keys(q.en.options).join('')})`).join(' ') : ''}`)
console.log(`  ZH/EN option pairing: before=${parsed.filter(q => q.langKey === 'before').length} after=${parsed.filter(q => q.langKey === 'after').length}; token cross-check disagrees on ${disagree.length}${disagree.length ? ' -> ' + disagree.map(q => '#' + q.id).join(' ') : ''}`)
console.log(`  skipped HOTSPOT/DRAG (candidate list only exists as page images): ${skipped.length}`)
console.log(`    ids: ${skipped.map(q => q.id).join(' ')}`)

const LEAKS = [
  ['footer', /淘宝|闲鱼|IT认证轻松过|Examt|^opics$/],
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
        ...(record.matches || []).map(match => match.use_case),
      ]
      if (fields.some(text => re.test(text))) { hits.push(q.id); break }
    }
  }
  console.log(`  ${label} leaked into a record: ${hits.length}${hits.length ? ' -> ' + [...new Set(hits)].slice(0, 20).join(' ') : ''}`)
}

if (reportOnly) {
  for (const id of [1, 3]) {
    const q = parsed.find(x => x.id === id)
    if (q) {
      console.log(`\n── sample #${id} (zh, topic ${q.topic} Q${q.num}, pairing=${q.langKey}) ──`)
      console.log(JSON.stringify(q.zh, null, 1).slice(0, 1500))
    }
  }
  process.exit(0)
}

// Chunk by id range rather than by record count, so that filling in the
// HOTSPOT sections later drops records into the existing files instead of
// renaming every chunk.
const lastId = sections.at(-1).id
const buckets = new Map()
for (const q of parsed) {
  const bucket = Math.floor((q.id - 1) / CHUNK)
  if (!buckets.has(bucket)) buckets.set(bucket, [])
  buckets.get(bucket).push(q)
}
const written = []
for (const [bucket, chunk] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
  const first = bucket * CHUNK + 1
  const last = Math.min((bucket + 1) * CHUNK, lastId)
  for (const [prefix, key] of [['', 'zh'], ['en_', 'en']]) {
    const name = `az_305_${prefix}${first}_${last}.json`
    writeFileSync(resolve(dataDir, name), JSON.stringify(chunk.map(q => q[key]), null, 1))
    written.push(name)
  }
}
console.log(`\nwrote ${written.length} files:`)
for (const name of written) console.log('  ' + name)
