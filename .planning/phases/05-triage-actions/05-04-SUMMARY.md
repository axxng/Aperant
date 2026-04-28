---
phase: 05-triage-actions
plan: "04"
subsystem: web/client
tags: [keyboard-nav, triage, badge, react, hooks]
dependency_graph:
  requires: ["05-02", "05-03"]
  provides: ["TRIAGE-03", "TRIAGE-04", "TRIAGE-05"]
  affects: ["IssuesView", "AllIssuesView"]
tech_stack:
  added: []
  patterns:
    - useCallback for stable callback identity passed to child components
    - Map-based per-issue cache for session-level triage state (no extra API calls)
    - keydown event listener with useEffect + removeEventListener cleanup
    - Type narrowing cast at cache boundary to satisfy TriageStateDisplay union type
key_files:
  created: []
  modified:
    - apps/web/src/client/components/IssuesView.tsx
    - apps/web/src/client/components/AllIssuesView.tsx
decisions:
  - "issueTriageCache typed as Map<number, { isTriaged: boolean; priority: 'critical'|'high'|'medium'|'low'|null }> — cast from IssueDetailPanel's string|null at handleTriageLoad boundary to satisfy IssueListRow's TriageStateDisplay union"
  - "j/k useEffect placed after filteredIssues useMemo declaration — avoids 'cannot access before initialization' ReferenceError (React hooks ordering)"
  - "No AllIssuesView.test.tsx created — plan specifies only IssuesView.test.tsx as the test target; AllIssuesView shares identical implementation pattern"
metrics:
  duration: "3 minutes"
  completed: "2026-04-22T06:27:25Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 5 Plan 04: j/k Keyboard Nav + TriageState Cache Passthrough Summary

Wave 2 wires j/k keyboard navigation into `IssuesView` and `AllIssuesView`, and connects the `issueTriageCache` passthrough so `TriageBadgeSlot` in `IssueListRow` updates immediately after a triage action in the panel — without a page reload.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire j/k keyboard nav and triageState cache into IssuesView | d2161aba, c267fe81 | IssuesView.tsx |
| 2 | Wire identical j/k nav and triageState cache into AllIssuesView | a74bfbc2 | AllIssuesView.tsx |

## What Was Built

### IssuesView.tsx

- Added `useCallback` to React imports
- Added `issueTriageCache` state: `Map<number, { isTriaged: boolean; priority: 'critical'|'high'|'medium'|'low'|null }>`
- Added `handleTriageLoad` callback (via `useCallback`) — called by `IssueDetailPanel` when triage data loads or changes
- Added j/k `useEffect` after `filteredIssues` declaration:
  - Returns early when `selectedIssueId === null` (panel closed)
  - Skips navigation when `target.tagName === 'INPUT'` or `TEXTAREA` or `isContentEditable`
  - `j` advances to `filteredIssues[currentIndex + 1]`, bounded at last issue
  - `k` retreats to `filteredIssues[currentIndex - 1]`, bounded at index 0
  - `return () => window.removeEventListener('keydown', handleKeyDown)` cleanup prevents stacking
- Updated `IssueListRow` call: added `triageState={issueTriageCache.get(issue.id)}`
- Updated `IssueDetailPanel` call: added `onTriageLoad={handleTriageLoad}`

### AllIssuesView.tsx

Identical additions, adapted for AllIssuesView's cross-repo merged `filteredIssues` array:
- `useEffect`, `useCallback` added to React imports
- Same `issueTriageCache` state + `handleTriageLoad` callback pattern
- Same j/k `useEffect` (placed after `selectedIssue` derivation, which follows `filteredIssues`)
- `IssueListRow` and `IssueDetailPanel` call sites updated identically

## Test Results

```
Test Files  15 passed (15)
      Tests  97 passed | 3 todo (100)
```

