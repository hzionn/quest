// ──────────────────────────────────────────────────────────────────────────
// Gamification: XP + levels, achievements (milestone / challenge / hidden),
// combo. Everything is DERIVED from progress state so it's retroactive; a few
// dimensions (mock-exam results, time-of-day, easter-egg flags) need tracking
// that only accrues from now on — those are noted per-achievement.
// ──────────────────────────────────────────────────────────────────────────
import {
  Flag, BookOpen, Swords, Trophy, Target, Shield, Brain, Crown,
  Star, Flame, Clock, Zap, Medal, Award, Gem, Rocket, GraduationCap,
  TrendingUp, Sunrise, Moon, Coffee, Calendar, Languages, Keyboard, Move,
  Download, Sparkles, ClipboardCheck,
} from 'lucide-react'

// Deliberately independent of MASTERY_THRESHOLD in App.jsx (which gates when
// a question leaves the wrong-question list) — this only gates the one-time
// XP mastery bonus. Raising it retroactively REVOKES already-earned XP from
// every entry sitting between the old and new threshold, so it must only
// ever change with an explicit, disclosed one-time migration — never as an
// incidental "keep constants in sync" tweak.
export const MASTERY = 3
export const XP_PER_CORRECT = 10
export const XP_PER_WRONG = 3
export const XP_MASTER_BONUS = 25

export function computeXP(statsHistory) {
  let xp = 0
  for (const v of Object.values(statsHistory || {})) {
    // totalCorrect is a lifetime, never-decreasing counter — prefer it over
    // correctCount, which resets to 0 on a wrong answer to drive the SRS
    // review stage (src/srs.js) and stays intentionally reset-prone.
    // Falling back to correctCount keeps XP correct for entries recorded
    // before totalCorrect existed.
    const cc = v.totalCorrect ?? v.correctCount ?? v.correctStreak ?? 0
    const ew = v.everWrong ?? !v.correct
    xp += cc * XP_PER_CORRECT
    if (ew) xp += XP_PER_WRONG
    if (ew && cc >= MASTERY) xp += XP_MASTER_BONUS
  }
  return xp
}

// 100 levels, flat 1,500 XP each (≈ 150 answered questions), title every 5.
export const XP_PER_LEVEL = 1500
export const MAX_LEVEL = 100

export const TITLES = [
  '雲端見習生', '雲端學徒', '助理工程師', '雲端工程師', '資深工程師',
  'SysOps 專家', 'DevOps 達人', '安全守護者', '解決方案架構師', '資深架構師',
  '首席架構師', '雲端顧問', '技術佈道師', '領域專家', '雲端大師',
  '一代宗師', '雲端傳奇', '傳奇宗師', '雲界巨擘', '雲端之神',
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
    level, name: titleForLevel(level), xp, floor, next,
    toNext: isMax ? 0 : next - xp,
    pct: Math.max(0, Math.min(1, pct)),
    isMax,
    nextTitleLevel: (() => {
      const nt = Math.floor((level - 1) / 5) * 5 + 6
      return level >= MAX_LEVEL || nt > MAX_LEVEL ? null : nt
    })(),
  }
}

