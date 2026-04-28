---
phase: 05-triage-actions
plan: "06"
subsystem: web/triage
tags: [triage, batch-fetch, gap-closure, tdd, api]
dependency_graph:
  requires: [05-05]
  provides: [batch-triage-endpoint, triage-pre-fetch-on-render]
  affects: [IssuesView, AllIssuesView, triage-db-layer]
tech_stack:
  added: []
  patterns: [parse-dont-validate, 4-step-handler-shape, functional-setState, tdd-red-green]
key_files:
  created:
    - apps/web/api/triage/[owner]/[repo].ts
  modified:
    - apps/web/api/_lib/db/triage.ts
    - apps/web/api/_lib/db/triage.test.ts
    - apps/web/api/_lib/validation.ts
    - apps/web/src/client/components/IssuesView.tsx
    - apps/web/src/client/components/AllIssuesView.tsx
    - apps/web/src/client/components/IssuesView.test.tsx
    - apps/web/scripts/mocks/github-fixtures.ts
decisions:
  - "Placed batch pre-fetch useEffect AFTER filteredIssues useMemo (not after handleTriageLoad as plan suggested) — hooks must reference already-declared variables in React component body"
  - "Used raw fetch with credentials:include for batch pre-fetch, consistent with existing issues/labels fetch pattern in the same components"
  - "Cache seeding uses functional setState with !next.has(id) guard to preserve any optimistic updates that arrived before batch response"
metrics:
  duration: "~18 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 7
  files_created: 1
---

# Phase 05 Plan 06: Batch Triage Pre-Fetch (GAP-1) Summary

**One-liner:** Batch triage pre-fetch via new `GET /api/triage/:owner/:repo?numbers=...` endpoint seeds `issueTriageCache` on list render so priority badges appear without opening each panel.

## What Was Built

GAP-1 fix: Priority badges previously only appeared for issues whose detail panel had been opened (because `issueTriageCache` was populated exclusively via `onTriageLoad`). This plan adds a batch DB query + API endpoint + frontend pre-fetch to seed the cache on first render.

### Task 1: DB Helper + Batch API Endpoint (TDD)

**`getTriageRecordsBatch(repo, issueNumbers)`** in `triage.ts`:
- Returns `[]` immediately when `issueNumbers` is empty (no DB call)
- Single SQL query: `SELECT github_issue_number, is_triaged, priority FROM issue_triage WHERE github_repo = ? AND github_issue_number IN (?...)`
- Parses rows via `triageBatchRowSchema` (parse-don't-validate at DB boundary)
- Returns `Array<{ issueNumber, isTriaged, priority }>`

**`triageBatchRowSchema`** in `validation.ts`:
- Lightweight schema: `github_issue_number`, `is_triaged`, `priority` only
- Added before `githubOwnerRepoSchema` per schema organisation convention

**`GET /api/triage/:owner/:repo`** new endpoint:
- 4-step handler shape: parse → authorize → query → respond
- Path params via `githubOwnerRepoSchema.parse()` (programmer bug → 500)
- `numbers` query param via `batchQuerySchema.safeParse()` (user input → 400)
- Hard cap at 100 issue numbers (DoS mitigation, T-05-06-03)
- Auth required via `authenticateRequest` (T-05-06-02)
- Returns `{ records: Array<{ issueNumber, isTriaged, priority }> }`

**TDD:** 3 failing tests written first (RED), then implementation (GREEN). All 9 triage DB tests pass.

### Task 2: Frontend Pre-Fetch + Mock Handler

**`IssuesView.tsx`** — new `useEffect` watching `[filteredIssues, repoSource]`:
- Fires on first render and whenever filtered issue list changes
- Fetches `/api/triage/:owner/:repo?numbers=<all visible issue numbers>`
- Seeds cache entries using `!next.has(id)` guard (preserves optimistic updates)
- Silent failure: list renders without badges if fetch fails

**`AllIssuesView.tsx`** — new `useEffect` watching `[filteredIssues]`:
- Groups issues by `repoFullName`, fires one request per unique repo
- Same functional setState + cache-miss-only seeding pattern

**`github-fixtures.ts`** — mock `GET /api/triage/:owner/:repo`:
- Returns `{ records: [...] }` with `isTriaged: false, priority: null` for all requested numbers
- Mock dev env starts with no priorities (correct — triage is a user action)

**`IssuesView.test.tsx`** — 2 new tests in `TRIAGE-04: batch triage pre-fetch on render`:
- Verifies `fetch` called with correct URL pattern on render
- Verifies no crash after batch response merges into cache

**Final test count:** 103 passed (was 98 before), 3 todo, 0 failed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved batch pre-fetch useEffect to after filteredIssues declaration**
- **Found during:** Task 2 — full test suite run (ReferenceError: Cannot access 'filteredIssues' before initialization)
- **Issue:** Plan instructed placing the `useEffect` "immediately after the existing `handleTriageLoad` `useCallback`" — but `filteredIssues` is defined via `useMemo` ~80 lines later in the component body. JavaScript `let`/`const` are not hoisted, so a `useEffect` (which is a function call, not an arrow function body) can only reference variables declared above it in the component.
- **Fix:** Moved both `useEffect` blocks (in `IssuesView` and `AllIssuesView`) to immediately before the keyboard navigation `useEffect`, which already uses `filteredIssues` in its deps — confirming this is the correct position.
- **Files modified:** `IssuesView.tsx`, `AllIssuesView.tsx`
- **Commits:** b0bdf040

## Known Stubs

None. All triage records fetched from DB are real data. The mock dev env intentionally returns empty triage records (correct — priorities are set by user actions, not pre-seeded).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | `api/triage/[owner]/[repo].ts` | `numbers` query param validated with regex + safeParse + 100-item hard cap per plan threat model T-05-06-01 through T-05-06-03 — all mitigations in place |

## Self-Check: PASSED

All required files exist, commits are present, and content checks confirm key identifiers are in place.

| Check | Result |
|-------|--------|
| `apps/web/api/_lib/db/triage.ts` exists | PASSED |
| `apps/web/api/_lib/validation.ts` exists | PASSED |
| `apps/web/api/triage/[owner]/[repo].ts` exists | PASSED |
| `apps/web/src/client/components/IssuesView.tsx` exists | PASSED |
| `apps/web/src/client/components/AllIssuesView.tsx` exists | PASSED |
| `apps/web/scripts/mocks/github-fixtures.ts` exists | PASSED |
| `05-06-SUMMARY.md` exists | PASSED |
| Commit `10e3371c` (Task 1) present | PASSED |
| Commit `b0bdf040` (Task 2) present | PASSED |
| `getTriageRecordsBatch` in triage.ts | PASSED |
| `triageBatchRowSchema` in validation.ts | PASSED |
| `api/triage` reference in IssuesView.tsx | PASSED |
| `api/triage` reference in AllIssuesView.tsx | PASSED |
| `api/triage` route in github-fixtures.ts | PASSED |
| All 103 tests pass | PASSED |
