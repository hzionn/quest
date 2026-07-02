import { Component } from 'react'

// Catches render-time exceptions so one bad question/entry blanks a panel,
// not the whole app (which is exactly what happened with the stats lists).
// `resetKey` remounts children and clears the error when it changes (e.g. on
// tab switch), giving users a way out without a full reload.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-8">
          <p className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">頁面發生錯誤</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            很抱歉，這個畫面出了點問題。你的練習進度不受影響，重新整理即可繼續。
          </p>
          <pre className="text-left text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-5 overflow-auto max-h-28 whitespace-pre-wrap break-words">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            重新整理頁面
          </button>
        </div>
      </div>
    )
  }
}
