import test from 'node:test'
import assert from 'node:assert/strict'
import { dueAt, inReviewPool, isDue, SRS_INTERVALS_DAYS } from '../src/srs.js'

const DAY = 86_400_000

test('SRS uses expanding 1/3/7 day intervals', () => {
  assert.deepEqual(SRS_INTERVALS_DAYS, [1, 3, 7])
  SRS_INTERVALS_DAYS.forEach((days, correctCount) => {
    assert.equal(dueAt({ _updatedAt: 1000, correctCount }), 1000 + days * DAY)
  })
})

test('only previously wrong, unmastered questions enter the review pool', () => {
  assert.equal(inReviewPool({ everWrong: false, correctCount: 0 }), false)
  assert.equal(inReviewPool({ everWrong: true, correctCount: 2 }), true)
  assert.equal(inReviewPool({ everWrong: true, correctCount: 3 }), false)
})

test('a review becomes due at its scheduled time', () => {
  const entry = { everWrong: true, correctCount: 1, _updatedAt: 1000 }
  assert.equal(isDue(entry, 1000 + 3 * DAY - 1), false)
  assert.equal(isDue(entry, 1000 + 3 * DAY), true)
})
