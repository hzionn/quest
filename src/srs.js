// ──────────────────────────────────────────────────────────────────────────
// Spaced-repetition overlay (SRS).
//
// Derived ENTIRELY from fields the app already tracks and syncs — no separate
// schedule to persist, no extra sync payload, and it applies retroactively to
// history that predates the feature:
//   - _updatedAt    : when the question was last answered (epoch ms)
//   - correctCount  : monotonic count of correct answers (the SRS "stage")
//   - everWrong     : only ever-wrong, not-yet-mastered questions re-surface
//
// A question you got wrong comes back after a growing interval (the forgetting
// curve). Each subsequent correct answer pushes the next review further out;
// after MASTERY (3) corrects it leaves the pool entirely (it's "learned").
// ──────────────────────────────────────────────────────────────────────────

// Interval (days) before the next review, indexed by correctCount (0, 1, 2).
// MASTERY_THRESHOLD = 5 in App.jsx, so correctCount ≥ 5 is out of the pool.
export const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30]
const DAY = 86400000

function stageInterval(correctCount) {
  const i = Math.min(Math.max(correctCount, 0), SRS_INTERVALS_DAYS.length - 1)
  return SRS_INTERVALS_DAYS[i] * DAY
}

// In the review pool at all? (ever wrong, not yet mastered)
export function inReviewPool(entry) {
  if (!entry) return false
  const everWrong = entry.everWrong ?? !entry.correct
  const cc = entry.correctCount ?? entry.correctStreak ?? 0
  return !!everWrong && cc < SRS_INTERVALS_DAYS.length
}

// When is this entry next due? (epoch ms)
export function dueAt(entry) {
  const cc = entry.correctCount ?? entry.correctStreak ?? 0
  return (entry._updatedAt || 0) + stageInterval(cc)
}

// Due for review right now?
export function isDue(entry, now = Date.now()) {
  return inReviewPool(entry) && now >= dueAt(entry)
}

// Positive when overdue (ms past due), negative when not yet due — for sorting
// the most-overdue questions to the front of a review session.
export function overdueBy(entry, now = Date.now()) {
  return now - dueAt(entry)
}
