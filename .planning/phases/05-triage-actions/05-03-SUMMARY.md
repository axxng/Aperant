---
phase: 05-triage-actions
plan: "03"
subsystem: web/frontend-components
tags: [triage, useQuery, useMutation, optimistic-updates, TriageSection, IssueDetailPanel]
dependency_graph:
  requires: [05-01-SUMMARY, 05-02-SUMMARY]
  provides: [TRIAGE-01-green, TRIAGE-02-green, TRIAGE-03-wired, TRIAGE-06-green]
  affects:
    - apps/web/src/client/components/IssueDetailPanel.tsx
    - apps/web/src/client/components/AllIssuesView.test.tsx
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery lazy fetch with staleTime:0
    - TanStack Query useMutation with onMutate optimistic update + onError rollback
    - Radix DropdownMenu for PrioritySelector
    - aria-pressed for TriagedToggle accessibility
    - onTriageLoad callback via useEffect for parent cache hydration
key_files:
  created: []
  modified:
    - apps/web/src/client/components/IssueDetailPanel.tsx
    - apps/web/src/client/components/AllIssuesView.test.tsx
decisions:
  - "TriageSection placed between header block and meta/labels section per D-01"
  - "owner/repo derived from issue.repoFullName (split by '/') per RESEARCH.md Pattern 5"
  - "Priority null send explicit null in mutation payload (never omit) per RESEARCH.md Pitfall 4"
  - "onError rollback (setQueryData first) before toastError per RESEARCH.md Anti-Pattern"
  - "AllIssuesView.test.tsx mock updated to add useQuery/useMutation/useQueryClient (Rule 1 fix)"
metrics:
  duration: "6m 50s"
  completed_date: "2026-04-22"
  tasks_completed: 1
  files_changed: 2
requirements:
  - TRIAGE-01
  - TRIAGE-02
  - TRIAGE-03
  - TRIAGE-06
---

# Phase 05 Plan 03: Triage Actions — IssueDetailPanel TriageSection Summary

**One-liner:** IssueDetailPanel extended with full TriageSection — lazy triage fetch (useQuery), optimistic mutation (useMutation with onMutate/onError/onSettled), ClosedIssueWarning banner, TriagedToggle (aria-pressed), and PrioritySelector (Radix DropdownMenu).

## What Was Built

Wave 1b of the triage-actions phase: `IssueDetailPanel.tsx` extended with the full TriageSection, closing TRIAGE-01, TRIAGE-02, and TRIAGE-06 test cases. TRIAGE-03 optimistic mutation wiring is implemented (onMutate + onError + onSettled); the `.todo` stubs in the test remain as-is per plan acceptance criteria.

### IssueDetailPanel.tsx Changes

- **New props:** Added optional `onTriageLoad` callback prop; called via `useEffect` when `triageData` changes, enabling parent components to cache per-issue triage state for `TriageBadgeSlot` in `IssueListRow` without N API calls.

- **Triage fetch (D-07):** `useQuery` with key `['triage', owner, repo, issue.number]`, `staleTime: 0` (always fresh on panel open), `enabled: Boolean(issue && owner && repo)`. Owner/repo derived from `issue.repoFullName.split('/')`.

- **Optimistic mutation (D-08):**
  - `onMutate`: `cancelQueries` → `getQueryData` (save previous) → `setQueryData` (merge update) → return `{ previous }`
  - `onError`: `setQueryData(context.previous)` rollback FIRST, then `toastError(t('triage.saveError'))`
  - `onSettled`: `invalidateQueries` for cache reconciliation

- **TriagedToggle:** Button with `aria-pressed={triageData?.isTriaged ?? false}`, `aria-label={t('triage.markTriagedAriaLabel')}`, `Circle` icon when not triaged, `CheckCircle2` icon when triaged.

- **PrioritySelector:** Radix `DropdownMenu` with trigger showing `Priority: None` or `Priority: {level}`. All four priority levels (critical/high/medium/low) as `DropdownMenuItem` with color dot. Clear option renders only when priority is set; sends `{ priority: null }`.

- **ClosedIssueWarning:** `role="alert"` div with `AlertTriangle` icon, shown only when `issue.state === 'closed'`.

- **Section structure (D-01):** TriageSection inserted between header block and meta/labels section, followed by a divider. Full order: header → TriageSection → divider → meta → View on GitHub → divider → body.

### AllIssuesView.test.tsx Fix

Added `useQuery`, `useMutation`, `useQueryClient` exports to the `@tanstack/react-query` mock — required because `IssueDetailPanel` (rendered as a child of `AllIssuesView`) now calls all three hooks, and the original mock only exported `useQueries`.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Extend IssueDetailPanel with TriageSection + fix AllIssuesView test mock | `7aaf951c` |

## Verification

```
Test Files  1 passed (IssueDetailPanel.test.tsx)
Tests       9 passed | 3 todo (12)

Full suite: 14 passed | 1 failed (IssuesView.test.tsx TRIAGE-05 j/k — expected, Plan 05-04)
Tests: 95 passed | 2 failed | 3 todo (100)
```

TRIAGE-01 (toggle), TRIAGE-02 (priority selector), TRIAGE-06 (closed warning) — all green.
TRIAGE-03 (optimistic updates) — wired in implementation; `.todo` stubs remain per plan.
IssuesView.test.tsx j/k failures are expected Wave 0 RED stubs for Plan 05-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AllIssuesView.test.tsx mock missing useQuery/useMutation/useQueryClient**
- **Found during:** Task 1 (post-commit verification of full test suite)
- **Issue:** `AllIssuesView.test.tsx` mocked `@tanstack/react-query` with only `{ useQueries: vi.fn() }`. When `IssueDetailPanel` (child of `AllIssuesView`) was updated to call `useQueryClient()`, all 4 AllIssuesView tests threw `No "useQueryClient" export is defined on the mock`.
- **Fix:** Added `useQuery`, `useMutation`, and `useQueryClient` with appropriate default return values to the AllIssuesView test mock.
- **Files modified:** `apps/web/src/client/components/AllIssuesView.test.tsx`
- **Commit:** included in `7aaf951c`

## Known Stubs

- `IssueDetailPanel.test.tsx` lines 161-163: `it.todo` stubs for TRIAGE-03 onMutate/onError/toast behaviors. The implementation is wired correctly but these stubs are intentionally left as todos per plan acceptance criteria. No functional stub that prevents the plan's goal.

## Threat Flags

None — this plan modifies a frontend component only; no new network endpoints or auth paths introduced. The existing `GET/PUT /api/triage/:owner/:repo/:number` API calls are authenticated by the existing session cookie (`credentials: 'include'`).

## Self-Check: PASSED

Files modified:
- FOUND: apps/web/src/client/components/IssueDetailPanel.tsx
- FOUND: apps/web/src/client/components/AllIssuesView.test.tsx

Commits verified:
- FOUND: 7aaf951c
