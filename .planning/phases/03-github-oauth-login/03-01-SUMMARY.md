---
phase: 03-github-oauth-login
plan: "01"
subsystem: testing
tags: [tdd, wave-0, nyquist, github-oauth, auth]
dependency_graph:
  requires: []
  provides:
    - "Wave 0 test stubs for githubFetch(token, url) new signature (AUTH-01)"
    - "OAuth callback handler test stubs (AUTH-02, AUTH-03, AUTH-04, AUTH-05)"
    - "upsertOAuthUser test stubs with ON CONFLICT role preservation (AUTH-06)"
  affects:
    - "apps/web/api/_lib/github.test.ts"
    - "apps/web/api/auth/github/callback.test.ts"
    - "apps/web/api/_lib/db/users.test.ts"
    - "apps/web/api/github/repos/[owner]/[repo]/issues.test.ts"
    - "apps/web/api/github/repos/[owner]/[repo]/labels.test.ts"
tech_stack:
  added: []
  patterns:
    - "Dynamic import with .catch() fallback for stubs pointing at not-yet-created files"
    - "vi.mock for db/users.js with getUserById returning user with github_token"
    - "TokenPayload shape { userId } instead of { id } in authenticateRequest mock"
key_files:
  created:
    - apps/web/api/_lib/github.test.ts
    - apps/web/api/auth/github/callback.test.ts
    - apps/web/api/_lib/db/users.test.ts
  modified:
    - apps/web/api/github/repos/[owner]/[repo]/issues.test.ts
    - apps/web/api/github/repos/[owner]/[repo]/labels.test.ts
decisions:
  - "Replaced old github.test.ts (7 tests for old signature) with new tests for githubFetch(token, url) — the old tests covered the same rate-limit logic but wrong API surface"
  - "authenticateRequest mock updated to return { userId } not { id } to match actual TokenPayload type"
metrics:
  duration: "4 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 3
  files_changed: 5
---

# Phase 3 Plan 01: Wave 0 Test Stubs for GitHub OAuth Login Summary

Wave 0 Nyquist stubs for GitHub OAuth login — 5 test files (3 new, 2 updated) covering githubFetch(token, url) signature, OAuth callback state/role logic, and upsertOAuthUser ON CONFLICT SQL.

## What Was Built

Three new test files and two updated test files establish the RED state before Plan 02 implements production code:

1. **github.test.ts** (replaced) — 6 tests for the new `githubFetch(token, url)` signature:
   - Authorization: Bearer header injection
   - X-GitHub-Api-Version header
   - Accept header
   - GitHubRateLimitError on 429 with retry-after
   - GitHubRateLimitError on 403 with x-ratelimit-remaining=0
   - 200 response passthrough

2. **callback.test.ts** (new) — 6 tests for OAuth callback handler:
   - AUTH-02: state mismatch returns 400
   - AUTH-02: missing oauth_state cookie returns 400
   - AUTH-03: missing code param returns 400
   - AUTH-04: first user (userCount=0) gets role=admin
   - AUTH-04: second user (userCount=1) gets role=member
   - AUTH-05: successful OAuth redirects to `/?token=`

3. **users.test.ts** (new) — 3 tests for upsertOAuthUser:
   - AUTH-06: SQL includes ON CONFLICT(email) DO UPDATE SET
   - AUTH-06: SQL does NOT include role in the UPDATE SET clause
   - AUTH-06: sets github_token and github_login for new user
   - userCount returns count from SELECT COUNT(*)

4. **issues.test.ts** (updated) — config-resolver mock removed; getUserById mock added with github_token; authenticateRequest mock updated to return `{ userId }` shape

5. **labels.test.ts** (updated) — same pattern as issues.test.ts update

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

One notable observation: `apps/web/api/_lib/github.test.ts` already existed from a prior phase (Phase 1/2) with OLD test content testing `githubFetch(url)`. The plan specified creating it as a NEW file. The existing file was replaced with the new test structure per plan instructions.

## Known Stubs

All test files in this plan are intentional stubs in RED state:

| Stub | File | Reason |
|------|------|--------|
| githubFetch(token, url) tests | github.test.ts | Current githubFetch takes (url) not (token, url) — will pass after Plan 02 |
| callback.test.ts tests | callback.test.ts | callback.ts does not yet exist — dynamic import fallback returns 501 |
| upsertOAuthUser tests | users.test.ts | upsertOAuthUser not yet in users.ts — will pass after Plan 02 |
| issues.test.ts tests | issues.test.ts | Route not yet updated to use getUserById — will pass after Plan 02 |
| labels.test.ts tests | labels.test.ts | Route not yet updated to use getUserById — will pass after Plan 02 |

These stubs are intentional Nyquist compliance — they exist to give continuous test feedback once Plan 02 production code lands.

## Threat Flags

None — test files only; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- FOUND: apps/web/api/_lib/github.test.ts
- FOUND: apps/web/api/auth/github/callback.test.ts
- FOUND: apps/web/api/_lib/db/users.test.ts
- FOUND (modified): apps/web/api/github/repos/[owner]/[repo]/issues.test.ts
- FOUND (modified): apps/web/api/github/repos/[owner]/[repo]/labels.test.ts
- Commit 17f4cba6: test(03-01): add github.test.ts stubs for new githubFetch(token, url) signature (AUTH-01)
- Commit 22bcc1bc: test(03-01): add callback.test.ts and users.test.ts stubs (AUTH-02 through AUTH-06)
- Commit 0b5d59dc: test(03-01): update issues.test.ts and labels.test.ts for new githubFetch signature
