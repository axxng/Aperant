# Phase 3: GitHub OAuth Login - Research

**Researched:** 2026-04-21
**Domain:** GitHub OAuth 2.0 flow, Vercel serverless auth, LibSQL/Turso DB migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** GitHub OAuth is the **only** login method. Email OTP is removed entirely — no fallback, no dual login.
- **D-02:** Standard **GitHub OAuth App** (not GitHub App). Requires `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` env vars. Token does not expire unless revoked.
- **D-03:** OAuth scopes: **`repo`** (full private repo access). Single scope.
- **D-04:** Per-user GitHub OAuth tokens stored individually. GitHub API calls use the requesting user's token.
- **D-05:** Token stored in the **existing `users` table** via a new migration: add `github_token TEXT` and `github_login TEXT` columns.
- **D-06:** First GitHub user to complete OAuth becomes admin. All subsequent users become `member`.
- **D-07:** Admin promotes members manually via existing user management panel. No automatic role escalation.
- **D-08:** `LoginPage` replaced with a single "Sign in with GitHub" button.
- **D-09:** OAuth callback handled by `GET /api/auth/github/callback`.
- **D-10:** Admin configures products pointing to repos (no change). 403 for repos user's token cannot access.
- **D-11:** `githubToken` settings key deprecated and removed from `VALID_KEYS`.
- **D-12:** `githubFetch()` accepts the user's OAuth token as a parameter. Global `resolveConfig('githubToken', 'GITHUB_TOKEN')` is retired.
- **D-13:** All existing API routes calling `githubFetch()` pass the user's token from request context.
- **D-14:** Remove Resend, OTP-related DB columns/tables, and OTP API routes.

### Claude's Discretion
- CSRF state param storage approach
- Whether `github_token` is encrypted at rest or plain
- JWT structure after OAuth: reuse with `userId`, `email` (GitHub email), `role`

### Deferred Ideas (OUT OF SCOPE)
- GitHub App installation tokens
- Org membership-based role assignment
- Multiple OAuth providers
- Token refresh / revocation webhooks
</user_constraints>

---

## Summary

This phase replaces the existing email OTP login system with GitHub OAuth as the sole authentication mechanism. The scope is narrowly defined: two new server routes (`/api/auth/github` and `/api/auth/github/callback`), one DB migration, signature changes to `githubFetch()`, updates to 9 GitHub proxy route files, removal of OTP infrastructure, and a LoginPage replacement.

The existing codebase is clean and well-structured. The JWT infrastructure (`jwt.ts`) is reusable without any changes — `createToken(userId, email, role)` continues to work with GitHub email and same role strings. The `authenticateRequest()` middleware is completely unchanged. The migration system in `client.ts` uses a simple `MIGRATIONS` array appended in order; the next available slot is `012_github_oauth`.

The primary migration effort — updating the 9 route files that call `githubFetch()` — is repetitive but mechanical. Each route already has `user` from `authenticateRequest()`, so the pattern is: read `user.userId`, look up the user's `github_token` from the DB, pass it to `githubFetch()`. The `github-sync.ts` file uses its own internal `getGitHubToken()` and `githubFetch()` — this is a cron background job and requires separate treatment (a service-account or shared token strategy, or deferral).

