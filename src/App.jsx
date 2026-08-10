import { useState, useReducer, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Upload, FileJson, CheckCircle, XCircle, Sun, Moon, Star, Flag,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Play, Square,
  BarChart3, BookOpen, Clock, Filter, Search, Plus, Minus, RotateCcw,
  AlertCircle, Trophy, Target, ListChecks, Shuffle, X, Database,
  Github, Key, RefreshCw, Trash2, Eye, EyeOff, FileText, Shield, Loader2,
  Languages, LogOut, Flame, Users, Zap, Award, Sparkles, Lock,
  Gauge, CalendarClock, Share2, TrendingUp, TrendingDown, PartyPopper, Crown, Repeat, BadgeCheck,
} from 'lucide-react'
import awsLogo from '/aws.png'
import { loadLocalProgress, saveLocalProgress, clearLocalProgress, stripQuestions } from './storage'
import { SyncStatusPill, GoogleSignInButton, useGoogleSync } from './SyncControls'
import ErrorBoundary from './ErrorBoundary'
import { isSyncConfigured, mergeMaps, fetchAdminOverview, fetchLeaderboard } from './sync'
import {
  computeXP, levelInfo, evaluateAchievements, titleForLevel,
  GROUPS as ACHIEVEMENT_GROUPS,
  XP_PER_CORRECT, XP_PER_WRONG, XP_MASTER_BONUS,
} from './gamify'
import { isDue, overdueBy } from './srs'
import { buildDailyStudyPlan } from './studyPlan'
import { CERTIFICATIONS, getExcludedExams, isCertificationEarned } from './certifications'
import { buildExamProgressReport, createMemoryAnchor } from './learningInsights'
import { shareScoreCard } from './sharecard'
import { markExamActive, markPracticeActive } from './swUpdate'
import { saveSession, loadSession, clearSession } from './session'
import { computeCorrect, getStructuredChoices } from './grading'

// ── GitHub Config (admin only) ──
const GITHUB_OWNER = 'awsjin510'
const GITHUB_REPO = 'quest'
const GITHUB_BRANCH = 'claude/aws-exam-practice-app-mSqvt'
const DATA_PATH = 'public/data'
const BASE_URL = import.meta.env.BASE_URL || '/quest/'
// App logo (user-supplied); used in the header and the password gate.
const cloudIcon = `${BASE_URL}logo.png`
// Cache-bust token fixed at BUILD time: within one deploy every visitor hits
// the same URLs so the browser/CDN can cache the (immutable) JSON banks, and a
// new deploy mints a new token which busts everything at once. Data edits go
// through git → Pages rebuild, so "new data" always implies "new build id".
const DATA_VERSION = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : String(Date.now())

