# Phase 7: GitHub OAuth Login - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase replaces the existing email OTP login and admin-set GitHub PAT with GitHub OAuth as the sole authentication mechanism. After this phase:
- Users log in via GitHub OAuth (no email form, no OTP)
- Each user's GitHub OAuth token is stored per-user in the DB and used for all GitHub API calls
- The shared `githubToken` settings key is deprecated
- Email OTP, Resend dependency, and all OTP-related code are removed
- First GitHub user to complete OAuth becomes admin; subsequent users become members (admin promotes others manually)

**Roadmap reorder:** Phase 7 moves to immediately after Phase 2 (Single-Repo Issues Browser), becoming the new Phase 3. Cross-Repo Unified View shifts to Phase 4; Triage, Notes, and Promote shift forward by one accordingly.

No new features beyond auth replacement. Existing product/repo configuration by admin remains unchanged.

</domain>

<decisions>
## Implementation Decisions

### Auth Model
- **D-01:** GitHub OAuth is the **only** login method. Email OTP is removed entirely — no fallback, no dual login.
- **D-02:** Standard **GitHub OAuth App** (not GitHub App). Registered at github.com/settings/developers. Requires `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` env vars. Token does not expire unless revoked.
- **D-03:** OAuth scopes requested: **`repo`** (full private repo access — issues, PRs, labels, comments, write-back). Single scope, covers all current and planned GitHub API usage.

### Token Ownership
- **D-04:** **Per-user GitHub OAuth tokens.** Each user's token is stored individually. GitHub API calls use the requesting user's token — not a shared team token.
- **D-05:** Token stored in the **existing `users` table** via a new migration: add `github_token TEXT` and `github_login TEXT` columns. No new table.

### Role Assignment
- **D-06:** **First GitHub user** to complete OAuth becomes admin. All subsequent users become `member` by default.
- **D-07:** Admin can manually promote members to admin via the existing user management panel. No automatic role escalation based on GitHub org membership.

### Login UI
- **D-08:** `LoginPage` component is replaced with a single **"Sign in with GitHub" button**. No email field, no OTP form. Clicking initiates the GitHub OAuth redirect flow.
- **D-09:** OAuth callback is handled by a new server route (`/api/auth/github/callback`) that exchanges the code for a token, upserts the user record, and issues the existing JWT session.

### Repo Access Model
- **D-10:** Admin still **configures products pointing to specific repos** (no change). Each user's OAuth token is used when that user makes GitHub API calls. If a user's token lacks access to a configured repo, they receive a 403 for that repo (same partial-failure handling as CROSS-03).
- **D-11:** The existing `githubToken` settings key is deprecated and removed from `VALID_KEYS` in `api/settings/index.ts`. The `getGitHubToken()` function in `api/_lib/github.ts` is replaced with a per-request user-token resolver.

### GitHub Token Resolution
- **D-12:** `githubFetch()` must accept the user's OAuth token as a parameter (passed from the route handler after extracting it from the authenticated session). The global `resolveConfig('githubToken', 'GITHUB_TOKEN')` pattern is retired.
- **D-13:** All existing API routes that call `githubFetch()` must pass the user's token from the request context. This is the primary migration work for this phase.

### Removed Dependencies
- **D-14:** Remove Resend (email provider), OTP-related DB columns/tables, and any OTP API routes (`/api/auth/otp/*` or equivalent).

### Claude's Discretion
- Exact OAuth state parameter approach (CSRF protection) — Claude implements a standard server-side state check
- Whether to store `github_token` encrypted at rest or plain (given Turso/LibSQL is already access-controlled) — Claude decides based on existing DB security posture
- How to handle the session JWT after GitHub OAuth: reuse existing JWT structure with `userId`, `email` (set to GitHub email), `role`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing auth layer
- `apps/web/api/_lib/auth/middleware.ts` — `authenticateRequest()`, `hasRole()` — these continue to work; JWT structure unchanged
- `apps/web/api/_lib/auth/jwt.ts` — JWT sign/verify — reuse as-is
- `apps/web/src/client/components/LoginPage.tsx` — replaced with GitHub OAuth button
- `apps/web/src/client/stores/auth-store.ts` — session management; needs `githubLogin` field added

