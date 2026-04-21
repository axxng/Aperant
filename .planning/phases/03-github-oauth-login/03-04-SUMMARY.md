---
phase: 03-github-oauth-login
plan: 04
subsystem: api/github
tags: [github-oauth, token-isolation, per-user-token, proxy-routes]
dependency_graph:
  requires: [03-02]
  provides: [per-user-github-token-in-all-proxy-routes]
  affects: [apps/web/api/github/repos, apps/web/api/github/projects]
tech_stack:
  added: []
  patterns: [per-user-token-resolution, getUserById-guard, 403-on-missing-token]
key_files:
  created: []
  modified:
    - apps/web/api/github/repos/[owner]/[repo]/issues.ts
    - apps/web/api/github/repos/[owner]/[repo]/labels.ts
    - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts
    - apps/web/api/github/repos/[owner]/[repo]/branches.ts
    - apps/web/api/github/repos/[owner]/[repo]/pulls/index.ts
    - apps/web/api/github/repos/[owner]/[repo]/pulls/[number]/index.ts
    - apps/web/api/github/repos/[owner]/[repo]/pulls/[number]/files.ts
    - apps/web/api/github/projects/[owner]/[number]/index.ts
    - apps/web/api/github/projects/[owner]/[number]/items.ts
decisions:
  - "Used getUserById(user.userId) immediately after authenticateRequest guard — token resolved before any query params are read, ensuring 403 is returned before any parameter validation"
  - "githubFetch and githubGraphQL already had token as first param in their signatures — no library changes needed, only call-site updates"
  - "pulls/index.ts has both GET and POST handlers — dbUser.github_token is resolved once before the switch and reused in both case branches"
  - "callback.test.ts pre-existing failures (6 tests) are out of scope for this plan — not caused by any changes here"
metrics:
  duration: 15m
  completed: "2026-04-21"
  tasks_completed: 2
  files_modified: 9
---

# Phase 03 Plan 04: Migrate GitHub Proxy Routes to Per-User Token Summary

All 9 GitHub proxy route files now resolve the authenticated user's `github_token` from the DB via `getUserById` and pass it as the first argument to `githubFetch()` or `githubGraphQL()` — eliminating any shared PAT dependency and enforcing per-user OAuth token isolation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate 5 repos routes to per-user token | 1cf2e243 | issues.ts, labels.ts, comment.ts, branches.ts, pulls/index.ts |
| 2 | Migrate 4 remaining routes (pulls/[number], projects) | d5beb9dd | pulls/[number]/index.ts, pulls/[number]/files.ts, projects/index.ts, projects/items.ts |

## What Was Built

Each of the 9 GitHub proxy routes now follows this pattern:

1. `authenticateRequest()` validates the JWT and returns `TokenPayload` (with `userId`)
2. `getUserById(user.userId)` fetches the full DB user row
3. If `dbUser.github_token` is null/undefined → returns `403 { error: 'GitHub account not connected' }`
4. `githubFetch(dbUser.github_token, url, options)` or `githubGraphQL(dbUser.github_token, query, variables)` is called with the per-user token

Routes using `githubFetch` (7): issues, labels, comment, branches, pulls/index (GET + POST), pulls/[number]/index, pulls/[number]/files

Routes using `githubGraphQL` (2): projects/[owner]/[number]/index (2 calls), projects/[owner]/[number]/items (2 calls)

## Deviations from Plan

None — plan executed exactly as written.

Minor observation: The plan's import depth guide listed `pulls/index.ts` at depth 4, but the file uses depth 5 (`../../../../../_lib/`). The actual file's existing depth was followed (depth 5 is correct given the directory nesting).

## Test Results

- `issues.test.ts` — 6 tests PASS
- `labels.test.ts` — 4 tests PASS
- `api/_lib/github.test.ts` — 9 tests PASS
- `api/_lib/db/triage.test.ts` — 3 tests PASS
- `api/_lib/db/users.test.ts` — 3 tests PASS
- `api/auth/github/callback.test.ts` — 6 tests FAIL (pre-existing, out of scope for this plan)

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All changes are within existing authenticated proxy routes. Token flows server-to-server only — never returned to client.

T-03-10 (Spoofing): Mitigated — `authenticateRequest()` validates JWT before `getUserById`; token is never user-controlled.
T-03-12 (DoS): Accepted — users without `github_token` receive clear 403 message.

## Self-Check: PASSED

- [x] `grep -rn "dbUser.github_token" apps/web/api/github/` — 12 occurrences across 9 files
- [x] `grep -rn "getUserById" apps/web/api/github/` — 20 occurrences (import + call in each of 9 files, plus 2 extra calls in projects files)
- [x] `grep -rn "getGitHubToken" apps/web/api/github/` — 0 occurrences
- [x] Commits 1cf2e243 and d5beb9dd exist in git log
