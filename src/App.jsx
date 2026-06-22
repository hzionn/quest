import { useState, useReducer, useEffect, useMemo, useRef } from 'react'
import {
  Upload, FileJson, CheckCircle, XCircle, Sun, Moon, Star, Flag,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Play, Square,
  BarChart3, BookOpen, Clock, Filter, Search, Plus, Minus, RotateCcw,
  AlertCircle, Trophy, Target, ListChecks, Shuffle, X, Database,
  Github, Key, RefreshCw, Trash2, Eye, EyeOff, FileText, Shield, Loader2,
  Languages, LogOut
} from 'lucide-react'
import awsLogo from '/aws.png'
import { extractTextFromPDF, parseExamDump } from './pdfParser'

// ── GitHub Config (admin only) ──
const GITHUB_OWNER = 'awsjin510'
const GITHUB_REPO = 'quest'
const GITHUB_BRANCH = 'claude/aws-exam-practice-app-mSqvt'
const DATA_PATH = 'public/data'
const BASE_URL = import.meta.env.BASE_URL || '/quest/'
// Cache-bust token computed fresh on every page load (not at build time), so a
// plain refresh always re-fetches the question bank from the network and can
// never be served a stale copy by the browser or CDN. Combined with the
// cache:'no-store' option on every data fetch below.
const DATA_VERSION = String(Date.now())

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

// ── Helper: 判斷一題作答是否正確（練習與自動跳題共用） ──
function computeCorrect(q, userAns) {
  if (!q) return false
  const matchSet = (a, b) => Array.isArray(a) && a.length === b.length &&
    [...a].sort().join(',') === [...b].sort().join(',')
  if (q.type === 'single') {
    return userAns === q.answer
  } else if (q.type === 'multiple') {
    return Array.isArray(userAns) && Array.isArray(q.answer) && matchSet(userAns, q.answer)
  } else if (q.type === 'matching') {
    if (q.matches?.length > 0) {
      return q.matches.every((m, i) => userAns && userAns[i] === m.correct_answer)
    } else if (q.options && q.answer) {
      return matchSet(userAns, Array.isArray(q.answer) ? q.answer : [q.answer])
    }
    return userAns === 'self-assessed-correct'
  } else if (q.type === 'ordering') {
    if (q.ordered_steps?.length > 0) {
      return Array.isArray(userAns) && userAns.length === q.ordered_steps.length &&
        userAns.every((s, i) => s === q.ordered_steps[i])
    } else if (q.options && q.answer) {
      return matchSet(userAns, Array.isArray(q.answer) ? q.answer : [q.answer])
    }
    return userAns === 'self-assessed-correct'
  }
  return false
}

