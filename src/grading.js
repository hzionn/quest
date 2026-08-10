// Language-neutral grading for every question format.
// Structured questions with explicit IDs use those IDs; legacy records retain
// their existing text-based behavior until their banks are migrated.

export function getStructuredChoices(texts, ids) {
  return (texts || []).map((text, index) => ({
    id: ids?.[index] ?? text,
    text,
  }))
}

export function computeCorrect(q, userAns) {
  if (!q) return false
  const matchSet = (a, b) => Array.isArray(a) && a.length === b.length &&
    [...a].sort().join(',') === [...b].sort().join(',')

  if (q.type === 'single') {
    return userAns === q.answer
  }
  if (q.type === 'multiple') {
    return Array.isArray(userAns) && Array.isArray(q.answer) && matchSet(userAns, q.answer)
  }
  if (q.type === 'matching') {
    if (q.matches?.length > 0) {
      if (q.matches.every(match => typeof match.correct_option_id === 'string')) {
        return Array.isArray(userAns) && userAns.length === q.matches.length &&
          q.matches.every((match, index) => userAns[index] === match.correct_option_id)
      }
      return q.matches.every((match, index) => userAns && userAns[index] === match.correct_answer)
    }
    if (q.options && q.answer) return matchSet(userAns, Array.isArray(q.answer) ? q.answer : [q.answer])
    return userAns === 'self-assessed-correct'
  }
  if (q.type === 'ordering') {
    if (q.ordered_steps?.length > 0) {
      const correctSteps = Array.isArray(q.ordered_step_ids) ? q.ordered_step_ids : q.ordered_steps
      return Array.isArray(userAns) && userAns.length === correctSteps.length &&
        userAns.every((step, index) => step === correctSteps[index])
    }
    if (q.options && q.answer) return matchSet(userAns, Array.isArray(q.answer) ? q.answer : [q.answer])
    return userAns === 'self-assessed-correct'
  }
  return false
}
