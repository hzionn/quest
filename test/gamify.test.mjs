import test from 'node:test'
import assert from 'node:assert/strict'
import { computeXP, MASTERY, XP_PER_CORRECT, XP_PER_WRONG, XP_MASTER_BONUS } from '../src/gamify.js'

test('XP is a simple function of totalCorrect/everWrong/mastery', () => {
  const xp = computeXP({
    a: { totalCorrect: 4, everWrong: false },
    b: { totalCorrect: 2, everWrong: true },
    c: { totalCorrect: MASTERY, everWrong: true },
  })
  const expected =
    4 * XP_PER_CORRECT +
    (2 * XP_PER_CORRECT + XP_PER_WRONG) +
    (MASTERY * XP_PER_CORRECT + XP_PER_WRONG + XP_MASTER_BONUS)
  assert.equal(xp, expected)
})

test('XP never regresses when correctCount resets for the SRS review stage', () => {
  // Mirrors SUBMIT_ANSWER: correctCount resets to 0 on a wrong answer to drive
  // the SRS stage (src/srs.js), but totalCorrect is the lifetime, never-
  // decreasing counter XP must be computed from — this is the exact bug
  // reported ("等級題目練一練會變低，重整後又正常"): before the fix, computeXP
  // read correctCount directly and the displayed level dropped the moment a
  // well-practiced question was answered wrong again.
  const beforeLapse = { correctCount: 8, totalCorrect: 8, everWrong: true }
  const afterLapse = { correctCount: 0, totalCorrect: 8, everWrong: true } // wrong answer just landed
  assert.equal(computeXP({ q: afterLapse }), computeXP({ q: beforeLapse }))
})

test('a legacy entry with no totalCorrect falls back to correctCount', () => {
  const xp = computeXP({ q: { correctCount: 6, everWrong: true } })
  assert.equal(xp, 6 * XP_PER_CORRECT + XP_PER_WRONG + XP_MASTER_BONUS)
})

test('MASTERY stays low enough that it never retroactively revokes already-earned bonus XP', () => {
  // A prior change bumped MASTERY from 3 to 5 "to match MASTERY_THRESHOLD in
  // App.jsx" — but every already-recorded entry sitting at totalCorrect 3 or 4
  // instantly lost its +25 bonus, causing a real, persistent level drop (not
  // the transient one this file's other tests guard). MASTERY must only ever
  // move via an explicit, disclosed migration — this pins the safe value.
  assert.equal(MASTERY, 3)
})