**Primary recommendation:** New migration `012_github_oauth` adds two columns to `users` table. `githubFetch()` gains a required `token: string` first parameter. All 9 route files are updated in a single wave. OAuth callback uses a short-lived server-side state cookie (crypto random, 10-minute expiry) for CSRF protection — no new table required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth redirect initiation | API (Vercel serverless) | — | Generates state, sets cookie, redirects to GitHub |
| OAuth state CSRF check | API (Vercel serverless) | — | Cookie compared on callback; purely server-side |
| Token exchange (code → token) | API (Vercel serverless) | — | Requires `GITHUB_CLIENT_SECRET`; must never be in browser |
| GitHub user info fetch | API (Vercel serverless) | — | Server-to-server call with newly exchanged token |
| User upsert + first-admin check | API + DB (Turso) | — | `SELECT COUNT(*)` then INSERT/UPDATE |
| JWT issuance | API (Vercel serverless) | — | Reuses existing `createToken()` |
| Per-user token resolution | API (Vercel serverless) | DB | Each route reads token from DB by `userId` |
| Login UI | Browser (React) | — | Single button; initiates redirect to `/api/auth/github` |
| Session persistence | Browser (Zustand persist) | — | JWT stored in localStorage via existing `aperant-auth` key |
| Background sync token | API cron (`github-sync.ts`) | DB / env | Cron job — separate concern from per-user OAuth flow |

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@vercel/node` | ^5.0.0 | Vercel serverless handler types | Already installed [VERIFIED: package.json] |
| `@libsql/client` | ^0.14.0 | Turso DB client | Already installed [VERIFIED: package.json] |
| `uuid` | ^11.1.0 | Generate user IDs | Already installed [VERIFIED: package.json] |
| `zod` | ^3.24.4 | Input validation | Already installed [VERIFIED: package.json] |
| `crypto` (Node built-in) | — | State param generation, HMAC | Built-in; already used in `jwt.ts` |

### No new packages required
The OAuth flow uses native Node.js `fetch` (available in the Vercel runtime) and `crypto` (already imported in `jwt.ts`). No additional OAuth library is needed for a single-provider GitHub OAuth App flow.

**State cookie storage:** Standard `Set-Cookie` header with `HttpOnly; Secure; SameSite=Lax; Max-Age=600` — no cookie-parser package needed for Vercel serverless (headers read directly via `req.headers.cookie`).

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                    Vercel API                GitHub            Turso DB
  |                           |                         |                  |
  |  GET /api/auth/github     |                         |                  |
  |-------------------------->|                         |                  |
  |                           | generate state (crypto.randomBytes)        |
  |                           | Set-Cookie: oauth_state=<state>; HttpOnly  |
  |  302 → github.com/login/  |                         |                  |
  |  oauth/authorize?         |                         |                  |
  |  client_id=...&state=...  |                         |                  |
  |<--------------------------|                         |                  |
  |                           |                         |                  |
  |  User authenticates at GitHub, grants `repo` scope  |                  |
  |                           |                         |                  |
  |  GET /api/auth/github/callback?code=X&state=Y       |                  |
  |-------------------------->|                         |                  |
  |                           | verify state vs cookie  |                  |
  |                           | POST /login/oauth/access_token             |
  |                           |------------------------>|                  |
  |                           |   { access_token }      |                  |
  |                           |<------------------------|                  |
  |                           | GET /user               |                  |
  |                           |------------------------>|                  |
  |                           |   { id, login, email }  |                  |
  |                           |<------------------------|                  |
  |                           | SELECT COUNT(*) FROM users                 |
  |                           |-------------------------------------->|    |
  |                           | INSERT/UPDATE users (github_token, ...)    |
  |                           |-------------------------------------->|    |
  |                           | createToken(userId, email, role)     |    |
  |  302 → /?token=<jwt>      |                         |                  |
  |<--------------------------|                         |                  |
  |  Store JWT in Zustand     |                         |                  |
```

### Recommended File Structure (new/changed files)

```
apps/web/api/auth/
├── github.ts              # NEW: GET /api/auth/github — OAuth initiate
├── github/
│   └── callback.ts        # NEW: GET /api/auth/github/callback
├── me.ts                  # CHANGE: expose github_login in response
├── request-otp.ts         # DELETE
├── verify-otp.ts          # DELETE
└── users/                 # UNCHANGED

apps/web/api/_lib/
├── auth/
│   ├── jwt.ts             # UNCHANGED
│   ├── middleware.ts       # UNCHANGED
│   ├── otp.ts             # DELETE
│   └── email.ts           # DELETE
├── github.ts              # CHANGE: githubFetch() signature + remove getGitHubToken()
├── db/
│   ├── client.ts          # CHANGE: append migration 012_github_oauth
│   └── users.ts           # CHANGE: add upsertOAuthUser(), update getUserById() return type
└── config-resolver.ts     # UNCHANGED (still used by sync cron)

apps/web/api/github/               # ALL 9 ROUTE FILES: pass user token
apps/web/api/settings/index.ts     # CHANGE: remove githubToken from VALID_KEYS + SENSITIVE_KEYS

apps/web/src/client/
├── components/LoginPage.tsx       # FULL REPLACEMENT: GitHub button only
├── components/Settings.tsx        # CHANGE: remove GitHub token input section
└── stores/
    ├── auth-store.ts              # CHANGE: remove OTP actions, add initiateGitHubOAuth()
    └── settings-store.ts          # CHANGE: remove githubToken field + setGithubToken()

apps/web/src/shared/i18n/locales/
├── en/auth.json                   # CHANGE: replace OTP keys with OAuth keys
└── fr/auth.json                   # CHANGE: replace OTP keys with OAuth keys
```

### Pattern 1: OAuth Initiate Route

```typescript
// Source: github.com/login/oauth/authorize docs [CITED: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps]
// apps/web/api/auth/github.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:5173/api/auth/github/callback';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!GITHUB_CLIENT_ID) return res.status(500).json({ error: 'GitHub OAuth not configured' });

  const state = crypto.randomBytes(16).toString('hex');

  // Store state in HttpOnly cookie — survives Vercel's stateless serverless execution
  res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: 'repo',
    state,
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
```

