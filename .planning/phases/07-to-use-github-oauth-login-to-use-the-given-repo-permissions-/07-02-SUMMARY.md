---
phase: "07"
plan: "02"
subsystem: "web/api/tasks"
tags: ["tdd", "green-phase", "promote-to-backlog", "backend"]
dependency_graph:
  requires:
    - "07-01 — RED test stubs for by-github-issue and PROMOTE-05"
  provides:
    - "Full GET handler for /api/tasks/by-github-issue (PROMOTE-03 GREEN)"
    - "UNIQUE constraint 409 guard on POST /api/tasks (PROMOTE-05 GREEN)"
  affects:
    - "apps/web/api/tasks/by-github-issue.ts"
    - "apps/web/api/tasks/index.ts"
tech_stack:
  added: []
  patterns:
    - "4-step handler shape: parse → authorize → db → respond"
    - "z.parse() for programmer-level query params (ZodError → 500)"
    - "try/catch UNIQUE constraint guard returning 409 with existingTask"
key_files:
  created: []
  modified:
    - apps/web/api/tasks/by-github-issue.ts
    - apps/web/api/tasks/index.ts
decisions:
  - "Used z.parse() (not safeParse) for repo/number query params — programmer-level inputs fail with 500 per CLAUDE.md engineering principle"
  - "UNIQUE constraint catch re-throws non-constraint errors to preserve 500 behavior"
  - "IssueDetailPanel typecheck/test failures are pre-existing RED stubs from 07-01, out of scope for this backend plan"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  files_modified: 2
---

# Phase 07 Plan 02: Backend GREEN — by-github-issue handler + UNIQUE 409 guard Summary

Wave 1 backend GREEN phase — replaced the 501 stub in `by-github-issue.ts` with a full 4-step handler, and extended the POST `/api/tasks` handler with a UNIQUE constraint 409 guard. Both capabilities existed at the DB level; this plan wires them into the API layer.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement by-github-issue.ts full GET handler (PROMOTE-03 GREEN) | 9d3c7085 | apps/web/api/tasks/by-github-issue.ts |
| 2 | Extend index.ts POST handler with UNIQUE constraint 409 guard (PROMOTE-05 GREEN) | 18727682 | apps/web/api/tasks/index.ts |

## Test Results

### by-github-issue.test.ts (4/4 GREEN)
- PASS: "returns task when getTaskByGitHubIssue resolves to a task"
- PASS: "returns null when getTaskByGitHubIssue resolves to null"
- PASS: "returns 405 when method is not GET"
- PASS: "returns 403 when user has insufficient role"

### index.test.ts PROMOTE-05 (1/1 GREEN)
- PASS: "returns 409 with existing task when UNIQUE constraint is violated"

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all stubs from 07-01 removed for the files in scope of this plan.

## Pre-existing Issues (Out of Scope)

The following failures existed before this plan and are tracked for resolution in Plan 07-03 (frontend implementation):

| File | Issue | Resolution |
|------|-------|-----------|
| apps/web/src/client/components/IssueDetailPanel.test.tsx | 7 RED tests from 07-01 stubs (PROMOTE-01/03/04/05, NOTES-01, NOTES-03) | Plan 07-03 frontend implementation |
| apps/web/src/client/components/IssueDetailPanel.tsx | TypeScript errors: `asChild` prop not on Badge, `productId` missing in IssuesView | Plan 07-03 frontend implementation |

## Threat Surface

All mitigations from the threat model were applied:
- T-07-02-01: `authenticateRequest()` + `hasRole(user, 'admin', 'member')` enforced in by-github-issue.ts
- T-07-02-02: `z.string().regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/).parse()` rejects path traversal on repo param
- T-07-02-03: UNIQUE constraint catch returns generic `'This issue is already in the backlog.'` — internal table/column names not exposed

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/web/api/tasks/by-github-issue.ts | FOUND — no longer contains 501 stub |
| apps/web/api/tasks/index.ts | FOUND — contains UNIQUE constraint catch block |
| Commit 9d3c7085 | FOUND |
| Commit 18727682 | FOUND |
| by-github-issue.test.ts 4/4 GREEN | VERIFIED |
| index.test.ts PROMOTE-05 1/1 GREEN | VERIFIED |
