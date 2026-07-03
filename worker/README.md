# quest-api — Cloudflare Worker (cross-device progress sync)

Backend for syncing quiz progress across devices. Sign in with Google,
get a session JWT, and your `statsHistory` / bookmarks / reviews follow
you to any device.

- **Compute:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** Google ID token → our HS256 session JWT (sent as `Authorization: Bearer`)

The frontend stays on GitHub Pages; it just calls this Worker.

---

## One-time setup

### 1. Google OAuth Web client (for the "Sign in with Google" button)

1. Go to <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill app name + your email → save. Add yourself under **Test users** (or Publish).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins:** `https://awsjin510.github.io` (and `http://localhost:5173` for local dev)
4. Copy the **Client ID** (looks like `xxx.apps.googleusercontent.com`). You need it twice: as the Worker secret `GOOGLE_CLIENT_ID` and as the frontend's `VITE_GOOGLE_CLIENT_ID`.

### 2. Cloudflare (log in with your Google account)

```bash
cd worker
npm install
npx wrangler login          # opens the browser — choose "Sign in with Google"
```

### 3. Create the D1 database + tables

```bash
npx wrangler d1 create quest_db
# copy the printed database_id into wrangler.toml (replace REPLACE_WITH_D1_DATABASE_ID)
npm run db:init             # runs schema.sql against the remote D1
```

### 4. Set secrets

```bash
npx wrangler secret put GOOGLE_CLIENT_ID    # paste the OAuth Web Client ID
npx wrangler secret put JWT_SECRET          # paste a long random string (e.g. `openssl rand -base64 48`)
```

### 5. Deploy

```bash
npm run deploy
```

Wrangler prints your Worker URL, e.g. `https://quest-api.<account>.workers.dev`.
Test it: `curl https://quest-api.<account>.workers.dev/health` → `{"ok":true,...}`.

### 6. Point the frontend at it

In the frontend build, set:

- `VITE_API_BASE = https://quest-api.<account>.workers.dev`
- `VITE_GOOGLE_CLIENT_ID = <the OAuth Web Client ID>`

(These get wired into the app in the P2/P3 frontend work.)

---

## CORS

`wrangler.toml` → `ALLOWED_ORIGINS` lists the browser origins allowed to call the
API. It already includes `https://awsjin510.github.io` and `http://localhost:5173`.

## API

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET  | `/health` | – | – | `{ ok }` |
| POST | `/api/auth/google` | – | `{ credential }` (Google ID token) | `{ token, user }` |
| GET  | `/api/me` | Bearer | – | `{ user }` |
| GET  | `/api/state` | Bearer | – | `{ progress, bookmarks, reviews, settings }` |
| POST | `/api/state` | Bearer | `{ progress?, bookmarks?, reviews?, settings? }` (delta) | merged state |

## Merge semantics (two devices, no data loss)

- `correct_count` → **max** (answered-correctly count never regresses)
- `ever_wrong` → **OR** (once wrong, stays wrong)
- `correct`, bookmark/review `enabled`, settings → **last-write-wins** by `updated_at`

## Local dev

```bash
npm run db:init:local
npx wrangler dev          # also needs the two secrets in a .dev.vars file
```

`.dev.vars` (gitignored):

```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
JWT_SECRET=some-long-random-string
```

## Cost

Free tier: Workers 100k req/day, D1 5M rows read / 100k written per day. This
app is nowhere near those limits.

<!-- deploy retry: D1 transient "storage reset" error on previous run -->
