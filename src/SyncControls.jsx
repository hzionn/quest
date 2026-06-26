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
          } catch (e) {
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
export function useGoogleSync(state, dispatch, user, setUser) {
  const initialSyncedRef = useRef(false)
  const debounceRef = useRef(null)
  const lastPushAtRef = useRef(0)

  // 1. Bootstrap: hydrate `user` from an existing session token.
  useEffect(() => {
    if (!isSyncConfigured() || user) return
    let alive = true
    fetchMe().then((u) => { if (alive && u) setUser(u) }).catch(() => {})
    return () => { alive = false }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Initial fetch + merge + push, once per signed-in session.
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
        }
        const merged = mergeMaps(local, remote)
        dispatch({ type: 'RESTORE_STATS', statsHistory: merged.statsHistory })
        dispatch({ type: 'RESTORE_BOOKMARKS', bookmarked: merged.bookmarked })
        dispatch({ type: 'RESTORE_REVIEWS', reviewMarked: merged.reviewMarked })
        await pushMaps(merged).catch(() => {})
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

  // 3. Debounced push on state changes (after the initial sync).
  useEffect(() => {
    if (!isSyncConfigured() || !user || !initialSyncedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pushMaps({
        statsHistory: state.statsHistory,
        bookmarked: state.bookmarked,
        reviewMarked: state.reviewMarked,
      }).then(() => { lastPushAtRef.current = Date.now() })
        .catch((e) => console.warn('[sync] push failed:', e?.message || e))
    }, 3000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [state.statsHistory, state.bookmarked, state.reviewMarked, user])

  // 4. Best-effort flush on page hide.
  useEffect(() => {
    if (!isSyncConfigured() || !user) return
    const flush = () => {
      if (!initialSyncedRef.current) return
      // Cancel any pending debounce so it doesn't fire after we send.
      if (debounceRef.current) clearTimeout(debounceRef.current)
      pushMaps({
        statsHistory: state.statsHistory,
        bookmarked: state.bookmarked,
        reviewMarked: state.reviewMarked,
      }).catch(() => {})
    }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [state.statsHistory, state.bookmarked, state.reviewMarked, user])

  const signOut = useCallback(() => {
    clearSessionToken()
    setUser(null)
    initialSyncedRef.current = false
  }, [setUser])

  return { signOut }
}
