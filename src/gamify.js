// ──────────────────────────────────────────────────────────────────────────
// Gamification: XP + levels, achievements, combo. All DERIVED from the existing
// progress state (statsHistory / dailyStats / bookmarks) so it's retroactive —
// a returning user's history immediately counts. Nothing here talks to the
// network; combo's running/best value lives in reducer state (bestCombo is
// persisted via prefs).
// ──────────────────────────────────────────────────────────────────────────
import {
  Flag, BookOpen, Swords, Trophy, Target, Shield, Brain, Crown,
  Star, Flame, Clock, Zap, Medal, Award,
} from 'lucide-react'

export const MASTERY = 3
export const XP_PER_CORRECT = 10
export const XP_PER_WRONG = 3      // 答錯也給一點，鼓勵嘗試
export const XP_MASTER_BONUS = 25  // 錯題精通（答對達 MASTERY 次）額外獎勵

// XP is a pure function of the aggregate stats, so it's stable and retroactive.
export function computeXP(statsHistory) {
  let xp = 0
  for (const v of Object.values(statsHistory || {})) {
    const cc = v.correctCount ?? v.correctStreak ?? 0
    const ew = v.everWrong ?? !v.correct
    xp += cc * XP_PER_CORRECT
    if (ew) xp += XP_PER_WRONG
    if (ew && cc >= MASTERY) xp += XP_MASTER_BONUS
  }
  return xp
}

// Cloud-career ladder: 100 levels, flat 2,000 XP per level (≈ 200 answered
// questions at typical accuracy — the user-requested pacing), and a new title
// every 5 levels (20 titles total).
export const XP_PER_LEVEL = 2000
export const MAX_LEVEL = 100

// One title per 5-level band: levels 1–5 → [0], 6–10 → [1], … 96–100 → [19].
export const TITLES = [
  '雲端見習生',    // 1–5
  '雲端學徒',      // 6–10
  '助理工程師',    // 11–15
  '雲端工程師',    // 16–20
  '資深工程師',    // 21–25
  'SysOps 專家',   // 26–30
  'DevOps 達人',   // 31–35
  '安全守護者',    // 36–40
  '解決方案架構師', // 41–45
  '資深架構師',    // 46–50
  '首席架構師',    // 51–55
  '雲端顧問',      // 56–60
  '技術佈道師',    // 61–65
  '領域專家',      // 66–70
  '雲端大師',      // 71–75
  '一代宗師',      // 76–80
  '雲端傳奇',      // 81–85
  '傳奇宗師',      // 86–90
  '雲界巨擘',      // 91–95
  '雲端之神',      // 96–100
]

export function titleForLevel(level) {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 5))]
}

export function levelInfo(xp) {
  const level = Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL) + 1)
  const isMax = level >= MAX_LEVEL && xp >= (MAX_LEVEL - 1) * XP_PER_LEVEL
  const floor = (level - 1) * XP_PER_LEVEL
  const next = isMax ? null : level * XP_PER_LEVEL
  const pct = isMax ? 1 : (xp - floor) / XP_PER_LEVEL
  return {
    level,
    name: titleForLevel(level),
    xp,
    floor,
    next,
    toNext: isMax ? 0 : next - xp,
    pct: Math.max(0, Math.min(1, pct)),
    isMax,
    // 距離下一個稱號（每 5 級一換）；最後一個稱號帶（96–100）之後沒有新稱號
    nextTitleLevel: (() => {
      const nt = Math.floor((level - 1) / 5) * 5 + 6
      return level >= MAX_LEVEL || nt > MAX_LEVEL ? null : nt
    })(),
  }
}

