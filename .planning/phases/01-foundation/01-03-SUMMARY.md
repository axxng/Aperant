---
phase: 01-foundation
plan: "03"
subsystem: api
tags: [vercel, triage, rate-limit, validation, zod, github-api]

# Dependency graph
requires:
  - phase: 01-foundation
    plan: "01"
    provides: [GitHubRateLimitError, githubFetch-rate-limit-detection]
  - phase: 01-foundation
    plan: "02"
    provides: [getTriageRecord, upsertTriageRecord, TriageRecord, issue_triage-migration]
provides:
  - "GET /api/triage/:owner/:repo/:number — returns 200 with default empty state or existing record"
  - "PUT /api/triage/:owner/:repo/:number — upserts triage state, returns 400 on invalid priority"
  - "githubIssueQuerySchema with optional labels and assignee fields"
  - "issues route passes labels/assignee to GitHub API and catches GitHubRateLimitError with 429"
affects: [phase-03, phase-04, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Triage route pattern: ensureDb() → authenticateRequest() → path validation → switch(req.method)"
    - "D-04 default-empty-state: GET returns 200 with {isTriaged:false,priority:null,...} when no DB record (never 404)"
    - "D-05 upsert semantics: PUT always upserts via upsertTriageRecord(); no separate create/update paths"
    - "Conditional URLSearchParams: if (param) params.set(key, param) for optional filter passthrough"
    - "Rate-limit catch-first: instanceof GitHubRateLimitError checked before 500 fallback in catch block"

key-files:
  created:
    - apps/web/api/triage/[owner]/[repo]/[number].ts
  modified:
    - apps/web/api/_lib/validation.ts
    - apps/web/api/github/repos/[owner]/[repo]/issues.ts

key-decisions:
  - "GET triage returns 200 with default empty object (not 404) when no record exists — frontend can render default state without error handling (D-04)"
  - "PUT body allows nullable priority so clients can unset a previously-set priority value"
  - "labels/assignee are optional strings passed verbatim to GitHub API via URLSearchParams.set() — URL-encoding handled automatically, worst case GitHub returns 422 (T-03-05 accepted)"
  - "GitHubRateLimitError catch placed before 500 fallback to ensure 429 is never swallowed as 500"

patterns-established:
  - "Triage route auth pattern: authenticateRequest() at top of handler, return early on null (D-06)"
  - "Path schema extension: githubOwnerRepoSchema.extend({number: z.string().regex(...)}) for typed route params"

requirements-completed:
  - INFRA-01
  - INFRA-02

# Metrics
duration: 8min
completed: 2026-04-21
---

# Phase 1 Plan 03: Triage Route + Issues Filter Extension Summary

**GET+PUT triage API route with Zod path/body validation and auth guard wired to Plan 02 DB helpers; issues proxy extended with optional labels/assignee filter passthrough and GitHubRateLimitError 429 handling**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-21T06:28:00Z
- **Completed:** 2026-04-21T06:36:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `apps/web/api/triage/[owner]/[repo]/[number].ts` — GET returns default empty state (never 404), PUT upserts via `upsertTriageRecord()`, both require auth, 400 on invalid inputs, 405 on unsupported methods
- Extended `githubIssueQuerySchema` with optional `labels` and `assignee` fields — non-breaking addition, existing callers unaffected
- Updated issues route to destructure and conditionally pass `labels`/`assignee` to GitHub API `URLSearchParams`
- Added `instanceof GitHubRateLimitError` check in issues route catch block, returning 429 with `{error:'rate_limited', retryAfter:N}` before 500 fallback
- All 10 tests pass, TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create triage route handler** - `3b8dfe3f` (feat)
2. **Task 2: Extend validation schema + issues route** - `06e5295e` (feat)

## Files Created/Modified
- `apps/web/api/triage/[owner]/[repo]/[number].ts` — New Vercel route handler for GET+PUT triage state per issue
- `apps/web/api/_lib/validation.ts` — `githubIssueQuerySchema` extended with `labels` and `assignee` optional fields
- `apps/web/api/github/repos/[owner]/[repo]/issues.ts` — `GitHubRateLimitError` import added; labels/assignee destructured and forwarded; rate-limit catch before 500 fallback

## Decisions Made
- GET triage returns 200 with default empty object when no DB record exists — consistent with D-04, avoids frontend 404 handling
- PUT body allows `nullable` priority so clients can unset priority (e.g., `{"priority": null}`)
- `labels` and `assignee` forwarded verbatim to GitHub API via `URLSearchParams.set()` — URL-encoding is automatic, no sanitization needed beyond schema presence (T-03-05 accepted in threat model)
- `GitHubRateLimitError` catch placed before generic 500 fallback in issues route — ensures rate-limit responses are never swallowed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. All changes are code-only.

## Next Phase Readiness
- Triage route is production-ready for Phase 3/4/5 use: GET (D-04) and PUT (D-05) semantics fully implemented
- `githubIssueQuerySchema` with labels/assignee enables filtered issue lists for triage views (D-11, D-12)
- Rate-limit 429 propagation from issues route enables frontend retry logic (D-02)
- `github_comment_id` and `comment_status` columns in `issue_triage` table ready for Phase 5 comment posting

## Known Stubs

None — all routes are fully wired to DB helpers and validation. No placeholder responses.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. All STRIDE mitigations implemented as planned (T-03-01 through T-03-04).

## Self-Check: PASSED

- `apps/web/api/triage/[owner]/[repo]/[number].ts` — exists, contains `export default async function handler`, `authenticateRequest`, `case 'GET'` with default empty state, `case 'PUT'` with `upsertTriageRecord`, `z.enum(['critical', 'high', 'medium', 'low'])`, `case default` 405
- `apps/web/api/_lib/validation.ts` — `githubIssueQuerySchema` contains `labels: z.string().optional()` and `assignee: z.string().optional()`
- `apps/web/api/github/repos/[owner]/[repo]/issues.ts` — imports `GitHubRateLimitError`, destructures `labels` and `assignee`, contains `params.set('labels', labels)` and `params.set('assignee', assignee)`, catch block contains `instanceof GitHubRateLimitError` before 500 fallback
- Commits `3b8dfe3f` and `06e5295e` verified in git log
- `npx vitest run` — 10/10 tests passed
- `npx tsc --noEmit` — 0 errors

---
*Phase: 01-foundation*
*Completed: 2026-04-21*
