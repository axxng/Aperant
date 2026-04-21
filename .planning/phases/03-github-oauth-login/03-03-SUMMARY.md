---
phase: 03-github-oauth-login
plan: "03"
subsystem: api-auth
tags: [oauth, github, jwt, csrf, serverless]
dependency_graph:
  requires: [03-02]
  provides: [oauth-routes, callback-handler, settings-cleanup]
  affects: [apps/web/api/auth/, apps/web/api/settings/]
tech_stack:
  added: []
  patterns: [oauth-state-cookie, first-user-admin, null-email-fallback, upsert-preserve-role]
key_files:
  created:
    - apps/web/api/auth/github.ts
    - apps/web/api/auth/github/callback.ts
  modified:
    - apps/web/api/auth/me.ts
    - apps/web/api/settings/index.ts
decisions:
  - "SameSite=Lax used (not Strict) on oauth_state cookie — Strict blocks GitHub cross-origin redirect back to callback"
  - "Null GitHub email handled with @github.invalid synthetic address to satisfy NOT NULL constraint"
  - "upsertOAuthUser preserves existing role on conflict — re-OAuth cannot change admin to member"
metrics:
  duration: "15 minutes"
  completed: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 03 Plan 03: GitHub OAuth Server Routes Summary

GitHub OAuth flow implemented: state cookie CSRF protection, token exchange, first-admin role assignment, and JWT issuance via two new Vercel serverless routes.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | OAuth initiate route (github.ts) + settings githubToken removal | 4f57e895 |
| 2 | OAuth callback route (callback.ts) + me.ts githubLogin field | d0484748 |

## What Was Built

**`apps/web/api/auth/github.ts`** — GET /api/auth/github
- Generates 32-byte hex CSRF state via `crypto.randomBytes(16)`
- Sets `oauth_state` cookie: `HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
- Redirects 302 to `https://github.com/login/oauth/authorize` with `scope=repo`
- Returns 500 if `GITHUB_CLIENT_ID` not configured

**`apps/web/api/auth/github/callback.ts`** — GET /api/auth/github/callback
- Validates `oauth_state` cookie matches `?state=` query param (returns 400 on mismatch)
- Returns 400 if `?code=` is missing
- Exchanges code for access token via POST to GitHub
- Fetches GitHub user info (`/user`)
- First user (`userCount() === 0`) gets `role=admin`; subsequent users get `role=member`
- Null email fallback: `login@github.invalid` for private-email GitHub users
- Calls `upsertOAuthUser()` (role NOT overwritten on conflict per Pitfall 6)
- Issues JWT via `createToken(user.id, user.email, user.role)`
- Clears `oauth_state` cookie and redirects 302 to `/?token=<jwt>`

**`apps/web/api/auth/me.ts`** — Updated response
- Added `githubLogin: dbUser.github_login ?? null` to JSON response

**`apps/web/api/settings/index.ts`** — Cleanup
- Removed `'githubToken'` from `VALID_KEYS` array
- Updated `SENSITIVE_KEYS` from `['anthropicApiKey', 'githubToken', 'gitlabToken']` to `['anthropicApiKey', 'gitlabToken']`

## Test Results

- AUTH-02: state mismatch returns 400 — PASS
- AUTH-02: missing cookie returns 400 — PASS
- AUTH-03: missing code returns 400 — PASS
- AUTH-04: first user gets admin, second gets member — PASS
- AUTH-05: redirects to `/?token=` — PASS

Pre-existing failures in `issues.test.ts` (assignee param test) are out of scope for this plan.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the patterns specified in 03-PATTERNS.md and 03-RESEARCH.md.

## Threat Mitigations Implemented

| Threat ID | Mitigation |
|-----------|-----------|
| T-03-05 | CSRF: `cookieState !== queryState` returns 400; `HttpOnly; SameSite=Lax` cookie |
| T-03-06 | `Secure` cookie attribute; HTTPS-only in production |
| T-03-07 | `tokenData.access_token` never logged (CLAUDE.md: no console.log in production) |
| T-03-08 | Redirect target hardcoded as `/?token=${jwt}` — no user-controlled redirect |
| T-03-09 | `upsertOAuthUser` SQL excludes `role` from `DO UPDATE SET` |

## Self-Check: PASSED

- `apps/web/api/auth/github.ts` — EXISTS
- `apps/web/api/auth/github/callback.ts` — EXISTS
- `apps/web/api/auth/me.ts` — modified (githubLogin field added)
- `apps/web/api/settings/index.ts` — modified (githubToken removed)
- Commit 4f57e895 — EXISTS
- Commit d0484748 — EXISTS
