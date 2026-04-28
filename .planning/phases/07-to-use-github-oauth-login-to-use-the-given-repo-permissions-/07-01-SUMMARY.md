---
phase: "07"
plan: "01"
subsystem: "web/api/tasks + web/src/client/components"
tags: ["tdd", "red-phase", "promote-to-backlog", "test-stubs"]
dependency_graph:
  requires: []
  provides:
    - "RED test stubs for by-github-issue GET endpoint (PROMOTE-03)"
    - "RED test stub for index POST 409 duplicate guard (PROMOTE-05)"
    - "RED test stubs for IssueDetailPanel promote button (PROMOTE-01/03/04/05)"
  affects:
    - "apps/web/api/tasks/by-github-issue.ts"
    - "apps/web/api/tasks/by-github-issue.test.ts"
    - "apps/web/api/tasks/index.test.ts"
    - "apps/web/src/client/components/IssueDetailPanel.test.tsx"
tech_stack:
  added: []
  patterns:
    - "RED-phase TDD stubs with vi.mock + mockImplementation"
    - "Per-queryKey useQuery mock dispatch"
    - "promoteMutationOptionsRef pattern for onSuccess callback testing"
key_files:
  created:
    - apps/web/api/tasks/by-github-issue.ts
    - apps/web/api/tasks/by-github-issue.test.ts
    - apps/web/api/tasks/index.test.ts
  modified:
    - apps/web/src/client/components/IssueDetailPanel.test.tsx
decisions:
  - "Used callCount % 2 (not % 3) in setupNoteMocks to keep NOTES-01 passing — % 3 with 2-mutation component drifts across re-renders; update to % 3 in Plan 07-03 when promote mutation is added"
  - "PROMOTE-03 'does not render promote button' passes vacuously (component has no promote button yet) — acceptable for RED phase"
  - "by-github-issue.ts stub returns 501 for GET; 405 for non-GET — stub pattern from plan"
metrics:
  duration: "~30 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 07 Plan 01: RED Test Stubs for Promote to Backlog Summary

Wave 0 RED phase — all failing test stubs established before any implementation. Creates the test contract for Wave 1 (backend) and Wave 2 (frontend) to satisfy.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create by-github-issue.ts stub + by-github-issue.test.ts RED stubs | 07fe87e1 | apps/web/api/tasks/by-github-issue.ts, apps/web/api/tasks/by-github-issue.test.ts |
| 2 | Create index.test.ts PROMOTE-05 stub + extend IssueDetailPanel.test.tsx PROMOTE-01/03/04/05 stubs | 29306dd8 | apps/web/api/tasks/index.test.ts, apps/web/src/client/components/IssueDetailPanel.test.tsx |

## RED Test State

### by-github-issue.test.ts (4 tests)
- FAIL: "returns task when getTaskByGitHubIssue resolves to a task" — stub returns 501
- FAIL: "returns null when getTaskByGitHubIssue resolves to null" — stub returns 501
- PASS: "returns 405 when method is not GET" — stub handles method check
- FAIL: "returns 403 when user has insufficient role" — stub reaches 501 before auth

### index.test.ts (1 test)
- FAIL: "returns 409 with existing task when UNIQUE constraint is violated" — handler lacks duplicate guard

### IssueDetailPanel.test.tsx (8 new tests — all RED, 21 existing tests GREEN)
- FAIL: PROMOTE-01 "renders Promote to Backlog button when no existing task"
- FAIL: PROMOTE-01 "calls promoteMutation.mutate with correct fields on button click"
- FAIL: PROMOTE-03 "renders View in Backlog badge when existingTask query returns a task"
- PASS: PROMOTE-03 "does not render promote button when existingTask exists" (vacuously true — no button yet)
- FAIL: PROMOTE-04 "maps critical to urgent" (triagePriorityToTaskPriority not exported yet)
- FAIL: PROMOTE-04 "passes high/medium/low through unchanged"
- FAIL: PROMOTE-04 "maps null to undefined"
- FAIL: PROMOTE-05 "shows duplicate toast when promote onSuccess fires with alreadyExists=true"
- FAIL: PROMOTE-05 "shows success toast when promote onSuccess fires without alreadyExists"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used callCount % 2 instead of % 3 in setupNoteMocks**
- **Found during:** Task 2 verification
- **Issue:** The plan specifies `callCount % 3` for 3 mutations (triage, note, promote). But the component currently only has 2 `useMutation` calls. With `% 3` and 2 mutations per render, `callCount` drifts across re-renders — render cycle 2 starts at position 3 (which maps to `promote` slot), breaking the note mutation assignment. The NOTES-01 "calls noteMutation.mutate" test failed because on re-render the note position got `promoteMutate` instead of `noteMutate`.
- **Fix:** Used `callCount % 2` to keep triage/note assignment stable across re-renders. `promoteMutate` is defined but never returned (since the component has no 3rd mutation yet). The `% 3` approach will be correct once Plan 07-03 adds the promote mutation hook.
- **Files modified:** apps/web/src/client/components/IssueDetailPanel.test.tsx
- **Commit:** 29306dd8

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| apps/web/api/tasks/by-github-issue.ts | Returns 501 for GET | Wave 0 stub — Plan 07-02 implements full handler |

## Deferred Items

- Update `setupNoteMocks` from `callCount % 2` to `callCount % 3` in Plan 07-03 when IssueDetailPanel gains the 3rd `useMutation` call (promote mutation)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/web/api/tasks/by-github-issue.ts | FOUND |
| apps/web/api/tasks/by-github-issue.test.ts | FOUND |
| apps/web/api/tasks/index.test.ts | FOUND |
| apps/web/src/client/components/IssueDetailPanel.test.tsx | FOUND |
| .planning/phases/.../07-01-SUMMARY.md | FOUND |
| Commit 07fe87e1 | FOUND |
| Commit 29306dd8 | FOUND |
