// ──────────────────────────────────────────────────────────────────────────
// Remote sync client (talks to the Cloudflare Worker).
//
// Dormant until BOTH env vars are set at build time:
//   VITE_API_BASE          e.g. https://quest-api.<acct>.workers.dev
//   VITE_GOOGLE_CLIENT_ID   the OAuth Web client id
// When unconfigured, isSyncConfigured() is false and the app behaves exactly
// as before (local-only). This keeps the feature safe to ship before the
// backend exists.
// ──────────────────────────────────────────────────────────────────────────

import { stripQuestions } from './storage'

const API = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SESSION_KEY = 'quest-session'

export function isSyncConfigured() {
  return !!API && !!GOOGLE_CLIENT_ID
}

// ── session token (our JWT) ──
export function getSessionToken() {
  try { return localStorage.getItem(SESSION_KEY) || '' } catch { return '' }
}
function setSessionToken(t) {
  try { t ? localStorage.setItem(SESSION_KEY, t) : localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}
export function logout() { setSessionToken('') }
export function isLoggedIn() { return !!getSessionToken() }

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) { logout(); throw new Error('unauthorized') }
  if (!res.ok) throw new Error(`api ${path} ${res.status}`)
  return res.json()
}

// Exchange a Google ID token (credential) for our session JWT. Returns user.
export async function loginWithGoogle(credential) {
  const { token, user } = await api('/api/auth/google', { method: 'POST', body: { credential } })
  setSessionToken(token)
  return user
}

export async function fetchMe() {
  const token = getSessionToken()
  if (!token) return null
  try { return (await api('/api/me', { token })).user } catch { return null }
}

// ── shape conversion: server rows <-> the app's maps ──
const qkey = (exam, id) => `${exam}-${id}`

function remoteToMaps(state) {
  const statsHistory = {}
  for (const p of state.progress || []) {
    statsHistory[p.qkey] = {
      correct: !!p.correct,
      correctCount: p.correct_count || 0,
      everWrong: !!p.ever_wrong,
      exam: p.exam,
      type: undefined,
      id: p.qid,
      _updatedAt: p.updated_at || 0,
    }
  }
  const toMap = (rows) => {
    const m = {}
    for (const r of rows || []) if (r.enabled) m[r.qkey] = true
    return m
  }
  return { statsHistory, bookmarked: toMap(state.bookmarks), reviewMarked: toMap(state.reviews) }
}

// Build a delta payload from the app's current maps.
function mapsToDelta({ statsHistory, bookmarked, reviewMarked }) {
  const now = Date.now()
  const stripped = stripQuestions(statsHistory)
  const progress = Object.entries(stripped).map(([k, v]) => ({
    qkey: k, exam: v.exam, qid: v.id,
    correct: v.correct ? 1 : 0,
    correct_count: v.correctCount || 0,
    ever_wrong: v.everWrong ? 1 : 0,
    updated_at: v._updatedAt || now,
  }))
  const flags = (m) => Object.keys(m || {}).map((k) => ({ qkey: k, enabled: 1, updated_at: now }))
  return { progress, bookmarks: flags(bookmarked), reviews: flags(reviewMarked) }
}

export async function fetchRemoteMaps() {
  const token = getSessionToken()
  if (!token) return null
  return remoteToMaps(await api('/api/state', { token }))
}

export async function pushMaps(maps) {
  const token = getSessionToken()
  if (!token) return null
  const merged = await api('/api/state', { method: 'POST', token, body: mapsToDelta(maps) })
  return remoteToMaps(merged)
}

// ── client-side merge (for instant UI before the round-trip) ──
// Mirrors the server semantics: correctCount=max, everWrong=OR, rest LWW.
export function mergeMaps(local, remote) {
  if (!remote) return local
  const out = { statsHistory: {}, bookmarked: { ...local.bookmarked }, reviewMarked: { ...local.reviewMarked } }
  const keys = new Set([...Object.keys(local.statsHistory || {}), ...Object.keys(remote.statsHistory || {})])
  for (const k of keys) {
    const a = local.statsHistory?.[k]
    const b = remote.statsHistory?.[k]
    if (a && b) {
      const newer = (b._updatedAt || 0) >= (a._updatedAt || 0) ? b : a
      out.statsHistory[k] = {
        ...a, ...b,
        correct: newer.correct,
        correctCount: Math.max(a.correctCount || 0, b.correctCount || 0),
        everWrong: !!(a.everWrong || b.everWrong),
        question: a.question || b.question,
      }
    } else {
      out.statsHistory[k] = a || b
    }
  }
  // bookmarks/reviews: union on load (server is authoritative via LWW on push)
  for (const k of Object.keys(remote.bookmarked || {})) out.bookmarked[k] = true
  for (const k of Object.keys(remote.reviewMarked || {})) out.reviewMarked[k] = true
  return out
}