### Pattern 2: OAuth Callback Route

```typescript
// apps/web/api/auth/github/callback.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { createToken } from '../../_lib/auth/jwt.js';
import { upsertOAuthUser, userCount } from '../../_lib/db/users.js';
import { v4 as uuid } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // CSRF: validate state param against cookie
  const cookieHeader = req.headers.cookie || '';
  const cookieState = parseCookieState(cookieHeader);
  const queryState = req.query.state as string;

  if (!cookieState || !queryState || cookieState !== queryState) {
    return res.status(400).json({ error: 'Invalid OAuth state' });
  }

  const code = req.query.code as string;
  if (!code) return res.status(400).json({ error: 'Missing OAuth code' });

  // Exchange code for token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.OAUTH_CALLBACK_URL,
    }),
  });
  const tokenData = await tokenResponse.json();
  if (tokenData.error || !tokenData.access_token) {
    return res.status(400).json({ error: 'OAuth token exchange failed' });
  }

  // Fetch GitHub user
  const githubUser = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  }).then(r => r.json());

  // Determine role: first user is admin
  await ensureDb();
  const count = await userCount();
  const role = count === 0 ? 'admin' : 'member';

  // Upsert user record
  const user = await upsertOAuthUser({
    githubId: String(githubUser.id),
    email: githubUser.email || `${githubUser.login}@github.invalid`,
    name: githubUser.name || githubUser.login,
    githubLogin: githubUser.login,
    githubToken: tokenData.access_token,
    role,
  });

  // Issue JWT (same structure as OTP flow)
  const jwt = createToken(user.id, user.email, user.role);

  // Clear state cookie and redirect with token
  res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Max-Age=0; Path=/');
  res.redirect(302, `/?token=${jwt}`);
}
```

### Pattern 3: Updated githubFetch() Signature

```typescript
// apps/web/api/_lib/github.ts — new signature
export async function githubFetch(token: string, url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  // ... rate-limit detection unchanged ...
}
```

### Pattern 4: Route Migration — Resolving User Token

Every GitHub proxy route already calls `authenticateRequest()` which returns a `TokenPayload` with `userId`. The token resolution pattern for updated routes:

```typescript
// Pattern for each of the 9 route files
const user = await authenticateRequest(req, res);
if (!user) return;

// NEW: resolve per-user GitHub token
const dbUser = await getUserById(user.userId);
if (!dbUser?.github_token) {
  return res.status(403).json({ error: 'GitHub account not connected' });
}

const response = await githubFetch(dbUser.github_token, `${GITHUB_API}/...`);
```

### Pattern 5: DB Migration 012

```typescript
// Append to MIGRATIONS array in client.ts
{
  name: '012_github_oauth',
  sql: `
    ALTER TABLE users ADD COLUMN github_token TEXT;
    ALTER TABLE users ADD COLUMN github_login TEXT;
  `,
}
```

Note: LibSQL/SQLite `ALTER TABLE ADD COLUMN` is idempotent when wrapped in the migration guard — the migration runs once and is recorded in the `migrations` table. NULL is fine as default; pre-existing users will not have tokens and must re-login via GitHub OAuth.

### Pattern 6: Frontend Token Pickup from Redirect

The OAuth callback redirects to `/?token=<jwt>`. App.tsx needs to detect this query param on mount and store the JWT via `setAuth()`:

```typescript
// In App.tsx useEffect on mount (before auth check):
const params = new URLSearchParams(window.location.search);
const oauthToken = params.get('token');
if (oauthToken) {
  // Store token, then clean URL
  useAuthStore.getState().setAuth(oauthToken, /* ... fetch /api/auth/me ... */);
  window.history.replaceState({}, '', '/');
}
```

Alternatively: callback redirects to a dedicated `/auth/callback` React route that does the pickup. A direct `/?token=` pickup is simpler and avoids a new route.

### Anti-Patterns to Avoid

