// Auth helpers: verify Google ID tokens, mint/verify our own session JWT.
import { jwtVerify, createRemoteJWKSet, SignJWT } from 'jose'

// Google's public keys (cached by jose across requests in the same isolate).
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)
const GOOGLE_ISS = ['https://accounts.google.com', 'accounts.google.com']

// Verify a Google ID token (the `credential` from Google Identity Services).
// Returns the validated payload ({ sub, email, name, picture, ... }) or throws.
export async function verifyGoogleIdToken(idToken, clientId) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISS,
    audience: clientId,
  })
  if (!payload.sub) throw new Error('google token missing sub')
  return payload
}

// Mint our session token (HS256). `uid` is the D1 users.id.
export async function signSession({ uid, sub, email }, secret, ttlDays) {
  const key = new TextEncoder().encode(secret)
  return await new SignJWT({ sub, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(uid))
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(key)
}

// Verify our session token. Returns { uid, sub, email } or null.
export async function verifySession(token, secret) {
  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key)
    return { uid: Number(payload.sub), sub: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

// Pull the Bearer token out of an Authorization header.
export function bearer(request) {
  const h = request.headers.get('Authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}
