// Generates public/data/bank-index.json from manifest.json at build time.
// The index maps each exam code to its question count and the data files that
// contain it, so the app can lazy-load just the selected subject instead of
// the whole 14 MB bank. Runs via the `prebuild`/`predev` npm hooks.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, 'public/data')
const manifest = JSON.parse(readFileSync(resolve(dataDir, 'manifest.json'), 'utf8'))

function scan(files) {
  const byExam = {} // exam -> { count, files:Set }
  for (const f of files) {
    let questions
    try {
      const data = JSON.parse(readFileSync(resolve(dataDir, f), 'utf8'))
      questions = Array.isArray(data) ? data : (data.questions || [])
    } catch (err) {
      console.warn(`bank-index: skipping unreadable ${f}: ${err.message}`)
      continue
    }
    for (const q of questions) {
      const exam = q.exam || 'UNKNOWN'
      if (!byExam[exam]) byExam[exam] = { count: 0, files: new Set() }
      byExam[exam].count++
      byExam[exam].files.add(f)
    }
  }
  return byExam
}

const zh = scan(manifest.files || [])
const en = scan(manifest.enFiles || [])
const exams = {}
for (const [exam, v] of Object.entries(zh)) {
  exams[exam] = { count: v.count, files: [...v.files], enFiles: [...(en[exam]?.files || [])] }
}

writeFileSync(resolve(dataDir, 'bank-index.json'), JSON.stringify({ exams }))
console.log(
  'bank-index.json:',
  Object.entries(exams).map(([k, v]) => `${k}=${v.count}`).join(', ')
)
