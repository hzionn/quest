// Fast, dependency-free validation for every static question-bank JSON file.
// Fatal structural errors stop CI/build; content-quality gaps are summarized as warnings.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// BANK_DATA_DIR lets the test suite point the validator at fixture banks so the
// rules below can be mutation-tested; production runs always use public/data.
const dataDir = resolve(root, process.env.BANK_DATA_DIR || 'public/data')
const manifest = JSON.parse(readFileSync(resolve(dataDir, 'manifest.json'), 'utf8'))
const fileGroups = [
  ...(manifest.files || []).map(file => ({ file, lang: 'zh' })),
  ...(manifest.enFiles || []).map(file => ({ file, lang: 'en' })),
]
const files = [...new Map(fileGroups.map(item => [`${item.lang}:${item.file}`, item])).values()]
const errors = []
const warnings = []
const seen = new Map()
const questionsByKey = new Map()
let count = 0

const add = (bucket, file, index, message) => bucket.push(`${file} #${index + 1}: ${message}`)
const hasUniqueNonEmptyStrings = (values) => Array.isArray(values) &&
  values.every(value => typeof value === 'string' && value.length > 0) &&
  new Set(values).size === values.length

// How many answers a stem explicitly asks for ("(Choose two.)" / "（選擇兩個）"),
// or null when it does not say.
const WORD_COUNTS = { two: 2, three: 3, four: 4, five: 5, 两: 2, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5 }
function answersWanted(text) {
  if (typeof text !== 'string') return null
  const en = text.match(/\(?\s*(?:choose|select|pick)\s+(two|three|four|five|2|3|4|5)\s*\.?\s*\)?/i)
  if (en) return WORD_COUNTS[en[1].toLowerCase()] ?? Number(en[1])
  const zh = text.match(/[选選]\s*[择擇]?\s*(两|兩|二|三|四|五|2|3|4|5)\s*[个個]/)
  if (zh) return WORD_COUNTS[zh[1]] ?? Number(zh[1])
  return null
}

for (const { file, lang } of files) {
  let questions
  try {
    const data = JSON.parse(readFileSync(resolve(dataDir, file), 'utf8'))
    questions = Array.isArray(data) ? data : data.questions
    if (!Array.isArray(questions)) throw new Error('root must be an array or contain questions[]')
  } catch (error) {
    errors.push(`${file}: ${error.message}`)
    continue
  }

  questions.forEach((q, index) => {
    count++
    if (!q || typeof q !== 'object') { add(errors, file, index, 'question must be an object'); return }
    if (!q.exam || typeof q.exam !== 'string') add(errors, file, index, 'missing exam')
    if (q.id === undefined || q.id === null || q.id === '') add(errors, file, index, 'missing id')
    if (!q.question || typeof q.question !== 'string') add(errors, file, index, 'missing question text')

    const key = `${lang}:${q.exam}-${q.id}`
    if (q.exam && q.id !== undefined) {
      if (seen.has(key)) add(errors, file, index, `duplicate key ${key} (also in ${seen.get(key)})`)
      else {
        seen.set(key, file)
        questionsByKey.set(key, { q, file, index })
      }
    }

    if (q.options && q.answer !== undefined && q.answer !== '') {
      const optionKeys = new Set(Object.keys(q.options))
      const answers = Array.isArray(q.answer) ? q.answer : [q.answer]
      for (const answer of answers) {
        if (!optionKeys.has(String(answer))) add(errors, file, index, `answer ${answer} is not present in options`)
      }
    }

    // A stem that says "(Choose two.)" while the record is typed `single` renders
    // as radio buttons, so the correct answer cannot even be selected and the
    // question is unscoreable. Warn rather than error: the remaining offenders
    // are ones whose source explanation cannot settle the answer key, and they
    // need a human, not a build failure.
    if (q.options && (q.type === 'single' || q.type === 'multiple')) {
      const wanted = answersWanted(q.question)
      if (wanted !== null) {
        const given = Array.isArray(q.answer) ? q.answer.length : (q.answer ? 1 : 0)
        if (q.type !== 'multiple' || given !== wanted) {
          add(warnings, file, index, `stem asks for ${wanted} answers but type=${q.type} with ${given} answer(s)`)
        }
      }
    }

    const hasMatchingIds = q.available_option_ids !== undefined || q.matches?.some(match => match.correct_option_id !== undefined)
    if (hasMatchingIds) {
      if (q.type !== 'matching') add(errors, file, index, 'available_option_ids/correct_option_id is only valid for matching questions')
      if (!Array.isArray(q.available_options) || q.available_options.length === 0) add(errors, file, index, 'matching IDs require non-empty available_options')
      if (!Array.isArray(q.available_option_ids) || q.available_option_ids.length !== q.available_options?.length) {
        add(errors, file, index, 'available_option_ids length must match available_options')
      } else if (!hasUniqueNonEmptyStrings(q.available_option_ids)) {
        add(errors, file, index, 'available_option_ids must contain unique non-empty strings')
      }
      if (!Array.isArray(q.matches) || q.matches.length === 0) {
        add(errors, file, index, 'matching IDs require non-empty matches')
      } else {
        q.matches.forEach((match, matchIndex) => {
          if (typeof match?.correct_option_id !== 'string' || !q.available_option_ids?.includes(match.correct_option_id)) {
            add(errors, file, index, `matches[${matchIndex}].correct_option_id must be present in available_option_ids`)
          }
        })
      }
    }

    const hasOrderingIds = q.available_step_ids !== undefined || q.ordered_step_ids !== undefined
    if (hasOrderingIds) {
      if (q.type !== 'ordering') add(errors, file, index, 'available_step_ids/ordered_step_ids is only valid for ordering questions')
      if (!Array.isArray(q.available_steps) || q.available_steps.length === 0) add(errors, file, index, 'ordering IDs require non-empty available_steps')
      if (!Array.isArray(q.available_step_ids) || q.available_step_ids.length !== q.available_steps?.length) {
        add(errors, file, index, 'available_step_ids length must match available_steps')
      } else if (!hasUniqueNonEmptyStrings(q.available_step_ids)) {
        add(errors, file, index, 'available_step_ids must contain unique non-empty strings')
      }
      if (!Array.isArray(q.ordered_steps) || q.ordered_steps.length === 0) add(errors, file, index, 'ordering IDs require non-empty ordered_steps')
      if (!Array.isArray(q.ordered_step_ids) || q.ordered_step_ids.length !== q.ordered_steps?.length) {
        add(errors, file, index, 'ordered_step_ids length must match ordered_steps')
      } else if (!q.ordered_step_ids.every(id => typeof id === 'string' && q.available_step_ids?.includes(id))) {
        add(errors, file, index, 'every ordered_step_id must be present in available_step_ids')
      }
    }
    if (!q.explanations && !q.explanation) add(warnings, file, index, 'missing explanation')
  })
}