- **Storing state in Vercel KV or DB:** Vercel serverless functions are stateless and short-lived. A simple `HttpOnly` cookie is the correct CSRF state storage for OAuth — no DB table needed, no cold-start risk.
- **Passing the OAuth token in a URL fragment (#token=...):** Fragments are not sent to the server. Use query param or cookie for the handoff. The query param `/?token=<jwt>` approach is standard for SPA OAuth flows.
- **Returning the token as a redirect to a route that re-fetches:** Over-engineering. The JWT contains `userId`, `email`, `role` — sufficient for the auth store to populate without an extra round-trip.
- **Using `github-sync.ts` with the per-user token model:** The cron background sync job (`/api/cron/sync`) is not user-scoped. It must NOT be changed to use per-user tokens in this phase. It retains the `resolveConfig('githubToken', 'GITHUB_TOKEN')` pattern. See Open Questions.

---

## Complete File Inventory

### Files to CREATE (new)
| File | Description |
|------|-------------|
| `api/auth/github.ts` | OAuth initiate: generates state, sets cookie, redirects |
| `api/auth/github/callback.ts` | OAuth callback: validates state, exchanges code, upserts user, issues JWT |

### Files to MODIFY
| File | Change |
|------|--------|
| `api/_lib/db/client.ts` | Append migration `012_github_oauth` (add `github_token`, `github_login` to `users`) |
| `api/_lib/db/users.ts` | Add `upsertOAuthUser()` helper; update `UserRow` interface; add `github_token`, `github_login` fields |
| `api/_lib/github.ts` | Change `githubFetch(url, options)` to `githubFetch(token, url, options)`; remove `getGitHubToken()`; keep `githubGraphQL` (update signature too) |
| `api/auth/me.ts` | Expose `githubLogin` in response |
| `api/auth/users/index.ts` | Update `createUserWithoutPassword` call — new users via admin panel need no `github_token` (fine as NULL) |
| `api/settings/index.ts` | Remove `githubToken` from `VALID_KEYS` and `SENSITIVE_KEYS` |
| `api/github/repos/[owner]/[repo]/issues.ts` | Resolve user token, pass to `githubFetch()` |
| `api/github/repos/[owner]/[repo]/labels.ts` | Resolve user token, pass to `githubFetch()` |
| `api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` | Resolve user token |
| `api/github/repos/[owner]/[repo]/branches.ts` | Resolve user token |
| `api/github/repos/[owner]/[repo]/pulls/index.ts` | Resolve user token |
| `api/github/repos/[owner]/[repo]/pulls/[number]/index.ts` | Resolve user token |
| `api/github/repos/[owner]/[repo]/pulls/[number]/files.ts` | Resolve user token |
| `api/github/projects/[owner]/[number]/index.ts` | Resolve user token, pass to `githubGraphQL()` |
| `api/github/projects/[owner]/[number]/items.ts` | Resolve user token, pass to `githubGraphQL()` |
| `src/client/components/LoginPage.tsx` | Full replacement: single "Sign in with GitHub" button |
| `src/client/components/Settings.tsx` | Remove GitHub token input section (entire "API Keys" → GitHub block) |
| `src/client/stores/auth-store.ts` | Remove OTP actions, add `initiateGitHubOAuth()`, add `githubLogin` to `User` interface |
| `src/client/stores/settings-store.ts` | Remove `githubToken` field and `setGithubToken()` action |
| `src/client/App.tsx` | Add OAuth token pickup from `?token=` query param on mount |
| `src/shared/i18n/locales/en/auth.json` | Replace OTP keys with OAuth keys |
| `src/shared/i18n/locales/fr/auth.json` | Replace OTP keys with OAuth keys |

### Files to DELETE
| File | Reason |
|------|--------|
| `api/auth/request-otp.ts` | OTP flow removed (D-14) |
| `api/auth/verify-otp.ts` | OTP flow removed (D-14) |
| `api/_lib/auth/otp.ts` | OTP logic removed |
| `api/_lib/auth/email.ts` | Resend dependency removed |

### Files UNCHANGED
| File | Reason |
|------|--------|
| `api/_lib/auth/jwt.ts` | JWT sign/verify unchanged; `createToken()` reused as-is |
| `api/_lib/auth/middleware.ts` | `authenticateRequest()` unchanged |
| `api/_lib/config-resolver.ts` | Still used by `github-sync.ts` cron |
| `api/_lib/sync/github-sync.ts` | Cron background sync — out of scope for this phase (see Open Questions) |
| `api/auth/users/index.ts` | Admin user management — unchanged behavior |
| `api/auth/users/[id].ts` | Role update / delete — unchanged |
| All Kanban / product / task routes | No GitHub calls |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie parsing | Manual string split | `req.headers.cookie.split('; ').find(...)` | One-liner; no library needed for a single cookie name |
| State CSRF protection | DB table for OAuth state | `HttpOnly` cookie with `Max-Age=600` | Stateless; survives serverless execution; standard practice |
| Token encryption | AES encrypt before storing | Plain text in Turso | Turso access is controlled by `TURSO_AUTH_TOKEN`; the DB itself is not publicly accessible; encryption adds complexity without meaningful security gain for this access model [ASSUMED - see Assumptions Log] |
| JWT library | Custom JWT | Existing `jwt.ts` | Already implemented with `crypto.createHmac` + `timingSafeEqual` |
| GitHub OAuth client | `passport-github`, `octokit` | Native `fetch` to GitHub API | No cold-start penalty; two HTTP calls (token exchange + user info) are trivial |

**Key insight:** This is a two-request OAuth flow (token exchange + user info). A full OAuth library is overkill — it adds cold-start weight with no benefit over two native fetch calls.

---

## Common Pitfalls

### Pitfall 1: `bootstrapAdmin` Conflict with First-User-is-Admin

**What goes wrong:** `bootstrapAdmin()` in `client.ts` checks for `ADMIN_EMAIL` env var and inserts a user row if the table is empty. If this env var is set, the very first call to `ensureDb()` will create an admin user — before any GitHub OAuth completes. Result: the OAuth callback's "first user gets admin" check fires against a non-empty table and assigns `member` to the first GitHub user.

**Why it happens:** `bootstrapAdmin` runs on every cold start via `ensureDb()`. It predates the GitHub OAuth design.

**How to avoid:** Remove `bootstrapAdmin()` from `client.ts` and remove the `ADMIN_EMAIL` env var. The first-user-is-admin logic in the OAuth callback handles bootstrapping. Any existing admin created via `ADMIN_EMAIL` must be migrated manually or re-logged-in via GitHub OAuth (their row will be upserted by matching email).

**Warning signs:** Admin account exists in DB with `password_hash = NULL` and `github_token = NULL` after migration is applied.

### Pitfall 2: State Cookie SameSite vs. GitHub Cross-Origin Redirect

**What goes wrong:** Setting `SameSite=Strict` on the `oauth_state` cookie. After the GitHub redirect back to `/api/auth/github/callback`, the browser treats this as a cross-site navigation from `github.com`. With `SameSite=Strict`, the cookie is not sent — the state check fails and every OAuth attempt returns 400.

**Why it happens:** GitHub's callback is a top-level navigation redirect, which SameSite=Lax allows but SameSite=Strict blocks.

**How to avoid:** Use `SameSite=Lax` (not Strict) for the `oauth_state` cookie. `Lax` allows the cookie to be sent on top-level cross-site navigations (which is exactly what the OAuth callback is) while still blocking cross-site subresource requests.

### Pitfall 3: GitHub Email Can Be Null

**What goes wrong:** GitHub users can set their email to private. `GET /api/github/user` returns `email: null` for private-email users. Inserting NULL into the `email` column (which has `NOT NULL UNIQUE` constraint) will fail.

**Why it happens:** The `users` table schema has `email TEXT NOT NULL UNIQUE`. GitHub OAuth does not guarantee a non-null public email.

**How to avoid:** Fallback: `email = githubUser.email || `${githubUser.login}@github.invalid``. This is a synthetic sentinel address, not a real email. The email field in the JWT becomes cosmetic for GitHub-OAuth users — it is never used to send mail (Resend is removed).

**Alternative:** Request `user:email` scope in addition to `repo` and call `GET /user/emails` to get the primary verified email. This requires two additional API calls and adding a scope. Simpler to use the `@github.invalid` fallback given Resend is fully removed.

### Pitfall 4: `githubFetch()` Callers in `github-sync.ts` Are Not Updated

**What goes wrong:** `api/_lib/sync/github-sync.ts` has its own local `getGitHubToken()` and `githubFetch()` implementations. If the library-level `githubFetch()` signature changes but the sync file's internal copies are not updated, the cron job breaks (or silently falls back to `GITHUB_TOKEN` env var if it's removed).

