# Quick Task 260423-etk: Document Mock Local API Server — Research

**Researched:** 2026-04-23
**Domain:** Local development tooling — mock API server for `apps/web/`
**Confidence:** HIGH (all findings directly read from source files)

---

## Summary

The mock local API server is a complete local dev environment that eliminates the need for Turso credentials, a GitHub OAuth app, or a real GitHub PAT. It is gated behind `MOCK_SERVICES=true` and consists of two parts: an Express dev server (`scripts/dev-server.ts`) that serves all Vercel serverless functions locally, and a mock middleware layer (`scripts/mocks/github-fixtures.ts`) that intercepts GitHub API and OAuth routes with fixture data. The DB is a local SQLite file (`file:dev.db`) provided by `@libsql/client`.

**Primary recommendation:** Add a "Local Development" section to `apps/web/README.md` covering quick-start, all intercepted routes with request/response shapes, and a troubleshooting section. Existing README content (deployment, architecture, features, scripts, testing) must be preserved.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Target file: `apps/web/README.md` (add a "Local Development" section)
- Coverage: quick-start (env setup, seed command, start command) + all mock endpoints with request/response examples + troubleshooting section
- Enumerate every intercepted `/api/*` route with: HTTP method, path, fixture data shape, and notes on behaviour differences vs. real API

### Claude's Discretion
- Exact section headings and formatting style within the README
- Order of sections within the doc (quick-start first, then endpoints, then troubleshooting)
- Whether to include a brief architecture explainer paragraph before the endpoint table

### Deferred Ideas (OUT OF SCOPE)
- None stated
</user_constraints>

---

## Environment Variables

Source: `apps/web/.env.example` and `apps/web/api/_lib/db/client.ts` [VERIFIED: direct file read]

| Variable | Required for mock | Value | Notes |
|----------|-------------------|-------|-------|
| `MOCK_SERVICES` | Yes | `true` | Gates DB switch (Turso → `file:dev.db`) and mock middleware registration. Throws if set with `VERCEL=true`. |
| `VITE_MOCK_SERVICES` | Yes | `true` | Exposes mock flag to Vite frontend so client-side code can branch if needed. Must match `MOCK_SERVICES`. |
| `JWT_SECRET` | Yes | Any long random string | Required for stable JWT tokens across dev-server restarts. Without it tokens re-sign differently on each restart. |
| `TURSO_DATABASE_URL` | No | — | Not needed when `MOCK_SERVICES=true`; DB client switches to `file:dev.db`. |
| `TURSO_AUTH_TOKEN` | No | — | Same — skipped in mock mode. |
| `GITHUB_TOKEN` | No | — | Mock routes serve fixture data; no real GitHub API calls are made. |

**CRITICAL:** `MOCK_SERVICES=true` MUST NOT be set in production (Vercel). The DB client guard throws `Error('MOCK_SERVICES=true must not be set in Vercel deployments')` when `process.env.VERCEL` is also set, but this is a hard requirement regardless. [VERIFIED: `api/_lib/db/client.ts` line 9]

---

## Startup Commands (exact order)

Source: `apps/web/scripts/seed.ts` and `apps/web/scripts/dev-server.ts` [VERIFIED: direct file read]

```bash
# 1. Create .env.local with mock vars (from apps/web/)
echo "MOCK_SERVICES=true" >> .env.local
echo "VITE_MOCK_SERVICES=true" >> .env.local
echo "JWT_SECRET=any-long-random-string" >> .env.local

# 2. Seed local SQLite with fake data
cd apps/web && npx tsx scripts/seed.ts

# 3. In one terminal — start the API dev server (port 3001)
cd apps/web && npx tsx scripts/dev-server.ts

# 4. In another terminal — start the Vite frontend (port 5173)
cd apps/web && npm run dev
```

Vite proxies all `/api` requests to `http://localhost:3001` (configured in `vite.config.ts` server.proxy). [VERIFIED: `apps/web/vite.config.ts` line 14-18]

The seed script refuses to run unless `MOCK_SERVICES=true` is set, protecting against accidental production DB overwrites.

---

## Mock Route Inventory

Source: `apps/web/scripts/mocks/github-fixtures.ts` [VERIFIED: direct file read]

All mock routes are registered BEFORE real Vercel handler routes (first-match wins in Express). Mock middleware registration happens only when `MOCK_SERVICES=true`; it throws if called otherwise.

### Route 1 — OAuth Initiate
```
GET /api/auth/github
```
**Behaviour:** Immediately redirects to `/api/auth/github/callback`. Bypasses GitHub OAuth entirely — no `state` param, no external redirect.
**Difference vs. real API:** Real handler generates an OAuth state and redirects to `https://github.com/login/oauth/authorize`. Mock skips GitHub entirely.

