import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyStudyPlan } from '../src/studyPlan.js'

const DAY = 86_400_000
const now = Date.UTC(2026, 6, 11, 0, 0, 0)

test('daily plan prioritizes overdue reviews and caps the session at 20 questions', () => {
  const statsHistory = {}
  for (let i = 1; i <= 25; i++) {
    statsHistory[`SAA-C03-${i}`] = { exam: 'SAA-C03', everWrong: true, correctCount: 0, _updatedAt: now - 2 * DAY }
  }
  const plan = buildDailyStudyPlan({
    statsHistory,
    dailyGoal: 30,
    dailyStats: { '2026-07-11': { answered: 0 } },
    availableExams: ['SAA-C03'],
    today: '2026-07-11',
    now,
  })
  assert.equal(plan.targetCount, 20)
  assert.equal(plan.reviewCount, 20)
  assert.equal(plan.practiceCount, 0)
  assert.equal(plan.focusExam, 'SAA-C03')
})

test('daily plan fills the remaining goal with weakest-subject practice', () => {
  const statsHistory = {
    'AIP-C01-1': { exam: 'AIP-C01', correct: false, everWrong: true, correctCount: 0, _updatedAt: now },
    'AIP-C01-2': { exam: 'AIP-C01', correct: false, everWrong: true, correctCount: 0, _updatedAt: now },
    'AIP-C01-3': { exam: 'AIP-C01', correct: true, everWrong: false, correctCount: 1, _updatedAt: now },
    'SAA-C03-1': { exam: 'SAA-C03', correct: true, everWrong: false, correctCount: 1, _updatedAt: now },
    'SAA-C03-2': { exam: 'SAA-C03', correct: true, everWrong: false, correctCount: 1, _updatedAt: now },
    'SAA-C03-3': { exam: 'SAA-C03', correct: true, everWrong: false, correctCount: 1, _updatedAt: now },
  }
  const plan = buildDailyStudyPlan({
    statsHistory,
    dailyGoal: 20,
    dailyStats: { '2026-07-11': { answered: 12 } },
    availableExams: ['AIP-C01', 'SAA-C03'],
    today: '2026-07-11',
    now,
  })
  assert.equal(plan.targetCount, 8)
  assert.equal(plan.reviewCount, 0)
  assert.equal(plan.practiceCount, 8)
  assert.equal(plan.focusExam, 'AIP-C01')
})

test('daily plan falls back to the closest exam date for a new learner', () => {
  const plan = buildDailyStudyPlan({
    examDates: { 'SAA-C03': '2026-09-01', 'AIP-C01': '2026-08-01' },
    availableExams: ['SAA-C03', 'AIP-C01'],
    today: '2026-07-11',
    now,
  })
  assert.equal(plan.focusExam, 'AIP-C01')
  assert.equal(plan.targetCount, 20)
})

test('daily plan never recommends an earned certification', () => {
  const plan = buildDailyStudyPlan({
    availableExams: ['SCS-C02', 'SAA-C03'],
    excludedExams: ['SCS-C02'],
    today: '2026-07-11',
    now,
  })
  assert.equal(plan.focusExam, 'SAA-C03')
})
