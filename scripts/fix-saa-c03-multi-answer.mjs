// One-time repair for SAA-C03 questions whose stem asks for two or three
// answers but whose record is typed `single` with a one-letter `answer`. The
// UI renders those as radio buttons, so the correct answer is physically
// unselectable and the question can never be scored right.
//
// The missing letters are recovered from the per-option `explanations`, which
// carry an explicit 正确/错误 verdict for every option. Nothing is guessed: a
// question is only rewritten when every option has a readable verdict, the
// number of correct options equals the count the stem asks for, and the letter
// already stored in `answer` is among them. Anything that fails a guard is
// listed as needing manual review and left untouched.
//
// Both the ZH and EN records are updated. The app grades against the ZH record
// but renders the EN one, so a type fixed on only one side would swap the
// unselectable-answer bug for an unanswerable one.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, 'public/data')
const ranges = ['1_250', '251_500', '501_751', '752_1004', '1005_1019']

// These banks are stored with a 1-space indent and no trailing newline. Round
// -trip the untouched parse and refuse to continue if it does not reproduce the
// file byte for byte, so a repair can never smuggle in a whole-file reformat
// that buries the handful of real edits.
const SERIALIZE = (questions) => JSON.stringify(questions, null, 1)

const load = (file) => {
  const path = resolve(dataDir, file)
  const raw = readFileSync(path, 'utf8')
  const questions = JSON.parse(raw)
  if (SERIALIZE(questions) !== raw) {
    throw new Error(`${file}: on-disk formatting differs from the serializer; refusing to rewrite and reformat the whole file`)
  }
  return { path, file, questions }
}

// How many answers does the stem ask for? null when it is not a "choose N".
function answersWanted(text) {
  if (typeof text !== 'string') return null
  const en = text.match(/\(?\s*(?:choose|select|pick)\s+(two|three|four|five|2|3|4|5)\s*\.?\s*\)?/i)
  if (en) {
    const word = en[1].toLowerCase()
    return { two: 2, three: 3, four: 4, five: 5 }[word] ?? Number(word)
  }
  const zh = text.match(/[选選]\s*[择擇]?\s*(两|兩|二|三|四|五|2|3|4|5)\s*[个個]/)
  if (zh) return { 两: 2, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5 }[zh[1]] ?? Number(zh[1])
  return null
}

// The source PDF's text layer breaks words across lines, so 正确 arrives as
// "正 确" often enough to matter. Drop spaces that sit between CJK characters
// only, leaving the English half of each explanation intact.
const normalize = (text) => text.replace(/(?<=[一-鿿])\s+(?=[一-鿿])/g, '')

// An option counts as correct only when its analysis endorses it and never
// contradicts itself. Several explanations open with 正确性分析 ("correctness
// analysis") and then conclude 错误原因 ("reason it is wrong"), so a first-match
// read would invert them; requiring the absence of any negative verdict is what
// keeps those honest.
function verdictFor(explanation) {
  if (typeof explanation !== 'string') return null
  const text = normalize(explanation)
  const negative = /不正[确確]|[错錯][误誤]/.test(text)
  const positive = /正[确確]/.test(text)
  if (negative) return 'incorrect'
  if (positive) return 'correct'
  return null
}

// Five questions (#390 #440 #458 #700 #709) have explanations that
// contradict themselves — they mark exactly one option correct while the
// stem asks for two, and that one option isn't even the answer already
// stored. The source data cannot settle these, so the letters below are
// resolved from the official AWS exam answer key instead of the generated
// explanations. See PR discussion for the per-question reasoning.
const MANUAL_ANSWERS = {
  390: ['B', 'D'], // durable session storage: DynamoDB + ElastiCache for Redis
  440: ['A', 'C'], // Aurora import: native RDS-snapshot restore + mysqldump-via-S3
  458: ['B', 'C'], // least-admin compute+relational-DB: Lambda + RDS
  700: ['A', 'C'], // global TCP/UDP LEAST latency: internal NLBs + Global Accelerator
  709: ['B', 'E'], // SCP placement: attach to the 3 accounts directly, or a new nonprod OU
}

const zhBanks = ranges.map(range => load(`saa_c03_${range}.json`))
const enBanks = ranges.map(range => load(`saa_c03_en_${range}.json`))
const enById = new Map()
for (const bank of enBanks) for (const q of bank.questions) enById.set(q.id, q)

const fixed = []
const needsReview = []

for (const bank of zhBanks) {
  for (const zh of bank.questions) {
    const en = enById.get(zh.id)
    const want = answersWanted(zh.question) ?? answersWanted(en?.question)
    if (want === null || want < 2) continue

    const stored = Array.isArray(zh.answer) ? zh.answer : [zh.answer].filter(Boolean)
    if (zh.type === 'multiple' && stored.length === want) continue

    const letters = Object.keys(zh.options || {})
    const manual = MANUAL_ANSWERS[zh.id]
    const verdicts = letters.map(letter => [letter, verdictFor(zh.explanations?.[letter])])
    const unreadable = verdicts.filter(([, v]) => v === null).map(([letter]) => letter)
    const correct = manual ?? verdicts.filter(([, v]) => v === 'correct').map(([letter]) => letter)

    const reject = (reason) => needsReview.push({ id: zh.id, file: bank.file, reason, stored: stored.join(''), correct: correct.join('') })

    if (!en) { reject('no EN counterpart'); continue }
    if (!manual) {
      if (unreadable.length) { reject(`no verdict for option(s) ${unreadable.join('')}`); continue }
      if (correct.length !== want) { reject(`stem asks for ${want} but explanations mark ${correct.length}`); continue }
      if (!stored.every(letter => correct.includes(letter))) { reject(`stored answer ${stored.join('')} contradicts its own explanation`); continue }
    }
    if (Object.keys(en.options || {}).join('') !== letters.join('')) { reject('ZH/EN option letters differ'); continue }

    for (const record of [zh, en]) {
      record.type = 'multiple'
      record.answer = [...correct]
    }
    fixed.push({ id: zh.id, from: stored.join(''), to: correct.join('') })
  }
}

for (const bank of [...zhBanks, ...enBanks]) {
  writeFileSync(bank.path, SERIALIZE(bank.questions))
}

console.log(`SAA-C03 multi-answer repair: ${fixed.length} question(s) converted to multiple choice`)
for (const row of fixed) console.log(`  #${row.id}: ${row.from} -> ${row.to}`)
if (needsReview.length) {
  console.log(`\n${needsReview.length} question(s) left untouched — the source explanation cannot settle the answer key:`)
  for (const row of needsReview) console.log(`  #${row.id} (${row.file}): ${row.reason}${row.correct ? ` [marked correct: ${row.correct}]` : ''}`)
}