### Route 2 — OAuth Callback
```
GET /api/auth/github/callback
```
**Behaviour:** Upserts a seeded user (`dev-admin@github.invalid`, `githubId: 'mock-12345'`, `role: 'admin'` if first user, else `'member'`) via `upsertOAuthUser()`, issues a real JWT, redirects to `/?token=<jwt>`.
**DB writes:** Yes — upserts to `users` table in `dev.db`.
**Difference vs. real API:** No GitHub token exchange; no `code`/`state` verification; always logs in as `dev-admin`.

### Route 3 — GitHub Issues List
```
GET /api/github/repos/:owner/:repo/issues
```
**Query params supported:** `state` — filters by `'open'`, `'closed'`, or `'all'` (undefined defaults to all).
**Response shape** (matches `PaginatedIssuesResult`):
```json
{
  "issues": [
    {
      "id": 1001,
      "number": 1,
      "title": "Fix null pointer exception in auth flow",
      "body": "Issue body for #1 in owner/repo.",
      "state": "open",
      "labels": [{ "id": 1, "name": "bug", "color": "d73a4a", "description": "Something is broken" }],
      "assignees": [{ "login": "dev-admin", "avatarUrl": "https://github.com/ghost.png" }],
      "author": { "login": "dev-admin", "avatarUrl": "https://github.com/ghost.png" },
      "milestone": null,
      "createdAt": "<iso>",
      "updatedAt": "<iso>",
      "closedAt": null,
      "commentsCount": 0,
      "url": "https://api.github.com/repos/owner/repo/issues/1",
      "htmlUrl": "https://github.com/owner/repo/issues/1",
      "repoFullName": "owner/repo"
    }
  ],
  "hasMore": false
}
```
**Fixture data:** 20 issues per `owner/repo` combination (15 open, 5 closed). Issue IDs are deterministic based on `owner/repo` string hash so the same repo always returns the same set. Labels cycle through a 5-label set; 1–3 labels per issue.
**Difference vs. real API:** No pagination (`hasMore` is always `false`); no rate limiting; response is already camelCase (matches real handler's transformed output, not raw GitHub API).

### Route 4 — GitHub Labels List
```
GET /api/github/repos/:owner/:repo/labels
```
**Response shape** (matches `LabelsResult`):
```json
{
  "labels": [
    { "id": 1, "name": "bug", "color": "d73a4a", "description": "Something is broken" },
    { "id": 2, "name": "enhancement", "color": "0075ca", "description": "New feature request" },
    { "id": 3, "name": "documentation", "color": "0075ca", "description": null },
    { "id": 4, "name": "question", "color": "e4e669", "description": null },
    { "id": 5, "name": "good first issue", "color": "7057ff", "description": null }
  ]
}
```
**Fixture data:** Same 5 labels for every repo.
**Difference vs. real API:** Labels are identical regardless of `owner`/`repo`.

### Route 5 — Batch Triage Fetch
```
GET /api/triage/:owner/:repo?numbers=1,2,3
```
**Query params:** `numbers` — comma-separated issue numbers.
**Behaviour:** Reads from `dev.db` via `getTriageRecordsBatch()`. Returns whatever was seeded or persisted by previous mock POST calls.
**Response shape:**
```json
{ "records": [ /* triage records from dev.db */ ] }
```
**Difference vs. real API:** Functionally identical — reads from the same `issue_triage` table, just via local SQLite instead of Turso.

### Route 6 — Post Comment (Triage)
```
POST /api/github/repos/:owner/:repo/issues/:number/comment
```
**Request body:** `{ "body": "<comment text>" }`
**Behaviour:** Persists `githubCommentId` (timestamp-based) and `commentStatus: 'posted'` to `dev.db` via `upsertTriageRecord()`. Returns a comment object.
**Response shape:**
```json
{
  "id": 1714000000000,
  "html_url": "https://github.com/owner/repo/issues/1#issuecomment-1714000000000",
  "body": "<comment text>"
}
```
**Difference vs. real API:** No real GitHub API call; comment ID is `Date.now()` (millisecond timestamp); `html_url` is synthetic.

---

## Seed Data

Source: `apps/web/scripts/seed.ts` [VERIFIED: direct file read]

The seed script is idempotent — it deletes all existing rows before inserting. Running it again resets `dev.db` to a clean state.

**Seeded data:**
- 1 admin user: `dev-admin@github.invalid` / `Dev Admin` / `role: 'admin'` / `github_login: 'dev-admin'`
- 3 products (org: `mock-org`, repos: `project-alpha`, `project-beta`, `project-gamma`)
- 8 tasks per product (one per Kanban status: `backlog`, `queue`, `in_progress`, `ai_review`, `human_review`, `done`, `pr_created`, `error`)
- 3 `issue_triage` records per product: issue #1 triaged with `priority: 'high'`; issues #2 and #3 untriaged

---

## Dev Server Architecture

Source: `apps/web/scripts/dev-server.ts` [VERIFIED: direct file read]

- Loads `.env.local` via `dotenv` on startup (must be in `apps/web/` directory)
- Registers mock routes FIRST before scanning real handlers — Express first-match-wins ensures mock routes shadow any real handler for the same path
- Recursively scans `api/` for `.ts` handler files (excludes `.test.ts`)
- Converts Vercel `[param]` path segments to Express `:param` syntax
- Sorts routes: static paths before dynamic `[param]` paths to prevent `:id` matching `/by-github-issue`
- Proxies `req.params` + `req.query` into the `query` property (Vercel API pattern)
- Parses cookies from `Cookie` header (Vercel adds `req.cookies`)
- Listens on `process.env.API_PORT ?? 3001`

---

## Common Pitfalls

### Pitfall 1: `.env.local` not in `apps/web/`
**What goes wrong:** `MOCK_SERVICES` is not picked up; server connects to Turso and fails with missing `TURSO_DATABASE_URL`.
**How to avoid:** Always run seed and dev-server from `apps/web/` directory; `.env.local` must be at `apps/web/.env.local`.

### Pitfall 2: Seed not run after DB change
**What goes wrong:** Missing tables cause SQL errors; `dev.db` doesn't exist yet.
**How to avoid:** Run `npx tsx scripts/seed.ts` before starting the dev server. Re-run it after destructive schema changes.

### Pitfall 3: `JWT_SECRET` not set
**What goes wrong:** Tokens issued by one dev-server restart are invalid after restart (different signing secret derived from random entropy).
**How to avoid:** Set `JWT_SECRET` to any fixed string in `.env.local`.

### Pitfall 4: Both terminals needed
**What goes wrong:** Starting only Vite (`npm run dev`) results in 404s for `/api/*` — Vite proxies to port 3001 which isn't listening.
**How to avoid:** Start both `npx tsx scripts/dev-server.ts` AND `npm run dev` in separate terminals.

### Pitfall 5: `MOCK_SERVICES=true` in production
**What goes wrong:** DB client throws `Error('MOCK_SERVICES=true must not be set in Vercel deployments')` when `VERCEL` env is also set. GitHub OAuth is completely bypassed.
**How to avoid:** `MOCK_SERVICES` and `VITE_MOCK_SERVICES` must only appear in `.env.local` (gitignored), never in Vercel environment variable settings.

---

## Existing README Content to Preserve

`apps/web/README.md` currently contains: [VERIFIED: direct file read]
- Product overview paragraph
- Deployment section (Turso setup, Vercel connect, env vars table, first login)
- Architecture diagram and tech stack
- Features section (task management, GitHub sync, settings/auth, real-time)
- Project structure tree
- Scripts table
- Testing section (manual checklist + automated commands)
- API Quick Reference (curl examples)

The new "Local Development" section should be inserted after "Architecture" and before "Features", or after "Scripts" — either placement keeps the production deployment content first (as documented in CONTEXT.md: quick-start first ordering applies within the new section, not the whole README).

---

## Sources

- `apps/web/scripts/mocks/github-fixtures.ts` — mock route implementations [VERIFIED]
- `apps/web/scripts/dev-server.ts` — dev server entrypoint [VERIFIED]
- `apps/web/api/_lib/db/client.ts` — DB client mock gate [VERIFIED]
- `apps/web/scripts/seed.ts` — seed script [VERIFIED]
- `apps/web/.env.example` — env var documentation [VERIFIED]
- `apps/web/README.md` — existing README content [VERIFIED]
- `apps/web/vite.config.ts` — Vite proxy config [VERIFIED]
- `CLAUDE.md` Section 5 "Mocked Services for Dev Env" — canonical pattern reference [VERIFIED]

## Metadata

**Confidence breakdown:**
- Route inventory: HIGH — read directly from source
- Env vars: HIGH — read directly from `.env.example` and `client.ts`
- Startup commands: HIGH — read directly from script files
- Existing README content: HIGH — read directly from file

**Research date:** 2026-04-23
**Valid until:** Until `scripts/mocks/github-fixtures.ts` or `scripts/dev-server.ts` change