// ── Data fetch helpers (parallel, versioned URLs) ──
async function fetchDataJson(path) {
  const res = await fetch(`${BASE_URL}data/${path}?v=${DATA_VERSION}`)
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`)
  return res.json()
}
const asQuestions = (data) => {
  const list = Array.isArray(data) ? data : (data.questions || [])
  // 防禦性正規化：多選答案若是字串（如 "AD"）轉成陣列，否則計分永遠判錯
  for (const q of list) {
    if (q && q.type === 'multiple' && typeof q.answer === 'string') q.answer = q.answer.split('')
  }
  return list
}

// Fetch many bank files concurrently; per-file failures are skipped so one
// bad file can't take down the whole bank. onProgress(done, total) fires as
// each file settles.
async function loadBankFiles(files, onProgress) {
  let done = 0
  const results = await Promise.all(files.map(async (f) => {
    try {
      return asQuestions(await fetchDataJson(f))
    } catch {
      return []
    } finally {
      done++
      onProgress?.(done, files.length)
    }
  }))
  return results.flat()
}

// ── Check admin mode ──
const isAdmin = new URLSearchParams(window.location.search).has('admin')

// ── GitHub API Helpers ──
async function githubApiFetch(path, token, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
  return res.json()
}

async function githubPutFile(path, content, token, sha = null) {
  const body = {
    message: `data: update ${path.split('/').pop()}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: GITHUB_BRANCH,
  }
  if (sha) body.sha = sha
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API ${res.status}`)
  }
  return res.json()
}

async function githubDeleteFile(path, token, sha) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `data: delete ${path.split('/').pop()}`,
      sha,
      branch: GITHUB_BRANCH,
    }),
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return res.json()
}

async function loadQuestionsFromGitHub(token) {
  // List files in public/data/
  const files = await githubApiFetch(DATA_PATH, token)
  const jsonFiles = files.filter(f => f.name.endsWith('.json'))
  const allQuestions = []
  const bankInfo = []
  for (const file of jsonFiles) {
    try {
      const fileData = await githubApiFetch(`${DATA_PATH}/${file.name}`, token)
      const content = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))))
      const data = JSON.parse(content)
      const questions = Array.isArray(data) ? data : (data.questions || [])
      if (questions.length) {
        allQuestions.push(...questions)
        bankInfo.push({ name: file.name, count: questions.length, sha: fileData.sha })
      }
    } catch { /* skip bad files */ }
  }
  return { questions: allQuestions, banks: bankInfo }
}

// ── Initial State ──
const initialState = {
  darkMode: false,
  activeTab: isAdmin ? 'upload' : 'practice',
  questions: [],
  uploadHistory: [],

  // Practice
  practiceFiltered: [],
  practiceIndex: 0,
  practiceAnswers: {},
  practiceSubmitted: {},
  practiceResults: {},
  bookmarked: {},
  reviewMarked: {},
  showAnswers: false,

  // Filters
  filterExam: '',
  filterType: '',
  filterSearch: '',

  // Exam
  examConfig: { count: 65, timeLimit: 170, examFilter: '' },
  examActive: false,
  examQuestionIds: [],
  examIndex: 0,
  examAnswers: {},
  examEndTime: null,
  examRemaining: 0,
  examSubmitted: false,
  examResults: null,

  // Stats
  statsHistory: {},
  dailyStats: {},   // { 'YYYY-MM-DD': { answered, correct, seconds } } — 本裝置的每日計數
  dailyRemote: {},  // 其他裝置的每日計數總和（登入同步後由伺服器提供，僅供顯示疊加）
  dailyGoal: 20,    // 每日目標題數（可調）

  // Gamification (連對)：combo 為本次連續答對數（session），bestCombo 持久化
  combo: 0,
  bestCombo: 0,
  lastXpGain: null, // { amount, base, bonus, mult, correct, at } — 作答後的 +XP 動畫
  bonusXp: 0,       // Fever 連對加成累計（本機；等級顯示 = computeXP + bonusXp）
  examHistory: [],  // [{ at, exam, total, correct, pct, passed }] — 模擬考成就用
  examDates: {},    // { [exam]: 'YYYY-MM-DD' } — 各科目標考期（倒數＋配速用）
  earnedCertifications: {}, // { [certId]: { enabled, earnedAt, _updatedAt } }
  missionRewards: {}, // { 'YYYY-MM-DD': true } — 每日三任務全完成獎勵
  flags: {},        // 隱藏成就旗標：earlyBird/nightOwl/weekend/lunch/lang/dark/export/hotkey/swipe

  // Language
  lang: 'zh',        // 'zh' | 'en'
  questionsEn: {},    // { 'CLF-C02-1': questionObj, ... }

  // Loading
  questionsLoading: true,

  // GitHub sync
  githubLoading: false,
  githubSyncing: false,
  githubBanks: [],  // [{ name, count, sha }]
  githubError: null,
}

// ── Helper: 今日日期 key（學習趨勢用，local 時區） ──
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// 累計 dailyStats：answered +n、correct +c（保留其他欄位如 seconds）
function bumpDaily(dailyStats, answered, correct) {
  const dk = todayKey()
  const prev = dailyStats?.[dk] || { answered: 0, correct: 0 }
  return { ...dailyStats, [dk]: { ...prev, answered: (prev.answered || 0) + answered, correct: (prev.correct || 0) + correct } }
}

// 疊加本機與其他裝置的每日計數（顯示用）
function combineDaily(own = {}, others = {}) {
  const out = {}
  for (const src of [own, others]) {
    for (const [day, v] of Object.entries(src)) {
      const cur = out[day] || { answered: 0, correct: 0, seconds: 0 }
      out[day] = {
        answered: cur.answered + (v?.answered || 0),
        correct: cur.correct + (v?.correct || 0),
        seconds: cur.seconds + (v?.seconds || 0),
      }
    }
  }
  return out
}

// 正確率三段語意色：≥70 綠（及格）、55–69 琥珀（接近）、<55 紅
function accuracyTone(pct) {
  if (pct >= 70) return { text: 'text-green-600 dark:text-green-400', bar: 'linear-gradient(90deg, #22c55e, #16a34a)' }
  if (pct >= 55) return { text: 'text-amber-600 dark:text-amber-500', bar: 'linear-gradient(90deg, #f59e0b, #d97706)' }
  return { text: 'text-red-500', bar: 'linear-gradient(90deg, #ef4444, #dc2626)' }
}

// 目前作答時段的隱藏成就旗標
function currentTimeFlags() {
  const d = new Date()
  const h = d.getHours(), day = d.getDay()
  const f = {}
  if (h < 6) f.earlyBird = true
  if (h >= 0 && h < 4) f.nightOwl = true
  if (day === 0 || day === 6) f.weekend = true
  if (h === 12) f.lunch = true
  return f
}

// 秒數 → 人類可讀時數
function formatDuration(sec) {
  if (!sec || sec < 60) return '0 分鐘'
  const h = sec / 3600
  if (h >= 10) return `${Math.round(h)} 小時`
  if (h >= 1) return `${h.toFixed(1)} 小時`
  return `${Math.round(sec / 60)} 分鐘`
}

// ── Reducer ──
function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_DARK':
      return { ...state, darkMode: !state.darkMode, flags: { ...state.flags, dark: true } }

    case 'SET_LANG':
      return { ...state, lang: action.lang, flags: { ...state.flags, lang: true } }

    case 'TOGGLE_SHOW_ANSWERS':
      return { ...state, showAnswers: !state.showAnswers }

    case 'LOAD_EN_QUESTIONS': {
      const enMap = { ...state.questionsEn }
      action.questions.forEach(q => { enMap[`${q.exam}-${q.id}`] = q })
      return { ...state, questionsEn: enMap }
    }

    case 'EXIT_EXAM':
      return {
        ...state,
        examActive: false,
        examSubmitted: false,
        examResults: null,
        examQuestionIds: [],
        examIndex: 0,
        examAnswers: {},
        examEndTime: null,
        examRemaining: 0,
      }

    case 'SET_TAB':
      return { ...state, activeTab: action.tab }

    case 'SET_QUESTIONS_LOADING':
      return { ...state, questionsLoading: action.value }

    case 'LOAD_QUESTIONS': {
      const newQs = action.questions
      const map = new Map()
      state.questions.forEach(q => map.set(`${q.exam}-${q.id}`, q))
      newQs.forEach(q => map.set(`${q.exam}-${q.id}`, q))
      const merged = Array.from(map.values()).sort((a, b) => a.id - b.id)
      return {
        ...state,
        questions: merged,
        practiceFiltered: merged,
        practiceIndex: 0,
        questionsLoading: false,
        uploadHistory: [...state.uploadHistory, {
          filename: action.filename,
          count: newQs.length,
          timestamp: Date.now()
        }]
      }
    }

    case 'APPEND_QUESTIONS': {
      // Background/lazy loads merge into the bank WITHOUT resetting the user's
      // current practice list/index (unlike LOAD_QUESTIONS, which is only for
      // the initial full load and admin uploads).
      const map = new Map()
      state.questions.forEach(q => map.set(`${q.exam}-${q.id}`, q))
      action.questions.forEach(q => {
        const k = `${q.exam}-${q.id}`
        if (!map.has(k)) map.set(k, q)
      })
      return {
        ...state,
        questions: Array.from(map.values()).sort((a, b) => a.id - b.id),
        questionsLoading: false,
      }
    }

    case 'SET_FILTER':
      return { ...state, [action.key]: action.value }

    case 'START_PRACTICE': {
      let filtered = [...state.questions]
      if (state.filterExam) filtered = filtered.filter(q => q.exam === state.filterExam)
      if (state.filterType === 'official') filtered = filtered.filter(q => q.officialNo)
      else if (state.filterType) filtered = filtered.filter(q => q.type === state.filterType)
      if (state.filterSearch) {
        const rangeMatch = state.filterSearch.trim().match(/^(\d+)\s*[-~～]\s*(\d+)$/)
        if (rangeMatch) {
          const from = parseInt(rangeMatch[1], 10)
          const to = parseInt(rangeMatch[2], 10)
          filtered = filtered.filter(q => q.id >= from && q.id <= to)
        } else {
          filtered = filtered.filter(q => String(q.id).includes(state.filterSearch))
        }
      }
      // Exclude already practiced (submitted) questions
      filtered = filtered.filter(q => !state.practiceSubmitted[`${q.exam}-${q.id}`])
      // Sort by ID for sequential order
      filtered.sort((a, b) => a.id - b.id)
      return { ...state, practiceFiltered: filtered, practiceIndex: 0, activeTab: 'practice' }
    }

    case 'SELECT_SUBJECT': {
      // 登入後先選科別：依所選科別載入對應題目並進入練習模式
      const exam = action.exam || ''
      const filtered = (exam ? state.questions.filter(q => q.exam === exam) : [...state.questions])
        .sort((a, b) => a.id - b.id)
      // 回到上次練習位置（依科別各自記憶）
      let resumeIndex = 0
      try {
        const saved = JSON.parse(localStorage.getItem('quest-resume') || '{}')
        const savedKey = saved[exam || '__all__']
        if (savedKey) {
          const i = filtered.findIndex(q => `${q.exam}-${q.id}` === savedKey)
          if (i > 0) resumeIndex = i
        }
      } catch { /* ignore */ }
      return {
        ...state,
        filterExam: exam,
        filterType: '',
        filterSearch: '',
        practiceFiltered: filtered,
        practiceIndex: resumeIndex,
        activeTab: 'practice',
      }
    }

    case 'RESTORE_SESSION': {
      // Rebuild the practice session a previous page load was sitting in.
      // The snapshot stores question KEYS, so the bank has to be loaded first;
      // `action.loaded` carries the files fetched by the restoring effect,
      // which are not visible in `state.questions` from its stale closure.
      const snap = action.snap
      const merged = new Map()
      ;[...state.questions, ...(action.loaded || [])].forEach(q => merged.set(`${q.exam}-${q.id}`, q))
      const questions = snap.keys.map(k => merged.get(k)).filter(Boolean)
      // Some of the bank is missing (a file failed to fetch, or the question
      // was removed by a later deploy) — better to send the user to the
      // subject picker than into a session that is quietly missing questions.
      if (questions.length !== snap.keys.length) return state
      return {
        ...state,
        filterExam: snap.exam || '',
        filterType: snap.filterType || '',
        filterSearch: snap.filterSearch || '',
        activeTab: snap.activeTab === 'upload' ? 'practice' : (snap.activeTab || 'practice'),
        practiceFiltered: questions,
        practiceIndex: Math.min(Math.max(snap.index || 0, 0), questions.length - 1),
        practiceAnswers: { ...state.practiceAnswers, ...(snap.answers || {}) },
        practiceSubmitted: { ...state.practiceSubmitted, ...(snap.submitted || {}) },
        practiceResults: { ...state.practiceResults, ...(snap.results || {}) },
      }
    }

    case 'SET_PRACTICE_INDEX':
      return { ...state, practiceIndex: action.index }

    case 'SHUFFLE_PRACTICE': {
      const shuffled = [...state.practiceFiltered]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return { ...state, practiceFiltered: shuffled, practiceIndex: 0 }
    }

    case 'SET_ANSWER': {
      return { ...state, practiceAnswers: { ...state.practiceAnswers, [action.qKey]: action.answer } }
    }

    case 'SUBMIT_ANSWER': {
      const q = action.question
      const qKey = `${q.exam}-${q.id}`
      const userAns = state.practiceAnswers[qKey]
      const correct = computeCorrect(q, userAns)
      const prevEntry = state.statsHistory[qKey]
      const prevCount = prevEntry?.correctCount ?? prevEntry?.correctStreak ?? 0
      // 累計答對次數：答對 +1，答錯不歸零（不需連續答對，中間夾雜答錯也算數）。
      const correctCount = correct ? prevCount + 1 : prevCount
      // 終身總答對次數：只增不減，供 XP／等級計算使用，不受 SRS 階段重置影響
      // （避免答錯導致 correctCount 歸零時，等級跟著現場倒退）。
      const totalCorrect = (prevEntry?.totalCorrect ?? prevCount) + (correct ? 1 : 0)
      // 一旦答錯過就視為錯題；累計答對 MASTERY_THRESHOLD 次後才算學會並移出清單
      const everWrong = (prevEntry ? (prevEntry.everWrong ?? !prevEntry.correct) : false) || !correct
      const wasMastered = prevEntry && (prevEntry.everWrong ?? !prevEntry.correct) && (prevEntry.correctCount ?? 0) >= MASTERY_THRESHOLD
      const nowMastered = everWrong && correctCount >= MASTERY_THRESHOLD
      // 本次獲得的 XP：答對 10／答錯 3，首次精通錯題再 +25
      const baseXp = (correct ? XP_PER_CORRECT : XP_PER_WRONG) + (nowMastered && !wasMastered ? XP_MASTER_BONUS : 0)
      const combo = correct ? state.combo + 1 : 0
      // Fever 連對加成：連對 ≥5 給 ×1.2、≥10 給 ×1.5 的 XP（只對答對生效）
      const mult = combo >= 10 ? 1.5 : combo >= 5 ? 1.2 : 1
      const bonus = correct && mult > 1 ? Math.round(baseXp * (mult - 1)) : 0
      return {
        ...state,
        practiceSubmitted: { ...state.practiceSubmitted, [qKey]: true },
        practiceResults: { ...state.practiceResults, [qKey]: correct },
        statsHistory: {
          ...state.statsHistory,
          [qKey]: { correct, correctCount, totalCorrect, everWrong, exam: q.exam, type: q.type, id: q.id, question: q, _updatedAt: Date.now() }
        },
        dailyStats: bumpDaily(state.dailyStats, 1, correct ? 1 : 0),
        combo,
        bestCombo: Math.max(state.bestCombo, combo),
        bonusXp: (state.bonusXp || 0) + bonus,
        lastXpGain: { amount: baseXp + bonus, base: baseXp, bonus, mult, correct, qKey, at: Date.now() },
        flags: { ...state.flags, ...currentTimeFlags(), ...(action.viaHotkey ? { hotkey: true } : {}) },
      }
    }

    case 'SET_FLAG':
      return state.flags[action.flag] ? state : { ...state, flags: { ...state.flags, [action.flag]: true } }

    case 'TOGGLE_BOOKMARK': {
      const b = { ...state.bookmarked }
      b[action.qKey] = !b[action.qKey]
      return { ...state, bookmarked: b }
    }

    case 'TOGGLE_REVIEW': {
      const r = { ...state.reviewMarked }
      r[action.qKey] = !r[action.qKey]
      return { ...state, reviewMarked: r }
    }

    case 'SET_EXAM_CONFIG':
      return { ...state, examConfig: { ...state.examConfig, ...action.config } }

    case 'START_EXAM': {
      // action.pool（如錯題模擬考）可覆蓋預設題池；count/timeLimit 同理。
      let pool = action.pool ? [...action.pool] : [...state.questions]
      if (!action.pool && state.examConfig.examFilter) pool = pool.filter(q => q.exam === state.examConfig.examFilter)
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      const count = action.count ?? state.examConfig.count
      const timeLimit = action.timeLimit ?? state.examConfig.timeLimit
      const selected = pool.slice(0, Math.min(count, pool.length))
      if (!selected.length) return state
      const ids = selected.map(q => `${q.exam}-${q.id}`)
      return {
        ...state,
        examActive: true,
        examQuestionIds: ids,
        examIndex: 0,
        examAnswers: {},
        examEndTime: Date.now() + timeLimit * 60 * 1000,
        examRemaining: timeLimit * 60,
        examSubmitted: false,
        examResults: null,
        examConfig: { ...state.examConfig, timeLimit },
        activeTab: 'exam'
      }
    }

    case 'TICK_TIMER': {
      if (!state.examActive || state.examSubmitted) return state
      const remaining = Math.max(0, Math.round((state.examEndTime - Date.now()) / 1000))
      return { ...state, examRemaining: remaining }
    }

    case 'SET_EXAM_ANSWER':
      return { ...state, examAnswers: { ...state.examAnswers, [action.qKey]: action.answer } }

    case 'SET_EXAM_INDEX':
      return { ...state, examIndex: action.index }

    case 'SUBMIT_EXAM': {
      const qMap = new Map()
      state.questions.forEach(q => qMap.set(`${q.exam}-${q.id}`, q))
      let totalCorrect = 0
      const typeStats = {}
      const details = state.examQuestionIds.map(qKey => {
        const q = qMap.get(qKey)
        const userAns = state.examAnswers[qKey]
        const correct = computeCorrect(q, userAns)
        if (correct) totalCorrect++
        if (!typeStats[q.type]) typeStats[q.type] = { total: 0, correct: 0 }
        typeStats[q.type].total++
        if (correct) typeStats[q.type].correct++
        return { qKey, correct, question: q }
      })
      const newHistory = { ...state.statsHistory }
      const submittedAt = Date.now()
      details.forEach(d => {
        const prevEntry = state.statsHistory[d.qKey]
        const prevCount = prevEntry?.correctCount ?? prevEntry?.correctStreak ?? 0
        const correctCount = d.correct ? prevCount + 1 : prevCount
        // 終身總答對次數：只增不減，供 XP／等級計算使用（見 SUBMIT_ANSWER 註解）。
        const totalCorrect = (prevEntry?.totalCorrect ?? prevCount) + (d.correct ? 1 : 0)
        const everWrong = (prevEntry ? (prevEntry.everWrong ?? !prevEntry.correct) : false) || !d.correct
        newHistory[d.qKey] = { correct: d.correct, correctCount, totalCorrect, everWrong, exam: d.question.exam, type: d.question.type, id: d.question.id, question: d.question, _updatedAt: submittedAt }
      })
      const examTotal = state.examQuestionIds.length
      const examPct = examTotal > 0 ? Math.round((totalCorrect / examTotal) * 100) : 0
      const examExam = state.examConfig?.examFilter || '（全部科別）'
      const repeatedWrong = details.filter(d => !d.correct && state.statsHistory[d.qKey]?.everWrong).length
      const progressReport = buildExamProgressReport(state.examHistory, examExam, examPct, repeatedWrong)
      return {
        ...state,
        examActive: false,
        examSubmitted: true,
        examResults: {
          total: examTotal,
          correct: totalCorrect,
          typeStats,
          details,
          progressReport,
        },
        statsHistory: newHistory,
        dailyStats: bumpDaily(state.dailyStats, details.length, totalCorrect),
        // 保留最近 100 場模擬考結果（成就用）
        examHistory: [
          ...(state.examHistory || []),
          { at: submittedAt, exam: examExam, total: examTotal, correct: totalCorrect, pct: examPct, passed: examPct >= 70 },
        ].slice(-100),
      }
    }

    case 'GOTO_PRACTICE_QUESTION': {
      // Drop any undefined questions (can happen if the bank isn't loaded yet)
      // so building practiceFiltered never dereferences undefined and crashes.
      const questions = (action.questions || [action.question]).filter(Boolean)
      if (!questions.length) return state
      const startIndex = Math.min(Math.max(action.startIndex ?? 0, 0), questions.length - 1)
      const newAnswers = { ...state.practiceAnswers }
      const newSubmitted = { ...state.practiceSubmitted }
      const newResults = { ...state.practiceResults }
      questions.forEach(qq => {
        const k = `${qq.exam}-${qq.id}`
        newAnswers[k] = undefined
        newSubmitted[k] = false
        newResults[k] = undefined
      })
      return {
        ...state,
        activeTab: 'practice',
        practiceFiltered: questions,
        practiceIndex: startIndex,
        practiceAnswers: newAnswers,
        practiceSubmitted: newSubmitted,
        practiceResults: newResults,
      }
    }

    case 'CLEAR_WRONG_BY_EXAM': {
      // 將指定考科的所有「錯題」標記為已學會：累計答對數補到 MASTERY_THRESHOLD，移出錯題清單。
      const newHistory = { ...state.statsHistory }
      Object.entries(newHistory).forEach(([k, v]) => {
        if (v.exam !== action.exam) return
        const everWrong = v.everWrong ?? !v.correct
        if (!everWrong) return
        const count = v.correctCount ?? v.correctStreak ?? 0
        if (count >= MASTERY_THRESHOLD) return
        newHistory[k] = { ...v, correctCount: MASTERY_THRESHOLD, totalCorrect: Math.max(v.totalCorrect ?? count, MASTERY_THRESHOLD) }
      })
      return { ...state, statsHistory: newHistory }
    }

    case 'RESTORE_STATS':
      return { ...state, statsHistory: action.statsHistory }

    case 'RESTORE_BOOKMARKS':
      return { ...state, bookmarked: action.bookmarked }

    case 'RESTORE_REVIEWS':
      return { ...state, reviewMarked: action.reviewMarked }

    case 'RESTORE_DAILY':
      return { ...state, dailyStats: action.dailyStats }

    case 'SET_DAILY_REMOTE':
      return { ...state, dailyRemote: action.dailyRemote || {} }

    case 'SET_DAILY_GOAL':
      return { ...state, dailyGoal: Math.min(500, Math.max(1, Math.round(action.goal) || 20)) }

    case 'RESTORE_BEST_COMBO':
      return { ...state, bestCombo: Math.max(state.bestCombo, action.bestCombo || 0) }

    case 'RESTORE_GAMIFY':
      return {
        ...state,
        examHistory: (action.examHistory?.length ? action.examHistory : state.examHistory),
        flags: { ...state.flags, ...(action.flags || {}) },
        bonusXp: Math.max(state.bonusXp || 0, action.bonusXp || 0),
        examDates: { ...(action.examDates || {}), ...state.examDates },
        earnedCertifications: { ...state.earnedCertifications, ...(action.earnedCertifications || {}) },
        missionRewards: { ...state.missionRewards, ...(action.missionRewards || {}) },
      }

    case 'CLAIM_DAILY_MISSIONS': {
      if (!action.day || state.missionRewards[action.day]) return state
      return {
        ...state,
        bonusXp: (state.bonusXp || 0) + 50,
        missionRewards: { ...state.missionRewards, [action.day]: true },
      }
    }

    case 'RESTORE_CERTIFICATIONS':
      return { ...state, earnedCertifications: action.earnedCertifications || {} }

    case 'TOGGLE_CERTIFICATION': {
      const previous = state.earnedCertifications[action.certId]
      const enabled = !isCertificationEarned(previous)
      const now = Date.now()
      return {
        ...state,
        earnedCertifications: {
          ...state.earnedCertifications,
          [action.certId]: {
            enabled,
            earnedAt: enabled ? (previous?.earnedAt || now) : (previous?.earnedAt || null),
            _updatedAt: now,
          },
        },
      }
    }

    case 'SET_EXAM_DATE': {
      const next = { ...state.examDates }
      if (action.date) next[action.exam] = action.date
      else delete next[action.exam]
      return { ...state, examDates: next }
    }

    case 'ADD_STUDY_TIME': {
      // 學習時數：由 App 的活躍偵測計時器每 30 秒累加一次
      const dk = todayKey()
      const prev = state.dailyStats?.[dk] || { answered: 0, correct: 0 }
      return {
        ...state,
        dailyStats: { ...state.dailyStats, [dk]: { ...prev, seconds: (prev.seconds || 0) + action.seconds } },
      }
    }

    case 'SET_GITHUB_LOADING':
      return { ...state, githubLoading: action.value }

    case 'SET_GITHUB_SYNCING':
      return { ...state, githubSyncing: action.value }

    case 'SET_GITHUB_BANKS':
      return { ...state, githubBanks: action.banks }

    case 'SET_GITHUB_ERROR':
      return { ...state, githubError: action.error }

    case 'CLEAR_ALL_DATA':
      clearLocalProgress()
      return { ...initialState, darkMode: state.darkMode }

    default:
      return state
  }
}

// ── Helper: Question type label ──
const typeLabels = { single: '單選題', multiple: '多選題', matching: '配對題', ordering: '排序題' }
// ── Helper: Exam code display name (data keys stay as the short code) ──
const EXAM_DISPLAY_NAMES = { 'PCA': 'GCP-PCA' }
const displayExam = code => EXAM_DISPLAY_NAMES[code] || code
// 錯題清單：累計答對這麼多次才算「學會」並移出清單（不需連續，答錯不歸零）
const MASTERY_THRESHOLD = 3

// ── Helper: Get display question based on language ──
function getDisplayQuestion(q, lang, enMap) {
  if (!q) return q
  if (lang === 'en') {
    const enQ = enMap[`${q.exam}-${q.id}`]
    if (enQ) return enQ
  }
  return q
}

// ── Keyboard shortcuts for answering (shared by practice & exam) ──
// A–E / 1–9 pick an option (toggle for multiple-choice), Enter submits (or
// advances), ←/→ navigate. Disabled while typing in a form control.
function useAnswerHotkeys({ enabled, question, answer, submitted, allowChange, onAnswer, onPrev, onNext, onEnter }) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev?.(); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNext?.(); return }
      if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); return }
      if (!question?.options) return
      let key = null
      if (/^[a-zA-Z]$/.test(e.key) && question.options[e.key.toUpperCase()] !== undefined) {
        key = e.key.toUpperCase()
      } else if (/^[1-9]$/.test(e.key)) {
        key = Object.keys(question.options)[Number(e.key) - 1] ?? null
      }
      if (!key) return
      if (submitted && !allowChange) return
      if (question.type === 'single') {
        onAnswer(key)
      } else if (question.type === 'multiple') {
        const sel = Array.isArray(answer) ? answer : []
        onAnswer(sel.includes(key) ? sel.filter(s => s !== key) : [...sel, key])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, question, answer, submitted, allowChange, onAnswer, onPrev, onNext, onEnter])
}

// 快捷鍵提示（桌機才顯示）
function HotkeyHint() {
  return (
    <p className="hidden md:block text-center text-[11px] text-gray-400 dark:text-gray-500 mt-3">
      鍵盤快捷鍵：<span className="font-semibold">A–E / 1–5</span> 選答案 ·{' '}
      <span className="font-semibold">Enter</span> 提交／下一題 ·{' '}
      <span className="font-semibold">←</span> <span className="font-semibold">→</span> 切換題目
    </p>
  )
}

// 案例研究背景：與實際問題分開顯示，預設收合避免冗長題幹蓋過問題本身
function CaseStudyBox({ text }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-900/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
      >
        <span className="flex items-center gap-2"><FileText size={15} /> 案例背景</span>
        <span className="flex items-center gap-1 text-xs font-normal text-blue-500/80 dark:text-blue-400/80">
          {open ? '收合' : '展開'}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words max-h-80 overflow-y-auto border-t border-blue-200/60 dark:border-blue-900/40">
          {text}
        </div>
      )}
    </div>
  )
}

// ── Main App ──
// ── Password Gate ──
const SITE_PASSWORD = 'julia'
const PASSWORD_HINT = '提示：什麼福利是雲力橘子有，其他公司沒有的？'
const AUTH_KEY = 'quest_authenticated'

function PasswordGate({ onAuth }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const handleSubmit = (e) => {
    e.preventDefault()
    if (pw.trim().toLowerCase() === SITE_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1')
      onAuth()
    } else {
      setError(true)
      setPw('')
    }
  }
  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800/90 backdrop-blur rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-gray-700/80">
        <div className="flex justify-center mb-4">
          <img src={cloudIcon} alt="雲端證照" className="h-16 rounded-2xl" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2 tracking-tight">雲端證照考試練習器</h2>
        <p className="text-gray-400 text-sm mb-4">{PASSWORD_HINT}</p>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false) }}
          placeholder="請輸入密碼"
          className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-orange-400 focus:outline-none mb-3 text-center"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mb-3">密碼錯誤，請重試</p>}
        <button type="submit" className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors">
          進入練習
        </button>
        <p className="text-gray-500 text-[11px] mt-4 leading-relaxed">
          通過密碼後，仍需使用 Google／Gmail 帳號登入
        </p>
      </form>
    </div>
  )
}

function GoogleAuthGate({ user, authReady, onSignedIn }) {
  if (user) return null
  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="bg-gray-800/90 backdrop-blur rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-gray-700/80">
        <div className="flex justify-center mb-4">
          <img src={cloudIcon} alt="雲端證照" className="h-16 rounded-2xl" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2 tracking-tight">使用 Google 帳號登入</h2>
        <p className="text-gray-400 text-sm mb-6">完成 Gmail／Google 驗證後才能進入題庫，進度也會自動跨裝置同步。</p>
        {!authReady ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-300">
            <Loader2 size={18} className="animate-spin" /> 驗證登入狀態…
          </div>
        ) : isSyncConfigured() ? (
          <GoogleSignInButton onSuccess={onSignedIn} />
        ) : (
          <div className="rounded-xl border border-red-800/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            Google 登入尚未設定，請聯絡管理員。
          </div>
        )}
      </div>
    </div>
  )
}

// 登入後的科別選擇畫面：先選練習科別，再進入對應題目
const CLOUD_PROVIDERS = [
  { key: 'aws', label: 'AWS', accent: 'orange', logo: awsLogo },
  { key: 'gcp', label: 'GCP', accent: 'blue', logo: `${BASE_URL}gcp-logo.png` },
  { key: 'azure', label: 'Azure', accent: 'sky', logo: `${BASE_URL}azure-logo.png` },
]

// Tailwind only ships classes it can see as complete literals, so each accent
// spells its classes out in full rather than interpolating the colour name.
const PROVIDER_ACCENTS = {
  orange: {
    tab: 'bg-orange-500/20 text-orange-300 shadow-sm',
    hoverBg: 'hover:bg-orange-500/20', hoverBorder: 'hover:border-orange-400', hoverText: 'group-hover:text-orange-300',
    badgeHoverBg: 'group-hover:bg-orange-500/30', badgeHoverText: 'group-hover:text-orange-200',
  },
  blue: {
    tab: 'bg-blue-500/20 text-blue-300 shadow-sm',
    hoverBg: 'hover:bg-blue-500/20', hoverBorder: 'hover:border-blue-400', hoverText: 'group-hover:text-blue-300',
    badgeHoverBg: 'group-hover:bg-blue-500/30', badgeHoverText: 'group-hover:text-blue-200',
  },
  sky: {
    tab: 'bg-sky-500/20 text-sky-300 shadow-sm',
    hoverBg: 'hover:bg-sky-500/20', hoverBorder: 'hover:border-sky-400', hoverText: 'group-hover:text-sky-300',
    badgeHoverBg: 'group-hover:bg-sky-500/30', badgeHoverText: 'group-hover:text-sky-200',
  },
}

// 各雲服務商的考試代碼（用來在入口畫面分組）。列在這裡但題庫還沒匯入的
// 科別，會以「題庫準備中」的停用磚顯示，題目一進來就自動變成可點選。
const PROVIDER_EXAMS = {
  aws: ['CLF-C02', 'SAA-C03', 'SCS-C02', 'SCS-C03', 'SCS-C03 補充', 'SOA-C02', 'SOA-C03', 'DEA-C01', 'AIP-C01', 'MLA-C01'],
  gcp: ['PCA', 'GCP-CDL'],
  azure: ['AZ-900', 'AZ-104'],
}

// Shown instead of the subject picker while a previous session is being put
// back together, so a reload the user never asked for (discarded mobile tab,
// auto-update) reads as "resuming" rather than "everything reset".
function ResumeSplash({ loadProgress }) {
  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="bg-gray-800/90 backdrop-blur rounded-2xl shadow-2xl px-8 py-10 max-w-sm w-full border border-gray-700/80 flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-orange-400" />
        <span className="text-sm text-gray-200">正在接回上次的練習…</span>
        {loadProgress && (
          <div className="w-56 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-200"
              style={{ width: `${loadProgress.total ? Math.round((loadProgress.done / loadProgress.total) * 100) : 0}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SubjectSelect({ examTypes, questions, bankIndex, loading, loadProgress, onSelect, dueCount = 0, onStartDue, studyPlan, onStartPlan, dailyMissions, onClaimMissions }) {
  const [provider, setProvider] = useState('aws')
  const counts = useMemo(() => {
    const m = {}
    questions.forEach(q => { m[q.exam] = (m[q.exam] || 0) + 1 })
    // Lazy mode: counts come from the build-generated index before any
    // questions are actually downloaded.
    if (bankIndex?.exams) {
      for (const [exam, info] of Object.entries(bankIndex.exams)) {
        if (!m[exam]) m[exam] = info.count
      }
    }
    return m
  }, [questions, bankIndex])
  const availableExams = useMemo(
    () => new Set([...examTypes, ...Object.keys(bankIndex?.exams || {})]),
    [examTypes, bankIndex]
  )
  const isLoadingSubject = !!loadProgress
  const providerCfg = CLOUD_PROVIDERS.find(p => p.key === provider) || CLOUD_PROVIDERS[0]
  const logoSrc = providerCfg.logo
  const accent = PROVIDER_ACCENTS[providerCfg.accent]
  // 可點選的是題庫實際有題目的科別；已登記但題庫還沒到的另外標示
  const providerExamCodes = PROVIDER_EXAMS[provider] || []
  const visibleExams = providerExamCodes.filter(code => availableExams.has(code))
  const pendingExams = providerExamCodes.filter(code => !availableExams.has(code))
  const providerTotal = visibleExams.reduce((sum, code) => sum + (counts[code] || 0), 0)
  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="bg-gray-800/90 backdrop-blur rounded-2xl shadow-2xl p-8 max-w-2xl w-full border border-gray-700/80">
        <div className="flex justify-center mb-4 h-14">
          <img src={logoSrc} alt={provider.toUpperCase()} className="h-14 object-contain" />
        </div>
        <h2 className="text-xl font-semibold text-white text-center mb-1 tracking-tight">請選擇練習科別</h2>
        <p className="text-gray-400 text-sm text-center mb-6">選擇後將直接進入該科別的題目</p>

        {studyPlan?.focusExam && (
          <div className="mb-5 rounded-2xl border border-orange-400/50 bg-gradient-to-br from-orange-500/20 to-amber-500/5 p-5 text-left shadow-lg shadow-orange-950/20">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 text-orange-200 font-bold"><Sparkles size={17} /> 今日學習計畫</div>
                <p className="text-xs text-gray-300 mt-1">{studyPlan.reason}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-orange-100">約 {studyPlan.minutes} 分鐘</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-gray-900/35 px-3 py-2 text-center"><div className="text-lg font-extrabold text-white">{studyPlan.targetCount}</div><div className="text-[10px] text-gray-400">今日題數</div></div>
              <div className="rounded-xl bg-gray-900/35 px-3 py-2 text-center"><div className="text-lg font-extrabold text-orange-300">{studyPlan.reviewCount}</div><div className="text-[10px] text-gray-400">到期複習</div></div>
              <div className="rounded-xl bg-gray-900/35 px-3 py-2 text-center"><div className="text-lg font-extrabold text-blue-300">{studyPlan.practiceCount}</div><div className="text-[10px] text-gray-400">弱項練習</div></div>
            </div>
            <button
              onClick={onStartPlan}
              disabled={isLoadingSubject}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play size={16} fill="currentColor" /> 開始今日計畫 · {displayExam(studyPlan.focusExam)}
            </button>
            <p className="text-[10px] text-gray-500 text-center mt-2">今日已完成 {studyPlan.answeredToday}/{studyPlan.dailyGoal} 題</p>
          </div>
        )}

        {dailyMissions && (
          <DailyMissionsCard missions={dailyMissions} onClaim={onClaimMissions} />
        )}

        {dueCount > 0 && (
          <button
            onClick={onStartDue}
            disabled={isLoadingSubject}
            className="w-full mb-5 px-4 py-3.5 rounded-xl bg-orange-500/15 border border-orange-400/50 text-orange-100 hover:bg-orange-500/25 transition-colors flex items-center justify-between disabled:opacity-50"
          >
            <span className="flex items-center gap-2 font-semibold"><Repeat size={17} /> 全部到期錯題</span>
            <span className="text-sm bg-orange-500/25 px-2.5 py-1 rounded-lg">{dueCount} 題 · 專注複習</span>
          </button>
        )}

        {/* Cloud provider tabs */}
        <div className="flex gap-1 bg-gray-900/60 rounded-xl p-1 mb-6 border border-gray-700/60">
          {CLOUD_PROVIDERS.map(p => (
            <button
              key={p.key}
              onClick={() => setProvider(p.key)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                provider === p.key
                  ? PROVIDER_ACCENTS[p.accent].tab
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoadingSubject ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 size={32} className="animate-spin text-orange-400" />
            <span className="text-sm text-gray-300">題庫下載中… {loadProgress.done} / {loadProgress.total}</span>
            <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-200"
                style={{ width: `${loadProgress.total ? Math.round((loadProgress.done / loadProgress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-sm">題庫載入中...</span>
          </div>
        ) : visibleExams.length + pendingExams.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleExams.map(exam => (
                <button
                  key={exam}
                  onClick={() => onSelect(exam)}
                  className={`flex items-center justify-between px-4 py-4 rounded-xl bg-gray-700/60 ${accent.hoverBg} border border-gray-600 ${accent.hoverBorder} text-left transition-all duration-200 group`}
                >
                  <span className={`font-semibold text-white ${accent.hoverText}`}>{displayExam(exam)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-lg bg-gray-600 text-gray-300 ${accent.badgeHoverBg} ${accent.badgeHoverText}`}>{counts[exam] || 0} 題</span>
                </button>
              ))}
              {pendingExams.map(exam => (
                <div
                  key={exam}
                  className="flex items-center justify-between px-4 py-4 rounded-xl bg-gray-800/40 border border-dashed border-gray-600/70 text-left cursor-not-allowed"
                  title="題庫尚未匯入"
                >
                  <span className="font-semibold text-gray-400">{displayExam(exam)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-gray-700/80 text-gray-400">題庫準備中</span>
                </div>
              ))}
            </div>
            {visibleExams.length > 1 && (
              <button
                onClick={() => onSelect('')}
                className="w-full mt-4 py-3.5 rounded-xl bg-white/5 border border-gray-500/70 text-gray-100 font-semibold text-sm hover:bg-orange-500/15 hover:border-orange-400 hover:text-orange-200 transition-colors flex items-center justify-center gap-2"
              >
                <Shuffle size={15} />
                全部科別混合練習（{providerTotal} 題）
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-gray-400 border border-dashed border-gray-700 rounded-xl bg-gray-900/40">
            <img src={logoSrc} alt={providerCfg.label} className="h-16 object-contain opacity-90" />
            <p className="text-base font-semibold text-gray-200">{providerCfg.label} 題庫即將推出</p>
            <p className="text-xs text-gray-500 text-center max-w-xs">{providerCfg.label} 認證相關題目正在準備中，敬請期待。</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Shared gamification facts — derived from state, used both for the App-level
// achievement toasts and the stats page. Keeping it in one place stops the two
// from disagreeing about what's unlocked.
function computeGamifyFacts(state, examTypes, combinedDaily) {
  const history = state.statsHistory || {}
  const entries = Object.entries(history)
  const totalAnswered = entries.length
  const totalCorrect = entries.filter(([, v]) => v.correct).length
  const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const examStats = {}
  for (const [, v] of entries) {
    if (!examStats[v.exam]) examStats[v.exam] = { total: 0, correct: 0, everWrong: 0, mastered: 0 }
    const s = examStats[v.exam]
    s.total++
    if (v.correct) s.correct++
    const ew = v.everWrong ?? !v.correct
    const cc = v.correctCount ?? v.correctStreak ?? 0
    if (ew) { s.everWrong++; if (cc >= MASTERY_THRESHOLD) s.mastered++ }
  }
  const masteredCount = entries.filter(([, v]) => (v.everWrong ?? !v.correct) && (v.correctCount ?? v.correctStreak ?? 0) >= MASTERY_THRESHOLD).length

  let bestAcc100 = 0, maxAnswered = 0, expert = false
  for (const s of Object.values(examStats)) {
    maxAnswered = Math.max(maxAnswered, s.total)
    if (s.total >= 100) {
      const acc = Math.round((s.correct / s.total) * 100)
      bestAcc100 = Math.max(bestAcc100, acc)
      if (acc >= 90) expert = true
    }
  }

  const streak = computeStreak(combinedDaily)
  const totalStudySec = Object.values(combinedDaily).reduce((s, v) => s + (v?.seconds || 0), 0)

  const goal = state.dailyGoal || 20
  const days = Object.keys(combinedDaily).sort()
  let goalDays = 0, maxDay = 0, run = 0, bestRun = 0, prev = null
  const oneDay = 86400000
  for (const d of days) {
    const a = combinedDaily[d]?.answered || 0
    maxDay = Math.max(maxDay, a)
    if (a >= goal) {
      goalDays++
      const t = new Date(d).getTime()
      run = (prev !== null && t - prev === oneDay) ? run + 1 : 1
      bestRun = Math.max(bestRun, run)
      prev = t
    } else { run = 0; prev = null }
  }

  const h = state.examHistory || []
  let bestPct = 0, passStreak = 0, cur = 0
  for (const e of h) {
    bestPct = Math.max(bestPct, e.pct || 0)
    if (e.passed) { cur++; passStreak = Math.max(passStreak, cur) } else cur = 0
  }

  const xp = computeXP(history) + (state.bonusXp || 0)
  const glevel = levelInfo(xp)

  return {
    answered: totalAnswered, correct: totalCorrect, accuracy: overallAccuracy,
    mastered: masteredCount, examsTouched: Object.keys(examStats).length, examsTotal: examTypes.length,
    bookmarks: Object.values(state.bookmarked || {}).filter(Boolean).length,
    streak, studyHours: totalStudySec / 3600, bestCombo: state.bestCombo,
    level: glevel.level, xp,
    expertExam: expert, bestExamAcc100: bestAcc100, maxExamAnswered: maxAnswered,
    goalDays, goalStreak: bestRun, maxDayAnswered: maxDay, dailyGoal: goal,
    examCount: h.length, examBestPct: bestPct, examPassStreak: passStreak,
    flags: state.flags || {},
    // extras (not achievement facts, but handy for the stats cards)
    _examStats: examStats, _totalStudySec: totalStudySec, _glevel: glevel,
    _totalAnswered: totalAnswered, _totalCorrect: totalCorrect, _overallAccuracy: overallAccuracy, _masteredCount: masteredCount,
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [subjectChosen, setSubjectChosen] = useState(false)
  // A snapshot from a previous page load means this boot is a *resume*, not a
  // fresh start: hold back the subject picker until the session is rebuilt, so
  // a discarded mobile tab (or an auto-update reload) doesn't dump the user
  // back at the main screen. Read once — later writes must not re-trigger it.
  const [restoring, setRestoring] = useState(() => !isAdmin && !!loadSession())
  const [user, setUser] = useState(null)
  const [planToday] = useState(todayKey)
  const [planNow] = useState(Date.now)
  const [state, dispatch] = useReducer(reducer, initialState)
  const fileInputRef = useRef(null)
  const { signOut, authReady } = useGoogleSync(state, dispatch, user, setUser)

  // Tell the SW-update coordinator whether a live exam is in progress, so a
  // pending auto-reload (new deploy) waits until the exam ends instead of
  // dropping it mid-attempt (see swUpdate.js).
  useEffect(() => { markExamActive(state.examActive) }, [state.examActive])

  // ── Lazy question-bank loading ──
  // bankIndex (build-generated) maps exam → { count, files, enFiles } so the
  // subject picker can show counts instantly and we only download the chosen
  // subject's files up front; everything else streams in the background.
  const [bankIndex, setBankIndex] = useState(null)
  const [loadProgress, setLoadProgress] = useState(null) // { done, total } | null
  const loadedFilesRef = useRef(new Set())
  const backgroundStartedRef = useRef(false)

  // Files not yet fetched, de-duped against everything already requested.
  const takeUnloaded = (files) => {
    const fresh = files.filter(f => !loadedFilesRef.current.has(f))
    fresh.forEach(f => loadedFilesRef.current.add(f))
    return fresh
  }

  // Stream the rest of the bank (all exams' ZH+EN) after the user is in.
  const startBackgroundLoad = (index) => {
    if (backgroundStartedRef.current || !index?.exams) return
    backgroundStartedRef.current = true
    const zhAll = [...new Set(Object.values(index.exams).flatMap(e => e.files))]
    const enAll = [...new Set(Object.values(index.exams).flatMap(e => e.enFiles))]
    ;(async () => {
      const zhRest = takeUnloaded(zhAll)
      if (zhRest.length) {
        const qs = await loadBankFiles(zhRest)
        if (qs.length) dispatch({ type: 'APPEND_QUESTIONS', questions: qs })
      }
      const enRest = takeUnloaded(enAll)
      if (enRest.length) {
        const qs = await loadBankFiles(enRest)
        if (qs.length) dispatch({ type: 'LOAD_EN_QUESTIONS', questions: qs })
      }
    })()
  }

  // Boot: fetch the bank index (tiny). Admin mode — or a missing index —
  // falls back to loading the whole bank up front (in parallel).
  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      let index = null
      try { index = await fetchDataJson('bank-index.json') } catch { /* fallback below */ }
      if (cancelled) return
      if (index?.exams && !isAdmin) {
        setBankIndex(index)
        dispatch({ type: 'SET_QUESTIONS_LOADING', value: false })
        return // questions load when a subject is picked
      }
      try {
        const manifest = await fetchDataJson('manifest.json')
        const files = manifest.files || []
        setLoadProgress({ done: 0, total: files.length })
        takeUnloaded(files)
        const qs = await loadBankFiles(files, (done, total) => { if (!cancelled) setLoadProgress({ done, total }) })
        if (cancelled) return
        if (qs.length) dispatch({ type: 'LOAD_QUESTIONS', questions: qs, filename: '靜態題庫' })
        else dispatch({ type: 'SET_QUESTIONS_LOADING', value: false })
        setLoadProgress(null)
        const enFiles = takeUnloaded(manifest.enFiles || [])
        const enQs = await loadBankFiles(enFiles)
        if (!cancelled && enQs.length) dispatch({ type: 'LOAD_EN_QUESTIONS', questions: enQs })
      } catch (err) {
        console.error('載入題庫失敗:', err)
        if (!cancelled) {
          dispatch({ type: 'SET_QUESTIONS_LOADING', value: false })
          setLoadProgress(null)
        }
      }
    }
    boot()
    return () => { cancelled = true }
  }, [])

  // Subject picked: load just that subject's files (with progress), enter,
  // then stream its EN files and the rest of the bank in the background.
  const handleSelectSubject = async (exam, session = null) => {
    if (loadProgress) return // a load is already in flight
    let loadedNow = []
    const sessionKeys = session?.keys || null
    if (bankIndex?.exams) {
      const info = exam ? bankIndex.exams[exam] : null
      const reviewExams = sessionKeys
        ? new Set(sessionKeys.map(k => state.statsHistory[k]?.exam).filter(Boolean))
        : null
      if (session?.focusExam) reviewExams?.add(session.focusExam)
      const reviewInfos = reviewExams
        ? [...reviewExams].map(code => bankIndex.exams[code]).filter(Boolean)
        : null
      const zhWanted = reviewInfos
        ? [...new Set(reviewInfos.flatMap(e => e.files))]
        : info ? info.files : [...new Set(Object.values(bankIndex.exams).flatMap(e => e.files))]
      const enWanted = reviewInfos
        ? [...new Set(reviewInfos.flatMap(e => e.enFiles))]
        : info ? info.enFiles : [...new Set(Object.values(bankIndex.exams).flatMap(e => e.enFiles))]
      const zhFiles = takeUnloaded(zhWanted)
      if (zhFiles.length) {
        setLoadProgress({ done: 0, total: zhFiles.length })
        const qs = await loadBankFiles(zhFiles, (done, total) => setLoadProgress({ done, total }))
        setLoadProgress(null)
        if (!qs.length) {
          // Whole load failed (offline?) — release the files so retry works.
          zhFiles.forEach(f => loadedFilesRef.current.delete(f))
          alert('題庫載入失敗，請檢查網路後再試一次。')
          return
        }
        loadedNow = qs
        dispatch({ type: 'APPEND_QUESTIONS', questions: qs })
      }
      ;(async () => {
        const enFiles = takeUnloaded(enWanted)
        if (enFiles.length) {
          const qs = await loadBankFiles(enFiles)
          if (qs.length) dispatch({ type: 'LOAD_EN_QUESTIONS', questions: qs })
        }
        startBackgroundLoad(bankIndex)
      })()
    }
    dispatch({ type: 'SELECT_SUBJECT', exam })
    if (session) {
      const merged = new Map()
      ;[...state.questions, ...loadedNow].forEach(q => merged.set(`${q.exam}-${q.id}`, q))
      const selected = new Set()
      const pool = (sessionKeys || []).map(k => merged.get(k)).filter(Boolean)
      pool.forEach(q => selected.add(`${q.exam}-${q.id}`))
      const score = (q) => {
        const entry = state.statsHistory[`${q.exam}-${q.id}`]
        if (!entry) return 1
        if ((entry.everWrong ?? !entry.correct) && (entry.correctCount || 0) < MASTERY_THRESHOLD) return 0
        return 2
      }
      const focusCandidates = [...merged.values()]
        .filter(q => (!session.focusExam || q.exam === session.focusExam) && !selected.has(`${q.exam}-${q.id}`))
        .sort((a, b) => score(a) - score(b))
      const targetCount = session.targetCount || pool.length
      for (const q of focusCandidates) {
        if (pool.length >= targetCount) break
        pool.push(q)
      }
      if (pool.length) dispatch({ type: 'GOTO_PRACTICE_QUESTION', questions: pool, startIndex: 0 })
    }
    setSubjectChosen(true)
  }

  // Restore user progress (stats/bookmarks/reviews/daily/prefs) via the storage adapter.
  useEffect(() => {
    const { statsHistory, bookmarked, reviewMarked, dailyStats, prefs } = loadLocalProgress()
    if (Object.keys(statsHistory).length) dispatch({ type: 'RESTORE_STATS', statsHistory })
    if (Object.keys(bookmarked).length) dispatch({ type: 'RESTORE_BOOKMARKS', bookmarked })
    if (Object.keys(reviewMarked).length) dispatch({ type: 'RESTORE_REVIEWS', reviewMarked })
    if (Object.keys(dailyStats).length) dispatch({ type: 'RESTORE_DAILY', dailyStats })
    if (prefs?.dailyGoal) dispatch({ type: 'SET_DAILY_GOAL', goal: prefs.dailyGoal })
    if (prefs?.bestCombo) dispatch({ type: 'RESTORE_BEST_COMBO', bestCombo: prefs.bestCombo })
    if (prefs?.examHistory?.length || prefs?.flags || prefs?.bonusXp || prefs?.examDates || prefs?.earnedCertifications || prefs?.missionRewards) {
      dispatch({ type: 'RESTORE_GAMIFY', examHistory: prefs.examHistory, flags: prefs.flags, bonusXp: prefs.bonusXp, examDates: prefs.examDates, earnedCertifications: prefs.earnedCertifications, missionRewards: prefs.missionRewards })
    }
  }, [])

  useEffect(() => {
    if (
      !Object.keys(state.statsHistory).length &&
      !Object.keys(state.bookmarked).length &&
      !Object.keys(state.dailyStats).length &&
      !Object.keys(state.earnedCertifications).length
    ) return
    saveLocalProgress({
      statsHistory: state.statsHistory,
      bookmarked: state.bookmarked,
      reviewMarked: state.reviewMarked,
      dailyStats: state.dailyStats,
      prefs: { dailyGoal: state.dailyGoal, bestCombo: state.bestCombo, examHistory: state.examHistory, flags: state.flags, bonusXp: state.bonusXp, examDates: state.examDates, earnedCertifications: state.earnedCertifications, missionRewards: state.missionRewards },
    })
  }, [state.statsHistory, state.bookmarked, state.reviewMarked, state.dailyStats, state.dailyGoal, state.bestCombo, state.examHistory, state.flags, state.bonusXp, state.examDates, state.earnedCertifications, state.missionRewards])

  // 記住目前練習位置（依科別），下次選同科別直接續刷
  useEffect(() => {
    const q = state.practiceFiltered[state.practiceIndex]
    if (!q) return
    try {
      const saved = JSON.parse(localStorage.getItem('quest-resume') || '{}')
      saved[state.filterExam || '__all__'] = `${q.exam}-${q.id}`
      localStorage.setItem('quest-resume', JSON.stringify(saved))
    } catch { /* ignore */ }
  }, [state.practiceIndex, state.practiceFiltered, state.filterExam])

  // 把整個練習工作階段存起來，讓「重新載入」變成看不見的事
  // （手機鎖屏後分頁被系統回收、或新版本自動更新，都會讓頁面整個重載）。
  // 還原中先不要寫入，否則空的 practiceFiltered 會蓋掉待還原的快照。
  useEffect(() => {
    if (restoring || !subjectChosen) return
    if (!state.practiceFiltered.length) return
    saveSession({
      exam: state.filterExam,
      filterType: state.filterType,
      filterSearch: state.filterSearch,
      activeTab: state.activeTab,
      index: state.practiceIndex,
      questions: state.practiceFiltered,
      answers: state.practiceAnswers,
      submitted: state.practiceSubmitted,
      results: state.practiceResults,
    })
  }, [restoring, subjectChosen, state.practiceFiltered, state.practiceIndex, state.practiceAnswers,
      state.practiceSubmitted, state.practiceResults, state.filterExam, state.filterType,
      state.filterSearch, state.activeTab])

  // 開機還原：把上次的練習工作階段接回來，跳過選科畫面。
  useEffect(() => {
    if (!restoring) return
    if (state.questionsLoading) return // 等 boot 決定要走 bankIndex 還是整包載入
    let cancelled = false
    ;(async () => {
      const snap = loadSession()
      if (!snap) { setRestoring(false); return }
      let loadedNow = []
      if (bankIndex?.exams) {
        const infos = (snap.exams || []).map(code => bankIndex.exams[code]).filter(Boolean)
        const zhFiles = takeUnloaded([...new Set(infos.flatMap(e => e.files))])
        if (zhFiles.length) {
          setLoadProgress({ done: 0, total: zhFiles.length })
          loadedNow = await loadBankFiles(zhFiles, (done, total) => {
            if (!cancelled) setLoadProgress({ done, total })
          })
          if (cancelled) return
          setLoadProgress(null)
          if (!loadedNow.length) {
            // 離線或載入失敗：把檔案釋放回去，退回選科畫面讓使用者自己重試。
            zhFiles.forEach(f => loadedFilesRef.current.delete(f))
            setRestoring(false)
            return
          }
          dispatch({ type: 'APPEND_QUESTIONS', questions: loadedNow })
        }
        ;(async () => {
          const enFiles = takeUnloaded([...new Set(infos.flatMap(e => e.enFiles))])
          if (enFiles.length) {
            const qs = await loadBankFiles(enFiles)
            if (qs.length) dispatch({ type: 'LOAD_EN_QUESTIONS', questions: qs })
          }
          startBackgroundLoad(bankIndex)
        })()
      }
      if (cancelled) return
      dispatch({ type: 'RESTORE_SESSION', snap, loaded: loadedNow })
      setSubjectChosen(true)
      setRestoring(false)
    })()
    return () => { cancelled = true }
    // 這個 effect 只該由「還原旗標／題庫索引就緒」驅動；把每次 render 都會重建的
    // helper 列進相依會讓還原重跑一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoring, bankIndex, state.questionsLoading])

  // RESTORE_SESSION 會在題目對不起來時原地不動（少了題目就不還原）。
  // 這時 practiceFiltered 仍是空的，代表還原失敗，把快照丟掉回選科畫面。
  useEffect(() => {
    if (restoring || !subjectChosen) return
    if (!state.practiceFiltered.length) { clearSession(); setSubjectChosen(false) }
  }, [restoring, subjectChosen, state.practiceFiltered.length])

  // 練習中就別讓新版本把頁面抽掉；等切到背景再套用（見 swUpdate.js）。
  useEffect(() => {
    markPracticeActive(subjectChosen && state.practiceFiltered.length > 0)
  }, [subjectChosen, state.practiceFiltered.length])

  // ── 學習時數計時器 ──
  // 每 30 秒檢查一次：分頁可見、且最近 2 分鐘內有任何操作（點擊/按鍵/捲動/觸控）
  // 才累加 30 秒 —— 掛網發呆或切去別的分頁都不會計入。
  useEffect(() => {
    if (!authenticated) return
    let lastActivity = Date.now()
    const bump = () => { lastActivity = Date.now() }
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, bump, { passive: true }))
    const TICK_SEC = 30
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastActivity > 2 * 60 * 1000) return
      dispatch({ type: 'ADD_STUDY_TIME', seconds: TICK_SEC })
    }, TICK_SEC * 1000)
    return () => {
      events.forEach(e => window.removeEventListener(e, bump))
      clearInterval(interval)
    }
  }, [authenticated])

  // Timer for exam
  useEffect(() => {
    if (!state.examActive || state.examSubmitted) return
    const interval = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' })
      const remaining = Math.max(0, Math.round((state.examEndTime - Date.now()) / 1000))
      if (remaining <= 0) dispatch({ type: 'SUBMIT_EXAM' })
    }, 1000)
    return () => clearInterval(interval)
  }, [state.examActive, state.examSubmitted, state.examEndTime])

  // Derived data
  const examTypes = useMemo(() => [...new Set(state.questions.map(q => q.exam))], [state.questions])
  const excludedExams = useMemo(() => getExcludedExams(state.earnedCertifications), [state.earnedCertifications])
  const dueKeys = useMemo(
    () => Object.entries(state.statsHistory).filter(([, entry]) => isDue(entry) && !excludedExams.has(entry.exam)).map(([key]) => key),
    [state.statsHistory, excludedExams]
  )
  const studyPlan = useMemo(() => buildDailyStudyPlan({
    statsHistory: state.statsHistory,
    dailyStats: state.dailyStats,
    dailyGoal: state.dailyGoal,
    examDates: state.examDates,
    availableExams: Object.keys(bankIndex?.exams || {}),
    excludedExams: [...excludedExams],
    today: planToday,
    now: planNow,
  }), [state.statsHistory, state.dailyStats, state.dailyGoal, state.examDates, excludedExams, bankIndex, planToday, planNow])
  const qMap = useMemo(() => {
    const m = new Map()
    state.questions.forEach(q => m.set(`${q.exam}-${q.id}`, q))
    return m
  }, [state.questions])

  // Gamification: XP/level derived from stats (retroactive) + Fever bonus
  const xp = useMemo(() => computeXP(state.statsHistory) + (state.bonusXp || 0), [state.statsHistory, state.bonusXp])
  const level = useMemo(() => levelInfo(xp), [xp])

  const combinedDaily = useMemo(
    () => combineDaily(state.dailyStats, state.dailyRemote),
    [state.dailyStats, state.dailyRemote]
  )
  const todayMissionStats = combinedDaily[planToday] || {}
  const dailyMissions = {
    answered: todayMissionStats.answered || 0,
    correct: todayMissionStats.correct || 0,
    dailyGoal: state.dailyGoal,
    claimed: !!state.missionRewards[planToday],
  }
  const facts = useMemo(
    () => computeGamifyFacts(state, examTypes, combinedDaily),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.statsHistory, state.bonusXp, state.bestCombo, state.examHistory, state.flags, state.dailyGoal, state.bookmarked, combinedDaily, examTypes]
  )
  const achievements = useMemo(() => evaluateAchievements(facts), [facts])

  // Celebrations are "armed" ~2.5s after mount so the initial restore + first
  // sync merge (which land as one big XP/achievement jump) are absorbed
  // silently instead of firing a phantom level-up / toast flood on load.
  const celebrateArmedRef = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => { celebrateArmedRef.current = true }, 2500)
    return () => clearTimeout(t)
  }, [])

  // ── Level-up celebration (item 10) ──
  // Only a clean +1 after arming is a real level-up (one answer can't cross a
  // 1,500-XP boundary twice); restore/sync jumps just update the ref silently.
  const [levelUp, setLevelUp] = useState(null)
  const prevLevelRef = useRef(null)
  useEffect(() => {
    const lv = level.level
    const prev = prevLevelRef.current
    prevLevelRef.current = lv
    if (!celebrateArmedRef.current || prev == null || lv !== prev + 1) return
    const newTitle = titleForLevel(lv)
    setLevelUp({ level: lv, title: newTitle, isNewTitle: newTitle !== titleForLevel(prev) })
  }, [level.level])

  // ── Achievement unlock toasts (item 11) ──
  // Capped per batch too, so a large post-arm sync merge is absorbed silently.
  const [toasts, setToasts] = useState([])
  const unlockedRef = useRef(null)
  const toastSeq = useRef(0)
  useEffect(() => {
    const done = new Set(achievements.filter(a => a.done).map(a => a.id))
    const prev = unlockedRef.current
    unlockedRef.current = done
    if (!celebrateArmedRef.current || prev == null) return
    const fresh = achievements.filter(a => a.done && !prev.has(a.id))
    if (fresh.length && fresh.length <= 4) {
      setToasts(t => [...t, ...fresh.map(a => ({ ...a, _tid: ++toastSeq.current }))])
    }
  }, [achievements])
  const dismissToast = useCallback((tid) => setToasts(t => t.filter(x => x._tid !== tid)), [])

  const rootClass = state.darkMode ? 'dark' : ''

  if (!authenticated) {
    return <PasswordGate onAuth={() => setAuthenticated(true)} />
  }

  if (!user) {
    return <GoogleAuthGate user={user} authReady={authReady} onSignedIn={setUser} />
  }

  // 上次的練習還在還原中：先別顯示選科畫面，免得閃一下又跳走
  if (restoring && !isAdmin) {
    return <ResumeSplash loadProgress={loadProgress} />
  }

  // 登入後（非管理員）先選擇練習科別，再進入對應題目
  if (!subjectChosen && !isAdmin) {
    return (
      <SubjectSelect
        examTypes={examTypes}
        questions={state.questions}
        bankIndex={bankIndex}
        loading={state.questionsLoading}
        loadProgress={loadProgress}
        onSelect={handleSelectSubject}
        dueCount={dueKeys.length}
        onStartDue={() => handleSelectSubject('', { keys: dueKeys, targetCount: dueKeys.length })}
        studyPlan={studyPlan}
        onStartPlan={() => handleSelectSubject(studyPlan.focusExam, {
          keys: studyPlan.dueKeys,
          focusExam: studyPlan.focusExam,
          targetCount: studyPlan.targetCount,
        })}
        dailyMissions={dailyMissions}
        onClaimMissions={() => dispatch({ type: 'CLAIM_DAILY_MISSIONS', day: planToday })}
      />
    )
  }

  return (
    <div className={rootClass}>
      <div className="min-h-screen app-bg text-gray-900 dark:text-gray-100">
        {/* Header - Glassmorphism */}
        <header className="glass-header bg-aws-dark/95 dark:bg-aws-darker/95 shadow-lg sticky top-0 z-50 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-semibold text-white flex items-center gap-2.5">
                <img src={cloudIcon} alt="雲端證照" className="h-9 md:h-10 rounded-xl" />
                <span className="hidden sm:inline text-orange-400 tracking-tight">雲端證照考試練習器</span>
                <span className="sm:hidden text-orange-400 tracking-tight">考試練習</span>
              </h1>
              <p className="text-[10px] text-gray-600 dark:text-gray-700 ml-1 -mt-0.5 hidden sm:block">僅供練習使用，如有相同處，純屬巧合</p>
            </div>
            <div className="flex items-center gap-1">
              {/* Nav tabs - desktop */}
              <nav className="hidden md:flex gap-0.5 bg-white/5 rounded-xl p-1">
                {[
                  ...(isAdmin ? [{ key: 'upload', label: '管理題庫', icon: Shield }] : []),
                  { key: 'practice', label: '練習模式', icon: BookOpen },
                  { key: 'exam', label: '模擬考試', icon: Clock },
                  { key: 'stats', label: '統計分析', icon: BarChart3 },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => dispatch({ type: 'SET_TAB', tab: t.key })}
                    className={`tab-indicator px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all duration-200 ${
                      state.activeTab === t.key
                        ? 'active bg-white/10 text-orange-400 shadow-sm'
                        : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <t.icon size={16} />
                    {t.label}
                  </button>
                ))}
              </nav>
              <div className="w-px h-6 bg-white/10 mx-1 hidden md:block" />
              <LevelBadge level={level} onClick={() => dispatch({ type: 'SET_TAB', tab: 'stats' })} />
              <SyncStatusPill user={user} onSignedIn={setUser} onSignOut={signOut} />
              <button
                onClick={() => dispatch({ type: 'TOGGLE_DARK' })}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-orange-400 transition-all duration-200"
                title={state.darkMode ? '切換淺色模式' : '切換深色模式'}
              >
                <span key={state.darkMode ? 'sun' : 'moon'} className="block animate-rotate-in">
                  {state.darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </span>
              </button>
            </div>
          </div>
          {/* Nav tabs - mobile */}
          <nav className="flex md:hidden border-t border-white/5">
            {[
              ...(isAdmin ? [{ key: 'upload', label: '管理', icon: Shield }] : []),
              { key: 'practice', label: '練習', icon: BookOpen },
              { key: 'exam', label: '模擬考', icon: Clock },
              { key: 'stats', label: '統計', icon: BarChart3 },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => dispatch({ type: 'SET_TAB', tab: t.key })}
                className={`flex-1 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition-all duration-200 relative ${
                  state.activeTab === t.key
                    ? 'text-orange-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <t.icon size={18} className={state.activeTab === t.key ? 'scale-110' : ''} style={{ transition: 'transform 200ms' }} />
                {t.label}
                {state.activeTab === t.key && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-orange-400 rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-fade-in" key={state.activeTab}>
            <ErrorBoundary resetKey={state.activeTab}>
              {state.activeTab === 'upload' && isAdmin && <UploadTab state={state} dispatch={dispatch} fileInputRef={fileInputRef} examTypes={examTypes} />}
              {state.activeTab === 'practice' && <PracticeTab state={state} dispatch={dispatch} examTypes={examTypes} qMap={qMap} />}
              {state.activeTab === 'exam' && <ExamTab state={state} dispatch={dispatch} examTypes={examTypes} qMap={qMap} />}
              {state.activeTab === 'stats' && <StatsTab state={state} dispatch={dispatch} examTypes={examTypes} qMap={qMap} user={user} setUser={setUser} bankIndex={bankIndex} facts={facts} achievements={achievements} combinedDaily={combinedDaily} />}
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <AchievementToasts toasts={toasts} onDismiss={dismissToast} />
      {levelUp && <LevelUpModal info={levelUp} onClose={() => setLevelUp(null)} />}
    </div>
  )
}

// ══════════════════════════════════════════
// Upload Tab
// ══════════════════════════════════════════
function UploadTab({ state, dispatch, fileInputRef, examTypes }) {
  const [token, setToken] = useState(() => localStorage.getItem('quest-github-token') || '')
  const [showToken, setShowToken] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(() => !!localStorage.getItem('quest-github-token'))

  const saveToken = () => {
    if (token.trim()) {
      localStorage.setItem('quest-github-token', token.trim())
      setTokenSaved(true)
      // Reload from GitHub
      reloadFromGitHub(token.trim())
    }
  }

  const clearToken = () => {
    localStorage.removeItem('quest-github-token')
    setToken('')
    setTokenSaved(false)
    dispatch({ type: 'SET_GITHUB_BANKS', banks: [] })
  }

  const reloadFromGitHub = async (t) => {
    const tk = t || localStorage.getItem('quest-github-token')
    if (!tk) return
    dispatch({ type: 'SET_GITHUB_LOADING', value: true })
    dispatch({ type: 'SET_GITHUB_ERROR', error: null })
    try {
      const { questions, banks } = await loadQuestionsFromGitHub(tk)
      dispatch({ type: 'SET_GITHUB_BANKS', banks })
      if (questions.length) {
        dispatch({ type: 'LOAD_QUESTIONS', questions, filename: 'GitHub 題庫' })
      }
    } catch (err) {
      dispatch({ type: 'SET_GITHUB_ERROR', error: err.message })
    } finally {
      dispatch({ type: 'SET_GITHUB_LOADING', value: false })
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const tk = localStorage.getItem('quest-github-token')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const rawText = ev.target.result
        const data = JSON.parse(rawText)
        const questions = Array.isArray(data) ? data : (data.questions || [])
        if (!questions.length) { alert('找不到有效的題目資料'); return }

        // Load locally first
        dispatch({ type: 'LOAD_QUESTIONS', questions, filename: file.name })

        // Upload to GitHub if token exists
        if (tk) {
          dispatch({ type: 'SET_GITHUB_SYNCING', value: true })
          dispatch({ type: 'SET_GITHUB_ERROR', error: null })
          try {
            // Check if file already exists to get sha
            let sha = null
            try {
              const existing = await githubApiFetch(`${DATA_PATH}/${file.name}`, tk)
              sha = existing.sha
            } catch { /* file doesn't exist yet */ }
            await githubPutFile(`${DATA_PATH}/${file.name}`, rawText, tk, sha)
            await reloadFromGitHub(tk)
          } catch (err) {
            dispatch({ type: 'SET_GITHUB_ERROR', error: `上傳 GitHub 失敗: ${err.message}` })
          } finally {
            dispatch({ type: 'SET_GITHUB_SYNCING', value: false })
          }
        }
      } catch {
        alert('JSON 解析失敗，請確認檔案格式正確')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleDeleteBank = async (bank) => {
    if (!confirm(`確定要刪除 ${bank.name} 嗎？`)) return
    const tk = localStorage.getItem('quest-github-token')
    if (!tk) return
    dispatch({ type: 'SET_GITHUB_SYNCING', value: true })
    try {
      await githubDeleteFile(`${DATA_PATH}/${bank.name}`, tk, bank.sha)
      await reloadFromGitHub(tk)
      // Reset local questions and reload
      dispatch({ type: 'CLEAR_ALL_DATA' })
      await reloadFromGitHub(tk)
    } catch (err) {
      dispatch({ type: 'SET_GITHUB_ERROR', error: `刪除失敗: ${err.message}` })
    } finally {
      dispatch({ type: 'SET_GITHUB_SYNCING', value: false })
    }
  }

  const stats = useMemo(() => {
    const byExam = {}
    const byType = {}
    state.questions.forEach(q => {
      byExam[q.exam] = (byExam[q.exam] || 0) + 1
      byType[q.type] = (byType[q.type] || 0) + 1
    })
    const ranges = {}
    state.questions.forEach(q => {
      if (!ranges[q.exam]) ranges[q.exam] = { min: q.id, max: q.id }
      ranges[q.exam].min = Math.min(ranges[q.exam].min, q.id)
      ranges[q.exam].max = Math.max(ranges[q.exam].max, q.id)
    })
    return { byExam, byType, ranges }
  }, [state.questions])

  return (
    <div className="space-y-6">
      {/* GitHub Token Config */}
      <div className="surface-card p-6 card-hover">
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
            <Github size={18} className="text-gray-700 dark:text-gray-300" />
          </div>
          GitHub 連結設定
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-10">
          設定 GitHub Token 後，上傳的題庫會自動存到 GitHub，任何裝置開啟都能使用
        </p>
        {tokenSaved ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">GitHub Token 已設定</span>
            </div>
            <button
              onClick={() => reloadFromGitHub()}
              disabled={state.githubLoading}
              className="p-2.5 rounded-xl text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-200 disabled:opacity-50"
              title="重新同步"
            >
              <RefreshCw size={18} className={state.githubLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={clearToken}
              className="p-2.5 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
              title="移除 Token"
            >
              <XCircle size={18} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={saveToken}
                disabled={!token.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow"
              >
                儲存
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              需要 repo 的讀寫權限。前往 GitHub → Settings → Developer settings → Personal access tokens 建立
            </p>
          </div>
        )}
        {state.githubError && (
          <div className="mt-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-fade-in">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={14} />
              {state.githubError}
            </p>
          </div>
        )}
      </div>

      {/* GitHub stored banks */}
      {tokenSaved && state.githubBanks.length > 0 && (
        <div className="surface-card p-6 card-hover">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30">
              <Database size={18} className="text-orange-500" />
            </div>
            GitHub 題庫檔案
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.githubBanks.map((bank, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 bg-gray-50/50 dark:bg-gray-750 transition-all duration-200 group">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <FileJson size={16} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{bank.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{bank.count} 題</p>
                </div>
                <button
                  onClick={() => handleDeleteBank(bank)}
                  disabled={state.githubSyncing}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="從 GitHub 刪除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload area - with dashed border */}
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-600 p-10 text-center transition-all duration-300 cursor-pointer group"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <Upload size={36} className="text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">上傳 JSON 題庫</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {tokenSaved ? '上傳後自動存到 GitHub，所有裝置都能使用' : '點擊選擇檔案或設定 GitHub Token 永久保存'}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
            disabled={state.githubSyncing}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-orange-300 disabled:to-orange-300 text-white rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            {state.githubSyncing ? (
              <><RefreshCw size={18} className="animate-spin" /> 同步中...</>
            ) : (
              <><Upload size={18} /> 選擇 JSON 檔案</>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      {state.questions.length > 0 && (
        <div className="surface-card p-6">
          <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/30">
              <CheckCircle size={18} className="text-green-500" />
            </div>
            題庫統計
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="總題數" value={state.questions.length} icon={Database} />
            <StatCard label="科別數" value={examTypes.length} icon={ListChecks} />
            <StatCard label="上傳次數" value={state.uploadHistory.length} icon={Upload} />
            <StatCard label="題型數" value={Object.keys(stats.byType).length} icon={Shuffle} />
          </div>

          {/* By exam */}
          <h4 className="font-medium mb-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Target size={14} />
            各科別統計
          </h4>
          <div className="overflow-x-auto mb-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600 dark:text-gray-400">科別</th>
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600 dark:text-gray-400">題數</th>
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600 dark:text-gray-400">題號範圍</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byExam).map(([exam, count]) => (
                  <tr key={exam} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-750/50 transition-colors">
                    <td className="py-2.5 px-4 font-medium">{displayExam(exam)}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-2">
                        {count}
                        <span className="inline-block h-1.5 rounded-full bg-orange-400" style={{ width: `${Math.min(count / 2, 60)}px` }} />
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400">{stats.ranges[exam]?.min} ~ {stats.ranges[exam]?.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By type */}
          <h4 className="font-medium mb-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Shuffle size={14} />
            各題型統計
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byType).map(([type, count]) => (
              <span key={type} className="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600">
                {typeLabels[type] || type}: <span className="text-orange-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Upload history */}
      {state.uploadHistory.length > 0 && (
        <div className="surface-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
              <Clock size={18} className="text-gray-500" />
            </div>
            上傳紀錄
          </h3>
          <div className="space-y-2">
            {state.uploadHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm p-3 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <FileJson size={14} className="text-orange-500" />
                </div>
                <span className="font-medium truncate">{h.filename}</span>
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{h.count} 題</span>
                <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto shrink-0">
                  {new Date(h.timestamp).toLocaleTimeString('zh-TW')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`stat-card bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200/60 dark:border-gray-700/60 shadow-sm ${onClick ? 'cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 w-full' : ''}`}
      title={onClick ? '點擊查看清單' : undefined}
    >
      {Icon && (
        <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-100 dark:ring-orange-500/20">
          <Icon size={18} className="text-orange-500 dark:text-orange-400" />
        </div>
      )}
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-50 animate-count tnum">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{label}</div>
    </Tag>
  )
}

// 等級徽章（header）：Lv + 名稱 + XP 進度環，點擊跳統計成就頁
function LevelBadge({ level, onClick }) {
  const R = 11, C = 2 * Math.PI * R
  return (
    <button
      onClick={onClick}
      title={`等級 ${level.level} · ${level.name} · ${level.xp} XP${level.isMax ? '（滿級）' : ` · 距下一級 ${level.toNext} XP`}`}
      className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
    >
      <span className="relative w-7 h-7 shrink-0">
        <svg viewBox="0 0 28 28" className="w-7 h-7 -rotate-90">
          <circle cx="14" cy="14" r={R} fill="none" strokeWidth="3" className="stroke-white/15" />
          <circle cx="14" cy="14" r={R} fill="none" strokeWidth="3" strokeLinecap="round"
            stroke="#ff9900" strokeDasharray={C} strokeDashoffset={C * (1 - level.pct)}
            style={{ transition: 'stroke-dashoffset 500ms ease' }} />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-bold text-orange-400 tnum ${level.level >= 100 ? 'text-[8px]' : 'text-[11px]'}`}>{level.level}</span>
      </span>
      <span className="hidden lg:flex flex-col items-start leading-none">
        <span className="text-[11px] font-semibold text-gray-200">{level.name}</span>
        <span className="text-[9px] text-gray-500 tnum">{level.xp} XP</span>
      </span>
    </button>
  )
}

// ══════════════════════════════════════════
// Practice Tab
// ══════════════════════════════════════════
function PracticeTab({ state, dispatch, examTypes }) {
  const { practiceFiltered, practiceIndex, practiceAnswers, practiceSubmitted, practiceResults, bookmarked, reviewMarked } = state
  const currentQRaw = practiceFiltered[practiceIndex]
  const currentQ = getDisplayQuestion(currentQRaw, state.lang, state.questionsEn)
  const qKey = currentQRaw ? `${currentQRaw.exam}-${currentQRaw.id}` : null
  const hasEnVersion = currentQRaw && Object.keys(state.questionsEn).length > 0 && !!state.questionsEn[`${currentQRaw.exam}-${currentQRaw.id}`]
  const isSubmitted = qKey ? (practiceSubmitted[qKey] || state.showAnswers) : false
  const isCorrect = qKey ? (practiceSubmitted[qKey] ? practiceResults[qKey] : undefined) : undefined
  const hasAnswer = qKey
    ? !!practiceAnswers[qKey] && (!Array.isArray(practiceAnswers[qKey]) || practiceAnswers[qKey].length > 0)
    : false
  const canSubmit = !!currentQ && (
    (currentQ.options && Object.keys(currentQ.options).length > 0) ||
    (currentQ.type === 'matching' && currentQ.available_options?.length > 0 && currentQ.matches?.length > 0) ||
    (currentQ.type === 'ordering' && currentQ.available_steps?.length > 0 && currentQ.ordered_steps?.length > 0)
  )

  // Submit the current answer (shared by the button and the Enter hotkey);
  // when already submitted, Enter advances to the next question instead.
  const submitCurrent = () => {
    if (!currentQRaw) return
    if (practiceSubmitted[qKey]) {
      if (practiceIndex < practiceFiltered.length - 1) dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 })
      return
    }
    const ans = practiceAnswers[qKey]
    if (!ans || (Array.isArray(ans) && ans.length === 0)) return
    const correct = computeCorrect(currentQRaw, ans)
    // Light haptic on phones: short tap for correct, double for wrong.
    try { navigator.vibrate?.(correct ? 15 : [20, 40, 20]) } catch { /* unsupported */ }
    dispatch({ type: 'SUBMIT_ANSWER', question: currentQRaw })
    // 答對自動進入下一題（答錯則停留以便查看解析）
    if (correct && practiceIndex < practiceFiltered.length - 1) {
      setTimeout(() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 }), 900)
    }
  }

  useAnswerHotkeys({
    enabled: !!currentQRaw,
    question: currentQ,
    answer: qKey ? practiceAnswers[qKey] : undefined,
    submitted: isSubmitted,
    allowChange: false,
    onAnswer: (ans) => { dispatch({ type: 'SET_ANSWER', qKey, answer: ans }); dispatch({ type: 'SET_FLAG', flag: 'hotkey' }) },
    onPrev: () => { if (practiceIndex > 0) dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex - 1 }) },
    onNext: () => { if (practiceIndex < practiceFiltered.length - 1) dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 }) },
    onEnter: () => { dispatch({ type: 'SET_FLAG', flag: 'hotkey' }); submitCurrent() },
  })

  // 手機左右滑動換題：水平位移夠大且明顯大於垂直，才不干擾捲動
  const touchStartRef = useRef(null)
  const onCardTouchStart = (e) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }
  const onCardTouchEnd = (e) => {
    const s = touchStartRef.current
    touchStartRef.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2) return
    if (dx < 0 && practiceIndex < practiceFiltered.length - 1) { dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 }); dispatch({ type: 'SET_FLAG', flag: 'swipe' }) }
    else if (dx > 0 && practiceIndex > 0) { dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex - 1 }); dispatch({ type: 'SET_FLAG', flag: 'swipe' }) }
  }

  if (state.questions.length === 0) {
    if (state.questionsLoading) {
      return <EmptyState message="題庫載入中..." icon={Loader2} />
    }
    if (isAdmin) {
      return <EmptyState message="請先上傳題庫" icon={Upload} action={() => dispatch({ type: 'SET_TAB', tab: 'upload' })} actionLabel="前往上傳" />
    }
    return <EmptyState message="題庫載入失敗，請重新整理頁面" icon={AlertCircle} />
  }

  if (practiceFiltered.length === 0) {
    return (
      <div className="space-y-6">
        <FilterBar state={state} dispatch={dispatch} examTypes={examTypes} showStart />
        <EmptyState message="沒有符合篩選條件的題目，請調整篩選條件或點擊開始練習" icon={Search} />
      </div>
    )
  }

  // Calculate progress
  const answeredCount = practiceFiltered.filter((q) => practiceSubmitted[`${q.exam}-${q.id}`]).length
  const progressPct = practiceFiltered.length > 0 ? Math.round((answeredCount / practiceFiltered.length) * 100) : 0
  const correctCount = practiceFiltered.filter((q) => practiceResults[`${q.exam}-${q.id}`] === true).length
  const accuracyPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
  const sessionComplete = practiceFiltered.length > 0 && answeredCount === practiceFiltered.length
  const navPageSize = 50
  const navPage = Math.floor(practiceIndex / navPageSize)
  const navPageCount = Math.ceil(practiceFiltered.length / navPageSize)
  const navStart = navPage * navPageSize
  const navQuestions = practiceFiltered.slice(navStart, navStart + navPageSize)

  const accTone = accuracyTone(accuracyPct)
  const chipClass = (active, activeStyle) =>
    `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
      active
        ? activeStyle
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <FilterBar state={state} dispatch={dispatch} examTypes={examTypes} showStart />

      {/* 工具列＋進度（單列緊湊，手機不折行） */}
      <div className="surface-card px-4 py-3">
        <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasEnVersion && (
              <button
                onClick={() => dispatch({ type: 'SET_LANG', lang: state.lang === 'zh' ? 'en' : 'zh' })}
                className={chipClass(state.lang === 'en', 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700')}
                title="切換語言 / Switch Language"
              >
                <Languages size={12} />
                {state.lang === 'en' ? 'EN' : '中文'}
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SHOW_ANSWERS' })}
              className={chipClass(state.showAnswers, 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700')}
              title="顯示/隱藏答案"
            >
              {state.showAnswers ? <Eye size={12} /> : <EyeOff size={12} />}
              {state.showAnswers ? '顯示答案' : '隱藏答案'}
            </button>
            <button
              onClick={() => dispatch({ type: 'SHUFFLE_PRACTICE' })}
              disabled={practiceFiltered.length === 0}
              className={`${chipClass(false, '')} disabled:opacity-40 disabled:cursor-not-allowed`}
              title="隨機打亂題目順序"
            >
              <Shuffle size={12} /> 隨機練習
            </button>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            進度 <span className="font-bold text-gray-800 dark:text-gray-100">{answeredCount}/{practiceFiltered.length}</span>
            {answeredCount > 0 && (
              <> · 答對率 <span className={`font-bold ${accTone.text}`}>{accuracyPct}%</span></>
            )}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="progress-bar h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Question card */}
      {currentQ && (
        <div className="surface-card overflow-hidden animate-fade-in" key={qKey} onTouchStart={onCardTouchStart} onTouchEnd={onCardTouchEnd}>
          {/* Color accent bar based on exam type */}
          <div className="h-0.5 bg-gradient-to-r from-orange-400/70 to-orange-500/70" />

          <div className="p-6 md:p-8">
            {/* Question header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold">{displayExam(currentQ.exam)}</span>
                <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold">{typeLabels[currentQ.type]}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">#{currentQ.id}</span>
                {currentQ.officialNo && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold" title="壓題參考編號">壓題 #{currentQ.officialNo}</span>
                )}
                <span className="text-sm text-gray-400 dark:text-gray-500">({practiceIndex + 1} / {practiceFiltered.length})</span>
                {state.combo >= 2 && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold animate-icon-bounce ${
                      state.combo >= 10
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm'
                        : state.combo >= 5
                          ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    }`}
                    key={state.combo}
                    title="連續答對"
                  >
                    <Flame size={12} fill="currentColor" /> {state.combo} 連對{state.combo >= 10 ? '！' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_BOOKMARK', qKey })}
                  className={`p-2 rounded-xl transition-all duration-200 ${bookmarked[qKey] ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'}`}
                  title="書籤"
                >
                  <Star size={18} fill={bookmarked[qKey] ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_REVIEW', qKey })}
                  className={`p-2 rounded-xl transition-all duration-200 ${reviewMarked[qKey] ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                  title="標記複習"
                >
                  <Flag size={18} fill={reviewMarked[qKey] ? 'currentColor' : 'none'} />
                </button>
                <a
                  href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(`[題目回報] ${currentQ.exam} #${currentQ.id}`)}&body=${encodeURIComponent(`科別：${currentQ.exam}\n題號：${currentQ.id}\n\n問題描述：\n`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                  title="回報題目問題"
                  aria-label="回報題目問題"
                >
                  <AlertCircle size={18} />
                </a>
              </div>
            </div>

            {/* Case study background (collapsible) + Question text */}
            <CaseStudyBox text={currentQ.caseStudy} />
            <p className="text-base md:text-lg leading-relaxed mb-5 whitespace-pre-wrap break-words">{currentQ.question}</p>

            {/* Answer area — 緊貼題目，不被按鈕打斷 */}
            <QuestionInput
              question={currentQ}
              answer={practiceAnswers[qKey]}
              submitted={isSubmitted}
              onAnswer={(ans) => dispatch({ type: 'SET_ANSWER', qKey, answer: ans })}
            />

            {/* 桌機操作列（選項之後、詳解之上，方便切換上下題不必捲過長解析） */}
            <div className="hidden md:flex items-center justify-between mt-6 pt-5 border-t border-gray-100 dark:border-gray-700/60">
              <button
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex - 1 })}
                disabled={practiceIndex === 0}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200"
              >
                <ChevronLeft size={16} /> 上一題
              </button>
              {canSubmit && !isSubmitted ? (
                <button
                  onClick={submitCurrent}
                  disabled={!hasAnswer}
                  className={`px-8 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white rounded-xl font-medium whitespace-nowrap transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-md ${hasAnswer ? 'pulse-glow' : ''}`}
                >
                  <CheckCircle size={16} className="inline mr-1.5 -mt-0.5" />
                  提交答案
                </button>
              ) : <span />}
              <button
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 })}
                disabled={practiceIndex >= practiceFiltered.length - 1}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200"
              >
                下一題 <ChevronRight size={16} />
              </button>
            </div>
            <HotkeyHint />

            {/* Result */}
            {practiceSubmitted[qKey] && (
              <div className={`mt-5 p-5 rounded-xl animate-correct-pop ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {isCorrect
                    ? <><CheckCircle size={22} className="text-green-600 dark:text-green-400 animate-icon-bounce" /><span className="font-bold text-green-700 dark:text-green-400 text-lg">正確！</span></>
                    : <><XCircle size={22} className="text-red-600 dark:text-red-400 animate-icon-bounce" /><span className="font-bold text-red-700 dark:text-red-400 text-lg">錯誤</span></>
                  }
                  {state.lastXpGain?.qKey === qKey && state.lastXpGain.amount > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1.5">
                      {state.lastXpGain.mult > 1 && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-extrabold animate-correct-pop">
                          <Flame size={12} fill="currentColor" /> ×{state.lastXpGain.mult}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 text-sm font-bold animate-correct-pop tnum">
                        <Zap size={13} fill="currentColor" /> +{state.lastXpGain.amount} XP
                      </span>
                    </span>
                  )}
                </div>
                <ExplanationView question={currentQ} userAnswer={practiceAnswers[qKey]} />
              </div>
            )}
            {/* Show answer mode (not submitted yet) */}
            {state.showAnswers && !practiceSubmitted[qKey] && (
              <div className="mt-5 p-5 rounded-xl animate-scale-in bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={18} className="text-purple-600 dark:text-purple-400" />
                  <span className="font-bold text-purple-700 dark:text-purple-400 text-sm">
                    正確答案：{Array.isArray(currentQ.answer) ? currentQ.answer.join(', ') : currentQ.answer}
                  </span>
                </div>
                <ExplanationView question={currentQ} userAnswer={practiceAnswers[qKey]} />
              </div>
            )}
          </div>
        </div>
      )}

      {sessionComplete && (
        <div className="surface-card overflow-hidden animate-slide-up">
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2"><PartyPopper size={21} className="text-orange-500" /> 本輪練習完成</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">先看成果，再決定下一步。</p>
              </div>
              <span className={`text-3xl font-extrabold ${accuracyTone(accuracyPct).text}`}>{accuracyPct}%</span>
            </div>
            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/60 p-3 text-center"><div className="text-xl font-bold">{practiceFiltered.length}</div><div className="text-xs text-gray-500">完成題數</div></div>
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center"><div className="text-xl font-bold text-green-600 dark:text-green-400">{correctCount}</div><div className="text-xs text-gray-500">答對</div></div>
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-center"><div className="text-xl font-bold text-red-500">{answeredCount - correctCount}</div><div className="text-xs text-gray-500">待加強</div></div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => dispatch({ type: 'SET_TAB', tab: 'stats' })} className="flex-1 min-w-32 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700">查看學習分析</button>
              <button onClick={() => dispatch({ type: 'START_PRACTICE' })} className="flex-1 min-w-32 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm">再練一輪</button>
            </div>
          </div>
        </div>
      )}

      {/* 手機釘底操作列：選完答案不用回捲就能提交 */}
      {currentQ && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center gap-2 px-3 pt-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_16px_rgb(0_0_0/0.08)]" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex - 1 })}
            disabled={practiceIndex === 0}
            aria-label="上一題"
            className="p-3 rounded-xl border border-gray-300 dark:border-gray-600 disabled:opacity-40 text-gray-600 dark:text-gray-300"
          >
            <ChevronLeft size={20} />
          </button>
          {canSubmit && !isSubmitted ? (
            <button
              onClick={submitCurrent}
              disabled={!hasAnswer}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white rounded-xl font-semibold text-sm whitespace-nowrap disabled:cursor-not-allowed"
            >
              <CheckCircle size={16} className="inline mr-1.5 -mt-0.5" />
              提交答案
            </button>
          ) : (
            <button
              onClick={() => practiceIndex < practiceFiltered.length - 1 && dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 })}
              disabled={practiceIndex >= practiceFiltered.length - 1}
              className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white rounded-xl font-semibold text-sm whitespace-nowrap disabled:cursor-not-allowed"
            >
              下一題
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 })}
            disabled={practiceIndex >= practiceFiltered.length - 1}
            aria-label="下一題"
            className="p-3 rounded-xl border border-gray-300 dark:border-gray-600 disabled:opacity-40 text-gray-600 dark:text-gray-300"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Navigation bar */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <ListChecks size={14} />
            題目導覽
          </h4>
          {navPageCount > 1 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <button
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: Math.max(0, navStart - navPageSize) })}
                disabled={navPage === 0}
                className="p-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="上一組題目"
              ><ChevronLeft size={15} /></button>
              <span>{navStart + 1}–{Math.min(navStart + navPageSize, practiceFiltered.length)} / {practiceFiltered.length}</span>
              <button
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: Math.min(practiceFiltered.length - 1, navStart + navPageSize) })}
                disabled={navPage >= navPageCount - 1}
                className="p-1 rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="下一組題目"
              ><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {navQuestions.map((q, offset) => {
            const i = navStart + offset
            const k = `${q.exam}-${q.id}`
            const submitted = practiceSubmitted[k]
            const correct = practiceResults[k]
            const isBookmarked = bookmarked[k]
            const isReview = reviewMarked[k]
            const isCurrent = i === practiceIndex
            let bgClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            if (submitted) {
              bgClass = correct
                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
            }
            return (
              <button
                key={k}
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: i })}
                className={`relative w-9 h-9 rounded-lg text-xs font-bold transition-all duration-200 ${bgClass} ${isCurrent ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-800 scale-110' : ''} ${isBookmarked ? 'border-2 border-yellow-400' : ''}`}
              >
                {q.id}
                {isReview && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white dark:ring-gray-800" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Filter Bar
// ══════════════════════════════════════════
function FilterBar({ state, dispatch, examTypes, showStart }) {
  return (
    <div className="surface-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
            <Filter size={12} />科別
          </label>
          <select
            value={state.filterExam}
            onChange={e => dispatch({ type: 'SET_FILTER', key: 'filterExam', value: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
          >
            <option value="">全部</option>
            {examTypes.map(e => <option key={e} value={e}>{displayExam(e)}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">題型</label>
          <select
            value={state.filterType}
            onChange={e => dispatch({ type: 'SET_FILTER', key: 'filterType', value: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
          >
            <option value="">全部</option>
            <option value="official">壓題參考（93 題）</option>
            <option value="single">單選題</option>
            <option value="multiple">多選題</option>
            <option value="matching">配對題</option>
            <option value="ordering">排序題</option>
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
            <Search size={12} />練習區間
          </label>
          <input
            type="text"
            value={state.filterSearch}
            onChange={e => dispatch({ type: 'SET_FILTER', key: 'filterSearch', value: e.target.value })}
            placeholder="例: 1-10"
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
          />
        </div>
        {showStart && (
          <button
            onClick={() => dispatch({ type: 'START_PRACTICE' })}
            className="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1.5 btn-glow"
          >
            <Play size={14} /> 開始練習
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Bilingual option text renderer
// ══════════════════════════════════════════
function OptionText({ label, text }) {
  const isCode = text && text.includes('\n')
  return (
    <span className="text-sm" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
      <span className="font-semibold mr-1">{label}.</span>
      {isCode
        ? <pre style={{ display: 'inline-block', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8em', margin: 0, verticalAlign: 'top' }}>{text}</pre>
        : text}
    </span>
  )
}

// ══════════════════════════════════════════
// Question Input (shared between practice & exam)
// ══════════════════════════════════════════
function QuestionInput({ question, answer, submitted, onAnswer, examMode = false }) {
  const q = question

  // Handle questions with no options (broken data or unsupported format)
  // Skip this check for matching/ordering questions that use available_options/available_steps
  const hasMatchingData = q.type === 'matching' && q.available_options?.length > 0 && q.matches?.length > 0
  const hasOrderingData = q.type === 'ordering' && q.available_steps?.length > 0 && q.ordered_steps?.length > 0
  if (!hasMatchingData && !hasOrderingData && (!q.options || Object.keys(q.options).length === 0)) {
    return (
      <div className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200">
        <p className="font-medium">此題目格式不支援作答（可能為拖拉配對題或排序題，選項資料缺失）。</p>
        {q.answer && <p className="mt-2">正確答案：<strong>{Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</strong></p>}
      </div>
    )
  }

  if (q.type === 'single') {
    return (
      <div className="space-y-2.5">
        {Object.entries(q.options).map(([key, text]) => {
          const selected = answer === key
          let optClass = 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-sm'
          let accentClass = ''
          if (submitted && !examMode) {
            if (key === q.answer) { optClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'; accentClass = 'correct' }
            else if (selected && key !== q.answer) { optClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'; accentClass = 'incorrect' }
          } else if (selected) {
            optClass = 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-sm'; accentClass = 'selected'
          }
          return (
            <label
              key={key}
              className={`option-accent ${accentClass} flex items-start gap-3 p-3.5 pl-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${optClass} ${submitted && !examMode ? 'cursor-default' : ''}`}
            >
              <input
                type="radio"
                name={`q-${q.exam}-${q.id}`}
                checked={selected}
                onChange={() => !submitted && onAnswer(key)}
                disabled={submitted && !examMode}
                className="w-4 h-4 mt-0.5 shrink-0 accent-orange-500"
              />
              <OptionText label={key} text={text} />
            </label>
          )
        })}
      </div>
    )
  }

  if (q.type === 'multiple') {
    const selected = Array.isArray(answer) ? answer : []
    const needed = Array.isArray(q.answer) ? q.answer.length : 0
    return (
      <div className="space-y-2.5">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
          <AlertCircle size={14} className="text-blue-500 shrink-0" />
          請選擇 <span className="font-bold text-blue-600 dark:text-blue-400">{needed}</span> 個選項
          {selected.length > 0 && <span className="ml-auto text-xs font-medium">已選 {selected.length}/{needed}</span>}
        </p>
        {Object.entries(q.options).map(([key, text]) => {
          const checked = selected.includes(key)
          let optClass = 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-sm'
          let accentClass = ''
          if (submitted && !examMode) {
            if (q.answer.includes(key)) { optClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'; accentClass = 'correct' }
            else if (checked && !q.answer.includes(key)) { optClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'; accentClass = 'incorrect' }
          } else if (checked) {
            optClass = 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-sm'; accentClass = 'selected'
          }
          return (
            <label
              key={key}
              className={`option-accent ${accentClass} flex items-start gap-3 p-3.5 pl-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${optClass} ${submitted && !examMode ? 'cursor-default' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  if (submitted && !examMode) return
                  const newSel = checked ? selected.filter(s => s !== key) : [...selected, key]
                  onAnswer(newSel)
                }}
                disabled={submitted && !examMode}
                className="w-4 h-4 mt-0.5 shrink-0 accent-orange-500"
              />
              <OptionText label={key} text={text} />
            </label>
          )
        })}
      </div>
    )
  }

  if (q.type === 'matching') {
    // If matches/available_options exist, use dropdown matching UI
    if (q.matches?.length > 0 && q.available_options?.length > 0) {
      const selections = Array.isArray(answer) ? answer : q.matches.map(() => '')
      const choices = getStructuredChoices(q.available_options, q.available_option_ids)
      return (
        <div className="space-y-3">
          {q.matches.map((m, i) => {
            const correctAnswer = m.correct_option_id ?? m.correct_answer
            let borderClass = 'border-gray-200 dark:border-gray-700'
            let accentClass = ''
            if (submitted && !examMode) {
              if (selections[i] === correctAnswer) { borderClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'; accentClass = 'correct' }
              else { borderClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'; accentClass = 'incorrect' }
            }
            return (
              <div key={i} className={`option-accent ${accentClass} p-4 pl-5 rounded-xl border-2 transition-all duration-200 ${borderClass}`}>
                <p className="text-sm font-medium mb-2.5">{m.use_case || m.description}</p>
                <select
                  value={selections[i] || ''}
                  onChange={e => {
                    if (submitted && !examMode) return
                    const newSel = [...selections]
                    newSel[i] = e.target.value
                    onAnswer(newSel)
                  }}
                  disabled={submitted && !examMode}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
                >
                  <option value="">-- 請選擇 --</option>
                  {choices.map(choice => (
                    <option key={choice.id} value={choice.id}>{choice.text}</option>
                  ))}
                </select>
                {submitted && !examMode && selections[i] !== correctAnswer && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1"><CheckCircle size={12} />正確答案：{m.correct_answer}</p>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    // Fallback: matching question with options/answer (render as multi-select)
    if (q.options) {
      const selected = Array.isArray(answer) ? answer : []
      const needed = Array.isArray(q.answer) ? q.answer.length : 0
      return (
        <div className="space-y-2">
          {needed > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <AlertCircle size={14} className="inline mr-1" />
              請選擇 {needed} 個選項
            </p>
          )}
          {Object.entries(q.options).map(([key, text]) => {
            const checked = selected.includes(key)
            let optClass = 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-600'
            if (submitted && !examMode) {
              const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer]
              if (correctAnswers.includes(key)) optClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'
              else if (checked && !correctAnswers.includes(key)) optClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'
            } else if (checked) {
              optClass = 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
            }
            return (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${optClass} ${submitted && !examMode ? 'cursor-default' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (submitted && !examMode) return
                    const newSel = checked ? selected.filter(s => s !== key) : [...selected, key]
                    onAnswer(newSel)
                  }}
                  disabled={submitted && !examMode}
                  className="mt-0.5 accent-orange-600"
                />
                <OptionText label={key} text={text} />
              </label>
            )
          })}
        </div>
      )
    }
    // Final fallback: self-assessment mode (no structured data)
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <AlertCircle size={14} className="inline mr-1" />
          此題為自我評估模式，請閱讀題目後點擊「提交答案」查看解析。
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => !submitted && onAnswer('self-assessed-correct')}
            disabled={submitted && !examMode}
            className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${answer === 'self-assessed-correct' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'border-gray-200 dark:border-gray-600 hover:border-green-400'}`}
          >
            <CheckCircle size={14} className="inline mr-1" />我答對了
          </button>
          <button
            onClick={() => !submitted && onAnswer('self-assessed-incorrect')}
            disabled={submitted && !examMode}
            className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${answer === 'self-assessed-incorrect' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-gray-200 dark:border-gray-600 hover:border-red-400'}`}
          >
            <XCircle size={14} className="inline mr-1" />我答錯了
          </button>
        </div>
      </div>
    )
  }

  if (q.type === 'ordering') {
    // If available_steps/ordered_steps exist, use the ordering UI
    if (q.available_steps?.length > 0 && q.ordered_steps?.length > 0) {
      const selectedSteps = Array.isArray(answer) ? answer : []
      const choices = getStructuredChoices(q.available_steps, q.available_step_ids)
      const choiceTextById = new Map(choices.map(choice => [choice.id, choice.text]))
      const availableSteps = choices.filter(choice => !selectedSteps.includes(choice.id))
      const correctSteps = q.ordered_step_ids ?? q.ordered_steps
      const neededCount = correctSteps.length

      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <AlertCircle size={14} className="inline mr-1" />
            請從下方選擇 {neededCount} 個步驟並排列正確順序
          </p>

          {/* Available steps */}
          <div>
            <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">可選步驟：</h5>
            <div className="flex flex-wrap gap-2">
              {availableSteps.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => {
                    if (submitted && !examMode) return
                    if (selectedSteps.length < neededCount) {
                      onAnswer([...selectedSteps, choice.id])
                    }
                  }}
                  disabled={(submitted && !examMode) || selectedSteps.length >= neededCount}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={12} className="inline mr-1" />{choice.text}
                </button>
              ))}
            </div>
          </div>

          {/* Selected & ordered steps */}
          {selectedSteps.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">已選步驟（排序）：</h5>
              <div className="space-y-1.5">
                {selectedSteps.map((step, i) => {
                  let itemClass = 'border-gray-200 dark:border-gray-700'
                  if (submitted && !examMode) {
                    itemClass = (i < correctSteps.length && step === correctSteps[i])
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  }
                  return (
                    <div key={`${step}-${i}`} className={`flex items-center gap-2 p-2 rounded-lg border-2 ${itemClass}`}>
                      <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm flex-1">{choiceTextById.get(step) ?? step}</span>
                      {!(submitted && !examMode) && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => {
                              if (i === 0) return
                              const newArr = [...selectedSteps];
                              [newArr[i - 1], newArr[i]] = [newArr[i], newArr[i - 1]]
                              onAnswer(newArr)
                            }}
                            disabled={i === 0}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (i === selectedSteps.length - 1) return
                              const newArr = [...selectedSteps];
                              [newArr[i], newArr[i + 1]] = [newArr[i + 1], newArr[i]]
                              onAnswer(newArr)
                            }}
                            disabled={i === selectedSteps.length - 1}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            onClick={() => onAnswer(selectedSteps.filter((_, j) => j !== i))}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Show correct answer after submit */}
          {submitted && !examMode && (
            <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">正確順序：</p>
              {q.ordered_steps.map((step, i) => (
                <p key={i} className="text-sm text-green-600 dark:text-green-400">{i + 1}. {step}</p>
              ))}
            </div>
          )}
        </div>
      )
    }
    // Fallback: ordering question with options/answer (render as multi-select)
    if (q.options) {
      const selected = Array.isArray(answer) ? answer : []
      const needed = Array.isArray(q.answer) ? q.answer.length : 0
      return (
        <div className="space-y-2">
          {needed > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <AlertCircle size={14} className="inline mr-1" />
              請選擇 {needed} 個選項
            </p>
          )}
          {Object.entries(q.options).map(([key, text]) => {
            const checked = selected.includes(key)
            let optClass = 'border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-600'
            if (submitted && !examMode) {
              const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer]
              if (correctAnswers.includes(key)) optClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'
              else if (checked && !correctAnswers.includes(key)) optClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'
            } else if (checked) {
              optClass = 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
            }
            return (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${optClass} ${submitted && !examMode ? 'cursor-default' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (submitted && !examMode) return
                    const newSel = checked ? selected.filter(s => s !== key) : [...selected, key]
                    onAnswer(newSel)
                  }}
                  disabled={submitted && !examMode}
                  className="mt-0.5 accent-orange-600"
                />
                <OptionText label={key} text={text} />
              </label>
            )
          })}
        </div>
      )
    }
    // Final fallback: self-assessment mode (no structured data)
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <AlertCircle size={14} className="inline mr-1" />
          此題為自我評估模式，請閱讀題目後點擊「提交答案」查看解析。
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => !submitted && onAnswer('self-assessed-correct')}
            disabled={submitted && !examMode}
            className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${answer === 'self-assessed-correct' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'border-gray-200 dark:border-gray-600 hover:border-green-400'}`}
          >
            <CheckCircle size={14} className="inline mr-1" />我答對了
          </button>
          <button
            onClick={() => !submitted && onAnswer('self-assessed-incorrect')}
            disabled={submitted && !examMode}
            className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${answer === 'self-assessed-incorrect' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-gray-200 dark:border-gray-600 hover:border-red-400'}`}
          >
            <XCircle size={14} className="inline mr-1" />我答錯了
          </button>
        </div>
      </div>
    )
  }

  return <p className="text-gray-500">不支援的題型：{q.type}</p>
}

// ══════════════════════════════════════════
// Explanation View
// ══════════════════════════════════════════
function CollapsibleText({ text, maxHeight = 120 }) {
  const contentRef = useRef(null)
  const [needsTruncate, setNeedsTruncate] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (contentRef.current) {
      setNeedsTruncate(contentRef.current.scrollHeight > maxHeight + 20)
    }
  }, [text, maxHeight])

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="px-3 pb-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed overflow-hidden transition-all duration-200"
        style={{ maxHeight: isExpanded ? 'none' : `${maxHeight}px` }}
      >
        {text}
      </div>
      {needsTruncate && !isExpanded && (
        <div className="px-3 pt-1 pb-1 bg-gradient-to-t from-white dark:from-gray-900 to-transparent" style={{ marginTop: '-24px', paddingTop: '24px', position: 'relative' }}>
          <button onClick={() => setIsExpanded(true)} className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium">
            展開更多 ▼
          </button>
        </div>
      )}
      {needsTruncate && isExpanded && (
        <div className="px-3 pb-1">
          <button onClick={() => setIsExpanded(false)} className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium">
            收起 ▲
          </button>
        </div>
      )}
    </div>
  )
}

// 解析顯示：去除前面重複的英文選項文字，只保留中文段落（含中文裡夾帶的英文服務名稱）
function zhExplanation(text) {
  if (typeof text !== 'string') return text
  const idx = text.search(/[一-鿿]/)
  if (idx <= 0) return text  // 沒有中文、或一開始就是中文 → 原樣顯示
  return text.slice(idx).trim()
}

function ExplanationView({ question }) {
  const q = question
  const correctKeys = Array.isArray(q.answer) ? q.answer : [q.answer]
  const allOptionKeys = q.options ? Object.keys(q.options) : Object.keys(q.explanations || {})
  // Default to first correct answer that has explanation, or first key with explanation
  const defaultKey = correctKeys.find(k => q.explanations?.[k]) || allOptionKeys.find(k => q.explanations?.[k]) || allOptionKeys[0] || ''
  const [selectedKey, setSelectedKey] = useState(defaultKey)

  if (!q.explanations) return null

  const selectedText = q.explanations[selectedKey]
  // 記憶錨點固定萃取「正確答案」的解析核心句，不隨瀏覽的選項切換
  const correctExpKey = correctKeys.find(k => q.explanations?.[k])
  const memoryAnchor = correctExpKey ? createMemoryAnchor(q, zhExplanation(q.explanations[correctExpKey])) : null

  if (q.type === 'single' || q.type === 'multiple') {
    return (
      <div className="space-y-2 mt-2">
        <h5 className="text-sm font-medium">解析：</h5>
        <div className="relative">
          <select
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
            className="w-full px-3 py-2 pr-8 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {allOptionKeys.map(key => {
              const isCorrect = correctKeys.includes(key)
              const hasExp = !!q.explanations[key]
              return (
                <option key={key} value={key} disabled={!hasExp}>
                  {key}. {isCorrect ? '✓ 正確' : '✗ 錯誤'}{!hasExp ? ' (無解析)' : ''}
                </option>
              )
            })}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {memoryAnchor && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-300 mb-1"><Sparkles size={15} /> 記憶錨點</div>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{memoryAnchor.anchor}</p>
            {memoryAnchor.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">{memoryAnchor.services.map(service => <span key={service} className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-800 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{service}</span>)}</div>
            )}
          </div>
        )}
        {selectedText ? (
          <div className={`rounded-lg border px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
            correctKeys.includes(selectedKey)
              ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20 text-gray-700 dark:text-gray-300'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300'
          }`}>
            {zhExplanation(selectedText)}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-3 text-sm text-gray-400 dark:text-gray-500">
            此選項無詳細解析
          </div>
        )}
      </div>
    )
  }

  if (q.type === 'matching' || q.type === 'ordering') {
    const entries = Object.entries(q.explanations)
    const matchKeys = entries.map(([k]) => k)
    const defaultMatchKey = matchKeys[0]
    return <MatchingExplanationDropdown entries={entries} defaultKey={defaultMatchKey} qType={q.type} />
  }

  return null
}

function MatchingExplanationDropdown({ entries, defaultKey, qType }) {
  const [selectedKey, setSelectedKey] = useState(defaultKey)
  const selectedText = entries.find(([k]) => k === selectedKey)?.[1]

  return (
    <div className="space-y-2 mt-2">
      <h5 className="text-sm font-medium">解析：</h5>
      <div className="relative">
        <select
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
          className="w-full px-3 py-2 pr-8 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {entries.map(([key]) => (
            <option key={key} value={key}>
              {key === '_full' ? '總覽' : qType === 'matching' ? `配對 ${key}` : key}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
      {selectedText && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
          {zhExplanation(selectedText)}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// Exam Tab
// ══════════════════════════════════════════
const EXAM_SPECS = {
  'MLA-C01': { name: 'AWS Machine Learning Engineer Associate', count: 65, timeLimit: 170, passScore: 720, questions: '65 題（50 題計分 + 15 題不計分）', time: '170 分鐘（2 小時 50 分）', types: '單選、多選、排序、配對' },
  'CLF-C02': { name: 'AWS Cloud Practitioner', count: 65, timeLimit: 90, passScore: 700, questions: '65 題（50 題計分 + 15 題不計分）', time: '90 分鐘（1 小時 30 分）', types: '單選、多選' },
  'SCS-C02': { name: 'AWS Certified Security - Specialty (C02)', count: 65, timeLimit: 170, passScore: 750, questions: '65 題（50 題計分 + 15 題不計分）', time: '170 分鐘（2 小時 50 分）', types: '單選、多選' },
  'SCS-C03': { name: 'AWS Certified Security - Specialty (C03)', count: 65, timeLimit: 170, passScore: 750, questions: '65 題（50 題計分 + 15 題不計分）', time: '170 分鐘（2 小時 50 分）', types: '單選、多選、排序' },
  'AIP-C01': { name: 'AWS Certified Generative AI Developer - Professional', count: 85, timeLimit: 205, passScore: 750, questions: '85 題，複選題及多個答案', time: '205 分鐘（3 小時 25 分）', types: '單選、多選' },
  'SAA-C03': { name: 'AWS Certified Solutions Architect - Associate', count: 65, timeLimit: 130, passScore: 720, questions: '65 題（50 題計分 + 15 題不計分）', time: '130 分鐘（2 小時 10 分）', types: '單選、多選' },
  'SOA-C02': { name: 'AWS Certified SysOps Administrator - Associate', count: 65, timeLimit: 130, passScore: 720, questions: '65 題（50 題計分 + 15 題不計分）', time: '130 分鐘（2 小時 10 分）', types: '單選、多選、排序' },
  'SOA-C03': { name: 'AWS Certified CloudOps Engineer - Associate', count: 65, timeLimit: 130, passScore: 720, questions: '65 題（50 題計分 + 15 題不計分）', time: '130 分鐘（2 小時 10 分）', types: '單選、多選' },
  'DEA-C01': { name: 'AWS Certified Data Engineer - Associate', count: 65, timeLimit: 130, passScore: 720, questions: '65 題（50 題計分 + 15 題不計分）', time: '130 分鐘（2 小時 10 分）', types: '單選、多選' },
  'PCA': { name: 'Google Professional Cloud Architect', count: 50, timeLimit: 120, passScore: 700, questions: '50 題（單選與多選）', time: '120 分鐘（2 小時）', types: '單選、多選' },
  'GCP-CDL': { name: 'Google Cloud Digital Leader', count: 50, timeLimit: 90, passScore: 700, questions: '50–60 題（單選與多選）', time: '90 分鐘', types: '單選、多選' },
  'AZ-104': { name: 'Microsoft Certified: Azure Administrator Associate', count: 50, timeLimit: 120, passScore: 700, questions: '40–60 題（微軟未公布確切題數）', time: '120 分鐘（2 小時）', types: '單選、多選' },
  'AZ-900': { name: 'Microsoft Certified: Azure Fundamentals', count: 45, timeLimit: 45, passScore: 700, questions: '40–60 題（微軟未公布確切題數）', time: '45 分鐘', types: '單選、多選、配對' },
}

function ExamTab({ state, dispatch, examTypes, qMap }) {
  const selectedExam = state.examConfig.examFilter
  const spec = EXAM_SPECS[selectedExam] || null

  // Keyboard shortcuts during an active exam (hook must run before any
  // early return). Enter advances only — submitting the exam stays a click.
  const hkQRaw = state.examActive ? qMap.get(state.examQuestionIds[state.examIndex]) : null
  const hkQ = getDisplayQuestion(hkQRaw, state.lang, state.questionsEn)
  const hkKey = state.examActive ? state.examQuestionIds[state.examIndex] : null
  useAnswerHotkeys({
    enabled: !!(state.examActive && !state.examSubmitted && hkQRaw),
    question: hkQ,
    answer: hkKey ? state.examAnswers[hkKey] : undefined,
    submitted: false,
    allowChange: true,
    onAnswer: (ans) => dispatch({ type: 'SET_EXAM_ANSWER', qKey: hkKey, answer: ans }),
    onPrev: () => { if (state.examIndex > 0) dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex - 1 }) },
    onNext: () => { if (state.examIndex < state.examQuestionIds.length - 1) dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex + 1 }) },
    onEnter: () => { if (state.examIndex < state.examQuestionIds.length - 1) dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex + 1 }) },
  })

  // 手機左右滑動換題（考試中）
  const examTouchRef = useRef(null)
  const onExamTouchStart = (e) => {
    const t = e.touches[0]
    examTouchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onExamTouchEnd = (e) => {
    const s = examTouchRef.current
    examTouchRef.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2) return
    if (dx < 0 && state.examIndex < state.examQuestionIds.length - 1) dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex + 1 })
    else if (dx > 0 && state.examIndex > 0) dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex - 1 })
  }

  // Config screen
  if (!state.examActive && !state.examSubmitted) {
    return (
      <div className="space-y-6">
        {state.questions.length === 0 ? (
          state.questionsLoading
            ? <EmptyState message="題庫載入中..." icon={Loader2} />
            : isAdmin
              ? <EmptyState message="請先上傳題庫" icon={Upload} action={() => dispatch({ type: 'SET_TAB', tab: 'upload' })} actionLabel="前往上傳" />
              : <EmptyState message="題庫載入失敗，請重新整理頁面" icon={AlertCircle} />
        ) : (
          <div className="surface-card overflow-hidden max-w-lg mx-auto animate-slide-up">
            <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600" />
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} className="text-orange-500" />
                </div>
                <h2 className="text-xl font-bold">模擬考設定</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{spec ? `依據 ${displayExam(selectedExam)} 真實考試規則` : '設定考試參數後開始挑戰'}</p>
              </div>
              {spec && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-sm">
                  <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5"><AlertCircle size={14} /> {displayExam(selectedExam)} 考試規格</p>
                  <ul className="text-blue-600 dark:text-blue-400 space-y-1 ml-5 list-disc">
                    <li>{spec.questions}</li>
                    <li>{spec.time}</li>
                    <li>及格分數：{spec.passScore} / 1000</li>
                    <li>題型：{spec.types}</li>
                    <li>猜題不倒扣</li>
                  </ul>
                </div>
              )}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">題數</label>
                  <input
                    type="number"
                    min={1}
                    max={state.questions.length}
                    value={state.examConfig.count}
                    onChange={e => dispatch({ type: 'SET_EXAM_CONFIG', config: { count: parseInt(e.target.value) || 1 } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">可用題數：{state.questions.length}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">時間限制（分鐘）</label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={state.examConfig.timeLimit}
                    onChange={e => dispatch({ type: 'SET_EXAM_CONFIG', config: { timeLimit: parseInt(e.target.value) || 1 } })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">科別篩選</label>
                  <select
                    value={state.examConfig.examFilter}
                    onChange={e => {
                      const exam = e.target.value
                      const s = EXAM_SPECS[exam]
                      const config = { examFilter: exam }
                      if (s) { config.count = s.count; config.timeLimit = s.timeLimit }
                      dispatch({ type: 'SET_EXAM_CONFIG', config })
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400 outline-none transition-all duration-200"
                  >
                    <option value="">全部科別</option>
                    {examTypes.map(e => <option key={e} value={e}>{displayExam(e)}</option>)}
                  </select>
                </div>
                {/* Language toggle - only show when CLF-C02 has English version */}
                {Object.keys(state.questionsEn).length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-1.5 flex items-center gap-1.5"><Languages size={14} />考題語言</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => dispatch({ type: 'SET_LANG', lang: 'zh' })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                          state.lang === 'zh'
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-400 dark:border-orange-600'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        中文
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'SET_LANG', lang: 'en' })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                          state.lang === 'en'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-600'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => dispatch({ type: 'START_EXAM' })}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 btn-glow text-base"
                >
                  <Play size={20} />
                  開始考試
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Results screen
  if (state.examSubmitted && state.examResults) {
    const r = state.examResults
    const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0
    const scaledScore = r.total > 0 ? Math.round(100 + (r.correct / r.total) * 900) : 100
    const passScore = spec ? spec.passScore : 720
    const passed = scaledScore >= passScore
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="surface-card overflow-hidden">
          <div className={`h-1.5 ${passed ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`} />
          <div className="p-8 text-center">
            <div className={`w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center ${passed ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <Trophy size={40} className={`animate-count ${passed ? 'text-yellow-500' : 'text-gray-400'}`} />
            </div>
            <h2 className="text-2xl font-bold mb-3">考試結果</h2>
            <div className="text-6xl font-extrabold mb-3 animate-count">
              <span className={passed ? 'gradient-text' : 'text-red-600 dark:text-red-400'}>{scaledScore}</span>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">換算分數（滿分 1000，及格 {passScore}）</p>
            <p className="text-gray-500 dark:text-gray-400 text-lg">{r.correct} / {r.total} 題正確（{pct}%）</p>
            <p className={`text-sm font-semibold mt-2 ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {passed ? '恭喜通過！' : `未達及格標準 ${passScore} 分，繼續加油！`}
            </p>

            {/* Type breakdown */}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {Object.entries(r.typeStats).map(([type, s]) => {
                const typePct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                return (
                  <span key={type} className="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600">
                    {typeLabels[type]}: <span className={typePct >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>{s.correct}/{s.total}</span>
                  </span>
                )
              })}
            </div>

            <button
              onClick={() => dispatch({ type: 'EXIT_EXAM' })}
              className="mt-8 px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold inline-flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <RotateCcw size={16} /> 再考一次
            </button>
          </div>
        </div>

        {r.progressReport && (
          <div className="surface-card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingUp size={18} className="text-orange-500" /> 模擬考進步報告</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{r.progressReport.message}</p>
              </div>
              {r.progressReport.delta != null && (
                <span className={`text-2xl font-extrabold ${r.progressReport.delta > 0 ? 'text-green-600 dark:text-green-400' : r.progressReport.delta < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {r.progressReport.delta > 0 ? '+' : ''}{r.progressReport.delta}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/60 p-4"><div className="text-xs text-gray-500">上次正確率</div><div className="text-xl font-bold mt-1">{r.progressReport.previousPct == null ? '首次基準' : `${r.progressReport.previousPct}%`}</div></div>
              <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 p-4"><div className="text-xs text-gray-500">重複錯題</div><div className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">{r.progressReport.repeatedWrong} 題</div></div>
            </div>
            <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              下一步：{r.progressReport.repeatedWrong > 0 ? `先複習 ${r.progressReport.repeatedWrong} 道重複錯題` : pct < 70 ? '優先練習本次錯題' : '保持節奏，安排下一場模擬考'}
            </p>
          </div>
        )}

        {/* Detail review */}
        <div className="surface-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ListChecks size={18} />
            逐題檢視
          </h3>
          <div className="space-y-3">
            {r.details.map((d, i) => (
              <ExamReviewItem key={d.qKey} detail={d} index={i} examAnswers={state.examAnswers} lang={state.lang} questionsEn={state.questionsEn} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Active exam
  const examQRaw = qMap.get(state.examQuestionIds[state.examIndex])
  const examQ = getDisplayQuestion(examQRaw, state.lang, state.questionsEn)
  const examQKey = state.examQuestionIds[state.examIndex]
  const examHasEn = Object.keys(state.questionsEn).length > 0
  const minutes = Math.floor(state.examRemaining / 60)
  const seconds = state.examRemaining % 60

  const examAnsweredCount = state.examQuestionIds.filter(qk => state.examAnswers[qk] !== undefined).length
  const examProgressPct = state.examQuestionIds.length > 0 ? Math.round((examAnsweredCount / state.examQuestionIds.length) * 100) : 0
  const totalSeconds = (state.examConfig?.timeLimit || 60) * 60
  const timerPct = totalSeconds > 0 ? Math.max(0, (state.examRemaining / totalSeconds) * 100) : 100

  return (
    <div className="space-y-4">
      {/* Timer bar + controls */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              題目 {state.examIndex + 1} / {state.examQuestionIds.length}
              <span className="text-xs text-gray-400 ml-2">已答 {examAnsweredCount} 題</span>
            </span>
            {examHasEn && (
              <button
                onClick={() => dispatch({ type: 'SET_LANG', lang: state.lang === 'zh' ? 'en' : 'zh' })}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                  state.lang === 'en'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="切換語言 / Switch Language"
              >
                <Languages size={12} />
                {state.lang === 'en' ? 'EN' : '中文'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 font-mono text-lg font-bold tnum ${state.examRemaining < 300 ? 'text-red-600 dark:text-red-400 animate-pulse' : ''}`}>
              <Clock size={18} />
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <button
              onClick={() => {
                if (confirm('確定要退出考試嗎？本次考試進度將不會保留。')) {
                  dispatch({ type: 'EXIT_EXAM' })
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-300 dark:border-gray-600 transition-all duration-200"
              title="退出考試"
            >
              <LogOut size={12} />
              退出
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="progress-bar h-full rounded-full" style={{ width: `${timerPct}%`, background: state.examRemaining < 300 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #ff9900, #ec7211)' }} />
        </div>
      </div>

      {/* Question */}
      {examQ && (
        <div className="surface-card overflow-hidden" onTouchStart={onExamTouchStart} onTouchEnd={onExamTouchEnd}>
          <div className="h-0.5 bg-gradient-to-r from-orange-400/70 to-orange-500/70" />
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold">{displayExam(examQ.exam)}</span>
              <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold">{typeLabels[examQ.type]}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">#{examQ.id}</span>
              {examQ.officialNo && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold" title="壓題參考編號">壓題 #{examQ.officialNo}</span>
              )}
            </div>
            <CaseStudyBox text={examQ.caseStudy} />
            <p className="text-base md:text-lg leading-relaxed mb-6 whitespace-pre-wrap break-words">{examQ.question}</p>

            <QuestionInput
              question={examQ}
              answer={state.examAnswers[examQKey]}
              submitted={false}
              onAnswer={(ans) => dispatch({ type: 'SET_EXAM_ANSWER', qKey: examQKey, answer: ans })}
              examMode
            />

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2 mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex - 1 })}
                disabled={state.examIndex === 0}
                className="px-4 sm:px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200"
              >
                <ChevronLeft size={16} /><span className="hidden sm:inline">上一題</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('確定要交卷嗎？未作答的題目將視為錯誤。')) {
                    dispatch({ type: 'SUBMIT_EXAM' })
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shadow-sm"
              >
                <Square size={14} /> 交卷
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex + 1 })}
                disabled={state.examIndex >= state.examQuestionIds.length - 1}
                className="px-4 sm:px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200"
              >
                <span className="hidden sm:inline">下一題</span><ChevronRight size={16} />
              </button>
            </div>
            <HotkeyHint />
          </div>
        </div>
      )}

      {/* Exam navigation bar */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">作答進度</span>
          <span className="text-xs font-bold text-orange-500">{examProgressPct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
          <div className="progress-bar h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full" style={{ width: `${examProgressPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {state.examQuestionIds.map((qk, i) => {
            const answered = state.examAnswers[qk] !== undefined
            const isCurrent = i === state.examIndex
            return (
              <button
                key={qk}
                onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: i })}
                className={`w-9 h-9 rounded-lg text-xs font-bold transition-all duration-200 ${
                  answered
                    ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                } ${isCurrent ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-800 scale-110' : ''}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ExamReviewItem({ detail, index, examAnswers, lang, questionsEn }) {
  const [expanded, setExpanded] = useState(false)
  const displayQ = getDisplayQuestion(detail.question, lang, questionsEn)
  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${detail.correct ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'} ${expanded ? 'shadow-md' : ''}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
        <div className="flex items-center gap-2.5">
          {detail.correct
            ? <CheckCircle size={18} className="text-green-600 dark:text-green-400 shrink-0" />
            : <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
          }
          <span className="text-sm font-semibold">第 {index + 1} 題 — {displayExam(detail.question.exam)} #{detail.question.id}</span>
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium">{typeLabels[detail.question.type]}</span>
        </div>
        <ChevronRight size={16} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
          <CaseStudyBox text={displayQ.caseStudy} />
          <p className="text-sm mb-3 whitespace-pre-wrap break-words">{displayQ.question}</p>
          <QuestionInput
            question={displayQ}
            answer={examAnswers[detail.qKey]}
            submitted={true}
            onAnswer={() => {}}
          />
          <ExplanationView question={displayQ} userAnswer={examAnswers[detail.qKey]} />
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════════
// Stats Tab
// ══════════════════════════════════════════
// 連續學習天數：今天有練 +1；今天還沒練不算斷（從昨天往回數）
function computeStreak(daily) {
  const key = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  const now = new Date()
  let streak = (daily[key(now)]?.answered || 0) > 0 ? 1 : 0
  for (let i = 1; i < 3650; i++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    if ((daily[key(dt)]?.answered || 0) > 0) streak++
    else break
  }
  return streak
}

// ── 每日目標＋連續學習：單值進度環（軌道低調灰，達標轉綠） ──
// 連續天數里程碑：達 100/30/7 天時進度環轉金色並顯示徽章
function streakMilestone(streak) {
  if (streak >= 100) return { at: 100, gold: true, label: '百日達人' }
  if (streak >= 30) return { at: 30, gold: true, label: '30 天里程碑' }
  if (streak >= 7) return { at: 7, gold: true, label: '一週連續' }
  return null
}

// 一次性彩帶（每日目標達成時觸發）
function ConfettiBurst() {
  const colors = ['#ec7211', '#22c55e', '#3b82f6', '#eab308', '#ef4444']
  const pieces = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 5.4 + (i % 3) * 4) % 100}%`,
    bg: colors[i % colors.length],
    delay: `${(i % 6) * 60}ms`,
  }))
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ left: p.left, top: 0, background: p.bg, animationDelay: p.delay }} />
      ))}
    </div>
  )
}

// ── 升級慶祝 modal（item 10）──
function LevelUpModal({ info, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative surface-card overflow-hidden max-w-sm w-full p-8 text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <ConfettiBurst />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 text-xs font-bold mb-4">
            <PartyPopper size={14} /> 升級囉！
          </div>
          <div className="mx-auto w-28 h-28 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex flex-col items-center justify-center shadow-lg mb-4 animate-icon-bounce">
            <span className="text-[11px] text-white/80 font-semibold leading-none">LEVEL</span>
            <span className="text-5xl font-extrabold text-white leading-none tnum">{info.level}</span>
          </div>
          {info.isNewTitle ? (
            <>
              <div className="flex items-center justify-center gap-1.5 text-lg font-bold text-gray-900 dark:text-gray-50">
                <Crown size={18} className="text-yellow-500" /> {info.title}
              </div>
              <p className="text-xs text-orange-500 font-semibold mt-1">解鎖全新稱號！</p>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-50">{info.title}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">繼續保持，向下一級邁進！</p>
            </>
          )}
          <button onClick={onClose} className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm transition-colors">
            太棒了
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 成就解鎖 toast（item 11）──
function AchievementToast({ toast, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast._tid), 4500)
    return () => clearTimeout(t)
  }, [toast._tid, onDismiss])
  const Icon = toast.icon || Award
  return (
    <div
      className="pointer-events-auto flex items-center gap-3 pr-4 pl-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800/60 shadow-lg animate-slide-up max-w-[300px] cursor-pointer"
      role="status"
      onClick={() => onDismiss(toast._tid)}
    >
      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-orange-500" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-orange-500 flex items-center gap-1"><Sparkles size={11} /> 成就解鎖</div>
        <div className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate">{toast.name}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{toast.desc}</div>
      </div>
    </div>
  )
}

function AchievementToasts({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => <AchievementToast key={t._tid} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}

// 等級卡（統計頁頂）：大等級環 + 稱號 + XP 進度 + 成就/最佳連對摘要
function LevelCard({ level, unlocked, total, bestCombo, onShare, sharing }) {
  const R = 34, C = 2 * Math.PI * R
  return (
    <div className="surface-card relative p-5 flex items-center gap-5 flex-wrap">
      {onShare && (
        <button
          onClick={onShare}
          disabled={sharing}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-orange-500 hover:border-orange-300 dark:hover:border-orange-700 transition-colors disabled:opacity-50"
          title="產生成績卡圖片"
        >
          {sharing ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
          <span className="hidden sm:inline">分享成績卡</span>
        </button>
      )}
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 88 88" className="w-24 h-24 -rotate-90">
          <circle cx="44" cy="44" r={R} fill="none" strokeWidth="7" className="stroke-gray-100 dark:stroke-gray-700" />
          <circle cx="44" cy="44" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
            stroke="#ec7211" strokeDasharray={C} strokeDashoffset={C * (1 - level.pct)}
            style={{ transition: 'stroke-dashoffset 500ms ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">LV</span>
          <span className="text-2xl font-extrabold text-orange-500 leading-none tnum">{level.level}</span>
        </div>
      </div>
      <div className="flex-1 min-w-[180px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl font-bold text-gray-900 dark:text-gray-50">{level.name}</span>
          <Sparkles size={16} className="text-orange-400" />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 tnum">
          {level.xp} XP{level.isMax ? '（已達最高等級）' : ` · 再 ${level.toNext} XP 升 Lv.${level.level + 1}`}
          {!level.isMax && level.nextTitleLevel && (
            <span className="text-gray-400 dark:text-gray-500"> · Lv.{level.nextTitleLevel} 晉升「{titleForLevel(level.nextTitleLevel)}」</span>
          )}
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full" style={{ width: `${level.pct * 100}%`, transition: 'width 500ms ease' }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300"><Award size={13} className="text-orange-400" /> 成就 <span className="font-bold tnum">{unlocked}/{total}</span></span>
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300"><Flame size={13} className="text-orange-400" fill="currentColor" /> 最佳連對 <span className="font-bold tnum">{bestCombo}</span></span>
        </div>
      </div>
    </div>
  )
}

// ── SRS 待複習卡（item 13）──
// 錯題快速入口卡：一進統計頁就能一鍵開練，不必再滑到下方分頁列。
// 有 SRS 到期 → 主按鈕「開始複習」＋錯題按鈕；沒到期但有錯題 → 錯題主按鈕。
// 錯題可用下拉選科別（含各科題數），到期複習也跟著所選科別過濾。
function ReviewDueCard({ items, wrongItems = [], dispatch }) {
  const [examFilter, setExamFilter] = useState('')
  const startPool = (list) => {
    const pool = list.map((i) => i.question).filter(Boolean)
    if (pool.length) dispatch({ type: 'GOTO_PRACTICE_QUESTION', questions: pool, startIndex: 0 })
  }
  // 各科錯題數（下拉選項用）；所選科別同步過濾錯題與到期複習兩個池
  const examCounts = {}
  wrongItems.forEach((i) => { if (i.exam) examCounts[i.exam] = (examCounts[i.exam] || 0) + 1 })
  const exams = Object.keys(examCounts).sort()
  const filteredWrong = examFilter ? wrongItems.filter((i) => i.exam === examFilter) : wrongItems
  const filteredDue = examFilter ? items.filter((i) => i.exam === examFilter) : items
  const hasDue = filteredDue.length > 0
  return (
    <div className="surface-card p-5 flex items-center justify-between gap-4 flex-wrap border-l-4 border-l-orange-400">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 ring-1 ring-orange-100 dark:ring-orange-500/20 flex items-center justify-center">
          <Repeat size={24} className="text-orange-500" />
        </div>
        <div>
          {hasDue ? (
            <>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-50">今日待複習 <span className="text-orange-500 tnum">{filteredDue.length}</span> 題</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">依遺忘曲線排程回鍋的錯題，趁記憶還在鞏固起來</div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-50">錯題待消滅 <span className="text-orange-500 tnum">{filteredWrong.length}</span> 題</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">累計答對 {MASTERY_THRESHOLD} 次即學會並移出清單，不需連續</div>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {exams.length > 1 && (
          <div className="relative">
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="pl-3 pr-8 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
              title="選擇科別"
            >
              <option value="">全部科別 ({wrongItems.length})</option>
              {exams.map((exam) => (
                <option key={exam} value={exam}>{displayExam(exam)} ({examCounts[exam]})</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
        {hasDue && (
          <button
            onClick={() => startPool(filteredDue)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm transition-all duration-200 shadow-sm flex items-center gap-1.5"
          >
            <Play size={15} fill="currentColor" /> 開始複習
          </button>
        )}
        {filteredWrong.length > 0 && (
          <button
            onClick={() => startPool(filteredWrong)}
            className={hasDue
              ? 'px-4 py-2.5 rounded-xl border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-300 font-semibold text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center gap-1.5'
              : 'px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm transition-all duration-200 shadow-sm flex items-center gap-1.5'}
          >
            <Play size={15} fill="currentColor" /> 練習錯題 ({filteredWrong.length})
          </button>
        )}
      </div>
    </div>
  )
}

// ── 考試準備度 + 倒數配速（items 7、8）──
function ReadinessCard({ examStats, bankIndex, examDates, dispatch }) {
  const [now] = useState(Date.now)
  const exams = Object.keys(examStats)
  if (!exams.length) return null
  const setDate = (exam) => {
    const cur = examDates?.[exam] || ''
    const v = window.prompt(`設定「${displayExam(exam)}」目標考期（YYYY-MM-DD，留空可清除）`, cur)
    if (v == null) return
    const d = v.trim()
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) { alert('日期格式需為 YYYY-MM-DD'); return }
    dispatch({ type: 'SET_EXAM_DATE', exam, date: d })
  }
  return (
    <div className="surface-card p-6">
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
        <Gauge size={16} className="text-orange-500" />考試準備度
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">綜合題庫覆蓋率、近期正確率、錯題精通率；70% 為建議應考門檻。設定考期後顯示倒數與每日配速。</p>
      <div className="space-y-4">
        {exams.map((exam) => {
          const s = examStats[exam]
          const total = bankIndex?.exams?.[exam]?.count || s.total
          const coverage = total > 0 ? Math.min(1, s.total / total) : 0
          const accuracy = s.total > 0 ? s.correct / s.total : 0
          const masteryRate = s.everWrong > 0 ? s.mastered / s.everWrong : 1
          const score = Math.round(100 * (0.35 * coverage + 0.45 * accuracy + 0.20 * masteryRate))
          const tone = accuracyTone(score)
          const date = examDates?.[exam]
          let pacing = null
          if (date) {
            const days = Math.ceil((new Date(date + 'T00:00:00').getTime() - now) / 86400000)
            const remaining = Math.max(0, total - s.total)
            pacing = days > 0 ? { days, perDay: Math.ceil(remaining / Math.max(1, days)), remaining } : { over: true }
          }
          return (
            <div key={exam} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <span className="font-semibold text-sm">{displayExam(exam)}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-extrabold ${tone.text}`}>{score}%</span>
                  <button onClick={() => setDate(exam)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-[11px] text-gray-500 dark:text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-colors">
                    <CalendarClock size={12} /> {date ? '改考期' : '設考期'}
                  </button>
                </div>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="progress-bar h-full rounded-full" style={{ width: `${score}%`, background: tone.bar }} />
              </div>
              <div className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 tnum">
                覆蓋 {s.total}/{total}（{Math.round(coverage * 100)}%） · 正確率 {Math.round(accuracy * 100)}%
                {s.everWrong > 0 && <> · 錯題精通 {s.mastered}/{s.everWrong}</>}
              </div>
              {pacing && (
                <div className="mt-2 text-xs flex items-center gap-1.5">
                  {pacing.over ? (
                    <span className="text-gray-500 dark:text-gray-400"><CalendarClock size={12} className="inline -mt-0.5" /> 考期已到／已過（{date}）</span>
                  ) : (
                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                      <CalendarClock size={12} className="inline -mt-0.5" /> 距考試 {pacing.days} 天 · 尚有 {pacing.remaining} 題 · 建議每日 {pacing.perDay} 題
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 本週回顧卡（item 14）──
function WeeklyDelta({ v, unit = '' }) {
  if (!v) return <span className="text-[11px] text-gray-400">持平</span>
  const up = v > 0
  return (
    <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${up ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{up ? '+' : ''}{v}{unit}
    </span>
  )
}

function WeeklyReportCard({ combinedDaily }) {
  const report = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const t0 = today.getTime()
    const DAY = 86400000
    const tw = { answered: 0, correct: 0, sec: 0, days: 0 }
    const lw = { answered: 0, correct: 0, sec: 0, days: 0 }
    for (const [k, v] of Object.entries(combinedDaily || {})) {
      const t = new Date(k + 'T00:00:00').getTime()
      if (Number.isNaN(t)) continue
      const age = Math.round((t0 - t) / DAY)
      const a = v?.answered || 0
      const bucket = age >= 0 && age <= 6 ? tw : age >= 7 && age <= 13 ? lw : null
      if (!bucket) continue
      bucket.answered += a
      bucket.correct += v?.correct || 0
      bucket.sec += v?.seconds || 0
      if (a > 0) bucket.days++
    }
    const twAcc = tw.answered ? Math.round((tw.correct / tw.answered) * 100) : 0
    const lwAcc = lw.answered ? Math.round((lw.correct / lw.answered) * 100) : 0
    return { tw, lw, twAcc, lwAcc, accDelta: twAcc - lwAcc, ansDelta: tw.answered - lw.answered }
  }, [combinedDaily])

  if (report.tw.answered === 0 && report.lw.answered === 0) return null

  const enc =
    report.tw.answered === 0 ? '本週還沒開始，來刷幾題暖身吧！'
      : report.lw.answered === 0 ? `本週已完成 ${report.tw.answered} 題，累積更多資料後就能比較趨勢`
        : report.ansDelta > 0 && report.accDelta >= 0 ? '題數與正確率同步成長，狀態極佳 🚀'
        : report.accDelta > 0 ? '正確率提升，穩紮穩打 👍'
          : report.ansDelta > 0 ? '練習量增加，保持節奏 💪'
            : '本週步調稍緩，明天再衝一波 🔥'

  const tiles = [
    { label: '本週題數', value: report.tw.answered, delta: <WeeklyDelta v={report.ansDelta} /> },
    { label: '本週正確率', value: `${report.twAcc}%`, delta: <WeeklyDelta v={report.accDelta} unit="%" /> },
    { label: '學習天數', value: `${report.tw.days} 天`, delta: null },
    { label: '學習時間', value: formatDuration(report.tw.sec), delta: null },
  ]

  return (
    <div className="surface-card p-6">
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-orange-500" />本週回顧
        <span className="text-xs font-normal text-gray-400">近 7 天 vs. 前 7 天</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <div className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">{t.label}</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-gray-50 tnum">{t.value}</div>
            {t.delta && <div className="mt-0.5">{t.delta}</div>}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 flex items-center gap-1.5">
        <Sparkles size={13} className="text-orange-400" />{enc}
      </p>
    </div>
  )
}

function DailyMissionsCard({ missions, onClaim }) {
  const tasks = [
    { label: '完成暖身', value: missions.answered, target: 5 },
    { label: '答對 5 題', value: missions.correct, target: 5 },
    { label: '達成今日目標', value: missions.answered, target: missions.dailyGoal },
  ]
  const allDone = tasks.every(task => task.value >= task.target)

  return (
    <div className="mb-5 rounded-2xl border border-violet-400/40 bg-violet-500/10 p-5 text-left">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-violet-200"><Target size={17} /> 今日三任務</div>
          <p className="text-xs text-gray-400 mt-1">完成三項任務，領取額外 50 XP</p>
        </div>
        <span className="text-xs font-bold text-violet-200">{tasks.filter(task => task.value >= task.target).length}/3</span>
      </div>
      <div className="space-y-3">
        {tasks.map(task => {
          const done = task.value >= task.target
          const progress = Math.min(100, Math.round((task.value / Math.max(1, task.target)) * 100))
          return (
            <div key={task.label}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className={`flex items-center gap-1.5 ${done ? 'text-green-300' : 'text-gray-300'}`}>
                  {done ? <CheckCircle size={13} /> : <CircleProgressIcon />}{task.label}
                </span>
                <span className="text-gray-400">{Math.min(task.value, task.target)}/{task.target}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-900/40 overflow-hidden"><div className={`h-full rounded-full ${done ? 'bg-green-400' : 'bg-violet-400'}`} style={{ width: `${progress}%` }} /></div>
            </div>
          )
        })}
      </div>
      <button
        onClick={onClaim}
        disabled={!allDone || missions.claimed}
        className="w-full mt-4 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-bold disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {missions.claimed ? '今日獎勵已領取' : allDone ? '領取 +50 XP' : '完成三任務後領取'}
      </button>
    </div>
  )
}

function CircleProgressIcon() {
  return <span className="inline-block w-[13px] h-[13px] rounded-full border border-gray-500" aria-hidden="true" />
}

function DailyGoalCard({ combinedDaily, dailyGoal, dispatch }) {
  const todayCount = combinedDaily[todayKey()]?.answered || 0
  const streak = computeStreak(combinedDaily)
  const pct = Math.min(1, dailyGoal > 0 ? todayCount / dailyGoal : 0)
  const done = todayCount >= dailyGoal && dailyGoal > 0
  const milestone = streakMilestone(streak)
  const R = 30, C = 2 * Math.PI * R
  const ringColor = milestone?.gold ? '#eab308' : done ? '#16a34a' : '#ec7211'
  // 彩帶只在「本次剛達標」那一刻放一次（每天一次），用 localStorage 記日期
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (!done) return
    try {
      const key = 'quest-goal-celebrated'
      if (localStorage.getItem(key) !== todayKey()) {
        localStorage.setItem(key, todayKey())
        const start = setTimeout(() => setCelebrate(true), 0)
        const stop = setTimeout(() => setCelebrate(false), 1100)
        return () => { clearTimeout(start); clearTimeout(stop) }
      }
    } catch { /* ignore */ }
  }, [done])
  const editGoal = () => {
    const v = window.prompt('設定每日目標題數（1–500）', String(dailyGoal))
    if (v == null) return
    const n = Number(v)
    if (Number.isFinite(n) && n >= 1) dispatch({ type: 'SET_DAILY_GOAL', goal: n })
  }
  return (
    <div className="surface-card relative p-5 flex items-center justify-between gap-4 flex-wrap overflow-hidden">
      {celebrate && <ConfettiBurst />}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
          milestone?.gold
            ? 'bg-yellow-50 dark:bg-yellow-500/10 ring-1 ring-yellow-200 dark:ring-yellow-500/30'
            : streak > 0 ? 'bg-orange-50 dark:bg-orange-500/10 ring-1 ring-orange-100 dark:ring-orange-500/20' : 'bg-gray-100 dark:bg-gray-700'
        }`}>
          <Flame size={24} className={milestone?.gold ? 'text-yellow-500' : streak > 0 ? 'text-orange-500' : 'text-gray-400'} fill={streak > 0 ? 'currentColor' : 'none'} />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight flex items-center gap-2">
            <span className="tnum">{streak > 0 ? `連續學習 ${streak} 天` : '今天還沒開始'}</span>
            {milestone && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 whitespace-nowrap">🏆 {milestone.label}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {done
              ? '今日目標達成！繼續保持 🎉'
              : todayCount > 0
                ? `再 ${dailyGoal - todayCount} 題達成今日目標`
                : '每天練一點，連續天數不中斷'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-[76px] h-[76px]">
          <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
            <circle cx="38" cy="38" r={R} fill="none" strokeWidth="7" className="stroke-gray-100 dark:stroke-gray-700" />
            <circle
              cx="38" cy="38" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
              stroke={ringColor} strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
              style={{ transition: 'stroke-dashoffset 400ms ease, stroke 400ms ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-50 leading-none tnum">{todayCount}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 tnum">/ {dailyGoal} 題</span>
          </div>
        </div>
        <button
          onClick={editGoal}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="調整每日目標"
        >
          目標
        </button>
      </div>
    </div>
  )
}

// ── 學習趨勢：近 14 天每日作答量（答對＝綠、答錯＝中性灰 的堆疊長條） ──
// Colors validated (dataviz six checks): lightness band + CVD ΔE 48 + ≥3:1
// contrast on both the light (white) and dark (gray-800) card surfaces. The
// gray is a deliberate neutral "remainder", identity carried by legend+tooltip.
const TREND_COLORS = { correct: '#16a34a', wrong: '#64748b' }

function DailyTrendChart({ dailyStats }) {
  const [hover, setHover] = useState(null)
  const days = useMemo(() => {
    const out = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const v = dailyStats?.[key] || { answered: 0, correct: 0 }
      out.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, answered: v.answered || 0, correct: Math.min(v.correct || 0, v.answered || 0), seconds: v.seconds || 0 })
    }
    return out
  }, [dailyStats])

  const total = days.reduce((s, d) => s + d.answered, 0)
  const totalCorrect = days.reduce((s, d) => s + d.correct, 0)
  const totalSec14 = days.reduce((s, d) => s + d.seconds, 0)
  if (!total) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">近 14 天尚無作答紀錄，開始練習後這裡會顯示每日趨勢。</p>
  }

  const W = 560, plotH = 150, labelH = 20, H = plotH + labelH
  const slot = W / 14, barW = 24
  const maxV = Math.max(...days.map(d => d.answered))
  const ceil = Math.max(5, Math.ceil(maxV / 5) * 5)
  const hOf = v => (v / ceil) * (plotH - 10)
  // 頂端資料端 4px 圓角（只有最上面的分段有）
  const topRound = (x, y0, w, h, r) => {
    const rr = Math.max(0, Math.min(r, h / 2, w / 2))
    return `M${x},${y0 + h} L${x},${y0 + rr} Q${x},${y0} ${x + rr},${y0} L${x + w - rr},${y0} Q${x + w},${y0} ${x + w},${y0 + rr} L${x + w},${y0 + h} Z`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          近 14 天共 <span className="font-bold text-gray-700 dark:text-gray-200">{total}</span> 題，
          正確率 <span className="font-bold text-gray-700 dark:text-gray-200">{Math.round((totalCorrect / total) * 100)}%</span>
          {totalSec14 >= 60 && (
            <>，學習 <span className="font-bold text-gray-700 dark:text-gray-200">{formatDuration(totalSec14)}</span></>
          )}
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TREND_COLORS.correct }} />答對</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TREND_COLORS.wrong }} />答錯</span>
        </div>
      </div>
      <div className="relative">
        {hover !== null && (
          <div
            className="absolute z-10 -top-2 -translate-y-full -translate-x-1/2 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: `${Math.min(92, Math.max(8, ((hover + 0.5) / 14) * 100))}%` }}
          >
            <div className="font-semibold mb-0.5">{days[hover].label}</div>
            <div>
              答對 {days[hover].correct} · 答錯 {days[hover].answered - days[hover].correct} · 共 {days[hover].answered} 題
              {days[hover].seconds >= 60 && <> · {formatDuration(days[hover].seconds)}</>}
            </div>
          </div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`近 14 天每日作答趨勢，共 ${total} 題，答對 ${totalCorrect} 題`}
        >
          {/* 基準格線（低調） */}
          {[0.5, 1].map(f => (
            <g key={f}>
              <line x1={0} x2={W} y1={plotH - hOf(ceil * f)} y2={plotH - hOf(ceil * f)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
              <text x={0} y={plotH - hOf(ceil * f) - 3} className="fill-gray-400 dark:fill-gray-500" fontSize="10">{ceil * f}</text>
            </g>
          ))}
          <line x1={0} x2={W} y1={plotH} y2={plotH} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1" />
          {days.map((d, i) => {
            const x = i * slot + (slot - barW) / 2
            const hC = hOf(d.correct)
            const hA = hOf(d.answered)
            const wrong = d.answered - d.correct
            // 分段之間留 2px 表面間隙
            const hW = wrong > 0 ? Math.max(0, hA - hC - 2) : 0
            const dim = hover !== null && hover !== i ? 0.45 : 1
            return (
              <g key={d.key} opacity={dim} style={{ transition: 'opacity 120ms' }}>
                {d.correct > 0 && (
                  wrong > 0 && hW > 0
                    ? <rect x={x} y={plotH - hC} width={barW} height={hC} fill={TREND_COLORS.correct} />
                    : <path d={topRound(x, plotH - hC, barW, hC, 4)} fill={TREND_COLORS.correct} />
                )}
                {hW > 0 && (
                  <path d={topRound(x, plotH - hA, barW, hW, 4)} fill={TREND_COLORS.wrong} />
                )}
                {i % 2 === 1 && (
                  <text x={x + barW / 2} y={H - 5} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize="10">{d.label}</text>
                )}
                {/* 滑鼠/觸控目標：整個 slot 高度 */}
                <rect
                  x={i * slot} y={0} width={slot} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onTouchStart={() => setHover(hover === i ? null : i)}
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ── 管理端：使用者用量總覽（僅 ?admin 且 email 在 Worker 白名單時有資料） ──
function AdminUsage() {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    fetchAdminOverview().then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [])
  if (!data?.users?.length) return null
  const fmtDay = (ms) => (ms ? new Date(ms).toLocaleDateString('zh-TW') : '—')
  return (
    <div className="surface-card p-6">
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
        <Users size={16} className="text-orange-500" />使用者用量（管理）
        <span className="text-xs font-normal text-gray-400">共 {data.users.length} 人</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-4 font-medium">使用者</th>
              <th className="py-2 pr-4 font-medium text-right">碰過題數</th>
              <th className="py-2 pr-4 font-medium text-right">總作答</th>
              <th className="py-2 pr-4 font-medium text-right">學習時數</th>
              <th className="py-2 pr-4 font-medium text-right">最後活躍</th>
              <th className="py-2 font-medium text-right">加入</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <td className="py-2.5 pr-4">
                  <div className="font-medium truncate max-w-[200px]">{u.name || '—'}</div>
                  <div className="text-xs text-gray-400 truncate max-w-[200px]">{u.email}</div>
                </td>
                <td className="py-2.5 pr-4 text-right font-mono">{u.questions_touched}</td>
                <td className="py-2.5 pr-4 text-right font-mono">{u.answered_total}</td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap">{formatDuration(u.seconds_total)}</td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap">{u.last_active_day || '—'}</td>
                <td className="py-2.5 text-right whitespace-nowrap text-xs text-gray-400">{fmtDay(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 等級排行榜 ────────────────────────────────────────────────────────────
// XP/名次由後端從已同步的 progress 直接推導（與 gamify.computeXP 同公式），
// 前端只負責顯示；未設定同步或未登入時給登入提示。前三名獎牌、highlight 自己。
const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

function LeaderRow({ row, isMe }) {
  const lv = levelInfo(row.xp || 0)
  const name = row.name || '匿名學習者'
  const medal = RANK_MEDAL[row.rank]
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
      isMe
        ? 'border-orange-300 dark:border-orange-700/70 bg-orange-50/80 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800'
        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
    }`}>
      <div className="w-7 shrink-0 text-center">
        {medal
          ? <span className="text-lg leading-none">{medal}</span>
          : <span className="text-sm font-bold text-gray-400 dark:text-gray-500 tnum">{row.rank}</span>}
      </div>
      {row.picture
        ? <img src={row.picture} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full shrink-0 ring-1 ring-black/5 dark:ring-white/10" />
        : <div className="w-9 h-9 rounded-full shrink-0 bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white text-sm font-bold">{name.slice(0, 1).toUpperCase()}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-50">{name}</span>
          {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold shrink-0">你</span>}
        </div>
        <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">Lv.{lv.level} · {lv.name} · {row.answered} 題</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-orange-500 tnum">{(row.xp || 0).toLocaleString()}</div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500">XP</div>
      </div>
    </div>
  )
}

function Leaderboard({ user, setUser }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | error

  const load = useCallback(() => {
    setStatus('loading')
    fetchLeaderboard(20)
      .then((d) => { if (d) { setData(d); setStatus('idle') } else setStatus('error') })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [user, load])

  const header = (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Trophy size={18} className="text-orange-500" />等級排行榜
      </h3>
      {user && (
        <button
          onClick={load}
          disabled={status === 'loading'}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={12} className={status === 'loading' ? 'animate-spin' : ''} /> 更新
        </button>
      )}
    </div>
  )

  // 同步未啟用（本 build 未帶 API/OAuth 設定）
  if (!isSyncConfigured()) {
    return (
      <div>
        {header}
        <p className="text-sm text-gray-500 dark:text-gray-400">排行榜需要雲端同步功能，此版本尚未啟用。</p>
      </div>
    )
  }

  // 未登入：引導登入（登入本身仍是選用的同步功能，不影響進站）
  if (!user) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
            <Trophy size={26} className="text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">登入即可查看排行榜並上榜</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">用 Google 登入後，你的等級與 XP 會跨裝置同步，並和其他學習者一起排名。</p>
          </div>
          <GoogleSignInButton onSuccess={(u) => setUser?.(u)} />
        </div>
      </div>
    )
  }

  if (status === 'loading' && !data) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> 載入排行榜…
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div>
        {header}
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">排行榜載入失敗，請稍後再試。</p>
          <button onClick={load} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">重新載入</button>
        </div>
      </div>
    )
  }

  const top = data?.top || []
  const me = data?.me || null
  const meInTop = me && top.some((r) => r.id === me.id)

  return (
    <div>
      {header}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        依 XP 由已同步的作答紀錄計算，共 {data?.total || 0} 位學習者。多練題、精通錯題就能往上爬。
      </p>
      {top.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">還沒有人上榜，快去練題搶頭香！</p>
      ) : (
        <div className="space-y-1">
          {top.map((row) => (
            <LeaderRow key={row.id} row={row} isMe={me?.id === row.id} />
          ))}
        </div>
      )}
      {/* 自己不在前 20：附一條分隔＋自己的名次 */}
      {me && !meInTop && (
        <>
          <div className="flex items-center gap-2 my-2 px-3">
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
            <span className="text-[10px] text-gray-400">你的名次</span>
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
          </div>
          <LeaderRow row={me} isMe />
        </>
      )}
    </div>
  )
}

function StatsTab({ state, dispatch, qMap, user, setUser, bankIndex, facts, achievements, combinedDaily }) {
  const [activeSection, setActiveSection] = useState('overview')
  const history = state.statsHistory
  const entries = Object.entries(history)
  // Persisted/synced progress strips the heavy `question` object, so rehydrate
  // it from the loaded question bank (keyed by `${exam}-${id}`). Items whose
  // question isn't in the bank (not loaded yet / removed) are dropped so the
  // practice launcher never receives an undefined question and crashes.
  const rehydrate = (k, v) => {
    const q = v?.question || qMap?.get(k)
    if (!q) return null
    return { key: k, ...v, question: q, exam: q.exam, id: q.id, type: q.type }
  }
  // 統計數字全部取自共用的 computeGamifyFacts（與標頭等級、成就 toast 同一份資料）
  const totalAnswered = facts.answered
  const totalCorrect = facts.correct
  const overallAccuracy = facts.accuracy
  const totalStudySec = facts._totalStudySec
  // 實際練習量：每次作答都計（含重複刷同一題），由每日統計累加、跨裝置同步
  const totalPracticed = Object.values(combinedDaily).reduce((s, v) => s + (v?.answered || 0), 0)
  const examStats = facts._examStats
  const excludedExams = getExcludedExams(state.earnedCertifications)
  const activeExamStats = Object.fromEntries(Object.entries(examStats).filter(([exam]) => !excludedExams.has(exam)))
  const masteredCount = facts._masteredCount
  const glevel = facts._glevel
  const streak = facts.streak
  const unlockedCount = achievements.filter(a => a.done).length

  // Wrong questions: 答錯過且累計答對未達 MASTERY_THRESHOLD 次（尚未學會）的題目
  const wrongQuestions = entries
    .filter(([, v]) => (v.everWrong ?? !v.correct) && (v.correctCount ?? v.correctStreak ?? 0) < MASTERY_THRESHOLD)
    .map(([k, v]) => rehydrate(k, v))
    .filter(Boolean)

  // SRS 待複習（item 13）：到期的錯題，最逾期的排前面
  const reviewDue = entries
    .filter(([, v]) => isDue(v) && !excludedExams.has(v.exam))
    .map(([k, v]) => ({ item: rehydrate(k, v), over: overdueBy(v) }))
    .filter((x) => x.item)
    .sort((a, b) => b.over - a.over)
    .map((x) => x.item)

  // 分享成績卡（item 12）
  const [sharing, setSharing] = useState(false)
  const doShare = async () => {
    setSharing(true)
    try {
      await shareScoreCard({
        level: glevel.level, title: glevel.name, xp: glevel.xp, pct: glevel.pct,
        answered: totalAnswered, accuracy: overallAccuracy, streak, bestCombo: state.bestCombo,
        name: user?.name || '', dateStr: new Date().toLocaleDateString('zh-TW'),
      })
    } catch { /* 使用者取消或環境不支援，忽略 */ } finally {
      setSharing(false)
    }
  }

  // Bookmarked / review: rehydrate from the bank so entries show (and can be
  // practiced) even if the question was never answered locally.
  const bookmarkedList = Object.entries(state.bookmarked)
    .filter(([, v]) => v)
    .map(([k]) => rehydrate(k, history[k] || {}))
    .filter(Boolean)

  const reviewList = Object.entries(state.reviewMarked)
    .filter(([, v]) => v)
    .map(([k]) => rehydrate(k, history[k] || {}))
    .filter(Boolean)

  // ── 進度備份／還原 ──
  const exportProgress = () => {
    const payload = {
      app: 'quest-progress',
      version: 1,
      exportedAt: new Date().toISOString(),
      statsHistory: stripQuestions(state.statsHistory),
      bookmarked: state.bookmarked,
      reviewMarked: state.reviewMarked,
      dailyStats: state.dailyStats,
      earnedCertifications: state.earnedCertifications,
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quest-progress-${todayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
    dispatch({ type: 'SET_FLAG', flag: 'export' })
  }

  const importProgress = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!data || typeof data.statsHistory !== 'object') throw new Error('不是進度備份檔')
        const merged = mergeMaps(
          { statsHistory: state.statsHistory, bookmarked: state.bookmarked, reviewMarked: state.reviewMarked },
          { statsHistory: data.statsHistory || {}, bookmarked: data.bookmarked || {}, reviewMarked: data.reviewMarked || {} }
        )
        dispatch({ type: 'RESTORE_STATS', statsHistory: merged.statsHistory })
        dispatch({ type: 'RESTORE_BOOKMARKS', bookmarked: merged.bookmarked })
        dispatch({ type: 'RESTORE_REVIEWS', reviewMarked: merged.reviewMarked })
        if (data.earnedCertifications && typeof data.earnedCertifications === 'object') {
          dispatch({ type: 'RESTORE_CERTIFICATIONS', earnedCertifications: { ...state.earnedCertifications, ...data.earnedCertifications } })
        }
        // dailyStats 逐日取較大值，重複匯入不會翻倍
        const mergedDaily = { ...state.dailyStats }
        for (const [day, v] of Object.entries(data.dailyStats || {})) {
          const cur = mergedDaily[day] || { answered: 0, correct: 0 }
          mergedDaily[day] = {
            answered: Math.max(cur.answered || 0, v?.answered || 0),
            correct: Math.max(cur.correct || 0, v?.correct || 0),
            seconds: Math.max(cur.seconds || 0, v?.seconds || 0),
          }
        }
        dispatch({ type: 'RESTORE_DAILY', dailyStats: mergedDaily })
        alert(`匯入完成：${Object.keys(data.statsHistory || {}).length} 筆作答紀錄已合併。`)
      } catch (err) {
        alert(`匯入失敗：${err.message || '無法解析檔案'}`)
      }
    }
    reader.readAsText(file)
  }

  const dataManageCard = (
    <div className="surface-card p-6">
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
        <Database size={16} className="text-orange-500" />資料管理
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={exportProgress}
          className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          <ArrowDown size={14} /> 匯出進度備份
        </button>
        <label className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer">
          <ArrowUp size={14} /> 匯入備份（合併）
          <input type="file" accept="application/json,.json" className="hidden" onChange={importProgress} />
        </label>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          匯出成 JSON 檔備份作答紀錄／書籤／複習標記／已取得證照；匯入時與現有進度合併。
        </span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 等級 + XP（含分享成績卡） */}
      <LevelCard level={glevel} unlocked={unlockedCount} total={achievements.length} bestCombo={state.bestCombo} onShare={doShare} sharing={sharing} />

      {/* 錯題／複習快速入口：有到期複習或錯題就常駐頂部，一鍵開練 */}
      {(reviewDue.length > 0 || wrongQuestions.length > 0) && (
        <ReviewDueCard items={reviewDue} wrongItems={wrongQuestions} dispatch={dispatch} />
      )}

      {/* 每日目標＋連續學習 */}
      <DailyGoalCard combinedDaily={combinedDaily} dailyGoal={state.dailyGoal} dispatch={dispatch} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="總練習量" value={Math.max(totalPracticed, totalAnswered)} icon={CheckCircle} />
        <StatCard label="答對" value={totalCorrect} icon={Trophy} />
        <StatCard label="正確率" value={`${overallAccuracy}%`} icon={Target} />
        <StatCard label="錯題數" value={wrongQuestions.length} icon={XCircle} onClick={() => { setActiveSection('wrong'); document.getElementById('stats-sections')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
        <StatCard label="學習總時數" value={formatDuration(totalStudySec)} icon={Clock} />
      </div>

      {/* Overall accuracy visual */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">整體正確率</span>
          <span className={`text-2xl font-extrabold ${accuracyTone(overallAccuracy).text}`}>{overallAccuracy}%</span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="progress-bar h-full rounded-full" style={{ width: `${overallAccuracy}%`, background: accuracyTone(overallAccuracy).bar }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">0%</span>
          <span className="text-xs text-gray-400 font-medium">及格線 70%</span>
          <span className="text-xs text-gray-400">100%</span>
        </div>
      </div>

      {/* 考試準備度 + 倒數配速（items 7、8） */}
      <ReadinessCard examStats={activeExamStats} bankIndex={bankIndex} examDates={state.examDates} dispatch={dispatch} />

      {/* 學習趨勢（近 14 天） */}
      <div className="surface-card p-6">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
          <BarChart3 size={16} className="text-orange-500" />學習趨勢
        </h3>
        <DailyTrendChart dailyStats={combinedDaily} />
      </div>

      {/* 本週回顧（item 14） */}
      <WeeklyReportCard combinedDaily={combinedDaily} />

      {/* Section tabs */}
      <div id="stats-sections" className="flex gap-2 overflow-x-auto pb-1 scroll-mt-24">
        {[
          { key: 'overview', label: '各科正確率', icon: Target },
          { key: 'achieve', label: `成就 (${unlockedCount}/${achievements.length})`, icon: Award },
          ...(isSyncConfigured() ? [{ key: 'leaderboard', label: '排行榜', icon: Trophy }] : []),
          { key: 'wrong', label: `錯題清單 (${wrongQuestions.length})`, icon: XCircle },
          { key: 'bookmark', label: `書籤 (${bookmarkedList.length})`, icon: Star },
          { key: 'review', label: `複習 (${reviewList.length})`, icon: Flag },
          { key: 'certifications', label: `已取得證照 (${Object.values(state.earnedCertifications).filter(isCertificationEarned).length})`, icon: BadgeCheck },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
              activeSection === s.key
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <s.icon size={14} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="surface-card p-6 animate-fade-in" key={activeSection}>
        {activeSection === 'achieve' && (
          <div>
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Award size={18} className="text-orange-500" />成就徽章
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">已解鎖 {unlockedCount} / {achievements.length} 個。灰色為未達成（會顯示進度），隱藏成就要達成後才會揭曉。</p>
            {ACHIEVEMENT_GROUPS.map(g => {
              const items = achievements.filter(a => a.group === g.key)
              if (!items.length) return null
              const got = items.filter(a => a.done).length
              return (
                <div key={g.key} className="mb-6 last:mb-0">
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
                    {g.label}
                    <span className="text-xs font-normal text-gray-400 tnum">{got}/{items.length}</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items.map(a => {
                      const secret = a.group === 'hidden' && !a.done
                      const pct = a.goal > 0 ? Math.min(1, a.cur / a.goal) : 0
                      return (
                        <div
                          key={a.id}
                          className={`relative p-4 rounded-xl border text-center transition-all ${
                            a.done
                              ? 'border-orange-200 dark:border-orange-800/60 bg-gradient-to-b from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40'
                          }`}
                          title={secret ? '隱藏成就' : a.desc}
                        >
                          <div className={`w-11 h-11 mx-auto mb-2 rounded-2xl flex items-center justify-center ${
                            a.done ? 'bg-orange-100 dark:bg-orange-500/20 ring-1 ring-orange-200 dark:ring-orange-500/30' : 'bg-gray-200/70 dark:bg-gray-700'
                          }`}>
                            {secret
                              ? <Lock size={20} className="text-gray-400 dark:text-gray-500" />
                              : <a.icon size={22} className={a.done ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'} />}
                          </div>
                          <div className={`text-sm font-semibold ${a.done ? 'text-gray-900 dark:text-gray-50' : 'text-gray-500 dark:text-gray-400'}`}>{secret ? '???' : a.name}</div>
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{secret ? '達成後揭曉' : a.desc}</div>
                          {a.done ? (
                            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-500">
                              <CheckCircle size={12} /> 已解鎖
                            </div>
                          ) : !secret && a.progress ? (
                            <div className="mt-2">
                              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-400/70 rounded-full" style={{ width: `${pct * 100}%` }} />
                              </div>
                              <div className="text-[10px] text-gray-400 mt-1 tnum">{a.cur}{a.unit} / {a.goal}{a.unit}</div>
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] text-gray-400">尚未解鎖</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {activeSection === 'leaderboard' && (
          <Leaderboard user={user} setUser={setUser} />
        )}
        {activeSection === 'overview' && (
          <div>
            <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <Target size={18} className="text-orange-500" />各科正確率
            </h3>
            <div className="space-y-4">
              {Object.entries(examStats).map(([exam, s]) => {
                const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                const tone = accuracyTone(pct)
                return (
                  <div key={exam} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{displayExam(exam)}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{s.correct}/{s.total}</span>
                        <span className={`font-bold ${tone.text}`}>{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="progress-bar h-full rounded-full" style={{ width: `${pct}%`, background: tone.bar }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeSection === 'wrong' && (
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-lg font-semibold flex items-center gap-2"><XCircle size={18} className="text-red-500" />錯題清單</h3>
              {wrongQuestions.length >= 3 && (
                <button
                  onClick={() => {
                    const pool = wrongQuestions.map(w => w.question)
                    const count = Math.min(pool.length, 65)
                    // 每題約 1.5 分鐘，向上取 5 分鐘的倍數，至少 10 分鐘
                    const timeLimit = Math.max(10, Math.ceil((count * 1.5) / 5) * 5)
                    if (window.confirm(`以 ${count} 道錯題進行限時模擬考（${timeLimit} 分鐘）？`)) {
                      dispatch({ type: 'START_EXAM', pool, count, timeLimit })
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-1.5 shadow-sm"
                >
                  <Clock size={12} /> 錯題模擬考
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              累計答對 {MASTERY_THRESHOLD} 次即視為學會並移出清單，不需連續。
              {masteredCount > 0 && <span className="text-green-600 dark:text-green-400 font-medium"> 已學會 {masteredCount} 題。</span>}
            </p>
            {wrongQuestions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">太棒了！目前沒有錯題</p>
            ) : (
              <QuestionList items={wrongQuestions} dispatch={dispatch} showMastery defaultCollapsed />
            )}
          </div>
        )}

        {activeSection === 'bookmark' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Star size={18} className="text-yellow-500" />書籤清單</h3>
            {bookmarkedList.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">尚未加入書籤</p>
            ) : (
              <QuestionList items={bookmarkedList} dispatch={dispatch} />
            )}
          </div>
        )}

        {activeSection === 'review' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Flag size={18} className="text-orange-500" />複習清單</h3>
            {reviewList.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">尚未標記複習</p>
            ) : (
              <QuestionList items={reviewList} dispatch={dispatch} />
            )}
          </div>
        )}

        {activeSection === 'certifications' && (
          <CertificationShelf
            earnedCertifications={state.earnedCertifications}
            bankIndex={bankIndex}
            dispatch={dispatch}
          />
        )}
      </div>

      {/* 資料管理：進度備份／還原 */}
      {dataManageCard}

      {/* 管理端用量（僅 ?admin） */}
      {isAdmin && <AdminUsage />}
    </div>
  )
}

function CertificationShelf({ earnedCertifications, bankIndex, dispatch }) {
  const available = CERTIFICATIONS.filter(cert => cert.exams.some(exam => bankIndex?.exams?.[exam]))
  const sorted = [...available].sort((a, b) => Number(isCertificationEarned(earnedCertifications[b.id])) - Number(isCertificationEarned(earnedCertifications[a.id])))
  const earnedCount = sorted.filter(cert => isCertificationEarned(earnedCertifications[cert.id])).length

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><BadgeCheck size={19} className="text-orange-500" />已取得證照</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">標記後仍可手動練習，但今日學習計畫不會再推薦該證照的考科版本。</p>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm font-bold">{earnedCount} / {sorted.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(cert => {
          const entry = earnedCertifications[cert.id]
          const earned = isCertificationEarned(entry)
          return (
            <div key={cert.id} className={`relative rounded-2xl border p-4 transition-all ${earned ? 'border-orange-300 dark:border-orange-700 bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-gray-800 shadow-sm' : 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40'}`}>
              {earned && <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-1 text-[10px] font-bold text-green-700 dark:text-green-300"><CheckCircle size={11} /> 已取得</span>}
              <div className="h-28 flex items-center justify-center mb-3">
                <img src={`${BASE_URL}${cert.badge}`} alt={cert.name} className={`max-h-28 max-w-[150px] object-contain transition-all ${earned ? '' : 'grayscale opacity-45'}`} />
              </div>
              <div className="text-[10px] font-bold tracking-widest text-orange-500 mb-1">{cert.provider}</div>
              <div className="text-sm font-bold text-gray-900 dark:text-gray-50 leading-snug min-h-10">{cert.name}</div>
              <div className="text-[11px] text-gray-400 mt-1 mb-3">{cert.exams.filter(exam => bankIndex?.exams?.[exam]).join(' / ')}</div>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_CERTIFICATION', certId: cert.id })}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors ${earned ? 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
              >
                {earned ? '取消已取得標記' : '標記為已取得'}
              </button>
              {earned && entry?.earnedAt && <div className="text-[10px] text-gray-400 text-center mt-2">標記日期：{new Date(entry.earnedAt).toLocaleDateString('zh-TW')}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuestionList({ items, dispatch, showMastery = false, defaultCollapsed = false }) {
  const allQuestions = items.map(item => item.question)

  // 錯題清單的「學會進度」徽章：累計答對 n/MASTERY_THRESHOLD
  const MasteryBadge = ({ item }) => {
    if (!showMastery) return null
    const count = item.correctCount ?? item.correctStreak ?? 0
    return (
      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
        count > 0
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
      }`}>
        答對 {count}/{MASTERY_THRESHOLD}
      </span>
    )
  }

  // Group by exam
  const grouped = useMemo(() => {
    const map = {}
    items.forEach(item => {
      if (!map[item.exam]) map[item.exam] = []
      map[item.exam].push(item)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])

  const hasMultipleExams = grouped.length > 1
  const [collapsedExams, setCollapsedExams] = useState({})
  const isCollapsed = (exam) => (exam in collapsedExams ? collapsedExams[exam] : defaultCollapsed)
  const toggleExam = (exam) => setCollapsedExams(prev => ({ ...prev, [exam]: !(exam in prev ? prev[exam] : defaultCollapsed) }))

  return (
    <div className="space-y-2.5">
      {items.length > 1 && (
        <button
          onClick={() => dispatch({ type: 'GOTO_PRACTICE_QUESTION', question: allQuestions[0], questions: allQuestions, startIndex: 0 })}
          className="w-full mb-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <Play size={14} /> 全部練習 ({items.length} 題)
        </button>
      )}
      {hasMultipleExams ? grouped.map(([exam, examItems]) => {
        const collapsed = isCollapsed(exam)
        const examQuestions = examItems.map(item => item.question)
        return (
          <div key={exam} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleExam(exam)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                {collapsed ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                <span className="text-sm font-semibold">{displayExam(exam)}</span>
                <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg font-medium">{examItems.length} 題</span>
              </div>
              <div className="flex items-center gap-1.5">
                {showMastery && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm(`確定要將 ${exam} 的 ${examItems.length} 道錯題標記為已學會並移出清單嗎？`)) {
                        dispatch({ type: 'CLEAR_WRONG_BY_EXAM', exam })
                      }
                    }}
                    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-semibold transition-all duration-200 flex items-center gap-1"
                  >
                    <X size={12} /> 清除此科
                  </span>
                )}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'GOTO_PRACTICE_QUESTION', question: examQuestions[0], questions: examQuestions, startIndex: 0 }) }}
                  className="px-3 py-1 text-xs bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-1 shadow-sm"
                >
                  <Play size={12} /> 練習此科
                </span>
              </div>
            </button>
            {!collapsed && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {examItems.map(item => {
                  const globalIdx = items.indexOf(item)
                  return (
                    <div key={item.key} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors duration-200">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold">#{item.id}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium">{typeLabels[item.type]}</span>
                        <MasteryBadge item={item} />
                      </div>
                      <button
                        onClick={() => dispatch({ type: 'GOTO_PRACTICE_QUESTION', question: item.question, questions: allQuestions, startIndex: globalIdx })}
                        className="px-3.5 py-1.5 text-xs bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-1 shadow-sm"
                      >
                        <RotateCcw size={12} /> 重做
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }) : items.map((item, idx) => (
        <div key={item.key} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-200 group">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold">{item.exam} #{item.id}</span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium">{typeLabels[item.type]}</span>
            <MasteryBadge item={item} />
          </div>
          <button
            onClick={() => dispatch({ type: 'GOTO_PRACTICE_QUESTION', question: item.question, questions: allQuestions, startIndex: idx })}
            className="px-3.5 py-1.5 text-xs bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-1 shadow-sm"
          >
            <RotateCcw size={12} /> 重做
          </button>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════
// Empty State
// ══════════════════════════════════════════
function EmptyState({ message, icon: Icon, action, actionLabel }) {
  const spinning = Icon === Loader2
  return (
    <div className="surface-card p-16 text-center animate-fade-in">
      {/* Soft layered "scene": concentric rings behind the icon give the empty
          state a bit more presence than a bare square. */}
      <div className="relative w-28 h-28 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-orange-100/50 dark:bg-orange-500/5" />
        <div className="absolute inset-3 rounded-full bg-orange-100/70 dark:bg-orange-500/10" />
        <div className="absolute inset-6 rounded-2xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center ring-1 ring-orange-100 dark:ring-orange-500/20">
          <Icon size={30} className={`text-orange-400 dark:text-orange-300/80 ${spinning ? 'animate-spin' : ''}`} />
        </div>
      </div>
      <p className="text-gray-500 dark:text-gray-400 mb-5 text-base">{message}</p>
      {action && (
        <button
          onClick={action}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