### GitHub API layer
- `apps/web/api/_lib/github.ts` — `githubFetch()`, `getGitHubToken()` — `getGitHubToken()` is retired; `githubFetch()` is updated to accept per-user token
- `apps/web/api/_lib/config-resolver.ts` — `resolveConfig('githubToken', ...)` call is removed

### Settings
- `apps/web/api/settings/index.ts` — remove `githubToken` from `VALID_KEYS` and `SENSITIVE_KEYS`
- `apps/web/src/client/components/Settings.tsx` — remove GitHub token input field

### DB
- `apps/web/api/_lib/db/client.ts` — migration system; new migration adds `github_token`, `github_login` to `users` table
- `apps/web/api/_lib/db/users.ts` — user helpers; add `github_token` and `github_login` to user upsert

### Requirements
- `.planning/REQUIREMENTS.md` — no current CROSS/TRIAGE/etc. requirements cover Phase 7; requirements for this phase are TBD and should be written during planning

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- JWT infrastructure (`api/_lib/auth/jwt.ts`) — reuse sign/verify unchanged
- `authenticateRequest()` — unchanged; continues to validate JWT
- `hasRole()` — unchanged
- User management panel — already exists; `admin manually promotes` (D-07) uses this as-is

### Established Patterns
- DB migration: `MIGRATIONS` array in `client.ts` — append migration to add `github_token` and `github_login` to `users` table
- Route structure: `(req, res)` handlers with `ensureDb()` + `authenticateRequest()` — new OAuth callback route follows this pattern
- Error responses: `res.status(N).json({ error: '...' })` — consistent throughout

### Integration Points
- `App.tsx`: `LoginPage` import replaced; OAuth callback redirect handled server-side
- All routes calling `githubFetch()`: must be updated to pass user token from session (primary migration effort)
- `product-store.ts`, `task-store.ts`: no changes — they don't call GitHub directly
- `vercel.json`: may need a rewrite rule for `/api/auth/github/callback`

### Scope of change (estimated high-impact files)
- `api/_lib/github.ts` — signature change to `githubFetch()`
- All GitHub proxy routes under `api/github/` — pass user token
- `api/auth/*` — remove OTP routes, add OAuth initiate + callback routes
- `api/_lib/db/client.ts` — new migration
- `src/client/components/LoginPage.tsx` — full replacement
- `api/settings/index.ts` — remove `githubToken`

</code_context>

<specifics>
## Specific Ideas

- OAuth initiate route: `GET /api/auth/github` — generates state param, stores in session cookie, redirects to `https://github.com/login/oauth/authorize?client_id=...&scope=repo&state=...`
- OAuth callback route: `GET /api/auth/github/callback` — validates state, exchanges `code` for token via `POST https://github.com/login/oauth/access_token`, fetches user info from `GET https://api.github.com/user`, upserts user record, issues JWT, redirects to `/`
- First-user-is-admin detection: `SELECT COUNT(*) FROM users` — if 0, the first OAuth user gets `role='admin'`; otherwise `role='member'`
- `github_login` column: store GitHub username (login) for display in user management panel and potential future org-membership checks

</specifics>

<deferred>
## Deferred Ideas

- GitHub App installation tokens (short-lived, more granular) — deferred; OAuth App tokens are sufficient for current scope
- Org membership-based role assignment — deferred; first-user-is-admin is sufficient for UAT team size
- Multiple OAuth providers (GitLab, Google) — deferred; GitHub-only for this milestone
- Token refresh / revocation webhooks — GitHub OAuth App tokens don't expire, so no refresh logic needed now

</deferred>

---

*Phase: 07-github-oauth-login*
*Context gathered: 2026-04-21*
