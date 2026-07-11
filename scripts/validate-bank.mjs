// Fast, dependency-free validation for every static question-bank JSON file.
// Fatal structural errors stop CI/build; content-quality gaps are summarized as warnings.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, 'public/data')
const manifest = JSON.parse(readFileSync(resolve(dataDir, 'manifest.json'), 'utf8'))
const fileGroups = [
  ...(manifest.files || []).map(file => ({ file, lang: 'zh' })),
  ...(manifest.enFiles || []).map(file => ({ file, lang: 'en' })),
]
const files = [...new Map(fileGroups.map(item => [`${item.lang}:${item.file}`, item])).values()]
const errors = []
const warnings = []
const seen = new Map()
let count = 0

const add = (bucket, file, index, message) => bucket.push(`${file} #${index + 1}: ${message}`)

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
      else seen.set(key, file)
    }

    if (q.options && q.answer !== undefined && q.answer !== '') {
      const optionKeys = new Set(Object.keys(q.options))
      const answers = Array.isArray(q.answer) ? q.answer : [q.answer]
      for (const answer of answers) {
        if (!optionKeys.has(String(answer))) add(errors, file, index, `answer ${answer} is not present in options`)
      }
    }
    if (!q.explanations && !q.explanation) add(warnings, file, index, 'missing explanation')
  })
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
