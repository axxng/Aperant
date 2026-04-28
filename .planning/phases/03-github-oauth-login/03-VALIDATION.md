---
phase: 3
slug: github-oauth-login
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.0 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npm test` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm test`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01 | DB migration | 1 | AUTH-08 | — | N/A | manual | DB inspection | — | ⬜ pending |
| 3-02 | githubFetch() signature | 1 | AUTH-01 | token-leakage | Authorization header set from token param | unit | `npm test` | ❌ Wave 0 | ⬜ pending |
| 3-03 | OAuth initiate route | 1 | — | CSRF | State cookie set HttpOnly SameSite=Lax | manual | N/A | — | ⬜ pending |
| 3-04 | OAuth callback — state mismatch | 1 | AUTH-02 | CSRF | Returns 400 on state mismatch | unit | `npm test` | ❌ Wave 0 | ⬜ pending |
| 3-05 | OAuth callback — missing code | 1 | AUTH-03 | — | Returns 400 on missing code | unit | `npm test` | ❌ Wave 0 | ⬜ pending |
| 3-06 | First-user-is-admin | 1 | AUTH-04 | privilege-escalation | First user gets admin; second gets member | unit | `npm test` | ❌ Wave 0 | ⬜ pending |
| 3-07 | Upsert preserves admin role | 1 | AUTH-05/06 | privilege-escalation | ON CONFLICT preserves existing role | unit | `npm test` | ❌ Wave 0 | ⬜ pending |
| 3-08 | Route 403 on no token | 2 | AUTH-07 | — | Returns 403 if user has no github_token | unit | `npm test` | ❌ Wave 0 | ⬜ pending |
| 3-09 | LoginPage replacement | 2 | AUTH-09 | — | Only "Sign in with GitHub" button visible | manual | N/A | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/api/_lib/github.test.ts` — stubs for AUTH-01 (new `githubFetch(token, url, options)` signature; existing tests for issues/labels routes updated to mock new signature)
- [ ] `apps/web/api/auth/github/callback.test.ts` — stubs for AUTH-02, AUTH-03, AUTH-04, AUTH-05 (state mismatch, missing code, first-user-admin, role preservation)
- [ ] `apps/web/api/_lib/db/users.test.ts` — stubs for AUTH-06 (upsertOAuthUser role preservation via `ON CONFLICT DO UPDATE`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 012 adds `github_token` + `github_login` columns to `users` table | AUTH-08 | DB schema changes require live DB inspection | After `npm run dev`, connect to Turso and run `.schema users` or inspect migration log |
| LoginPage renders only "Sign in with GitHub" button — no email field, no OTP form | AUTH-09 | Visual component rendering | Open app in browser, navigate to login page, confirm no email/OTP elements present |
| OAuth redirect initiates GitHub authorization flow with correct `scope=repo` | — | Cross-origin browser redirect, not unit-testable | Click "Sign in with GitHub", confirm GitHub prompts for `repo` scope |
| State cookie cleared after successful OAuth callback | — | Cookie lifecycle inspection | In DevTools, confirm `oauth_state` cookie is absent after callback completes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 03-01 creates github.test.ts, callback.test.ts, users.test.ts)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-21