// ── Reducer ──
function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_DARK':
      return { ...state, darkMode: !state.darkMode }

    case 'SET_LANG':
      return { ...state, lang: action.lang }

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
      return {
        ...state,
        filterExam: exam,
        filterType: '',
        filterSearch: '',
        practiceFiltered: filtered,
        practiceIndex: 0,
        activeTab: 'practice',
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
      // 累計答對次數：答對 +1，答錯不歸零
      const correctCount = prevCount + (correct ? 1 : 0)
      // 一旦答錯過就視為錯題；累計答對 MASTERY_THRESHOLD 次後才算學會並移出清單
      const everWrong = (prevEntry ? (prevEntry.everWrong ?? !prevEntry.correct) : false) || !correct
      return {
        ...state,
        practiceSubmitted: { ...state.practiceSubmitted, [qKey]: true },
        practiceResults: { ...state.practiceResults, [qKey]: correct },
        statsHistory: {
          ...state.statsHistory,
          [qKey]: { correct, correctCount, everWrong, exam: q.exam, type: q.type, id: q.id, question: q }
        }
      }
    }

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
      let pool = [...state.questions]
      if (state.examConfig.examFilter) pool = pool.filter(q => q.exam === state.examConfig.examFilter)
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      const selected = pool.slice(0, Math.min(state.examConfig.count, pool.length))
      const ids = selected.map(q => `${q.exam}-${q.id}`)
      return {
        ...state,
        examActive: true,
        examQuestionIds: ids,
        examIndex: 0,
        examAnswers: {},
        examEndTime: Date.now() + state.examConfig.timeLimit * 60 * 1000,
        examRemaining: state.examConfig.timeLimit * 60,
        examSubmitted: false,
        examResults: null,
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
        let correct = false
        if (q.type === 'single') correct = userAns === q.answer
        else if (q.type === 'multiple') {
          correct = Array.isArray(userAns) && Array.isArray(q.answer) &&
            userAns.length === q.answer.length &&
            [...userAns].sort().join(',') === [...q.answer].sort().join(',')
        } else if (q.type === 'matching') {
          if (q.matches?.length > 0) {
            correct = q.matches.every((m, i) => userAns && userAns[i] === m.correct_answer)
          } else if (q.options && q.answer) {
            const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer]
            correct = Array.isArray(userAns) &&
              userAns.length === correctAnswers.length &&
              [...userAns].sort().join(',') === [...correctAnswers].sort().join(',')
          } else {
            correct = userAns === 'self-assessed-correct'
          }
        } else if (q.type === 'ordering') {
          if (q.ordered_steps?.length > 0) {
            correct = Array.isArray(userAns) &&
              userAns.length === q.ordered_steps.length &&
              userAns.every((s, i) => s === q.ordered_steps[i])
          } else if (q.options && q.answer) {
            const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer]
            correct = Array.isArray(userAns) &&
              userAns.length === correctAnswers.length &&
              [...userAns].sort().join(',') === [...correctAnswers].sort().join(',')
          } else {
            correct = userAns === 'self-assessed-correct'
          }
        }
        if (correct) totalCorrect++
        if (!typeStats[q.type]) typeStats[q.type] = { total: 0, correct: 0 }
        typeStats[q.type].total++
        if (correct) typeStats[q.type].correct++
        return { qKey, correct, question: q }
      })
      const newHistory = { ...state.statsHistory }
      details.forEach(d => {
        const prevEntry = state.statsHistory[d.qKey]
        const prevCount = prevEntry?.correctCount ?? prevEntry?.correctStreak ?? 0
        const correctCount = prevCount + (d.correct ? 1 : 0)
        const everWrong = (prevEntry ? (prevEntry.everWrong ?? !prevEntry.correct) : false) || !d.correct
        newHistory[d.qKey] = { correct: d.correct, correctCount, everWrong, exam: d.question.exam, type: d.question.type, id: d.question.id, question: d.question }
      })
      return {
        ...state,
        examActive: false,
        examSubmitted: true,
        examResults: {
          total: state.examQuestionIds.length,
          correct: totalCorrect,
          typeStats,
          details
        },
        statsHistory: newHistory
      }
    }

    case 'GOTO_PRACTICE_QUESTION': {
      const q = action.question
      const questions = action.questions || [q]
      const startIndex = action.startIndex ?? 0
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
        newHistory[k] = { ...v, correctCount: MASTERY_THRESHOLD }
      })
      return { ...state, statsHistory: newHistory }
    }

    case 'RESTORE_STATS':
      return { ...state, statsHistory: action.statsHistory }

    case 'RESTORE_BOOKMARKS':
      return { ...state, bookmarked: action.bookmarked }

    case 'RESTORE_REVIEWS':
      return { ...state, reviewMarked: action.reviewMarked }

    case 'SET_GITHUB_LOADING':
      return { ...state, githubLoading: action.value }

    case 'SET_GITHUB_SYNCING':
      return { ...state, githubSyncing: action.value }

    case 'SET_GITHUB_BANKS':
      return { ...state, githubBanks: action.banks }

    case 'SET_GITHUB_ERROR':
      return { ...state, githubError: action.error }

    case 'CLEAR_ALL_DATA':
      try { localStorage.removeItem('quest-stats') } catch {}
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
// 錯題清單：需累計答對這麼多次才算「學會」並移出清單（答錯不會歸零）
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
          <img src={awsLogo} alt="AWS" className="h-16" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">AWS 證照考試練習器</h2>
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
      </form>
    </div>
  )
}

// 登入後的科別選擇畫面：先選練習科別，再進入對應題目
const CLOUD_PROVIDERS = [
  { key: 'aws', label: 'AWS', accent: 'orange' },
  { key: 'gcp', label: 'GCP', accent: 'blue' },
]

// 各雲服務商已上線的考試代碼（用來在入口畫面分組）
const PROVIDER_EXAMS = {
  aws: ['CLF-C02', 'SAA-C03', 'SCS-C02', 'SCS-C03', 'SCS-C03 補充', 'SOA-C02', 'SOA-C03', 'AIP-C01', 'MLA-C01'],
  gcp: ['PCA'],
}

