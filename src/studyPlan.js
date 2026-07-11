import { isDue, overdueBy } from './srs.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function examFromKey(key, entry) {
  return entry?.exam || key.split(/-(?=\d+$)/)[0]
}

export function buildDailyStudyPlan({
  statsHistory = {},
  dailyStats = {},
  dailyGoal = 20,
  examDates = {},
  availableExams = [],
  excludedExams = [],
  today,
  now = Date.now(),
}) {
  const eligibleExams = availableExams.filter(exam => !excludedExams.includes(exam))
  const answeredToday = dailyStats[today]?.answered || 0
  const remainingGoal = Math.max(0, dailyGoal - answeredToday)
  const targetCount = clamp(remainingGoal || 5, 5, 20)

  const due = Object.entries(statsHistory)
    .filter(([, entry]) => isDue(entry, now))
    .map(([key, entry]) => ({ key, entry, exam: examFromKey(key, entry), overdue: overdueBy(entry, now) }))
    .filter(item => eligibleExams.includes(item.exam))
    .sort((a, b) => b.overdue - a.overdue)

  const examStats = {}
  for (const [key, entry] of Object.entries(statsHistory)) {
    const exam = examFromKey(key, entry)
    if (!exam) continue
    const stat = examStats[exam] || { answered: 0, correct: 0, wrong: 0 }
    stat.answered++
    if (entry.correct) stat.correct++
    if (entry.everWrong ?? !entry.correct) stat.wrong++
    examStats[exam] = stat
  }

  const dueByExam = {}
  due.forEach(item => { dueByExam[item.exam] = (dueByExam[item.exam] || 0) + 1 })
  const dueFocus = Object.entries(dueByExam).sort((a, b) => b[1] - a[1])[0]?.[0]

  const weakest = Object.entries(examStats)
    .filter(([exam, stat]) => eligibleExams.includes(exam) && stat.answered >= 3)
    .sort((a, b) => {
      const accA = a[1].correct / a[1].answered
      const accB = b[1].correct / b[1].answered
      return accA - accB || b[1].wrong - a[1].wrong
    })[0]?.[0]

  const closestExam = Object.entries(examDates)
    .filter(([exam, date]) => eligibleExams.includes(exam) && new Date(`${date}T00:00:00`).getTime() >= now)
    .sort((a, b) => new Date(`${a[1]}T00:00:00`) - new Date(`${b[1]}T00:00:00`))[0]?.[0]

  const focusExam = dueFocus || weakest || closestExam || eligibleExams[0] || ''
  const reviewCount = Math.min(due.length, targetCount)
  const practiceCount = Math.max(0, targetCount - reviewCount)
  const minutes = Math.max(5, Math.ceil(reviewCount * 2 + practiceCount * 1.5))
  const reason = dueFocus
    ? `${dueFocus} 有最多到期錯題，先把記憶補強`
    : weakest
      ? `${weakest} 是目前正確率較低的科別`
      : closestExam
        ? `${closestExam} 的目標考期最近`
        : '從目前可用題庫建立基礎進度'

  return {
    targetCount,
    reviewCount,
    practiceCount,
    minutes,
    focusExam,
    reason,
    dueKeys: due.slice(0, reviewCount).map(item => item.key),
    answeredToday,
    dailyGoal,
  }
}
