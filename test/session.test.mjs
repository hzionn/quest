import test from 'node:test'
import assert from 'node:assert/strict'

// session.js talks to localStorage directly; give it a minimal in-memory one
// before importing so these stay plain node tests (no jsdom).
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { saveSession, loadSession, clearSession } = await import('../src/session.js')

const KEY = 'quest-practice-session'
const q = (exam, id) => ({ exam, id })
const SESSION = {
  exam: 'AZ-104',
  filterType: '',
  filterSearch: '',
  activeTab: 'practice',
  index: 2,
  questions: [q('AZ-104', 1), q('AZ-104', 2), q('AZ-104', 3)],
  answers: { 'AZ-104-1': 'B' },
  submitted: { 'AZ-104-1': true },
  results: { 'AZ-104-1': true },
}

test.beforeEach(() => store.clear())

test('a saved session round-trips', () => {
  saveSession(SESSION)
  const s = loadSession()
  assert.equal(s.exam, 'AZ-104')
  assert.equal(s.index, 2)
  assert.deepEqual(s.keys, ['AZ-104-1', 'AZ-104-2', 'AZ-104-3'])
  assert.deepEqual(s.exams, ['AZ-104'])
  assert.deepEqual(s.answers, { 'AZ-104-1': 'B' })
})

test('the exam list covers every exam in a mixed review session', () => {
  saveSession({ ...SESSION, exam: '', questions: [q('AZ-104', 1), q('SAA-C03', 7), q('AZ-104', 2)] })
  assert.deepEqual(loadSession().exams.sort(), ['AZ-104', 'SAA-C03'])
})

test('empty and stale answer entries are not stored', () => {
  saveSession({
    ...SESSION,
    answers: { 'AZ-104-1': 'B', 'AZ-104-2': undefined },
    submitted: { 'AZ-104-1': true, 'AZ-104-2': false },
  })
  const s = loadSession()
  assert.deepEqual(Object.keys(s.answers), ['AZ-104-1'])
  assert.deepEqual(Object.keys(s.submitted), ['AZ-104-1'])
})

test('answers for questions outside the session are dropped', () => {
  saveSession({ ...SESSION, answers: { 'AZ-104-1': 'B', 'SAA-C03-99': 'A' } })
  assert.deepEqual(loadSession().answers, { 'AZ-104-1': 'B' })
})

test('an empty session is not written at all', () => {
  saveSession({ ...SESSION, questions: [] })
  assert.equal(loadSession(), null)
})

test('a session older than a week is not resumed', () => {
  saveSession(SESSION)
  const raw = JSON.parse(store.get(KEY))
  raw.at = Date.now() - 8 * 24 * 60 * 60 * 1000
  store.set(KEY, JSON.stringify(raw))
  assert.equal(loadSession(), null)
})

test('a snapshot from an older format is ignored rather than half-applied', () => {
  store.set(KEY, JSON.stringify({ v: 0, at: Date.now(), keys: ['AZ-104-1'] }))
  assert.equal(loadSession(), null)
  store.set(KEY, 'not json')
  assert.equal(loadSession(), null)
})

test('clearSession removes it', () => {
  saveSession(SESSION)
  clearSession()
  assert.equal(loadSession(), null)
})

test('it never touches the auth token key', () => {
  store.set('quest-session', 'the-jwt')
  saveSession(SESSION)
  clearSession()
  assert.equal(store.get('quest-session'), 'the-jwt')
})
