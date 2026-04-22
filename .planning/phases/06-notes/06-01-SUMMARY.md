---
phase: "06-notes"
plan: "01"
subsystem: "apps/web"
tags: [tdd, red-phase, notes, testing]
dependency_graph:
  requires: []
  provides: [NOTES-01-tests, NOTES-02-tests, NOTES-03-tests, D-04-tests]
  affects: [apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts, apps/web/api/_lib/db/triage.test.ts, apps/web/src/client/components/IssueDetailPanel.test.tsx]
tech_stack:
  added: []
  patterns: [vitest-vi-mock-hoisting, red-green-tdd, expect-true-toBe-false-stubs]
key_files:
  created:
    - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts
  modified:
    - apps/web/api/_lib/db/triage.test.ts
    - apps/web/src/client/components/IssueDetailPanel.test.tsx
decisions:
  - "Used expect(true).toBe(false) stubs rather than it.todo to guarantee RED state — it.todo marks as skipped not failed"
  - "Pre-existing triage.test.ts upsertTriageRecord failure is out-of-scope; logged to deferred-items"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-22T13:53:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 6 Plan 01: TDD Red Phase — Notes Feature Stubs Summary

**One-liner:** Nine failing stubs for comment handler (NOTES-01/NOTES-02/D-04), one DB triage stub (NOTES-02), and seven IssueDetailPanel UI stubs (NOTES-01/NOTES-03) written in RED state before any implementation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create comment.test.ts with failing stubs (NOTES-01, NOTES-02, D-04) | 7def539d | apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts |
| 2 | Extend triage.test.ts + IssueDetailPanel.test.tsx with NOTES failing stubs | 62f9796c | apps/web/api/_lib/db/triage.test.ts, apps/web/src/client/components/IssueDetailPanel.test.tsx |

## What Was Built

### Task 1: comment.test.ts (9 failing stubs)

Created `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` with three describe blocks:

- `comment.ts — NOTES-01: valid POST` — 4 stubs: 405 on GET, 400 on empty body, 401 on no auth, happy path
- `comment.ts — D-04: per-user token` — 2 stubs: 403 when user has no github_token, per-user token used in Authorization header
- `comment.ts — NOTES-02: idempotency` — 3 stubs: alreadyPosted early return, no GitHub fetch when already posted, save commentId after post

All 9 stubs fail immediately (RED state confirmed: 9 failed, 0 passing from new file).

### Task 2: triage.test.ts + IssueDetailPanel.test.tsx extensions

**triage.test.ts:** Added one describe block `upsertTriageRecord — NOTES-02: comment fields` with 1 failing stub for saving githubCommentId and commentStatus. Existing 9 tests: 8 pass, 1 pre-existing failure (out of scope).

**IssueDetailPanel.test.tsx:** Made three changes:
1. Extended useToast mock to expose `mockToastSuccess` (was anonymous `vi.fn()`)
2. Added `Textarea` UI primitive mock for test isolation
3. Added 6 i18n key stubs for notes feature (postButton, sentButton, sectionLabel, placeholder, postSuccess, postError)
4. Appended 7 failing stubs in two describe blocks:
   - `IssueDetailPanel — NOTES-01: note textarea renders` — 4 stubs
   - `IssueDetailPanel — NOTES-03: post feedback` — 3 stubs

Existing 13 passing tests remain green. 7 new stubs in RED state.

## Verification Results

```
comment.test.ts: 9 failed, 0 passed (RED confirmed)
triage.test.ts: 1 new failing, 8 existing passing (1 pre-existing failure — out of scope)
IssueDetailPanel.test.tsx: 7 new failing, 13 existing passing (RED confirmed)
Total new failing stubs: 17
```

## Deviations from Plan

### Pre-existing Failure (Out of Scope)

**Found during:** Task 2 verification
**Issue:** `triage.test.ts > upsertTriageRecord > calls two execute steps` was already failing before this plan with `TypeError: Cannot read properties of undefined (reading '0')`. This is a bug in the existing test mock setup — the SELECT after UPDATE receives undefined instead of a mock rows array.
**Action:** Logged as deferred (out of scope per deviation rules — pre-existing failure not caused by this plan's changes).
**Files modified:** None

## Decisions Made

- Used `expect(true).toBe(false)` stubs rather than `it.todo` — `it.todo` marks tests as "todo/skipped" not "failed", which would not satisfy the RED phase requirement of confirming tests fail
- Matched existing `vi.mock` hoisting patterns from `callback.test.ts` and `triage.test.ts`
- `mockToastSuccess` exposed as named const (not anonymous `vi.fn()`) to enable NOTES-03 assertion in Wave 1

## Known Stubs

All stubs in this plan are intentional RED-phase stubs. They will be turned GREEN by Wave 1 plans (06-02 and 06-03). None represent missing data wiring — they are the TDD contract for future implementation.

## Self-Check: PASSED

- `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` — FOUND
- `apps/web/api/_lib/db/triage.test.ts` — FOUND (modified)
- `apps/web/src/client/components/IssueDetailPanel.test.tsx` — FOUND (modified)
- Commit 7def539d — FOUND
- Commit 62f9796c — FOUND
