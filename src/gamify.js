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

// Cloud-career ladder. Thresholds are cumulative XP.
export const LEVELS = [
  { min: 0,     name: '雲端見習生' },
  { min: 120,   name: '雲端學徒' },
  { min: 350,   name: '助理工程師' },
  { min: 800,   name: '雲端工程師' },
  { min: 1600,  name: 'SysOps 工程師' },
  { min: 3000,  name: '解決方案架構師' },
  { min: 5200,  name: '資深架構師' },
  { min: 8500,  name: '首席雲端架構師' },
  { min: 13000, name: '雲端大師' },
  { min: 20000, name: '雲端傳奇' },
]

export function levelInfo(xp) {
  let i = 0
  for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].min) i = k
  const isMax = i === LEVELS.length - 1
  const floor = LEVELS[i].min
  const next = isMax ? null : LEVELS[i + 1].min
  const pct = isMax ? 1 : (xp - floor) / (next - floor)
  return {
    level: i + 1,
    name: LEVELS[i].name,
    xp,
    floor,
    next,
    toNext: isMax ? 0 : next - xp,
    pct: Math.max(0, Math.min(1, pct)),
    isMax,
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
  { id: 'level5',   name: '嶄露頭角', desc: '達到等級 5',            icon: Medal,    unlocked: f => f.level >= 5,   progress: f => ({ cur: f.level, goal: 5 }) },
  { id: 'level8',   name: '登峰造極', desc: '達到等級 8',            icon: Award,    unlocked: f => f.level >= 8,   progress: f => ({ cur: f.level, goal: 8 }) },
]

export function evaluateAchievements(facts) {
  return ACHIEVEMENTS.map(a => {
    const p = a.progress(facts)
    return { ...a, done: a.unlocked(facts), cur: p.cur, goal: p.goal, unit: p.unit || '' }
  })
}
