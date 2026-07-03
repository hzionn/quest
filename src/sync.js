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

import { stripQuestions, getDeviceId } from './storage'

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
  // Split the per-device daily rows: this device's own counters vs. the sum
  // of every OTHER device (the "remote overlay" the UI adds on top of local).
  const myDevice = getDeviceId()
  const dailyOwn = {}
  const dailyOthers = {}
  for (const r of state.daily || []) {
    const row = { answered: r.answered || 0, correct: r.correct || 0, seconds: r.seconds || 0 }
    if (r.device_id === myDevice) {
      dailyOwn[r.day] = row
    } else {
      const cur = dailyOthers[r.day] || { answered: 0, correct: 0, seconds: 0 }
      dailyOthers[r.day] = {
        answered: cur.answered + row.answered,
        correct: cur.correct + row.correct,
        seconds: cur.seconds + row.seconds,
      }
    }
  }
  return { statsHistory, bookmarked: toMap(state.bookmarks), reviewMarked: toMap(state.reviews), dailyOwn, dailyOthers }
}

// Build a delta payload from the app's current maps. With `dirty` (per-map
// sets of qkeys) only those keys are sent — a much smaller payload than the
// full maps, and un-toggled bookmarks/reviews go up as enabled:0 so removals
// sync too (the server upserts enabled with last-write-wins).
function mapsToDelta({ statsHistory, bookmarked, reviewMarked }, dirty = null) {
  const now = Date.now()
  const stripped = stripQuestions(statsHistory)
  const statKeys = dirty ? [...dirty.stats].filter((k) => stripped[k]) : Object.keys(stripped)
  const progress = statKeys.map((k) => {
    const v = stripped[k]
    return {
      qkey: k, exam: v.exam, qid: v.id,
      correct: v.correct ? 1 : 0,
      correct_count: v.correctCount || 0,
      ever_wrong: v.everWrong ? 1 : 0,
      updated_at: v._updatedAt || now,
    }
  })
  const flags = (m, keys) =>
    (keys ? [...keys] : Object.keys(m || {})).map((k) => ({ qkey: k, enabled: m?.[k] ? 1 : 0, updated_at: now }))
  return { progress, bookmarks: flags(bookmarked, dirty?.bookmarks), reviews: flags(reviewMarked, dirty?.reviews) }
}

// This device's daily counters as server rows (G-Counter contribution).
// With `days` only those buckets are sent.
export function dailyToRows(dailyStats, days = null) {
  const now = Date.now()
  const deviceId = getDeviceId()
  return (days ? [...days] : Object.keys(dailyStats || {}))
    .map((day) => {
      const v = dailyStats?.[day]
      if (!v) return null
      return {
        device_id: deviceId, day,
        answered: v.answered || 0,
        correct: v.correct || 0,
        seconds: v.seconds || 0,
        updated_at: now,
      }
    })
    .filter(Boolean)
}

// Admin-only usage overview; null when not signed in / not an admin.
export async function fetchAdminOverview() {
  const token = getSessionToken()
  if (!token) return null
  try {
    return await api('/api/admin/overview', { token })
  } catch {
    return null
  }
}

export async function fetchRemoteMaps() {
  const token = getSessionToken()
  if (!token) return null
  return remoteToMaps(await api('/api/state', { token }))
}

export async function pushMaps(maps, dirty = null) {
  const token = getSessionToken()
  if (!token) return null
  const body = mapsToDelta(maps, dirty)
  // Attach this device's daily counters (all days on a full push, dirty days
  // only on a delta push). MAX-merged server-side, so retries are safe.
  body.daily = dailyToRows(maps.dailyStats, dirty ? dirty.daily : null)
  const merged = await api('/api/state', { method: 'POST', token, body })
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
