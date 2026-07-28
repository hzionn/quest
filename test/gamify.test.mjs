import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computeXP, MASTERY, XP_PER_CORRECT, XP_PER_WRONG, XP_MASTER_BONUS } from '../src/gamify.js'

// The XP expression from getLeaderboard's SQL literal only — started at the
// query's backtick so the surrounding prose comments (which quote the same
// numbers) can't satisfy the assertions on their own.
function leaderboardXpSql() {
  const src = readFileSync(new URL('../worker/src/db.js', import.meta.url), 'utf8')
  const fn = src.slice(src.indexOf('export async function getLeaderboard'))
  const query = fn.slice(fn.indexOf('`SELECT'))
  const expr = query.slice(0, query.indexOf('AS xp'))
  assert.ok(expr.includes('SUM('), 'could not locate the leaderboard XP expression')
  assert.ok(!expr.includes('//'), 'extracted region leaked a comment')
  return expr
}

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

test('the leaderboard SQL derives XP with the same constants as computeXP', () => {
  // The leaderboard recomputes XP server-side from progress rows (there is no
  // score to push), so the two formulas have to be kept in step by hand. This
  // reads the actual SQL and pins the numbers against gamify.js — a silent
  // drift here shows up to the user as "排行榜的數據對不上".
  const xpExpr = leaderboardXpSql()
  assert.match(xpExpr, new RegExp(`\\* ${XP_PER_CORRECT}\\b`), 'per-correct XP differs from gamify.js')
  assert.match(xpExpr, new RegExp(`THEN ${XP_PER_WRONG} ELSE 0`), 'ever-wrong XP differs from gamify.js')
  assert.match(xpExpr, new RegExp(`THEN ${XP_MASTER_BONUS} ELSE 0`), 'mastery bonus differs from gamify.js')
  assert.match(xpExpr, new RegExp(`>= ${MASTERY}\\b`), 'mastery threshold differs from gamify.js')
})

test('the leaderboard SQL includes bonus_xp, which is not derivable from progress rows', () => {
  // Fever combo + daily-mission XP accrues in state.bonusXp, which the level
  // card adds on top of computeXP. It used to live only in localStorage, so
  // the leaderboard read lower than the user's own level card (reported as a
  // 400 XP / one-level gap). It now round-trips through users.bonus_xp.
  const xpExpr = leaderboardXpSql()
  assert.match(xpExpr, /bonus_xp/, 'leaderboard XP must include the user-level bonus XP')
})

test('MASTERY stays low enough that it never retroactively revokes already-earned bonus XP', () => {
  // A prior change bumped MASTERY from 3 to 5 "to match MASTERY_THRESHOLD in
  // App.jsx" — but every already-recorded entry sitting at totalCorrect 3 or 4
  // instantly lost its +25 bonus, causing a real, persistent level drop (not
  // the transient one this file's other tests guard). MASTERY must only ever
  // move via an explicit, disclosed migration — this pins the safe value.
  assert.equal(MASTERY, 3)
})
