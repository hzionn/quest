import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computeCorrect, getStructuredChoices } from '../src/grading.js'

const load = (file) => JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url), 'utf8'))
const find = (questions, id) => questions.find(question => question.id === id)

const az104ZhFirst = load('az_104_1_100.json')
const az104EnFirst = load('az_104_en_1_100.json')

test('AZ-104 #41 grades English matching IDs against its Chinese canonical record', () => {
  const zh = find(az104ZhFirst, 41)
  const en = find(az104EnFirst, 41)
  const englishAnswer = en.matches.map(match => match.correct_option_id)

  assert.deepEqual(englishAnswer, ['opt-2', 'opt-6'])
  assert.equal(computeCorrect(zh, englishAnswer), true)
})

test('AZ-104 ordering IDs grade correctly and reject an incorrect sequence', () => {
  const zh = find(az104ZhFirst, 20)
  const en = find(az104EnFirst, 20)
  const englishAnswer = [...en.ordered_step_ids]
  const incorrectAnswer = [...englishAnswer].reverse()

  assert.equal(computeCorrect(zh, englishAnswer), true)
  assert.equal(computeCorrect(zh, incorrectAnswer), false)
})

test('single and multiple choice grading remains unchanged', () => {
  assert.equal(computeCorrect({ type: 'single', answer: 'B' }, 'B'), true)
  assert.equal(computeCorrect({ type: 'single', answer: 'B' }, 'A'), false)
  assert.equal(computeCorrect({ type: 'multiple', answer: ['A', 'C'] }, ['C', 'A']), true)
  assert.equal(computeCorrect({ type: 'multiple', answer: ['A', 'C'] }, ['A']), false)
})

test('structured IDs preserve selections across a Chinese/English language switch', () => {
  const zh = find(az104ZhFirst, 41)
  const en = find(az104EnFirst, 41)
  const answer = en.matches.map(match => match.correct_option_id)
  const zhLabels = new Map(getStructuredChoices(zh.available_options, zh.available_option_ids).map(choice => [choice.id, choice.text]))
  const enLabels = new Map(getStructuredChoices(en.available_options, en.available_option_ids).map(choice => [choice.id, choice.text]))

  assert.notEqual(enLabels.get(answer[0]), zhLabels.get(answer[0]))
  assert.ok(answer.every(id => zhLabels.has(id) && enLabels.has(id)))
  assert.equal(computeCorrect(zh, answer), true)
})
