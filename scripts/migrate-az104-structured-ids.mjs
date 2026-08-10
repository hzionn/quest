// Adds deterministic, language-neutral choice IDs to AZ-104 matching and
// ordering questions. It deliberately fails before writing when the paired
// Chinese/English records cannot be proved positionally equivalent.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, 'public/data')
const ranges = ['1_100', '101_200', '201_300', '301_400', '401_500', '501_605']
const zhFiles = ranges.map(range => `az_104_${range}.json`)
const enFiles = ranges.map(range => `az_104_en_${range}.json`)

function fail(message) {
  throw new Error(`AZ-104 structured-ID migration: ${message}`)
}

function load(file) {
  const path = resolve(dataDir, file)
  let data
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`cannot read ${file}: ${error.message}`)
  }
  const questions = Array.isArray(data) ? data : data.questions
  if (!Array.isArray(questions)) fail(`${file} must contain a question array`)
  return { file, path, data, questions }
}

function keyFor(q, source) {
  if (!q?.exam || q.id === undefined || q.id === null) fail(`${source} has a question without exam/id`)
  return `${q.exam}-${q.id}`
}

function mapQuestions(banks) {
  const map = new Map()
  for (const bank of banks) {
    for (const q of bank.questions) {
      const key = keyFor(q, bank.file)
      if (map.has(key)) fail(`duplicate question ${key} in ${bank.file} and ${map.get(key).source}`)
      map.set(key, { question: q, source: bank.file })
    }
  }
  return map
}

function requireUniqueTexts(values, label) {
  if (!Array.isArray(values) || values.length === 0) fail(`${label} must be a non-empty array`)
  const seen = new Set()
  values.forEach((value, index) => {
    if (typeof value !== 'string' || value.length === 0) fail(`${label}[${index}] must be a non-empty string`)
    if (seen.has(value)) fail(`${label} contains duplicate text: ${JSON.stringify(value)}`)
    seen.add(value)
  })
}

function deriveMatchingIds(q, label) {
  requireUniqueTexts(q.available_options, `${label}.available_options`)
  if (!Array.isArray(q.matches) || q.matches.length === 0) fail(`${label}.matches must be a non-empty array`)
  const optionIds = q.available_options.map((_, index) => `opt-${index + 1}`)
  const correctIds = q.matches.map((match, index) => {
    const optionIndex = q.available_options.indexOf(match?.correct_answer)
    if (optionIndex < 0) fail(`${label}.matches[${index}].correct_answer is not in available_options`)
    return optionIds[optionIndex]
  })
  return { optionIds, correctIds }
}

function deriveOrderingIds(q, label) {
  requireUniqueTexts(q.available_steps, `${label}.available_steps`)
  requireUniqueTexts(q.ordered_steps, `${label}.ordered_steps`)
  const stepIds = q.available_steps.map((_, index) => `step-${index + 1}`)
  const orderedIds = q.ordered_steps.map((step, index) => {
    const stepIndex = q.available_steps.indexOf(step)
    if (stepIndex < 0) fail(`${label}.ordered_steps[${index}] is not in available_steps`)
    return stepIds[stepIndex]
  })
  return { stepIds, orderedIds }
}

function sameSequence(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function migratePair(zh, en, key) {
  if (!en) fail(`${key} has no English counterpart`)
  if (zh.type !== en.type) fail(`${key} type mismatch: ZH=${zh.type}, EN=${en.type}`)
  if (zh.type === 'matching') {
    const zhIds = deriveMatchingIds(zh, `${key} (ZH)`)
    const enIds = deriveMatchingIds(en, `${key} (EN)`)
    if (!sameSequence(zhIds.correctIds, enIds.correctIds)) fail(`${key} has different correct matching positions across languages`)
    zh.available_option_ids = zhIds.optionIds
    en.available_option_ids = enIds.optionIds
    zh.matches.forEach((match, index) => { match.correct_option_id = zhIds.correctIds[index] })
    en.matches.forEach((match, index) => { match.correct_option_id = enIds.correctIds[index] })
  }
  if (zh.type === 'ordering') {
    const zhIds = deriveOrderingIds(zh, `${key} (ZH)`)
    const enIds = deriveOrderingIds(en, `${key} (EN)`)
    if (!sameSequence(zhIds.orderedIds, enIds.orderedIds)) fail(`${key} has different correct ordering positions across languages`)
    zh.available_step_ids = zhIds.stepIds
    en.available_step_ids = enIds.stepIds
    zh.ordered_step_ids = zhIds.orderedIds
    en.ordered_step_ids = enIds.orderedIds
  }
}

const zhBanks = zhFiles.map(load)
const enBanks = enFiles.map(load)
const zhMap = mapQuestions(zhBanks)
const enMap = mapQuestions(enBanks)

for (const [key, { question: zh }] of zhMap) {
  if (zh.type !== 'matching' && zh.type !== 'ordering') continue
  migratePair(zh, enMap.get(key)?.question, key)
}

for (const [key, { question: en }] of enMap) {
  if (en.type !== 'matching' && en.type !== 'ordering') continue
  const zh = zhMap.get(key)?.question
  if (!zh) fail(`${key} has no Chinese counterpart`)
  if (zh.type !== en.type) fail(`${key} type mismatch: ZH=${zh.type}, EN=${en.type}`)
}

for (const bank of [...zhBanks, ...enBanks]) {
  writeFileSync(bank.path, `${JSON.stringify(bank.data, null, 2)}\n`)
}

console.log(`migrated AZ-104 structured IDs in ${zhMap.size} Chinese and ${enMap.size} English questions`)