// group: 'milestone' | 'challenge' | 'hidden'. hidden badges show as ??? until
// earned. `progress` returns {cur, goal, unit?} for the locked-state bar.
export const ACHIEVEMENTS = [
  // ── 里程碑：量級 / 廣度 / 等級 / 時數 ──
  { id: 'first',    group: 'milestone', name: '首戰告捷',   desc: '完成第一題',            icon: Flag,          unlocked: f => f.answered >= 1,    progress: f => ({ cur: f.answered, goal: 1 }) },
  { id: 'q100',     group: 'milestone', name: '百題磨練',   desc: '累計作答 100 題',       icon: BookOpen,      unlocked: f => f.answered >= 100,  progress: f => ({ cur: f.answered, goal: 100 }) },
  { id: 'q500',     group: 'milestone', name: '五百題斬',   desc: '累計作答 500 題',       icon: Swords,        unlocked: f => f.answered >= 500,  progress: f => ({ cur: f.answered, goal: 500 }) },
  { id: 'q1000',    group: 'milestone', name: '千題斬',     desc: '累計作答 1000 題',      icon: Trophy,        unlocked: f => f.answered >= 1000, progress: f => ({ cur: f.answered, goal: 1000 }) },
  { id: 'q2000',    group: 'milestone', name: '二千題斬',   desc: '累計作答 2000 題',      icon: Gem,           unlocked: f => f.answered >= 2000, progress: f => ({ cur: f.answered, goal: 2000 }) },
  { id: 'q3500',    group: 'milestone', name: '題海霸主',   desc: '累計作答 3500 題',      icon: Crown,         unlocked: f => f.answered >= 3500, progress: f => ({ cur: f.answered, goal: 3500 }) },
  { id: 'exams5',   group: 'milestone', name: '博學多聞',   desc: '練習過 5 個科別',       icon: Brain,         unlocked: f => f.examsTouched >= 5, progress: f => ({ cur: f.examsTouched, goal: 5 }) },
  { id: 'examsAll', group: 'milestone', name: '全科獵人',   desc: '每個上線科別都練過',    icon: GraduationCap, unlocked: f => f.examsTotal > 0 && f.examsTouched >= f.examsTotal, progress: f => ({ cur: f.examsTouched, goal: f.examsTotal || 1 }) },
  { id: 'study10',  group: 'milestone', name: '十時馬拉松', desc: '累計學習 10 小時',      icon: Clock,         unlocked: f => f.studyHours >= 10, progress: f => ({ cur: Math.floor(f.studyHours), goal: 10, unit: 'h' }) },
  { id: 'study50',  group: 'milestone', name: '苦讀不輟',   desc: '累計學習 50 小時',      icon: Coffee,        unlocked: f => f.studyHours >= 50, progress: f => ({ cur: Math.floor(f.studyHours), goal: 50, unit: 'h' }) },
  { id: 'level10',  group: 'milestone', name: '嶄露頭角',   desc: '達到等級 10',           icon: Medal,         unlocked: f => f.level >= 10,  progress: f => ({ cur: f.level, goal: 10 }) },
  { id: 'level25',  group: 'milestone', name: '漸入佳境',   desc: '達到等級 25',           icon: Medal,         unlocked: f => f.level >= 25,  progress: f => ({ cur: f.level, goal: 25 }) },
  { id: 'level50',  group: 'milestone', name: '半百征途',   desc: '達到等級 50',           icon: Award,         unlocked: f => f.level >= 50,  progress: f => ({ cur: f.level, goal: 50 }) },
  { id: 'level100', group: 'milestone', name: '登峰造極',   desc: '達到等級 100（滿級）',  icon: Crown,         unlocked: f => f.level >= 100, progress: f => ({ cur: f.level, goal: 100 }) },

  // ── 挑戰：技巧 / 精通 / 毅力 / 連對 / 每日 / 模擬考 ──
  { id: 'acc90',    group: 'challenge', name: '神射手',     desc: '答滿 50 題且正確率 ≥ 90%', icon: Target,     unlocked: f => f.answered >= 50 && f.accuracy >= 90, progress: f => ({ cur: f.answered >= 50 ? f.accuracy : 0, goal: 90, unit: '%' }) },
  { id: 'master50', group: 'challenge', name: '錯題終結者', desc: '精通 50 道曾答錯的題目', icon: Shield,        unlocked: f => f.mastered >= 50,  progress: f => ({ cur: f.mastered, goal: 50 }) },
  { id: 'master200',group: 'challenge', name: '錯題殲滅者', desc: '精通 200 道曾答錯的題目', icon: Shield,       unlocked: f => f.mastered >= 200, progress: f => ({ cur: f.mastered, goal: 200 }) },
  { id: 'expert',   group: 'challenge', name: '單科宗師',   desc: '單一科別答滿 100 題且正確率 ≥ 90%', icon: TrendingUp, unlocked: f => f.expertExam, progress: f => ({ cur: f.bestExamAcc100, goal: 90, unit: '%' }) },
  { id: 'deepdive', group: 'challenge', name: '單科千錘',   desc: '單一科別累計 500 題',   icon: Rocket,        unlocked: f => f.maxExamAnswered >= 500, progress: f => ({ cur: f.maxExamAnswered, goal: 500 }) },
  { id: 'bm20',     group: 'challenge', name: '蒐藏家',     desc: '收藏 20 個書籤',        icon: Star,          unlocked: f => f.bookmarks >= 20, progress: f => ({ cur: f.bookmarks, goal: 20 }) },
  { id: 'streak7',  group: 'challenge', name: '七日精進',   desc: '連續學習 7 天',         icon: Flame,         unlocked: f => f.streak >= 7,  progress: f => ({ cur: f.streak, goal: 7 }) },
  { id: 'streak30', group: 'challenge', name: '卅日不輟',   desc: '連續學習 30 天',        icon: Flame,         unlocked: f => f.streak >= 30, progress: f => ({ cur: f.streak, goal: 30 }) },
  { id: 'streak100',group: 'challenge', name: '百日成神',   desc: '連續學習 100 天',       icon: Flame,         unlocked: f => f.streak >= 100, progress: f => ({ cur: f.streak, goal: 100 }) },
  { id: 'combo10',  group: 'challenge', name: '十連對',     desc: '一口氣連續答對 10 題',  icon: Zap,           unlocked: f => f.bestCombo >= 10, progress: f => ({ cur: f.bestCombo, goal: 10 }) },
  { id: 'combo20',  group: 'challenge', name: '廿連對',     desc: '一口氣連續答對 20 題',  icon: Zap,           unlocked: f => f.bestCombo >= 20, progress: f => ({ cur: f.bestCombo, goal: 20 }) },
  { id: 'combo50',  group: 'challenge', name: '半百連對',   desc: '一口氣連續答對 50 題',  icon: Zap,           unlocked: f => f.bestCombo >= 50, progress: f => ({ cur: f.bestCombo, goal: 50 }) },
  { id: 'goal10',   group: 'challenge', name: '達標達人',   desc: '累計 10 天達成每日目標', icon: Calendar,      unlocked: f => f.goalDays >= 10, progress: f => ({ cur: f.goalDays, goal: 10 }) },
  { id: 'goal30',   group: 'challenge', name: '目標常客',   desc: '累計 30 天達成每日目標', icon: Calendar,      unlocked: f => f.goalDays >= 30, progress: f => ({ cur: f.goalDays, goal: 30 }) },
  { id: 'perfectWk',group: 'challenge', name: '完美一週',   desc: '連續 7 天達成每日目標', icon: Sparkles,      unlocked: f => f.goalStreak >= 7, progress: f => ({ cur: f.goalStreak, goal: 7 }) },
  { id: 'overAch',  group: 'challenge', name: '超額狂人',   desc: '單日達成 2 倍每日目標', icon: TrendingUp,    unlocked: f => f.maxDayAnswered >= 2 * f.dailyGoal, progress: f => ({ cur: f.maxDayAnswered, goal: 2 * f.dailyGoal }) },
  { id: 'examFirst',group: 'challenge', name: '初次應試',   desc: '完成第一場模擬考',      icon: ClipboardCheck, unlocked: f => f.examCount >= 1, progress: f => ({ cur: f.examCount, goal: 1 }) },
  { id: 'examPass', group: 'challenge', name: '飛越及格線', desc: '模擬考達到 70 分',      icon: Target,        unlocked: f => f.examBestPct >= 70, progress: f => ({ cur: f.examBestPct, goal: 70, unit: '%' }) },
  { id: 'examAce',  group: 'challenge', name: '高分王',     desc: '模擬考達到 90 分',      icon: Award,         unlocked: f => f.examBestPct >= 90, progress: f => ({ cur: f.examBestPct, goal: 90, unit: '%' }) },
  { id: 'examPerf', group: 'challenge', name: '完美無瑕',   desc: '模擬考拿到 100 分',     icon: Crown,         unlocked: f => f.examBestPct >= 100, progress: f => ({ cur: f.examBestPct, goal: 100, unit: '%' }) },
  { id: 'examStrk', group: 'challenge', name: '屢戰屢勝',   desc: '連續 3 場模擬考及格',   icon: Flame,         unlocked: f => f.examPassStreak >= 3, progress: f => ({ cur: f.examPassStreak, goal: 3 }) },

  // ── 隱藏：作答時段 & 探索功能（?? until unlocked，只從現在起算） ──
  { id: 'earlyBird',group: 'hidden', name: '早鳥',     desc: '在早上 6 點前作答',       icon: Sunrise,   unlocked: f => f.flags.earlyBird },
  { id: 'nightOwl', group: 'hidden', name: '夜貓子',   desc: '在凌晨 0–4 點作答',       icon: Moon,      unlocked: f => f.flags.nightOwl },
  { id: 'weekend',  group: 'hidden', name: '週末戰士', desc: '在週末作答',              icon: Calendar,  unlocked: f => f.flags.weekend },
  { id: 'lunch',    group: 'hidden', name: '午休充電', desc: '在午休（12–13 點）作答',  icon: Coffee,    unlocked: f => f.flags.lunch },
  { id: 'polyglot', group: 'hidden', name: '雙聲道',   desc: '切換過中／英題目',        icon: Languages, unlocked: f => f.flags.lang },
  { id: 'nocturnal',group: 'hidden', name: '夜行者',   desc: '開啟過深色模式',          icon: Moon,      unlocked: f => f.flags.dark },
  { id: 'backup',   group: 'hidden', name: '有備無患', desc: '匯出過進度備份',          icon: Download,  unlocked: f => f.flags.export },
  { id: 'keyboard', group: 'hidden', name: '鍵盤俠',   desc: '用鍵盤快捷鍵作答',        icon: Keyboard,  unlocked: f => f.flags.hotkey },
  { id: 'swiper',   group: 'hidden', name: '手勢大師', desc: '用滑動手勢切換題目',      icon: Move,      unlocked: f => f.flags.swipe },
]

export const GROUPS = [
  { key: 'milestone', label: '里程碑' },
  { key: 'challenge', label: '挑戰' },
  { key: 'hidden',    label: '隱藏' },
]

export function evaluateAchievements(facts) {
  return ACHIEVEMENTS.map(a => {
    const p = a.progress ? a.progress(facts) : { cur: 0, goal: 1 }
    return { ...a, done: !!a.unlocked(facts), cur: p.cur, goal: p.goal, unit: p.unit || '' }
  })
}