**Why it happens:** The sync file was written as a self-contained module. It does not import from `api/_lib/github.ts`.

**How to avoid:** Do NOT change `github-sync.ts` in this phase. It uses its own `resolveConfig('githubToken', 'GITHUB_TOKEN')` — a service-account token model. Leave it running as-is. The per-user OAuth model is for interactive API calls only.

**Warning signs:** Cron sync job returns 401 or produces 0 updates after this phase ships.

### Pitfall 5: `vercel.json` Does Not Need a Rewrite Rule

**What goes wrong:** Adding an unnecessary rewrite rule thinking Vercel needs help routing `/api/auth/github/callback`.

**Why it's not needed:** Vercel's `framework: "vite"` auto-maps filesystem routes. `api/auth/github/callback.ts` is automatically served at `/api/auth/github/callback` — the same pattern used by every existing route. The `vercel.json` headers block (`/api/(.*)`) already covers this route.

**How to avoid:** Do not modify `vercel.json`.

### Pitfall 6: Users Pre-Existing in DB (from bootstrapAdmin or Manual Creation)

**What goes wrong:** The `upsertOAuthUser()` function must handle the case where a user already exists with the same email but no `github_token`. Naive INSERT will fail on the `UNIQUE` email constraint.

**Why it happens:** Admin may have created users via `POST /api/auth/users` before OAuth ships.

