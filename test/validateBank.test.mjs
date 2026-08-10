import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const validator = resolve(root, 'scripts/validate-bank.mjs')

// A minimal ZH/EN pair of the shape the AZ-104 structured-ID migration produces.
function matchingPair() {
  const base = () => ({
    exam: 'TST-C01',
    id: 1,
    type: 'matching',
    question: 'fixture',
    explanation: 'x',
  })
  const zh = {
    ...base(),
    available_options: ['甲', '乙'],
    available_option_ids: ['opt-1', 'opt-2'],
    matches: [{ use_case: '情境一', correct_answer: '乙', correct_option_id: 'opt-2' }],
  }
  const en = {
    ...base(),
    available_options: ['Alpha', 'Beta'],
    available_option_ids: ['opt-1', 'opt-2'],
    matches: [{ use_case: 'Case one', correct_answer: 'Beta', correct_option_id: 'opt-2' }],
  }
  return { zh, en }
}

// Runs the validator against a throwaway data dir; returns { ok, output }.
function runValidator(zh, en) {
  const dir = mkdtempSync(join(tmpdir(), 'bank-fixture-'))
  try {
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ files: ['zh.json'], enFiles: ['en.json'] }))
    writeFileSync(join(dir, 'zh.json'), JSON.stringify([zh]))
    writeFileSync(join(dir, 'en.json'), JSON.stringify([en]))
    try {
      const output = execFileSync('node', [validator], {
        env: { ...process.env, BANK_DATA_DIR: dir },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, output }
    } catch (error) {
      return { ok: false, output: `${error.stdout || ''}${error.stderr || ''}` }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a fully migrated ZH/EN pair passes validation', () => {
  const { zh, en } = matchingPair()
  const result = runValidator(zh, en)
  assert.equal(result.ok, true, result.output)
})

test('validation rejects a pair migrated on only one side', () => {
  // This is the silent-failure shape the ID scheme exists to prevent: the EN
  // record renders text into the answer while the ZH record grades by ID, so a
  // perfect English answer scores 0. It must not pass validation.
  const { zh, en } = matchingPair()
  delete en.available_option_ids
  en.matches.forEach(match => { delete match.correct_option_id })

  const result = runValidator(zh, en)
  assert.equal(result.ok, false, 'half-migrated pair must fail validation')
  assert.match(result.output, /matching IDs on ZH only/)
})

test('validation rejects ordering IDs migrated on only one side', () => {
  const shared = { exam: 'TST-C01', id: 2, type: 'ordering', question: 'fixture', explanation: 'x' }
  const zh = {
    ...shared,
    available_steps: ['一', '二'],
    available_step_ids: ['step-1', 'step-2'],
    ordered_steps: ['一', '二'],
    ordered_step_ids: ['step-1', 'step-2'],
  }
  const en = {
    ...shared,
    available_steps: ['One', 'Two'],
    ordered_steps: ['One', 'Two'],
  }

  const result = runValidator(zh, en)
  assert.equal(result.ok, false, 'half-migrated ordering pair must fail validation')
  assert.match(result.output, /ordering IDs on ZH only/)
})

test('validation rejects canonical answers that disagree across languages', () => {
  const { zh, en } = matchingPair()
  en.matches[0].correct_option_id = 'opt-1'
  en.matches[0].correct_answer = 'Alpha'

  const result = runValidator(zh, en)
  assert.equal(result.ok, false, 'diverging canonical answers must fail validation')
  assert.match(result.output, /canonical answers differ/)
})