// `facts` is built by the app from state it already computes (streak, study
// hours, combinedDaily, etc.) and handed to each achievement.
export const ACHIEVEMENTS = [
  { id: 'first',    name: '首戰告捷', desc: '完成第一題',            icon: Flag,     unlocked: f => f.answered >= 1,   progress: f => ({ cur: f.answered, goal: 1 }) },
  { id: 'q100',     name: '百題磨練', desc: '累計作答 100 題',       icon: BookOpen, unlocked: f => f.answered >= 100, progress: f => ({ cur: f.answered, goal: 100 }) },
  { id: 'q500',     name: '五百題斬', desc: '累計作答 500 題',       icon: Swords,   unlocked: f => f.answered >= 500, progress: f => ({ cur: f.answered, goal: 500 }) },
  { id: 'q1000',    name: '千題斬',   desc: '累計作答 1000 題',      icon: Trophy,   unlocked: f => f.answered >= 1000, progress: f => ({ cur: f.answered, goal: 1000 }) },
  { id: 'acc90',    name: '神射手',   desc: '答滿 50 題且正確率 ≥ 90%', icon: Target, unlocked: f => f.answered >= 50 && f.accuracy >= 90, progress: f => ({ cur: f.answered >= 50 ? f.accuracy : 0, goal: 90, unit: '%' }) },
  { id: 'master50', name: '錯題終結者', desc: '精通 50 道曾答錯的題目', icon: Shield,  unlocked: f => f.mastered >= 50, progress: f => ({ cur: f.mastered, goal: 50 }) },
  { id: 'exams5',   name: '博學多聞', desc: '練習過 5 個科別',       icon: Brain,    unlocked: f => f.examsTouched >= 5, progress: f => ({ cur: f.examsTouched, goal: 5 }) },
  { id: 'examsAll', name: '全科獵人', desc: '每個上線科別都練過',    icon: Crown,    unlocked: f => f.examsTotal > 0 && f.examsTouched >= f.examsTotal, progress: f => ({ cur: f.examsTouched, goal: f.examsTotal || 1 }) },
  { id: 'bm20',     name: '蒐藏家',   desc: '收藏 20 個書籤',        icon: Star,     unlocked: f => f.bookmarks >= 20, progress: f => ({ cur: f.bookmarks, goal: 20 }) },
  { id: 'streak7',  name: '七日精進', desc: '連續學習 7 天',         icon: Flame,    unlocked: f => f.streak >= 7,  progress: f => ({ cur: f.streak, goal: 7 }) },
  { id: 'streak30', name: '卅日不輟', desc: '連續學習 30 天',        icon: Flame,    unlocked: f => f.streak >= 30, progress: f => ({ cur: f.streak, goal: 30 }) },
  { id: 'study10',  name: '十時馬拉松', desc: '累計學習 10 小時',     icon: Clock,    unlocked: f => f.studyHours >= 10, progress: f => ({ cur: Math.floor(f.studyHours), goal: 10, unit: 'h' }) },
  { id: 'combo10',  name: '十連對',   desc: '一口氣連續答對 10 題',  icon: Zap,      unlocked: f => f.bestCombo >= 10, progress: f => ({ cur: f.bestCombo, goal: 10 }) },
  { id: 'combo20',  name: '廿連對',   desc: '一口氣連續答對 20 題',  icon: Zap,      unlocked: f => f.bestCombo >= 20, progress: f => ({ cur: f.bestCombo, goal: 20 }) },
  { id: 'level10',  name: '嶄露頭角', desc: '達到等級 10',           icon: Medal,    unlocked: f => f.level >= 10,  progress: f => ({ cur: f.level, goal: 10 }) },
  { id: 'level25',  name: '漸入佳境', desc: '達到等級 25',           icon: Medal,    unlocked: f => f.level >= 25,  progress: f => ({ cur: f.level, goal: 25 }) },
  { id: 'level50',  name: '半百征途', desc: '達到等級 50',           icon: Award,    unlocked: f => f.level >= 50,  progress: f => ({ cur: f.level, goal: 50 }) },
  { id: 'level100', name: '登峰造極', desc: '達到等級 100（滿級）',  icon: Crown,    unlocked: f => f.level >= 100, progress: f => ({ cur: f.level, goal: 100 }) },
]

export function evaluateAchievements(facts) {
  return ACHIEVEMENTS.map(a => {
    const p = a.progress(facts)
    return { ...a, done: a.unlocked(facts), cur: p.cur, goal: p.goal, unit: p.unit || '' }
  })
}
