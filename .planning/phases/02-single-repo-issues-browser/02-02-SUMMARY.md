---
phase: 02-single-repo-issues-browser
plan: "02"
subsystem: api
tags: [vercel-serverless, github-api-proxy, authentication, rate-limiting, zod-validation]

# Dependency graph
requires:
  - "02-01 (labels.test.ts RED stub)"
provides:
  - "GET /api/github/repos/:owner/:repo/labels — authenticated, validated, rate-limit-aware"
  - "labels.test.ts GREEN (all 4 tests passing)"
affects:
  - "02-03 (IssuesFilterBar label dropdown — backend now available)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GitHub proxy API route pattern: ensureDb → method guard → authenticateRequest → zod validate → githubFetch → map response"
    - "Rate-limit mock pattern: mockResolvedValueOnce(429 response with retry-after header) — githubFetch converts HTTP 429 to GitHubRateLimitError via instanceof check"
    - "mockFetchResponse headers parameter: headers map with get(key) lowercased lookup enables rate-limit header simulation in tests"

key-files:
  created:
    - "apps/web/api/github/repos/[owner]/[repo]/labels.ts"
  modified:
    - "apps/web/api/github/repos/[owner]/[repo]/labels.test.ts"

key-decisions:
  - "githubOwnerRepoSchema (not githubIssueQuerySchema) — path params only, no query filter params for labels endpoint"
  - "per_page=100 single-page fetch — repos with >100 labels silently truncate (documented Assumption A2 in RESEARCH.md)"
  - "encodeURIComponent on both owner and repo — path traversal prevention (T-02-02-01)"
  - "description: l.description ?? null — explicit null coercion; GitHub returns null for no-description labels"

# Metrics
duration: 2min
completed: 2026-04-21
---

# Phase 02 Plan 02: Labels API Route Summary

**GitHub labels proxy endpoint created — authenticated, path-validated, rate-limit-aware, all 4 Nyquist tests GREEN**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-21T11:28:13Z
- **Completed:** 2026-04-21T11:30:07Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2

## Accomplishments

- Created `apps/web/api/github/repos/[owner]/[repo]/labels.ts` following the exact structural analog of `issues.ts`
- Route enforces auth (401 without session via `authenticateRequest`), validates path params (400 on invalid owner/repo via `githubOwnerRepoSchema`), rejects non-GET (405), surfaces rate limits (429 with `retryAfter`)
- Fixed `labels.test.ts` rate-limit test mock to use `mockResolvedValueOnce` with a real 429 HTTP response (with `retry-after` header) so `githubFetch` converts it to `GitHubRateLimitError` via prototype chain `instanceof` check
- Updated `mockFetchResponse` helper to accept optional headers map for rate-limit header simulation
- All 4 labels tests + 21 total tests (including issues.test.ts) pass GREEN

## Task Commits

1. **Task 1: Create labels.ts API route (TDD GREEN + test fix)** — `c2651b60` (feat)

## Files Created/Modified

- `apps/web/api/github/repos/[owner]/[repo]/labels.ts` — New GitHub labels proxy API route (53 lines)
- `apps/web/api/github/repos/[owner]/[repo]/labels.test.ts` — Fixed rate-limit mock approach and added headers support to mockFetchResponse

## Decisions Made

- `githubOwnerRepoSchema` over `githubIssueQuerySchema` — labels endpoint only needs path params validated; no query filter params needed
- `per_page=100` hardcoded — single-page fetch per Pattern 5 in RESEARCH.md; repos with >100 labels truncate silently (Assumption A2)
- `encodeURIComponent` on both `owner` and `repo` — prevents path traversal injection (T-02-02-01 mitigated)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed rate-limit test mock in labels.test.ts**
- **Found during:** Task 1 (Create labels.ts — TDD GREEN phase)
- **Issue:** The test stub created in 02-01 used `vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(Object.assign(new Error('rate limited'), { retryAfter: 60, constructor: { name: 'GitHubRateLimitError' } }))`. This makes `fetch` reject with a plain Error object that has `retryAfter` property but is NOT an instance of `GitHubRateLimitError`. The handler's `error instanceof GitHubRateLimitError` check uses prototype chain — plain Error objects fail this check and fall to the 500 handler. Same root cause as the issues.test.ts fix in 02-01.
- **Fix:** Changed mock to `vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '60' }))` — returns a real 429 HTTP response. `githubFetch` detects status 429 and calls `new GitHubRateLimitError(retryAfter)`, which passes `instanceof GitHubRateLimitError`. Also updated `mockFetchResponse` to accept optional `headers: Record<string, string>` parameter with case-insensitive `get()` implementation.
- **Files modified:** `apps/web/api/github/repos/[owner]/[repo]/labels.test.ts`
- **Commit:** `c2651b60`

## Known Stubs

None — labels endpoint is fully wired. Returns real GitHub API data proxied through authenticated server-side call.

## Threat Flags

None — this plan implements the mitigations specified in the plan's threat model:
- T-02-02-01 (path traversal): mitigated via `githubOwnerRepoSchema` regex + `encodeURIComponent`
- T-02-02-02 (unauthenticated access): mitigated via `authenticateRequest()` early return
- T-02-02-03 (DoS unbounded fetch): accepted — `per_page=100` cap applied
- T-02-02-04 (XSS via label name): accepted — JSON data only, no server-side HTML injection

## Self-Check

- [x] `apps/web/api/github/repos/[owner]/[repo]/labels.ts` exists
- [x] Commit `c2651b60` exists in git log
- [x] All 21 tests pass GREEN

---
*Phase: 02-single-repo-issues-browser*
*Completed: 2026-04-21*
