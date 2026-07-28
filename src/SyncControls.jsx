// ──────────────────────────────────────────────────────────────────────────
// Cross-device sync UI + orchestration.
//
//   <GoogleSignInButton onSuccess />  — loads Google Identity Services, renders
//                                       the official Sign-In button, and on
//                                       success exchanges the credential for
//                                       our session JWT (sync.js).
//   <SyncStatusPill ...>              — small header badge: "Sign in to sync"
//                                       when logged out, user pill + sign-out
//                                       when logged in.
//   useGoogleSync(state, dispatch,    — wires up the side-effects:
//                 user)                 - on user becomes set → fetch remote,
//                                         merge with current local state,
//                                         dispatch RESTORE_*, push merged back
//                                       - on later state changes → debounced
//                                         push (3 s) of {stats, bookmarks,
//                                         reviews}
//
// Everything is a no-op when isSyncConfigured() is false (the build wasn't
// given VITE_API_BASE + VITE_GOOGLE_CLIENT_ID), so this file is safe to ship
// before the backend / OAuth client are in place.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react'
import { LogOut } from 'lucide-react'
import {
  isSyncConfigured, GOOGLE_CLIENT_ID,
  loginWithGoogle, fetchMe,
  fetchRemoteMaps, pushMaps, mergeMaps, logout as clearSessionToken,
} from './sync'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiPromise = null
function loadGsiScript() {
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = GSI_SRC; s.async = true; s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { gsiPromise = null; reject(new Error('GSI load failed')) }
    document.head.appendChild(s)
  })
  return gsiPromise
}