for (const [key, zh] of questionsByKey) {
  if (!key.startsWith('zh:')) continue
  const en = questionsByKey.get(`en:${key.slice(3)}`)
  if (!en) continue
  const zhHasMatchingIds = zh.q.available_option_ids !== undefined
  const enHasMatchingIds = en.q.available_option_ids !== undefined
  const zhHasOrderingIds = zh.q.available_step_ids !== undefined || zh.q.ordered_step_ids !== undefined
  const enHasOrderingIds = en.q.available_step_ids !== undefined || en.q.ordered_step_ids !== undefined
  const zhHasStructuredIds = zhHasMatchingIds || zhHasOrderingIds
  const enHasStructuredIds = enHasMatchingIds || enHasOrderingIds

  if (zhHasStructuredIds && enHasStructuredIds && zh.q.type !== en.q.type) {
    add(errors, zh.file, zh.index, `ZH/EN type mismatch for ${key.slice(3)}`)
  }

  // A half-migrated pair is the exact shape this whole ID scheme exists to
  // prevent: the migrated side renders IDs into the answer while the other
  // side grades by text, so a perfect answer scores 0. Both sides must move
  // together, so flag the lagging side rather than silently skipping the
  // canonical-answer checks below.
  if (zhHasMatchingIds !== enHasMatchingIds) {
    const behind = zhHasMatchingIds ? en : zh
    add(errors, behind.file, behind.index, `${key.slice(3)} has matching IDs on ${zhHasMatchingIds ? 'ZH' : 'EN'} only; migrate both languages together`)
  }
  if (zhHasOrderingIds !== enHasOrderingIds) {
    const behind = zhHasOrderingIds ? en : zh
    add(errors, behind.file, behind.index, `${key.slice(3)} has ordering IDs on ${zhHasOrderingIds ? 'ZH' : 'EN'} only; migrate both languages together`)
  }

  if (zhHasMatchingIds && enHasMatchingIds) {
    const zhCorrect = (zh.q.matches || []).map(match => match.correct_option_id)
    const enCorrect = (en.q.matches || []).map(match => match.correct_option_id)
    if (zhCorrect.length !== enCorrect.length || zhCorrect.some((id, index) => id !== enCorrect[index])) {
      add(errors, zh.file, zh.index, `ZH/EN matching canonical answers differ for ${key.slice(3)}`)
    }
  }
  if (zhHasOrderingIds && enHasOrderingIds) {
    const zhCorrect = zh.q.ordered_step_ids || []
    const enCorrect = en.q.ordered_step_ids || []
    if (zhCorrect.length !== enCorrect.length || zhCorrect.some((id, index) => id !== enCorrect[index])) {
      add(errors, zh.file, zh.index, `ZH/EN ordering canonical answers differ for ${key.slice(3)}`)
    }
  }
}

if (warnings.length) {
  console.warn(`question-bank warnings: ${warnings.length}`)
  warnings.slice(0, 20).forEach(w => console.warn(`  - ${w}`))
  if (warnings.length > 20) console.warn(`  ... ${warnings.length - 20} more`)
}
if (errors.length) {
  console.error(`question-bank validation failed: ${errors.length} error(s)`)
  errors.slice(0, 50).forEach(e => console.error(`  - ${e}`))
  if (errors.length > 50) console.error(`  ... ${errors.length - 50} more`)
  process.exitCode = 1
} else {
  console.log(`question-bank validation passed: ${count} questions across ${files.length} files`)
}
