---
phase: "06-notes"
plan: "02"
subsystem: "apps/web"
tags: [tdd, green-phase, notes, backend, idempotency, per-user-token]
dependency_graph:
  requires: [06-01]
  provides: [NOTES-01-backend, NOTES-02-backend, D-04-implementation]
  affects:
    - apps/web/api/_lib/db/triage.ts
    - apps/web/api/_lib/db/triage.test.ts
    - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts
    - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts
tech_stack:
  added: []
  patterns: [per-user-oauth-token, idempotency-guard, atomic-upsert, raw-fetch-over-githubFetch]
key_files:
  created: []
  modified:
    - apps/web/api/_lib/db/triage.ts
    - apps/web/api/_lib/db/triage.test.ts
    - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts
    - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts
decisions:
  - "Used raw fetch() with per-user token instead of githubFetch() — githubFetch reads GITHUB_TOKEN env var globally, not per-user"
  - "Idempotency check via getTriageRecord before calling GitHub — returns alreadyPosted:true if commentId already stored"
  - "upsertTriageRecord saves commentId after successful post — enables idempotency on retry"
  - "Conditional SQL expressions preserve existing github_comment_id/comment_status when not in updates object"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-22T13:58:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 4
---

# Phase 6 Plan 02: Backend — upsertTriageRecord + comment.ts Implementation Summary

**One-liner:** Extended upsertTriageRecord with github_comment_id/comment_status columns and replaced comment.ts githubFetch with per-user raw fetch plus getTriageRecord/upsertTriageRecord idempotency guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend upsertTriageRecord with githubCommentId + commentStatus (NOTES-02 DB layer) | dce6dfc3 | apps/web/api/_lib/db/triage.ts, apps/web/api/_lib/db/triage.test.ts |
| 2 | Extend comment.ts with per-user token (D-04) and idempotency guard (D-03) | 1fbd61c1 | apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts, comment.test.ts |

## What Was Built

### Task 1: upsertTriageRecord extension (triage.ts)

Extended `upsertTriageRecord` signature and SQL to accept `githubCommentId` and `commentStatus` optional fields:

- Added two optional fields to the `updates` parameter: `githubCommentId?: number | null` and `commentStatus?: 'posted' | 'failed' | null`
- Added conditional value extraction (`commentIdVal`, `commentStatusVal`) and conditional SQL expressions (`commentIdExpr`, `commentStatusExpr`) — same pattern as existing `isTriagedExpr`/`priorityExpr`
- Extended INSERT SQL to include `github_comment_id` and `comment_status` columns with 6 args total
- ON CONFLICT DO UPDATE preserves existing column values when fields not in updates (uses `issue_triage.github_comment_id` instead of `excluded.github_comment_id`)
- Updated triage.test.ts NOTES-02 stub with two real assertions: save new comment fields + preserve existing when not in updates

### Task 2: comment.ts replacement (D-04 + D-03)

Replaced `githubFetch()` global token approach with per-user OAuth token and added full idempotency:

- Removed `githubFetch` import; kept only `GITHUB_API` constant from github.ts
- Added `getUserById` import from users.ts — looks up authenticated user's `github_token`
- Returns 403 `{ error: 'No GitHub token for user' }` when `dbUser.github_token` is null
- Added `getTriageRecord` import — checks for existing `githubCommentId` before posting
- Returns 200 `{ alreadyPosted: true, commentId }` on idempotent retry (D-03)
- Raw `fetch()` call with `Authorization: Bearer ${dbUser.github_token}` header (not `GITHUB_TOKEN` env var)
- Calls `upsertTriageRecord` after successful GitHub post to persist `commentId` for future idempotency checks
- Updated all 9 comment.test.ts stubs to real passing tests

## Verification Results

```
comment.test.ts:  9 passed (all GREEN)
triage.test.ts:   10 passed, 1 pre-existing failure (out of scope — see Deviations)
Full API suite:   76 passed, 1 failed (pre-existing)
```

Grep checks:
- `getUserById` found in comment.ts — PASS
- `githubFetch` NOT imported in comment.ts — PASS
- `githubCommentId` found in triage.ts — PASS

## Deviations from Plan

### Pre-existing Failure (Out of Scope)

**Found during:** Task 1 verification
**Issue:** `triage.test.ts > upsertTriageRecord > calls two execute steps: INSERT DO NOTHING then dynamic UPDATE then SELECT` was already failing before this plan. The test expects a 3-step pattern (DO NOTHING + UPDATE + SELECT) but the implementation uses a 2-step atomic INSERT ON CONFLICT DO UPDATE + SELECT pattern.
**Action:** Not fixed — this is a pre-existing issue documented in 06-01-SUMMARY.md as out-of-scope. No changes made.

## TDD Gate Compliance

Both tasks followed RED → GREEN pattern:

- **Task 1:** RED — NOTES-02 stub (`expect(true).toBe(false)`) was failing (confirmed in Wave 0). GREEN — stub replaced with real test assertions, implementation added.
- **Task 2:** RED — all 9 comment.test.ts stubs (`expect(true).toBe(false)`) were failing (confirmed in Wave 0). GREEN — stubs replaced with real test assertions, implementation added.

## Known Stubs

None. All stubs from Wave 0 that are in scope for this plan (NOTES-01, NOTES-02, D-04 backend) are now GREEN.

## Threat Flags

No new security-relevant surface introduced beyond what is in the plan's threat model. The threats T-06-02 through T-06-06 are all mitigated as designed:
- T-06-02 (Spoofing): `authenticateRequest()` verified before domain logic
- T-06-03 (Replay/double-post): `getTriageRecord()` idempotency check implemented
- T-06-04 (Empty/oversized body): `githubCommentSchema.safeParse()` returns 400
- T-06-05 (Missing GitHub token): `getUserById` check returns 403
- T-06-06 (Error details): Generic 500 message in catch block

## Self-Check: PASSED

- `apps/web/api/_lib/db/triage.ts` — FOUND (modified)
- `apps/web/api/_lib/db/triage.test.ts` — FOUND (modified)
- `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` — FOUND (modified)
- `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` — FOUND (modified)
- Commit dce6dfc3 — FOUND
- Commit 1fbd61c1 — FOUND
