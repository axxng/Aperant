---
phase: 05-triage-actions
plan: "01"
subsystem: web/frontend-tests
tags: [tdd, red-phase, triage, keyboard-nav, optimistic-updates]
dependency_graph:
  requires: []
  provides: [TRIAGE-01-stubs, TRIAGE-02-stubs, TRIAGE-03-stubs, TRIAGE-04-stubs, TRIAGE-05-stubs, TRIAGE-06-stubs]
  affects: [IssueDetailPanel.test.tsx, IssuesView.test.tsx, IssueListRow.test.tsx]
tech_stack:
  added: []
  patterns: [vitest-mock-hoisting, tanstack-query-mock, react-testing-library]
key_files:
  created:
    - apps/web/src/client/components/IssueDetailPanel.test.tsx
    - apps/web/src/client/components/IssuesView.test.tsx
  modified:
    - apps/web/src/client/components/IssueListRow.test.tsx
decisions:
  - "IssueDetailPanel test mocks: useQuery + useMutation + useQueryClient from @tanstack/react-query; useToast from ../hooks/useToast; all Radix DropdownMenu primitives render children directly for assertion"
  - "IssuesView test mocks: IssueDetailPanel + IssueListRow as minimal stubs exposing data-testid and data-issue-id attributes to isolate keyboard nav logic from child rendering"
  - "IssueListRow TRIAGE-04: vi.mock('lucide-react') appended after CROSS-02 block — Vitest hoists all vi.mock() calls regardless of source position"
metrics:
  duration: "2m 26s"
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_changed: 3
requirements:
  - TRIAGE-01
  - TRIAGE-02
  - TRIAGE-03
  - TRIAGE-04
  - TRIAGE-05
  - TRIAGE-06
---

# Phase 05 Plan 01: Triage Actions — RED Phase Test Stubs Summary

**One-liner:** Failing TDD test stubs for all 6 triage requirements — TriagedToggle, PrioritySelector, optimistic rollback, TriageBadgeSlot, j/k keyboard nav, and ClosedIssueWarning.

## What Was Built

Wave 0 of the triage-actions phase: three test files containing failing stubs that define the acceptance contract for Wave 1 implementation.

- `IssueDetailPanel.test.tsx` (NEW, 180 lines): 8 active tests + 3 it.todo stubs covering TRIAGE-01 (toggle), TRIAGE-02 (priority selector), TRIAGE-03 (optimistic updates, as todos), and TRIAGE-06 (closed issue warning)
- `IssuesView.test.tsx` (NEW, 170 lines): 6 tests covering TRIAGE-05 j/k keyboard navigation — next, prev, k-boundary, j-boundary, closed-panel guard, INPUT guard
- `IssueListRow.test.tsx` (MODIFIED, +70 lines): 5 tests appended for TRIAGE-04 triage badge slot — checkmark, priority-only, both, absent, neither

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add IssueDetailPanel.test.tsx failing stubs | `4b684076` |
| 2 | Add IssuesView.test.tsx keyboard nav stubs | `b768a814` |
| 3 | Extend IssueListRow.test.tsx triage badge stubs | `54233c02` |

## Verification: RED Phase Confirmed

```
Test Files  3 failed (3 new) | 12 passed
Tests       13 failed | 84 passed | 3 todo (100)
```

- `IssueDetailPanel.test.tsx`: 8 failures — "Unable to find element with aria-label: Toggle triaged status", "Unable to find element by: [data-testid='circle']", "Unable to find role button", etc.
- `IssuesView.test.tsx`: 2 failures — panel data-issue-id not updating after j/k keydown (no handler implemented)
- `IssueListRow.test.tsx`: 3 failures — "Unable to find element by: [data-testid='check-circle-2']", "Unable to find text: Critical"

All 84 pre-existing tests continue to pass (CROSS-01, CROSS-02, CROSS-03, Auth, DB tests unaffected).

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

RED gate confirmed: all three files were committed as `test(05-01):` commits before any implementation. GREEN gate will be achieved in Plan 05-02 and 05-03.

## Known Stubs

The following items are intentionally stubbed as `it.todo` in TRIAGE-03 (optimistic updates):
- `IssueDetailPanel.test.tsx` lines 151-154: onMutate setQueryData, onError rollback, onError toast — these require the full mutation wiring to test properly and will be validated in the implementation review during Plan 05-02.

## Threat Flags

None — this plan creates test files only; no new network endpoints, auth paths, file access patterns, or schema changes were introduced.

## Self-Check: PASSED

Files created/modified:
- FOUND: apps/web/src/client/components/IssueDetailPanel.test.tsx
- FOUND: apps/web/src/client/components/IssuesView.test.tsx
- FOUND: apps/web/src/client/components/IssueListRow.test.tsx (TRIAGE-04 describe block appended)

Commits verified:
- FOUND: 4b684076
- FOUND: b768a814
- FOUND: 54233c02