**How to avoid:** Use `INSERT OR REPLACE` or `ON CONFLICT(email) DO UPDATE SET github_token=?, github_login=?, name=?, updated_at=datetime('now')`. This correctly upserts both new and pre-existing users. Preserve existing `role` for pre-existing users — don't overwrite admin role with `member`.

Correct upsert SQL:
```sql
INSERT INTO users (id, email, name, github_login, github_token, role)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(email) DO UPDATE SET
  github_login = excluded.github_login,
  github_token = excluded.github_token,
  name = CASE WHEN users.name = '' THEN excluded.name ELSE users.name END,
  updated_at = datetime('now')
```
Note: `role` is NOT in the `DO UPDATE SET` — preserves existing admin role.

---

## DB Migration Details

**Last applied migration:** `011_issue_triage` [VERIFIED: client.ts]
**Next migration number:** `012_github_oauth`

```sql
-- Migration 012_github_oauth
ALTER TABLE users ADD COLUMN github_token TEXT;
ALTER TABLE users ADD COLUMN github_login TEXT;
```

**Notes:**
- SQLite `ALTER TABLE ADD COLUMN` does not support `NOT NULL` without a default. `TEXT` (nullable) is correct — existing users will have NULL until they re-authenticate.
- No index on `github_token` needed — token lookups are by `userId` (primary key).
- `github_login` is stored for display in the user management panel and optional future org checks.
- `bootstrapAdmin()` function in `client.ts` must be removed (see Pitfall 1).
- `password_hash` column from migration `006_users` becomes vestigial — do NOT drop it in this migration (breaking DDL change on existing DBs). Leave it nullable as-is.
- The `otp_codes` table from migration `007_otp_auth` should be dropped in this migration: `DROP TABLE IF EXISTS otp_codes;`

---

## CSRF State Approach Decision

**Chosen approach: `HttpOnly` session cookie with `SameSite=Lax`**

Rationale:
- Vercel serverless functions are stateless — no in-memory state across invocations.
- Using the DB adds a new table and cleanup logic for a 10-minute ephemeral state.
- A single `HttpOnly` cookie is the industry-standard approach for OAuth state in serverless environments.
- No new package required; `Set-Cookie` header is native to Node.js HTTP.
- `SameSite=Lax` is required (not Strict) — see Pitfall 2. [VERIFIED: MDN web docs, OAuth RFC 6749]

**Cookie spec:** `oauth_state=<hex32>; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`

---

## Token Storage Security Decision

**Chosen approach: Plain text in Turso** [ASSUMED — see Assumptions Log A1]

Rationale:
- Turso access requires `TURSO_AUTH_TOKEN` — the DB is not publicly accessible.
- All API routes are behind `authenticateRequest()` — no unauthenticated route can read tokens.
- The token is only returned from DB to resolve a GitHub API call in the same serverless invocation — it is never returned to the client.
- Encryption at rest would require a symmetric key (another secret to manage) and adds latency with no meaningful security improvement given the access model.
- If Turso were compromised, an encrypted `github_token` provides limited additional protection since the attacker would also have the encryption key (likely in env vars).

---

## JWT Structure After OAuth

The existing `createToken(userId, email, role)` function is reused **unchanged**. [VERIFIED: jwt.ts]

| Field | Before (OTP) | After (OAuth) |
|-------|-------------|---------------|
| `userId` | DB UUID | DB UUID (same) |
| `email` | User's email address | GitHub email or `login@github.invalid` |
| `role` | `admin` / `member` / `viewer` | Same values |
| `exp` | 7 days | 7 days (unchanged) |

The `User` interface in `auth-store.ts` gains an optional `githubLogin` field (from `GET /api/auth/me` response), but this does not change the JWT payload.

---

## OTP Infrastructure Removal Checklist

Complete removal of OTP/Resend:

