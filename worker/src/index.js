// quest-api — Cloudflare Worker
// Cross-device progress sync for the quest quiz app.
// Auth: Google ID token in -> our session JWT out (Bearer). Storage: D1.

import { verifyGoogleIdToken, signSession, verifySession, bearer } from './auth.js'
import { upsertUser, getState, mergeState } from './db.js'

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  const allow = allowed.includes(origin) ? origin : (allowed[0] || '*')
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

async function requireUser(request, env) {
  const tok = bearer(request)
  if (!tok) return null
  return await verifySession(tok, env.JWT_SECRET)
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    const path = url.pathname
    const reply = (data, status = 200) => json(data, status, cors)

    try {
      // ── health ──
      if (path === '/' || path === '/health') {
        return reply({ ok: true, service: 'quest-api' })
      }

      // ── exchange a Google ID token for our session JWT ──
      if (path === '/api/auth/google' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const idToken = body.credential || body.id_token
        if (!idToken) return reply({ error: 'missing credential' }, 400)

        let g
        try {
          g = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID)
        } catch {
          return reply({ error: 'invalid google token' }, 401)
        }
        const user = await upsertUser(env.DB, g)
        const ttl = Number(env.SESSION_TTL_DAYS || '30')
        const token = await signSession(
          { uid: user.id, sub: user.google_sub, email: user.email },
          env.JWT_SECRET,
          ttl
        )
        return reply({ token, user })
      }

      // ── everything below needs a valid session ──
      const me = await requireUser(request, env)
      if (!me) return reply({ error: 'unauthorized' }, 401)

      if (path === '/api/me' && request.method === 'GET') {
        const user = await env.DB.prepare(
          `SELECT id, email, name, picture FROM users WHERE id = ?`
        ).bind(me.uid).first()
        return reply({ user })
      }

      if (path === '/api/state' && request.method === 'GET') {
        return reply(await getState(env.DB, me.uid))
      }

      if (path === '/api/state' && request.method === 'POST') {
        const delta = await request.json().catch(() => ({}))
        const merged = await mergeState(env.DB, me.uid, delta)
        return reply(merged)
      }

      return reply({ error: 'not found' }, 404)
    } catch (err) {
      return reply({ error: 'internal', detail: String(err && err.message || err) }, 500)
    }
  },
}
