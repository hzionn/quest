import { useState, useReducer, useEffect, useMemo, useRef } from 'react'
import {
  Upload, FileJson, CheckCircle, XCircle, Sun, Moon, Star, Flag,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Play, Square,
  BarChart3, BookOpen, Clock, Filter, Search, Plus, Minus, RotateCcw,
  AlertCircle, Trophy, Target, ListChecks, Shuffle, X
} from 'lucide-react'

// ── Initial State ──
const initialState = {
  darkMode: false,
  activeTab: 'upload',
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

  // Filters
  filterExam: '',
  filterType: '',
  filterSearch: '',

  // Exam
  examConfig: { count: 30, timeLimit: 60, examFilter: '' },
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
}

// ── Reducer ──
function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_DARK':
      return { ...state, darkMode: !state.darkMode }

    case 'SET_TAB':
      return { ...state, activeTab: action.tab }

    case 'LOAD_QUESTIONS': {
      const newQs = action.questions
      const map = new Map()
      state.questions.forEach(q => map.set(`${q.exam}-${q.id}`, q))
      newQs.forEach(q => map.set(`${q.exam}-${q.id}`, q))
      const merged = Array.from(map.values())
      return {
        ...state,
        questions: merged,
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
      if (state.filterType) filtered = filtered.filter(q => q.type === state.filterType)
      if (state.filterSearch) filtered = filtered.filter(q => String(q.id).includes(state.filterSearch))
      return { ...state, practiceFiltered: filtered, practiceIndex: 0, activeTab: 'practice' }
    }

    case 'SET_PRACTICE_INDEX':
      return { ...state, practiceIndex: action.index }

    case 'SET_ANSWER': {
      return { ...state, practiceAnswers: { ...state.practiceAnswers, [action.qKey]: action.answer } }
    }

    case 'SUBMIT_ANSWER': {
      const q = action.question
      const qKey = `${q.exam}-${q.id}`
      const userAns = state.practiceAnswers[qKey]
      let correct = false
      if (q.type === 'single') {
        correct = userAns === q.answer
      } else if (q.type === 'multiple') {
        correct = Array.isArray(userAns) && Array.isArray(q.answer) &&
          userAns.length === q.answer.length &&
          [...userAns].sort().join(',') === [...q.answer].sort().join(',')
      } else if (q.type === 'matching') {
        correct = q.matches.every((m, i) => userAns && userAns[i] === m.correct_answer)
      } else if (q.type === 'ordering') {
        correct = Array.isArray(userAns) && Array.isArray(q.ordered_steps) &&
          userAns.length === q.ordered_steps.length &&
          userAns.every((s, i) => s === q.ordered_steps[i])
      }
      return {
        ...state,
        practiceSubmitted: { ...state.practiceSubmitted, [qKey]: true },
        practiceResults: { ...state.practiceResults, [qKey]: correct },
        statsHistory: {
          ...state.statsHistory,
          [qKey]: { correct, exam: q.exam, type: q.type, id: q.id, question: q }
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
          correct = q.matches.every((m, i) => userAns && userAns[i] === m.correct_answer)
        } else if (q.type === 'ordering') {
          correct = Array.isArray(userAns) && Array.isArray(q.ordered_steps) &&
            userAns.length === q.ordered_steps.length &&
            userAns.every((s, i) => s === q.ordered_steps[i])
        }
        if (correct) totalCorrect++
        if (!typeStats[q.type]) typeStats[q.type] = { total: 0, correct: 0 }
        typeStats[q.type].total++
        if (correct) typeStats[q.type].correct++
        return { qKey, correct, question: q }
      })
      const newHistory = { ...state.statsHistory }
      details.forEach(d => {
        newHistory[d.qKey] = { correct: d.correct, exam: d.question.exam, type: d.question.type, id: d.question.id, question: d.question }
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
      return {
        ...state,
        activeTab: 'practice',
        practiceFiltered: [q],
        practiceIndex: 0,
        practiceAnswers: { ...state.practiceAnswers, [`${q.exam}-${q.id}`]: undefined },
        practiceSubmitted: { ...state.practiceSubmitted, [`${q.exam}-${q.id}`]: false },
        practiceResults: { ...state.practiceResults, [`${q.exam}-${q.id}`]: undefined },
      }
    }

    default:
      return state
  }
}