function getProviderForExam(exam) {
  for (const [provider, codes] of Object.entries(PROVIDER_EXAMS)) {
    if (codes.includes(exam)) return provider
  }
  return 'aws'
}

function SubjectSelect({ examTypes, questions, loading, onSelect }) {
  const [provider, setProvider] = useState('aws')
  const counts = useMemo(() => {
    const m = {}
    questions.forEach(q => { m[q.exam] = (m[q.exam] || 0) + 1 })
    return m
  }, [questions])
  const isAws = provider === 'aws'
  const logoSrc = isAws ? awsLogo : `${BASE_URL}gcp-logo.png`
  const accent = isAws
    ? { hoverBg: 'hover:bg-orange-500/20', hoverBorder: 'hover:border-orange-400', hoverText: 'group-hover:text-orange-300', badgeHoverBg: 'group-hover:bg-orange-500/30', badgeHoverText: 'group-hover:text-orange-200' }
    : { hoverBg: 'hover:bg-blue-500/20', hoverBorder: 'hover:border-blue-400', hoverText: 'group-hover:text-blue-300', badgeHoverBg: 'group-hover:bg-blue-500/30', badgeHoverText: 'group-hover:text-blue-200' }
  // 只列出當前服務商下、題庫實際有的科別
  const providerExamCodes = PROVIDER_EXAMS[provider] || []
  const visibleExams = providerExamCodes.filter(code => examTypes.includes(code))
  const providerTotal = visibleExams.reduce((sum, code) => sum + (counts[code] || 0), 0)
  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="bg-gray-800/90 backdrop-blur rounded-2xl shadow-2xl p-8 max-w-2xl w-full border border-gray-700/80">
        <div className="flex justify-center mb-4 h-14">
          <img src={logoSrc} alt={provider.toUpperCase()} className="h-14 object-contain" />
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-1">請選擇練習科別</h2>
        <p className="text-gray-400 text-sm text-center mb-6">選擇後將直接進入該科別的題目</p>

        {/* Cloud provider tabs */}
        <div className="flex gap-1 bg-gray-900/60 rounded-xl p-1 mb-6 border border-gray-700/60">
          {CLOUD_PROVIDERS.map(p => (
            <button
              key={p.key}
              onClick={() => setProvider(p.key)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                provider === p.key
                  ? p.accent === 'orange'
                    ? 'bg-orange-500/20 text-orange-300 shadow-sm'
                    : 'bg-blue-500/20 text-blue-300 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-sm">題庫載入中...</span>
          </div>
        ) : visibleExams.length > 0 ? (
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
            </div>
            {visibleExams.length > 1 && (
              <button
                onClick={() => onSelect('')}
                className="w-full mt-4 py-3 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-sm font-medium transition-colors"
              >
                全部科別（{providerTotal} 題）
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-gray-400 border border-dashed border-gray-700 rounded-xl bg-gray-900/40">
            <img src={`${BASE_URL}gcp-logo.png`} alt="Google Cloud Platform" className="h-16 object-contain opacity-90" />
            <p className="text-base font-semibold text-gray-200">GCP 題庫即將推出</p>
            <p className="text-xs text-gray-500 text-center max-w-xs">Google Cloud 認證相關題目正在準備中，敬請期待。</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [subjectChosen, setSubjectChosen] = useState(false)
  const [state, dispatch] = useReducer(reducer, initialState)
  const fileInputRef = useRef(null)

  // Load questions from static manifest on startup
  useEffect(() => {
    const load = async () => {
      try {
        const manifestRes = await fetch(`${BASE_URL}data/manifest.json?v=${DATA_VERSION}`, { cache: 'no-store' })
        if (!manifestRes.ok) throw new Error('無法載入題庫清單')
        const manifest = await manifestRes.json()
        const allQuestions = []
        for (const file of manifest.files) {
          try {
            const res = await fetch(`${BASE_URL}data/${file}?v=${DATA_VERSION}`, { cache: 'no-store' })
            if (!res.ok) continue
            const data = await res.json()
            const questions = Array.isArray(data) ? data : (data.questions || [])
            allQuestions.push(...questions)
          } catch { /* skip bad files */ }
        }
        if (allQuestions.length) {
          dispatch({ type: 'LOAD_QUESTIONS', questions: allQuestions, filename: '靜態題庫' })
        } else {
          dispatch({ type: 'SET_QUESTIONS_LOADING', value: false })
        }
        // Load English question files
        if (manifest.enFiles) {
          const enQuestions = []
          for (const file of manifest.enFiles) {
            try {
              const res = await fetch(`${BASE_URL}data/${file}?v=${DATA_VERSION}`, { cache: 'no-store' })
              if (!res.ok) continue
              const data = await res.json()
              const questions = Array.isArray(data) ? data : (data.questions || [])
              enQuestions.push(...questions)
            } catch { /* skip bad files */ }
          }
          if (enQuestions.length) {
            dispatch({ type: 'LOAD_EN_QUESTIONS', questions: enQuestions })
          }
        }
      } catch (err) {
        console.error('載入題庫失敗:', err)
        dispatch({ type: 'SET_QUESTIONS_LOADING', value: false })
      }
    }
    load()
  }, [])

  // Persist stats/bookmarks to localStorage (user-specific, not question data)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('quest-stats')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.statsHistory) dispatch({ type: 'RESTORE_STATS', statsHistory: data.statsHistory })
        if (data.bookmarked) dispatch({ type: 'RESTORE_BOOKMARKS', bookmarked: data.bookmarked })
        if (data.reviewMarked) dispatch({ type: 'RESTORE_REVIEWS', reviewMarked: data.reviewMarked })
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!Object.keys(state.statsHistory).length && !Object.keys(state.bookmarked).length) return
    try {
      localStorage.setItem('quest-stats', JSON.stringify({
        statsHistory: state.statsHistory,
        bookmarked: state.bookmarked,
        reviewMarked: state.reviewMarked,
      }))
    } catch {}
  }, [state.statsHistory, state.bookmarked, state.reviewMarked])

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
  const qMap = useMemo(() => {
    const m = new Map()
    state.questions.forEach(q => m.set(`${q.exam}-${q.id}`, q))
    return m
  }, [state.questions])

  const rootClass = state.darkMode ? 'dark' : ''

  if (!authenticated) {
    return <PasswordGate onAuth={() => setAuthenticated(true)} />
  }

  // 登入後（非管理員）先選擇練習科別，再進入對應題目
  if (!subjectChosen && !isAdmin) {
    return (
      <SubjectSelect
        examTypes={examTypes}
        questions={state.questions}
        loading={state.questionsLoading}
        onSelect={(exam) => {
          dispatch({ type: 'SELECT_SUBJECT', exam })
          setSubjectChosen(true)
        }}
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
              <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2.5">
                <img src={awsLogo} alt="AWS" className="h-9 md:h-10" />
                <span className="hidden sm:inline text-orange-400 tracking-tight">證照考試練習器</span>
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
            {state.activeTab === 'upload' && isAdmin && <UploadTab state={state} dispatch={dispatch} fileInputRef={fileInputRef} examTypes={examTypes} />}
            {state.activeTab === 'practice' && <PracticeTab state={state} dispatch={dispatch} examTypes={examTypes} qMap={qMap} />}
            {state.activeTab === 'exam' && <ExamTab state={state} dispatch={dispatch} examTypes={examTypes} qMap={qMap} />}
            {state.activeTab === 'stats' && <StatsTab state={state} dispatch={dispatch} examTypes={examTypes} />}
          </div>
        </main>
      </div>
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

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="stat-card bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-200/60 dark:border-gray-700/60 shadow-sm">
      {Icon && (
        <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-100 dark:ring-orange-500/20">
          <Icon size={18} className="text-orange-500 dark:text-orange-400" />
        </div>
      )}
      <div className="text-2xl font-bold gradient-text animate-count">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{label}</div>
    </div>
  )
}

// ══════════════════════════════════════════
// Practice Tab
// ══════════════════════════════════════════
function PracticeTab({ state, dispatch, examTypes, qMap }) {
  const { practiceFiltered, practiceIndex, practiceAnswers, practiceSubmitted, practiceResults, bookmarked, reviewMarked } = state
  const currentQRaw = practiceFiltered[practiceIndex]
  const currentQ = getDisplayQuestion(currentQRaw, state.lang, state.questionsEn)
  const qKey = currentQRaw ? `${currentQRaw.exam}-${currentQRaw.id}` : null
  const hasEnVersion = currentQRaw && Object.keys(state.questionsEn).length > 0 && !!state.questionsEn[`${currentQRaw.exam}-${currentQRaw.id}`]
  const isSubmitted = qKey ? (practiceSubmitted[qKey] || state.showAnswers) : false
  const isCorrect = qKey ? (practiceSubmitted[qKey] ? practiceResults[qKey] : undefined) : undefined

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

  return (
    <div className="space-y-5">
      <FilterBar state={state} dispatch={dispatch} examTypes={examTypes} showStart />

      {/* Language toggle + Progress bar */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">作答進度</span>
            {hasEnVersion && (
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
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SHOW_ANSWERS' })}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                state.showAnswers
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="顯示/隱藏答案"
            >
              {state.showAnswers ? <Eye size={12} /> : <EyeOff size={12} />}
              {state.showAnswers ? '顯示答案' : '隱藏答案'}
            </button>
            <button
              onClick={() => dispatch({ type: 'SHUFFLE_PRACTICE' })}
              disabled={practiceFiltered.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 border bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-800/40 disabled:opacity-40 disabled:cursor-not-allowed"
              title="隨機打亂題目順序"
            >
              <Shuffle size={12} /> 隨機練習
            </button>
          </div>
          <span className="text-xs font-bold text-orange-500">{answeredCount} / {practiceFiltered.length} ({progressPct}%)</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="progress-bar h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 mb-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">答對率</span>
          <span className="text-xs font-bold text-green-500">{correctCount} / {answeredCount} ({accuracyPct}%)</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="progress-bar h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full" style={{ width: `${accuracyPct}%` }} />
        </div>
      </div>

      {/* Question card */}
      {currentQ && (
        <div className="surface-card overflow-hidden animate-fade-in" key={qKey}>
          {/* Color accent bar based on exam type */}
          <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600" />

          <div className="p-6 md:p-8">
            {/* Question header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg text-xs font-semibold">{displayExam(currentQ.exam)}</span>
                <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold">{typeLabels[currentQ.type]}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">#{currentQ.id}</span>
                {currentQ.officialNo && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold" title="壓題參考編號">壓題 #{currentQ.officialNo}</span>
                )}
                <span className="text-sm text-gray-400 dark:text-gray-500">({practiceIndex + 1} / {practiceFiltered.length})</span>
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
              </div>
            </div>

            {/* Case study background (collapsible) + Question text */}
            <CaseStudyBox text={currentQ.caseStudy} />
            <p className="text-base leading-relaxed mb-5 whitespace-pre-wrap break-words">{currentQ.question}</p>

            {/* Navigation: prev, submit, next */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex - 1 })}
                disabled={practiceIndex === 0}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
              >
                <ChevronLeft size={16} /> 上一題
              </button>
              <div className="flex items-center gap-2">
                {!isSubmitted && (
                  (currentQ.options && Object.keys(currentQ.options).length > 0) ||
                  (currentQ.type === 'matching' && currentQ.available_options?.length > 0 && currentQ.matches?.length > 0) ||
                  (currentQ.type === 'ordering' && currentQ.available_steps?.length > 0 && currentQ.ordered_steps?.length > 0)
                ) && (
                  <button
                    onClick={() => {
                      dispatch({ type: 'SUBMIT_ANSWER', question: currentQRaw })
                      // 答對自動進入下一題（答錯則停留以便查看解析）
                      if (computeCorrect(currentQRaw, practiceAnswers[qKey]) && practiceIndex < practiceFiltered.length - 1) {
                        setTimeout(() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 }), 900)
                      }
                    }}
                    disabled={!practiceAnswers[qKey] || (Array.isArray(practiceAnswers[qKey]) && practiceAnswers[qKey].length === 0)}
                    className={`px-8 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed shadow-sm hover:shadow-md ${practiceAnswers[qKey] && (!Array.isArray(practiceAnswers[qKey]) || practiceAnswers[qKey].length > 0) ? 'pulse-glow' : ''}`}
                  >
                    <CheckCircle size={16} className="inline mr-1.5 -mt-0.5" />
                    提交答案
                  </button>
                )}
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 })}
                disabled={practiceIndex >= practiceFiltered.length - 1}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
              >
                下一題 <ChevronRight size={16} />
              </button>
            </div>

            {/* Answer area */}
            <QuestionInput
              question={currentQ}
              answer={practiceAnswers[qKey]}
              submitted={isSubmitted}
              onAnswer={(ans) => dispatch({ type: 'SET_ANSWER', qKey, answer: ans })}
            />

            {/* Result */}
            {practiceSubmitted[qKey] && (
              <div className={`mt-5 p-5 rounded-xl animate-scale-in ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {isCorrect
                    ? <><CheckCircle size={22} className="text-green-600 dark:text-green-400" /><span className="font-bold text-green-700 dark:text-green-400 text-lg">正確！</span></>
                    : <><XCircle size={22} className="text-red-600 dark:text-red-400" /><span className="font-bold text-red-700 dark:text-red-400 text-lg">錯誤</span></>
                  }
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

      {/* Navigation bar */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <ListChecks size={14} />
            題目導覽
          </h4>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {practiceFiltered.map((q, i) => {
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
                className="mt-0.5 accent-orange-500"
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
                className="mt-0.5 accent-orange-500"
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
      return (
        <div className="space-y-3">
          {q.matches.map((m, i) => {
            let borderClass = 'border-gray-200 dark:border-gray-700'
            let accentClass = ''
            if (submitted && !examMode) {
              if (selections[i] === m.correct_answer) { borderClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'; accentClass = 'correct' }
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
                  {q.available_options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {submitted && !examMode && selections[i] !== m.correct_answer && (
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
      const availableSteps = q.available_steps.filter(s => !selectedSteps.includes(s))
      const neededCount = q.ordered_steps.length

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
              {availableSteps.map(step => (
                <button
                  key={step}
                  onClick={() => {
                    if (submitted && !examMode) return
                    if (selectedSteps.length < neededCount) {
                      onAnswer([...selectedSteps, step])
                    }
                  }}
                  disabled={(submitted && !examMode) || selectedSteps.length >= neededCount}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={12} className="inline mr-1" />{step}
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
                    itemClass = (i < q.ordered_steps.length && step === q.ordered_steps[i])
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  }
                  return (
                    <div key={`${step}-${i}`} className={`flex items-center gap-2 p-2 rounded-lg border-2 ${itemClass}`}>
                      <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm flex-1">{step}</span>
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

function ExplanationView({ question, userAnswer }) {
  const q = question
  if (!q.explanations) return null

  const correctKeys = Array.isArray(q.answer) ? q.answer : [q.answer]
  const allOptionKeys = q.options ? Object.keys(q.options) : Object.keys(q.explanations)
  // Default to first correct answer that has explanation, or first key with explanation
  const defaultKey = correctKeys.find(k => q.explanations[k]) || allOptionKeys.find(k => q.explanations[k]) || allOptionKeys[0]
  const [selectedKey, setSelectedKey] = useState(defaultKey)

  const selectedText = q.explanations[selectedKey]

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
  'PCA': { name: 'Google Professional Cloud Architect', count: 50, timeLimit: 120, passScore: 700, questions: '50 題（單選與多選）', time: '120 分鐘（2 小時）', types: '單選、多選' },
}

function ExamTab({ state, dispatch, examTypes, qMap }) {
  const selectedExam = state.examConfig.examFilter
  const spec = EXAM_SPECS[selectedExam] || null

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
            <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500" />
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
            <div className={`flex items-center gap-2 font-mono text-lg font-bold ${state.examRemaining < 300 ? 'text-red-600 dark:text-red-400 animate-pulse' : ''}`}>
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
        <div className="surface-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-orange-500" />
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg text-xs font-semibold">{displayExam(examQ.exam)}</span>
              <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold">{typeLabels[examQ.type]}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">#{examQ.id}</span>
              {examQ.officialNo && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold" title="壓題參考編號">壓題 #{examQ.officialNo}</span>
              )}
            </div>
            <CaseStudyBox text={examQ.caseStudy} />
            <p className="text-base leading-relaxed mb-6 whitespace-pre-wrap break-words">{examQ.question}</p>

            <QuestionInput
              question={examQ}
              answer={state.examAnswers[examQKey]}
              submitted={false}
              onAnswer={(ans) => dispatch({ type: 'SET_EXAM_ANSWER', qKey: examQKey, answer: ans })}
              examMode
            />

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex - 1 })}
                disabled={state.examIndex === 0}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
              >
                <ChevronLeft size={16} /> 上一題
              </button>
              <button
                onClick={() => {
                  if (confirm('確定要交卷嗎？未作答的題目將視為錯誤。')) {
                    dispatch({ type: 'SUBMIT_EXAM' })
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 shadow-sm"
              >
                <Square size={14} /> 交卷
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex + 1 })}
                disabled={state.examIndex >= state.examQuestionIds.length - 1}
                className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
              >
                下一題 <ChevronRight size={16} />
              </button>
            </div>
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
function StatsTab({ state, dispatch, examTypes }) {
  const [activeSection, setActiveSection] = useState('overview')
  const history = state.statsHistory
  const entries = Object.entries(history)
  const totalAnswered = entries.length
  const totalCorrect = entries.filter(([, v]) => v.correct).length
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  // Per exam stats
  const examStats = useMemo(() => {
    const map = {}
    entries.forEach(([, v]) => {
      if (!map[v.exam]) map[v.exam] = { total: 0, correct: 0 }
      map[v.exam].total++
      if (v.correct) map[v.exam].correct++
    })
    return map
  }, [entries])

  // Wrong questions: 答錯過且累計答對未達 MASTERY_THRESHOLD 次（尚未學會）的題目
  const wrongQuestions = entries
    .filter(([, v]) => (v.everWrong ?? !v.correct) && (v.correctCount ?? v.correctStreak ?? 0) < MASTERY_THRESHOLD)
    .map(([k, v]) => ({ key: k, ...v }))
  // 已學會（曾答錯，後來累計答對達標）的題目數，用於提示
  const masteredCount = entries.filter(([, v]) => (v.everWrong ?? !v.correct) && (v.correctCount ?? v.correctStreak ?? 0) >= MASTERY_THRESHOLD).length

  // Bookmarked
  const bookmarkedList = Object.entries(state.bookmarked).filter(([, v]) => v).map(([k]) => {
    const h = history[k]
    return h ? { key: k, ...h } : null
  }).filter(Boolean)

  // Review marked
  const reviewList = Object.entries(state.reviewMarked).filter(([, v]) => v).map(([k]) => {
    const h = history[k]
    return h ? { key: k, ...h } : null
  }).filter(Boolean)

  if (totalAnswered === 0) {
    return <EmptyState message="尚無作答紀錄" icon={BarChart3} />
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="已作答" value={totalAnswered} icon={CheckCircle} />
        <StatCard label="答對" value={totalCorrect} icon={Trophy} />
        <StatCard label="正確率" value={`${overallAccuracy}%`} icon={Target} />
        <StatCard label="錯題數" value={wrongQuestions.length} icon={XCircle} />
      </div>

      {/* Overall accuracy visual */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">整體正確率</span>
          <span className={`text-2xl font-extrabold ${overallAccuracy >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{overallAccuracy}%</span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="progress-bar h-full rounded-full" style={{ width: `${overallAccuracy}%`, background: overallAccuracy >= 70 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">0%</span>
          <span className="text-xs text-gray-400 font-medium">及格線 70%</span>
          <span className="text-xs text-gray-400">100%</span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'overview', label: '各科正確率', icon: Target },
          { key: 'wrong', label: `錯題清單 (${wrongQuestions.length})`, icon: XCircle },
          { key: 'bookmark', label: `書籤 (${bookmarkedList.length})`, icon: Star },
          { key: 'review', label: `複習 (${reviewList.length})`, icon: Flag },
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
        {activeSection === 'overview' && (
          <div>
            <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <Target size={18} className="text-orange-500" />各科正確率
            </h3>
            <div className="space-y-4">
              {Object.entries(examStats).map(([exam, s]) => {
                const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                const passed = pct >= 70
                return (
                  <div key={exam} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{displayExam(exam)}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{s.correct}/{s.total}</span>
                        <span className={`font-bold ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="progress-bar h-full rounded-full" style={{ width: `${pct}%`, background: passed ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeSection === 'wrong' && (
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><XCircle size={18} className="text-red-500" />錯題清單</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              累計答對 {MASTERY_THRESHOLD} 次即視為學會並移出清單；答錯不會歸零。
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
  return (
    <div className="surface-card p-16 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-5">
        <Icon size={36} className="text-gray-300 dark:text-gray-500" />
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