All 6 TRIAGE-05 tests in `IssuesView.test.tsx` pass green:
- pressing j when panel is open moves selection to next issue
- pressing k when panel is open moves selection to previous issue
- pressing k on first issue does nothing (boundary guard)
- pressing j on last issue does nothing (boundary guard)
- pressing j when no issue selected (panel closed) does nothing
- pressing j when focus is on INPUT element does nothing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] j/k useEffect placed after filteredIssues declaration**
- **Found during:** Task 1 test run (all 4 non-navigation tests failed with `ReferenceError: Cannot access 'filteredIssues' before initialization`)
- **Issue:** Plan instructed adding the useEffect after the `setActiveProduct` useEffect (line ~52), but `filteredIssues` is declared later via `useMemo` at line ~148. React hooks run in a closure that captures the current render scope — referencing a `const` from `useMemo` before it is declared in the function body causes a TDZ ReferenceError.
- **Fix:** Moved the j/k `useEffect` to after `const selectedIssue = allIssues.find(...)` (which follows `filteredIssues`). This preserves React hooks ordering rules while ensuring `filteredIssues` is in scope.
- **Files modified:** `IssuesView.tsx`
- **Commit:** d2161aba

**2. [Rule 1 - Bug] Narrow priority type at cache boundary**
- **Found during:** Task 2 TypeScript typecheck — `TS2322: Type 'string | null' is not assignable to type '"low" | "medium" | "high" | "critical" | null'`
- **Issue:** `IssueDetailPanel.onTriageLoad` callback signature uses `priority: string | null` (broader), but `IssueListRow.triageState.priority` expects `'critical'|'high'|'medium'|'low'|null` (narrower). The plan's cache type `Map<number, { priority: string | null }>` propagates the wider type to the IssueListRow prop.
- **Fix:** Changed cache type to use the narrow union, added a `as` cast at the `handleTriageLoad` boundary in both `IssuesView.tsx` and `AllIssuesView.tsx`.
- **Files modified:** `IssuesView.tsx`, `AllIssuesView.tsx`
- **Commits:** c267fe81, a74bfbc2

## TypeScript Status

10 pre-existing typecheck errors remain (from `DevModeBanner.tsx` and `IssueDetailPanel.test.tsx` — introduced in previous plans, out of scope). Zero errors in the files modified by this plan.

## Known Stubs

None. All cache wiring is live: `handleTriageLoad` populates `issueTriageCache` from `IssueDetailPanel`'s real triage query data.

## Manual Verification Steps (for Human Tester)

The checkpoint task (Task 3) requires human verification. Run the dev server first:

```bash
# In apps/web — requires MOCK_SERVICES=true in .env.local
cd apps/web
npx tsx scripts/dev-server.ts
```

Or use a real Currents instance with GitHub OAuth.

### Verification Checklist

1. **Open Issues tab** — Navigate to any product's Issues tab or the All Issues view
2. **Open detail panel** — Click any open issue to open the detail panel
3. **Confirm triage controls** — A "Triaged" toggle button and "Priority: None" dropdown should appear below the issue title, above labels/meta
4. **Toggle triaged** — Click the "Triaged" toggle — button should show checkmark icon immediately (optimistic); confirm it persists on refresh
5. **Set priority** — Open another issue, select "High" from priority dropdown — button should show "Priority: high"
6. **Badge appears without reload** — Open the same High-priority issue again — the issue row in the list should now show an **orange "High" pill badge** without any page refresh (TRIAGE-04 session cache)
7. **j navigation** — Press `j` — panel should advance to next issue in the list without clicking
8. **k navigation** — Press `k` — panel should go back to previous issue
9. **j boundary guard** — Press `j` on the last issue — nothing should happen
10. **Input focus guard** — Click in the search bar and type `j` — issues should NOT navigate
11. **Closed issue warning** — Switch to "Closed" filter, open a closed issue — confirm the warning banner appears: "This issue is closed. Triage actions are still saved in Currents."
12. **Closed issue triage saves** — Set priority on a closed issue — confirm it saves (no blocking dialog)
13. **Persistence** — Open the same issue in a second browser tab and refresh — confirm triage state is visible (TRIAGE-03 API persistence)
14. **Priority colors** — Critical = red, High = orange, Medium = yellow, Low = muted gray

### Expected: PASS on all 14 checks

## Self-Check: PASSED

- `apps/web/src/client/components/IssuesView.tsx` — exists, contains `useCallback`, `issueTriageCache`, `handleTriageLoad`, `handleKeyDown`, `removeEventListener`
- `apps/web/src/client/components/AllIssuesView.tsx` — exists, contains identical additions
- Commits d2161aba, a74bfbc2, c267fe81 — all present in git log
- 97 tests pass, 0 failures
- 0 typecheck errors in modified files