| Item | File | Action |
|------|------|--------|
| `request-otp.ts` route | `api/auth/request-otp.ts` | DELETE file |
| `verify-otp.ts` route | `api/auth/verify-otp.ts` | DELETE file |
| OTP logic | `api/_lib/auth/otp.ts` | DELETE file |
| Resend email client | `api/_lib/auth/email.ts` | DELETE file |
| `otp_codes` table | `api/_lib/db/client.ts` migration 012 | `DROP TABLE IF EXISTS otp_codes` |
| `resend` npm package | `apps/web/package.json` | `npm uninstall resend` |
| `RESEND_API_KEY` env var | Vercel project settings | Remove (out of code scope) |
| `OTP_FROM_EMAIL` env var | Vercel project settings | Remove (out of code scope) |
| `requestOtp` action | `src/client/stores/auth-store.ts` | Remove |
| `verifyOtp` action | `src/client/stores/auth-store.ts` | Remove |
| OTP form JSX | `src/client/components/LoginPage.tsx` | Full replacement |
| OTP i18n keys | `en/auth.json`, `fr/auth.json` | Replace with OAuth keys |
| `githubToken` settings key | `api/settings/index.ts` | Remove from `VALID_KEYS` + `SENSITIVE_KEYS` |
| GitHub token field | `src/client/components/Settings.tsx` | Remove the entire "API Keys" section |
| `githubToken` in store | `src/client/stores/settings-store.ts` | Remove field + action |
| `bootstrapAdmin()` function | `api/_lib/db/client.ts` | Remove function call and function body |
| `ADMIN_EMAIL` env var reference | `api/_lib/db/client.ts` | Remove check |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Email OTP via Resend | GitHub OAuth App | Eliminates email dependency; token never expires unless revoked |
| Shared PAT in settings DB | Per-user OAuth token in users table | Each user's GitHub permissions apply; no shared credential risk |
| `bootstrapAdmin()` env var seeding | First-user-is-admin via OAuth | No ADMIN_EMAIL env var needed in production |
| Stateful OTP codes table | Stateless OAuth cookie (CSRF) | No cleanup required; no table |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plain text token storage is adequate given Turso's auth-token access model | Token Storage Security Decision | If compliance requires encryption at rest, would need AES-256-GCM with key from env vars + ~5 lines per read/write |

---

## Open Questions (RESOLVED)

1. **`github-sync.ts` cron token after OAuth ships**
   - What we know: The cron background sync (`/api/cron/sync`) uses `resolveConfig('githubToken', 'GITHUB_TOKEN')` — a service-account PAT pattern. This is intentionally out of scope for Phase 3.
   - What's unclear: After removing `githubToken` from `VALID_KEYS` in settings, the cron can no longer update the token via the Settings UI. It must rely on the `GITHUB_TOKEN` env var in Vercel project settings.
   - RESOLVED: `GITHUB_TOKEN` env var must be set in Vercel project settings for cron sync to continue working. The admin Settings UI no longer manages it. This is acceptable for UAT — a dedicated service token env var is standard Vercel practice. `github-sync.ts` is explicitly out of scope for Phase 3.

2. **Existing users with `ADMIN_EMAIL`-bootstrapped accounts**
   - What we know: Any deployment that used `ADMIN_EMAIL` has a user row with `password_hash = NULL` and `github_token = NULL`.
   - What's unclear: Should migration 012 or the OAuth callback attempt to match this user by email and upgrade them?
   - RESOLVED: The `upsertOAuthUser()` function's `ON CONFLICT(email) DO UPDATE` naturally handles this — when the admin logs in via GitHub with the same email, their row is updated with `github_token` and `github_login`. No special migration step needed.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Node.js `crypto` | State generation, JWT | Built-in | Already used in `jwt.ts` |
| Node.js `fetch` | OAuth token exchange | Built-in (Node 18+) | Vercel uses Node 18+ runtime; already used across codebase |
| `GITHUB_CLIENT_ID` env var | OAuth initiate | Not set (new) | Must be added to Vercel project before deployment |
| `GITHUB_CLIENT_SECRET` env var | OAuth callback | Not set (new) | Must be added to Vercel project before deployment |
| `OAUTH_CALLBACK_URL` env var | OAuth initiate + callback | Not set (new) | Required in production; defaults to localhost in dev |
| Turso DB | Migration 012 | Available | Already configured via `TURSO_DATABASE_URL` |

**New env vars required before deployment:**
- `GITHUB_CLIENT_ID` — from GitHub OAuth App settings
- `GITHUB_CLIENT_SECRET` — from GitHub OAuth App settings
- `OAUTH_CALLBACK_URL` — e.g., `https://your-app.vercel.app/api/auth/github/callback`