// ── Helper: Question type label ──
const typeLabels = { single: '單選題', multiple: '多選題', matching: '配對題', ordering: '排序題' }

// ── Main App ──
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const fileInputRef = useRef(null)

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

  return (
    <div className={rootClass}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <BookOpen size={24} />
              AWS 證照考試練習器
            </h1>
            <div className="flex items-center gap-2">
              {/* Nav tabs - desktop */}
              <nav className="hidden md:flex gap-1">
                {[
                  { key: 'upload', label: '上傳題庫', icon: Upload },
                  { key: 'practice', label: '練習模式', icon: BookOpen },
                  { key: 'exam', label: '模擬考試', icon: Clock },
                  { key: 'stats', label: '統計分析', icon: BarChart3 },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => dispatch({ type: 'SET_TAB', tab: t.key })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                      state.activeTab === t.key
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <t.icon size={16} />
                    {t.label}
                  </button>
                ))}
              </nav>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_DARK' })}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={state.darkMode ? '切換淺色模式' : '切換深色模式'}
              >
                {state.darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
          {/* Nav tabs - mobile */}
          <nav className="flex md:hidden border-t border-gray-200 dark:border-gray-700">
            {[
              { key: 'upload', label: '上傳', icon: Upload },
              { key: 'practice', label: '練習', icon: BookOpen },
              { key: 'exam', label: '模擬考', icon: Clock },
              { key: 'stats', label: '統計', icon: BarChart3 },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => dispatch({ type: 'SET_TAB', tab: t.key })}
                className={`flex-1 py-2 text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
                  state.activeTab === t.key
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <t.icon size={18} />
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto px-4 py-6">
          {state.activeTab === 'upload' && <UploadTab state={state} dispatch={dispatch} fileInputRef={fileInputRef} examTypes={examTypes} />}
          {state.activeTab === 'practice' && <PracticeTab state={state} dispatch={dispatch} examTypes={examTypes} qMap={qMap} />}
          {state.activeTab === 'exam' && <ExamTab state={state} dispatch={dispatch} examTypes={examTypes} qMap={qMap} />}
          {state.activeTab === 'stats' && <StatsTab state={state} dispatch={dispatch} examTypes={examTypes} />}
        </main>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Upload Tab
// ══════════════════════════════════════════
function UploadTab({ state, dispatch, fileInputRef, examTypes }) {
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        const questions = Array.isArray(data) ? data : (data.questions || [])
        if (!questions.length) { alert('找不到有效的題目資料'); return }
        dispatch({ type: 'LOAD_QUESTIONS', questions, filename: file.name })
      } catch {
        alert('JSON 解析失敗，請確認檔案格式正確')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
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
      {/* Upload area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <FileJson size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">上傳 JSON 題庫</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">支援多次上傳合併（不同題號範圍）</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Upload size={18} />
            選擇 JSON 檔案
          </button>
        </div>
      </div>

      {/* Stats */}
      {state.questions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            題庫統計
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="總題數" value={state.questions.length} />
            <StatCard label="科別數" value={examTypes.length} />
            <StatCard label="上傳次數" value={state.uploadHistory.length} />
            <StatCard label="題型數" value={Object.keys(stats.byType).length} />
          </div>

          {/* By exam */}
          <h4 className="font-medium mb-2 text-sm text-gray-500 dark:text-gray-400">各科別統計</h4>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3">科別</th>
                  <th className="text-left py-2 px-3">題數</th>
                  <th className="text-left py-2 px-3">題號範圍</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byExam).map(([exam, count]) => (
                  <tr key={exam} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 px-3 font-medium">{exam}</td>
                    <td className="py-2 px-3">{count}</td>
                    <td className="py-2 px-3">{stats.ranges[exam]?.min} ~ {stats.ranges[exam]?.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By type */}
          <h4 className="font-medium mb-2 text-sm text-gray-500 dark:text-gray-400">各題型統計</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.byType).map(([type, count]) => (
              <span key={type} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
                {typeLabels[type] || type}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Upload history */}
      {state.uploadHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">上傳紀錄</h3>
          <div className="space-y-2">
            {state.uploadHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <FileJson size={16} className="text-blue-500 shrink-0" />
                <span className="font-medium truncate">{h.filename}</span>
                <span className="text-gray-500 dark:text-gray-400">{h.count} 題</span>
                <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto">
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

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  )
}

// ══════════════════════════════════════════
// Practice Tab
// ══════════════════════════════════════════
function PracticeTab({ state, dispatch, examTypes, qMap }) {
  const { practiceFiltered, practiceIndex, practiceAnswers, practiceSubmitted, practiceResults, bookmarked, reviewMarked } = state
  const currentQ = practiceFiltered[practiceIndex]
  const qKey = currentQ ? `${currentQ.exam}-${currentQ.id}` : null
  const isSubmitted = qKey ? practiceSubmitted[qKey] : false
  const isCorrect = qKey ? practiceResults[qKey] : undefined

  if (state.questions.length === 0) {
    return <EmptyState message="請先上傳題庫" icon={Upload} action={() => dispatch({ type: 'SET_TAB', tab: 'upload' })} actionLabel="前往上傳" />
  }

  if (practiceFiltered.length === 0) {
    return (
      <div className="space-y-6">
        <FilterBar state={state} dispatch={dispatch} examTypes={examTypes} showStart />
        <EmptyState message="沒有符合篩選條件的題目，請調整篩選條件或點擊開始練習" icon={Search} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <FilterBar state={state} dispatch={dispatch} examTypes={examTypes} showStart />

      {/* Question card */}
      {currentQ && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {/* Question header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">{currentQ.exam}</span>
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">{typeLabels[currentQ.type]}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">#{currentQ.id}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">({practiceIndex + 1} / {practiceFiltered.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => dispatch({ type: 'TOGGLE_BOOKMARK', qKey })}
                className={`p-1.5 rounded transition-colors ${bookmarked[qKey] ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                title="書籤"
              >
                <Star size={18} fill={bookmarked[qKey] ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_REVIEW', qKey })}
                className={`p-1.5 rounded transition-colors ${reviewMarked[qKey] ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
                title="標記複習"
              >
                <Flag size={18} fill={reviewMarked[qKey] ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>

          {/* Question text */}
          <p className="text-base leading-relaxed mb-6 whitespace-pre-wrap">{currentQ.question}</p>

          {/* Answer area */}
          <QuestionInput
            question={currentQ}
            answer={practiceAnswers[qKey]}
            submitted={isSubmitted}
            onAnswer={(ans) => dispatch({ type: 'SET_ANSWER', qKey, answer: ans })}
          />

          {/* Submit button */}
          {!isSubmitted && (
            <button
              onClick={() => dispatch({ type: 'SUBMIT_ANSWER', question: currentQ })}
              disabled={!practiceAnswers[qKey] || (Array.isArray(practiceAnswers[qKey]) && practiceAnswers[qKey].length === 0)}
              className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              提交答案
            </button>
          )}

          {/* Result */}
          {isSubmitted && (
            <div className={`mt-4 p-4 rounded-lg ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2 mb-3">
                {isCorrect
                  ? <><CheckCircle size={20} className="text-green-600 dark:text-green-400" /><span className="font-semibold text-green-700 dark:text-green-400">正確！</span></>
                  : <><XCircle size={20} className="text-red-600 dark:text-red-400" /><span className="font-semibold text-red-700 dark:text-red-400">錯誤</span></>
                }
              </div>
              <ExplanationView question={currentQ} userAnswer={practiceAnswers[qKey]} />
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex - 1 })}
              disabled={practiceIndex === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-sm transition-colors"
            >
              <ChevronLeft size={16} /> 上一題
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: practiceIndex + 1 })}
              disabled={practiceIndex >= practiceFiltered.length - 1}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-sm transition-colors"
            >
              下一題 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Navigation bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">題目導覽</h4>
        <div className="flex flex-wrap gap-1.5">
          {practiceFiltered.map((q, i) => {
            const k = `${q.exam}-${q.id}`
            const submitted = practiceSubmitted[k]
            const correct = practiceResults[k]
            const isBookmarked = bookmarked[k]
            const isReview = reviewMarked[k]
            const isCurrent = i === practiceIndex
            let bgClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            if (submitted) {
              bgClass = correct
                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
            }
            return (
              <button
                key={k}
                onClick={() => dispatch({ type: 'SET_PRACTICE_INDEX', index: i })}
                className={`relative w-9 h-9 rounded-lg text-xs font-medium transition-all ${bgClass} ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : ''} ${isBookmarked ? 'border-2 border-yellow-400' : ''}`}
              >
                {q.id}
                {isReview && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />}
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <Filter size={12} className="inline mr-1" />科別
          </label>
          <select
            value={state.filterExam}
            onChange={e => dispatch({ type: 'SET_FILTER', key: 'filterExam', value: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
          >
            <option value="">全部</option>
            {examTypes.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">題型</label>
          <select
            value={state.filterType}
            onChange={e => dispatch({ type: 'SET_FILTER', key: 'filterType', value: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
          >
            <option value="">全部</option>
            <option value="single">單選題</option>
            <option value="multiple">多選題</option>
            <option value="matching">配對題</option>
            <option value="ordering">排序題</option>
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <Search size={12} className="inline mr-1" />題號
          </label>
          <input
            type="text"
            value={state.filterSearch}
            onChange={e => dispatch({ type: 'SET_FILTER', key: 'filterSearch', value: e.target.value })}
            placeholder="搜尋題號..."
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
          />
        </div>
        {showStart && (
          <button
            onClick={() => dispatch({ type: 'START_PRACTICE' })}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
          >
            <Play size={14} /> 開始練習
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Question Input (shared between practice & exam)
// ══════════════════════════════════════════
function QuestionInput({ question, answer, submitted, onAnswer, examMode = false }) {
  const q = question

  if (q.type === 'single') {
    return (
      <div className="space-y-2">
        {Object.entries(q.options).map(([key, text]) => {
          const selected = answer === key
          let optClass = 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
          if (submitted && !examMode) {
            if (key === q.answer) optClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'
            else if (selected && key !== q.answer) optClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'
          } else if (selected) {
            optClass = 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          }
          return (
            <label
              key={key}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${optClass} ${submitted && !examMode ? 'cursor-default' : ''}`}
            >
              <input
                type="radio"
                name={`q-${q.exam}-${q.id}`}
                checked={selected}
                onChange={() => !submitted && onAnswer(key)}
                disabled={submitted && !examMode}
                className="mt-0.5 accent-blue-600"
              />
              <span className="text-sm"><strong className="mr-1">{key}.</strong>{text}</span>
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
      <div className="space-y-2">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          <AlertCircle size={14} className="inline mr-1" />
          請選擇 {needed} 個選項
        </p>
        {Object.entries(q.options).map(([key, text]) => {
          const checked = selected.includes(key)
          let optClass = 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
          if (submitted && !examMode) {
            if (q.answer.includes(key)) optClass = 'border-green-500 bg-green-50 dark:bg-green-900/20'
            else if (checked && !q.answer.includes(key)) optClass = 'border-red-500 bg-red-50 dark:bg-red-900/20'
          } else if (checked) {
            optClass = 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
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
                className="mt-0.5 accent-blue-600"
              />
              <span className="text-sm"><strong className="mr-1">{key}.</strong>{text}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (q.type === 'matching') {
    const selections = Array.isArray(answer) ? answer : q.matches.map(() => '')
    return (
      <div className="space-y-3">
        {q.matches.map((m, i) => {
          let borderClass = 'border-gray-200 dark:border-gray-700'
          if (submitted && !examMode) {
            borderClass = selections[i] === m.correct_answer
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-red-500 bg-red-50 dark:bg-red-900/20'
          }
          return (
            <div key={i} className={`p-3 rounded-lg border-2 ${borderClass}`}>
              <p className="text-sm font-medium mb-2">{m.use_case}</p>
              <select
                value={selections[i] || ''}
                onChange={e => {
                  if (submitted && !examMode) return
                  const newSel = [...selections]
                  newSel[i] = e.target.value
                  onAnswer(newSel)
                }}
                disabled={submitted && !examMode}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              >
                <option value="">-- 請選擇 --</option>
                {q.available_options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {submitted && !examMode && selections[i] !== m.correct_answer && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">正確答案：{m.correct_answer}</p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (q.type === 'ordering') {
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
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
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

  return <p className="text-gray-500">不支援的題型：{q.type}</p>
}

// ══════════════════════════════════════════
// Explanation View
// ══════════════════════════════════════════
function ExplanationView({ question, userAnswer }) {
  const q = question
  if (!q.explanations) return null

  if (q.type === 'single' || q.type === 'multiple') {
    return (
      <div className="space-y-2 mt-2">
        <h5 className="text-sm font-medium">解析：</h5>
        {Object.entries(q.explanations).map(([key, text]) => (
          <div key={key} className="text-sm pl-2 border-l-2 border-gray-300 dark:border-gray-600 ml-1">
            <strong>{key}.</strong> {text}
          </div>
        ))}
      </div>
    )
  }

  if (q.type === 'matching') {
    return (
      <div className="space-y-2 mt-2">
        <h5 className="text-sm font-medium">解析：</h5>
        {Object.entries(q.explanations).map(([key, text]) => (
          <div key={key} className="text-sm pl-2 border-l-2 border-gray-300 dark:border-gray-600 ml-1">
            <strong>配對 {key}：</strong> {text}
          </div>
        ))}
      </div>
    )
  }

  if (q.type === 'ordering') {
    return (
      <div className="space-y-2 mt-2">
        <h5 className="text-sm font-medium">解析：</h5>
        {Object.entries(q.explanations).map(([key, text]) => (
          <div key={key} className="text-sm pl-2 border-l-2 border-gray-300 dark:border-gray-600 ml-1">
            <strong>{key}：</strong> {text}
          </div>
        ))}
      </div>
    )
  }

  return null
}

// ══════════════════════════════════════════
// Exam Tab
// ══════════════════════════════════════════
function ExamTab({ state, dispatch, examTypes, qMap }) {
  // Config screen
  if (!state.examActive && !state.examSubmitted) {
    return (
      <div className="space-y-6">
        {state.questions.length === 0 ? (
          <EmptyState message="請先上傳題庫" icon={Upload} action={() => dispatch({ type: 'SET_TAB', tab: 'upload' })} actionLabel="前往上傳" />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-lg mx-auto">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Clock size={20} />
              模擬考設定
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">題數</label>
                <input
                  type="number"
                  min={1}
                  max={state.questions.length}
                  value={state.examConfig.count}
                  onChange={e => dispatch({ type: 'SET_EXAM_CONFIG', config: { count: parseInt(e.target.value) || 1 } })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">可用題數：{state.questions.length}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">時間限制（分鐘）</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={state.examConfig.timeLimit}
                  onChange={e => dispatch({ type: 'SET_EXAM_CONFIG', config: { timeLimit: parseInt(e.target.value) || 1 } })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">科別篩選</label>
                <select
                  value={state.examConfig.examFilter}
                  onChange={e => dispatch({ type: 'SET_EXAM_CONFIG', config: { examFilter: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">全部科別</option>
                  {examTypes.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <button
                onClick={() => dispatch({ type: 'START_EXAM' })}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Play size={18} />
                開始考試
              </button>
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
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Trophy size={48} className={`mx-auto mb-4 ${pct >= 70 ? 'text-yellow-500' : 'text-gray-400'}`} />
          <h2 className="text-2xl font-bold mb-2">考試結果</h2>
          <div className="text-5xl font-bold mb-2">
            <span className={pct >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{pct}%</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400">{r.correct} / {r.total} 題正確</p>

          {/* Type breakdown */}
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {Object.entries(r.typeStats).map(([type, s]) => (
              <span key={type} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
                {typeLabels[type]}: {s.correct}/{s.total} ({s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0}%)
              </span>
            ))}
          </div>

          <button
            onClick={() => dispatch({ type: 'SET_EXAM_CONFIG', config: {} }) || dispatch({ type: 'SET_TAB', tab: 'exam' })}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium inline-flex items-center gap-2 transition-colors"
          >
            <RotateCcw size={16} /> 再考一次
          </button>
        </div>

        {/* Detail review */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">逐題檢視</h3>
          <div className="space-y-4">
            {r.details.map((d, i) => (
              <ExamReviewItem key={d.qKey} detail={d} index={i} examAnswers={state.examAnswers} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Active exam
  const examQ = qMap.get(state.examQuestionIds[state.examIndex])
  const examQKey = state.examQuestionIds[state.examIndex]
  const minutes = Math.floor(state.examRemaining / 60)
  const seconds = state.examRemaining % 60

  return (
    <div className="space-y-4">
      {/* Timer bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
        <span className="text-sm font-medium">
          題目 {state.examIndex + 1} / {state.examQuestionIds.length}
        </span>
        <div className={`flex items-center gap-2 font-mono text-lg font-bold ${state.examRemaining < 300 ? 'text-red-600 dark:text-red-400' : ''}`}>
          <Clock size={18} />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      {/* Question */}
      {examQ && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">{examQ.exam}</span>
            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">{typeLabels[examQ.type]}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">#{examQ.id}</span>
          </div>
          <p className="text-base leading-relaxed mb-6 whitespace-pre-wrap">{examQ.question}</p>

          <QuestionInput
            question={examQ}
            answer={state.examAnswers[examQKey]}
            submitted={false}
            onAnswer={(ans) => dispatch({ type: 'SET_EXAM_ANSWER', qKey: examQKey, answer: ans })}
            examMode
          />

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex - 1 })}
              disabled={state.examIndex === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-sm transition-colors"
            >
              <ChevronLeft size={16} /> 上一題
            </button>
            <button
              onClick={() => {
                if (confirm('確定要交卷嗎？未作答的題目將視為錯誤。')) {
                  dispatch({ type: 'SUBMIT_EXAM' })
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Square size={14} /> 交卷
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: state.examIndex + 1 })}
              disabled={state.examIndex >= state.examQuestionIds.length - 1}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-sm transition-colors"
            >
              下一題 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Exam navigation bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-1.5">
          {state.examQuestionIds.map((qk, i) => {
            const answered = state.examAnswers[qk] !== undefined
            const isCurrent = i === state.examIndex
            return (
              <button
                key={qk}
                onClick={() => dispatch({ type: 'SET_EXAM_INDEX', index: i })}
                className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${
                  answered
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                } ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
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

function ExamReviewItem({ detail, index, examAnswers }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`border-2 rounded-lg p-3 ${detail.correct ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          {detail.correct
            ? <CheckCircle size={16} className="text-green-600 dark:text-green-400 shrink-0" />
            : <XCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
          }
          <span className="text-sm font-medium">第 {index + 1} 題 — {detail.question.exam} #{detail.question.id}</span>
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{typeLabels[detail.question.type]}</span>
        </div>
        <ChevronRight size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm mb-3 whitespace-pre-wrap">{detail.question.question}</p>
          <QuestionInput
            question={detail.question}
            answer={examAnswers[detail.qKey]}
            submitted={true}
            onAnswer={() => {}}
          />
          <ExplanationView question={detail.question} userAnswer={examAnswers[detail.qKey]} />
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

  // Wrong questions
  const wrongQuestions = entries.filter(([, v]) => !v.correct).map(([k, v]) => ({ key: k, ...v }))

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
        <StatCard label="已作答" value={totalAnswered} />
        <StatCard label="答對" value={totalCorrect} />
        <StatCard label="正確率" value={`${overallAccuracy}%`} />
        <StatCard label="錯題數" value={wrongQuestions.length} />
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { key: 'overview', label: '各科正確率' },
          { key: 'wrong', label: `錯題清單 (${wrongQuestions.length})` },
          { key: 'bookmark', label: `書籤 (${bookmarkedList.length})` },
          { key: 'review', label: `複習 (${reviewList.length})` },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeSection === s.key
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {activeSection === 'overview' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Target size={18} />各科正確率</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3">科別</th>
                    <th className="text-left py-2 px-3">已作答</th>
                    <th className="text-left py-2 px-3">答對</th>
                    <th className="text-left py-2 px-3">正確率</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(examStats).map(([exam, s]) => (
                    <tr key={exam} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2 px-3 font-medium">{exam}</td>
                      <td className="py-2 px-3">{s.total}</td>
                      <td className="py-2 px-3">{s.correct}</td>
                      <td className="py-2 px-3">
                        <span className={`font-medium ${s.total > 0 && (s.correct / s.total) >= 0.7 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSection === 'wrong' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><XCircle size={18} className="text-red-500" />錯題清單</h3>
            {wrongQuestions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">太棒了！目前沒有錯題</p>
            ) : (
              <QuestionList items={wrongQuestions} dispatch={dispatch} />
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

function QuestionList({ items, dispatch }) {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{item.exam} #{item.id}</span>
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{typeLabels[item.type]}</span>
          </div>
          <button
            onClick={() => dispatch({ type: 'GOTO_PRACTICE_QUESTION', question: item.question })}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1"
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
      <Icon size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
      <p className="text-gray-500 dark:text-gray-400 mb-4">{message}</p>
      {action && (
        <button
          onClick={action}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