export function GoogleSignInButton({ onSuccess, theme = 'filled_black' }) {
  const containerRef = useRef(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isSyncConfigured()) return
    let alive = true
    loadGsiScript().then(() => {
      if (!alive || !containerRef.current) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp) => {
          if (!resp?.credential) { setError('沒收到 Google 憑證'); return }
          setBusy(true); setError('')
          try {
            const user = await loginWithGoogle(resp.credential)
            onSuccess?.(user)
          } catch {
            setError('登入失敗，請再試一次')
          } finally {
            setBusy(false)
          }
        },
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        theme,
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      })
    }).catch(() => setError('Google 服務無法載入（請檢查網路）'))
    return () => { alive = false }
  }, [theme, onSuccess])

  if (!isSyncConfigured()) return null
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} aria-busy={busy} />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export function SyncStatusPill({ user, onSignedIn, onSignOut }) {
  const [open, setOpen] = useState(false)
  if (!isSyncConfigured()) return null

  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-300 hover:text-orange-300 hover:bg-white/10 border border-white/10 transition-colors"
          title="登入以跨裝置同步進度"
        >
          登入同步
        </button>
        {open && (
          <div className="absolute right-0 mt-2 p-3 rounded-xl bg-gray-800 border border-gray-700 shadow-xl z-50">
            <p className="text-xs text-gray-400 mb-2 whitespace-nowrap">登入後練習進度自動跨裝置同步</p>
            <GoogleSignInButton onSuccess={(u) => { setOpen(false); onSignedIn?.(u) }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
      {user.picture && (
        <img src={user.picture} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
      )}
      <span className="text-xs text-gray-300 max-w-[140px] truncate" title={user.email}>
        {user.email}
      </span>
      <button
        onClick={onSignOut}
        className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/20"
        title="登出"
      >
        <LogOut size={12} />
      </button>
    </div>
  )
}

// ── Orchestration hook ───────────────────────────────────────────────────
//
// Runs three effects:
//   1. Bootstrap: if a session token is already in localStorage, call
//      /api/me to populate `user` (no UI prompt needed).
//   2. On user becomes truthy: fetch remote state, merge with the current
//      local state, dispatch RESTORE_* to replace state with the merged
//      result, then push merged back so the server picks up local-only
//      items.
//   3. After (2) completes, every subsequent change to statsHistory /
//      bookmarked / reviewMarked debounce-pushes (3 s) to the server.
//
// Keys whose value changed between two maps (reference compare — the reducer
// replaces entries immutably) plus keys that were removed.
function diffKeys(a = {}, b = {}) {
  const out = []
  for (const k in b) if (b[k] !== a[k]) out.push(k)
  for (const k in a) if (!(k in b)) out.push(k)
  return out
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGoogleSync(state, dispatch, user, setUser) {
  const [authReady, setAuthReady] = useState(!isSyncConfigured())
  const initialSyncedRef = useRef(false)
  const debounceRef = useRef(null)
  const lastPushAtRef = useRef(0)
  // Delta tracking: accumulate changed qkeys per map; each push sends only
  // those (removals go up as enabled:0). On success the pushed keys clear;
  // keys dirtied mid-flight survive for the next push.
  const prevMapsRef = useRef(null)
  const mapsRef = useRef(null)
  // `bonus` is a plain flag, not a key set: bonus XP is a single scalar, and
  // it can change on its own (claiming a daily mission touches nothing else),
  // so it needs its own reason-to-push.
  const dirtyRef = useRef({ stats: new Set(), bookmarks: new Set(), reviews: new Set(), certifications: new Set(), daily: new Set(), bonus: false })
  const lastOthersJsonRef = useRef('')

  const clearDirty = () => {
    dirtyRef.current.stats.clear()
    dirtyRef.current.bookmarks.clear()
    dirtyRef.current.reviews.clear()
    dirtyRef.current.certifications.clear()
    dirtyRef.current.daily.clear()
    dirtyRef.current.bonus = false
  }

  // Other devices' daily overlay: only dispatch when the content actually
  // changed, so routine pushes don't cause pointless re-renders.
  const applyDailyOthers = (others) => {
    const json = JSON.stringify(others || {})
    if (json === lastOthersJsonRef.current) return
    lastOthersJsonRef.current = json
    dispatch({ type: 'SET_DAILY_REMOTE', dailyRemote: others || {} })
  }

  const pushDirty = () => {
    const d = dirtyRef.current
    const snap = {
      stats: new Set(d.stats),
      bookmarks: new Set(d.bookmarks),
      reviews: new Set(d.reviews),
      certifications: new Set(d.certifications),
      daily: new Set(d.daily),
    }
    const total = snap.stats.size + snap.bookmarks.size + snap.reviews.size + snap.certifications.size + snap.daily.size + (d.bonus ? 1 : 0)
    if (!total || !mapsRef.current) return
    const sentBonus = d.bonus
    pushMaps(mapsRef.current, snap)
      .then((remote) => {
        snap.stats.forEach((k) => d.stats.delete(k))
        snap.bookmarks.forEach((k) => d.bookmarks.delete(k))
        snap.reviews.forEach((k) => d.reviews.delete(k))
        snap.certifications.forEach((k) => d.certifications.delete(k))
        snap.daily.forEach((k) => d.daily.delete(k))
        if (sentBonus) d.bonus = false
        lastPushAtRef.current = Date.now()
        if (remote) applyDailyOthers(remote.dailyOthers)
      })
      .catch((e) => console.warn('[sync] push failed:', e?.message || e))
  }

  // 1. Bootstrap: hydrate `user` from an existing session token.
  useEffect(() => {
    if (!isSyncConfigured() || user) return
    let alive = true
    fetchMe()
      .then((u) => { if (alive && u) setUser(u) })
      .catch(() => {})
      .finally(() => { if (alive) setAuthReady(true) })
    return () => { alive = false }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Initial fetch + merge + full push, once per signed-in session.
  useEffect(() => {
    if (!isSyncConfigured() || !user || initialSyncedRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const remote = await fetchRemoteMaps()
        if (cancelled || !remote) return
        const local = {
          statsHistory: state.statsHistory,
          bookmarked: state.bookmarked,
          reviewMarked: state.reviewMarked,
          earnedCertifications: state.earnedCertifications,
        }
        // Fever/mission XP: keep the higher of local vs server (RESTORE_GAMIFY
        // MAX-merges too), then push the winner back below.
        const bonusXp = Math.max(state.bonusXp || 0, remote.bonusXp || 0)
        const merged = mergeMaps(local, remote)
        // Daily counters: reconcile OWN device per-day (field-wise max with
        // the server's row for this device — restores after a cleared
        // localStorage); other devices become the display overlay.
        const ownDaily = {}
        for (const day of new Set([...Object.keys(state.dailyStats || {}), ...Object.keys(remote.dailyOwn || {})])) {
          const a = state.dailyStats?.[day] || {}
          const b = remote.dailyOwn?.[day] || {}
          ownDaily[day] = {
            answered: Math.max(a.answered || 0, b.answered || 0),
            correct: Math.max(a.correct || 0, b.correct || 0),
            seconds: Math.max(a.seconds || 0, b.seconds || 0),
          }
        }
        dispatch({ type: 'RESTORE_STATS', statsHistory: merged.statsHistory })
        dispatch({ type: 'RESTORE_BOOKMARKS', bookmarked: merged.bookmarked })
        dispatch({ type: 'RESTORE_REVIEWS', reviewMarked: merged.reviewMarked })
        dispatch({ type: 'RESTORE_CERTIFICATIONS', earnedCertifications: merged.earnedCertifications })
        dispatch({ type: 'RESTORE_DAILY', dailyStats: ownDaily })
        if (bonusXp > (state.bonusXp || 0)) dispatch({ type: 'RESTORE_GAMIFY', bonusXp })
        applyDailyOthers(remote.dailyOthers)
        const mergedWithDaily = { ...merged, dailyStats: ownDaily, bonusXp }
        await pushMaps(mergedWithDaily).catch(() => {})
        prevMapsRef.current = mergedWithDaily
        mapsRef.current = mergedWithDaily
        clearDirty()
        initialSyncedRef.current = true
        lastPushAtRef.current = Date.now()
      } catch (e) {
        console.warn('[sync] initial fetch/merge failed:', e?.message || e)
      }
    })()
    return () => { cancelled = true }
    // run when user changes (sign-in / sign-out / bootstrap fill-in)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // 3. Diff each state change into the dirty sets; debounce-push the delta.
  useEffect(() => {
    if (!isSyncConfigured() || !user || !initialSyncedRef.current) return
    const cur = {
      statsHistory: state.statsHistory,
      bookmarked: state.bookmarked,
      reviewMarked: state.reviewMarked,
      earnedCertifications: state.earnedCertifications,
      dailyStats: state.dailyStats,
      bonusXp: state.bonusXp || 0,
    }
    mapsRef.current = cur
    const prev = prevMapsRef.current
    if (prev) {
      const d = dirtyRef.current
      diffKeys(prev.statsHistory, cur.statsHistory).forEach((k) => d.stats.add(k))
      diffKeys(prev.bookmarked, cur.bookmarked).forEach((k) => d.bookmarks.add(k))
      diffKeys(prev.reviewMarked, cur.reviewMarked).forEach((k) => d.reviews.add(k))
      diffKeys(prev.earnedCertifications, cur.earnedCertifications).forEach((k) => d.certifications.add(k))
      diffKeys(prev.dailyStats, cur.dailyStats).forEach((k) => d.daily.add(k))
      if ((prev.bonusXp || 0) !== cur.bonusXp) d.bonus = true
    }
    prevMapsRef.current = cur
    const d = dirtyRef.current
    if (!(d.stats.size + d.bookmarks.size + d.reviews.size + d.certifications.size + d.daily.size + (d.bonus ? 1 : 0))) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(pushDirty, 3000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.statsHistory, state.bookmarked, state.reviewMarked, state.earnedCertifications, state.dailyStats, state.bonusXp, user])

  // 4. Best-effort flush on page hide.
  useEffect(() => {
    if (!isSyncConfigured() || !user) return
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || !initialSyncedRef.current) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      pushDirty()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const signOut = useCallback(() => {
    clearSessionToken()
    setUser(null)
    setAuthReady(true)
    initialSyncedRef.current = false
    prevMapsRef.current = null
    mapsRef.current = null
    clearDirty()
    lastOthersJsonRef.current = ''
    dispatch({ type: 'SET_DAILY_REMOTE', dailyRemote: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUser])

  return { signOut, authReady }
}