**Env vars to remove after this phase:**
- `RESEND_API_KEY` — Resend removed
- `OTP_FROM_EMAIL` — Resend removed
- `ADMIN_EMAIL` — `bootstrapAdmin()` removed

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.0 |
| Config file | `vitest.config.ts` (inferred from `package.json` `"test": "vitest run"`) |
| Quick run command | `cd apps/web && npm test` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `githubFetch(token, url)` passes token in Authorization header | Unit | `npm test -- --reporter=verbose` (test in `github.test.ts`) | ❌ Wave 0 |
| AUTH-02 | OAuth callback validates state cookie mismatch → 400 | Unit | `npm test` | ❌ Wave 0 |
| AUTH-03 | OAuth callback with missing code → 400 | Unit | `npm test` | ❌ Wave 0 |
| AUTH-04 | First user to complete OAuth gets `role='admin'`; second gets `role='member'` | Unit | `npm test` | ❌ Wave 0 |
| AUTH-05 | Existing user upsert preserves admin role | Unit | `npm test` | ❌ Wave 0 |
| AUTH-06 | `upsertOAuthUser()` uses `ON CONFLICT(email) DO UPDATE`, preserving role | Unit | `npm test` | ❌ Wave 0 |
| AUTH-07 | Route with no `github_token` in DB returns 403 | Unit | `npm test` | ❌ Wave 0 |
| AUTH-08 | Migration 012 adds `github_token` + `github_login` columns | Integration (manual) | DB inspection | — |
| AUTH-09 | LoginPage renders "Sign in with GitHub" button only (no email/OTP form) | Manual visual | — | — |

### Wave 0 Gaps
- [ ] `api/_lib/github.test.ts` — covers AUTH-01 (new `githubFetch()` token parameter)
- [ ] `api/auth/github/callback.test.ts` — covers AUTH-02, AUTH-03, AUTH-04, AUTH-05
- [ ] `api/_lib/db/users.test.ts` — covers AUTH-06 (upsert role preservation)

*(Existing tests: `api/github/repos/[owner]/[repo]/issues.test.ts` and `labels.test.ts` — these must be updated to mock the new `githubFetch(token, url, ...)` signature)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | GitHub OAuth App — token never touches client until JWT issued |
| V3 Session Management | Yes | JWT with 7-day expiry; `HttpOnly` state cookie for OAuth flow |
| V4 Access Control | Yes | `authenticateRequest()` on all routes; `hasRole()` for admin operations |
| V5 Input Validation | Yes | Zod on all body params; `state` param compared with constant-time-equal not needed (random hex compare is fine for non-secret state values) |
| V6 Cryptography | Partial | `GITHUB_CLIENT_SECRET` is env var (never in code); JWT uses HMAC-SHA256 via `crypto`; no hand-rolled crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on OAuth callback | Spoofing | State param cookie (`SameSite=Lax; HttpOnly`) |
| Authorization code interception | Spoofing | HTTPS-only (`Secure` cookie); short-lived code (GitHub codes expire in ~10 minutes) |
| Token leakage via server logs | Information Disclosure | `github_token` is never logged; CLAUDE.md forbids `console.log` in production |
| Open redirect | Spoofing | Callback redirects only to relative `/?token=...` — no user-controlled redirect target |
| Privilege escalation via re-OAuth | Elevation | `ON CONFLICT(email) DO UPDATE` preserves existing `role` — re-OAuth cannot downgrade or upgrade role |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/api/_lib/db/client.ts` — migration system, current schema, `bootstrapAdmin()` [VERIFIED: codebase]
- `apps/web/api/_lib/auth/jwt.ts` — JWT structure, `createToken()` signature [VERIFIED: codebase]
- `apps/web/api/_lib/auth/middleware.ts` — `authenticateRequest()`, `TokenPayload` [VERIFIED: codebase]
- `apps/web/api/_lib/github.ts` — current `githubFetch()` signature [VERIFIED: codebase]
- `apps/web/api/_lib/db/users.ts` — `UserRow` interface, all DB helpers [VERIFIED: codebase]
- `apps/web/package.json` — `resend: ^6.10.0` confirmed installed [VERIFIED: codebase]
- All 9 `api/github/` route files — pattern of calling `githubFetch()` [VERIFIED: codebase]
- `api/_lib/sync/github-sync.ts` — independent `getGitHubToken()` + `githubFetch()` [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- GitHub OAuth App authorization flow [CITED: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps]
- SameSite cookie specification for OAuth [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie]
- LibSQL `ALTER TABLE ADD COLUMN` behavior [ASSUMED: consistent with SQLite documentation]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json; no new packages needed
- Architecture: HIGH — codebase fully read; all integration points identified
- Pitfalls: HIGH — identified from direct code inspection (bootstrapAdmin conflict, email NULL, sync cron isolation)
- Migration: HIGH — migration number (012) and SQL verified against last migration (011)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable domain — GitHub OAuth App protocol does not change frequently)
