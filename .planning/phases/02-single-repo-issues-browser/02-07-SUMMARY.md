---
phase: 02-single-repo-issues-browser
plan: "07"
subsystem: ui
tags: [react, tanstack-query, react-router, react-i18next, typescript, issues-browser]

# Dependency graph
requires:
  - phase: 02-single-repo-issues-browser
    provides: "useIssuesFilters hook (02-04), IssueListRow + IssueSkeletonRow (02-04), IssuesFilterBar (02-05), IssueDetailPanel (02-06), QueryClientProvider (02-01), i18n issues namespace (02-04)"
provides:
  - "IssuesView — fully assembled top-level route component for /products/:productId/issues"
  - "useInfiniteQuery issues pagination with Load More (BROWSE-07)"
  - "Parallel labels fetch with useQuery (BROWSE-03)"
  - "Client-side title search via useMemo (BROWSE-05)"
  - "8-skeleton loading state, empty state (open/closed), error state with retry"
  - "Kanban/Issues tab switcher with NavLink + end prop"
  - "IssueDetailPanel slide-in wired to selectedIssueId state (BROWSE-06)"
  - "All 8 BROWSE requirements delivered via this assembly component"
affects: [phase-03, phase-04, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useInfiniteQuery for paginated issues: queryKey includes all filter state with sorted labels to prevent false cache misses"
    - "products.find(p => p.id === productId) for owner/repo derivation — never getActiveProduct()"
    - "setActiveProduct in useEffect to sync sidebar/breadcrumbs for sibling routes"
    - "enabled: Boolean(repoSource) guards both queries from running without a repo source"
    - "Client-side useMemo search + Set-based assignee derivation — zero extra API calls"
    - "NavLink with end prop on parent route tab to prevent dual-active state"
    - "credentials: 'include' on all fetch() calls for session cookie auth"

key-files:
  created: []
  modified:
    - apps/web/src/client/components/IssuesView.tsx

key-decisions:
  - "getActiveProduct() avoided in IssuesView — uses products.find() directly to handle direct-URL navigation without ProductView's setActiveProduct effect running first"
  - "labels array sorted in queryKey to prevent false cache misses when label selection order differs"
  - "Kanban tab uses navigation:items.kanban i18n key (not hardcoded) to satisfy CLAUDE.md i18n requirement"
  - "enabled: Boolean(repoSource) on both queries prevents silent undefined owner/repo fetch attempts"
  - "Client-side search not in URL (per D-10) — only state/labels/assignee go to URL via useIssuesFilters"

patterns-established:
  - "Assembly pattern: IssuesView wires all Phase 2 building blocks without duplicating logic"
  - "Infinite query pattern: useInfiniteQuery with initialPageParam: 1 and getNextPageParam from hasMore"
  - "Error isolation: labelsError shown in filter dropdown only; issues query errors shown in main pane"

requirements-completed:
  - BROWSE-01
  - BROWSE-02
  - BROWSE-03
  - BROWSE-04
  - BROWSE-05
  - BROWSE-06
  - BROWSE-07
  - BROWSE-08

# Metrics
duration: 15min
completed: 2026-04-21
---

# Phase 2 Plan 07: IssuesView Assembly Summary

**Full issues browser assembled: useInfiniteQuery pagination, parallel labels fetch, client-side search, 8-skeleton loading, empty/error states, Load More, and IssueDetailPanel slide-in wired into the /products/:productId/issues route**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-21T19:38:00Z
- **Completed:** 2026-04-21T19:53:00Z
- **Tasks:** 1 (Task 1: Implement IssuesView)
- **Files modified:** 1

## Accomplishments

- Replaced the 3-line stub in `IssuesView.tsx` with a full 282-line production component
- Wired all Phase 2 building blocks: `IssuesFilterBar`, `IssueListRow`, `IssueSkeletonRow`, `IssueDetailPanel`, `useIssuesFilters`
- Delivered all 8 BROWSE requirements (BROWSE-01 through BROWSE-08) in a single route component
- Applied all 7 correctness rules from the plan: sorted queryKey, products.find, useEffect sync, enabled guard, credentials include, useMemo search, NavLink end prop
- Pre-existing typecheck error in `labels.test.ts` (from plan 02-02) confirmed not caused by this plan

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement IssuesView (replaces stub)** - `5253545e` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified

- `apps/web/src/client/components/IssuesView.tsx` — Full implementation: tab switcher, filter bar, useInfiniteQuery issues, useQuery labels, client-side search, 8-skeleton loading, empty state, error state with retry, Load More, IssueDetailPanel integration

## Decisions Made

- Used `navigation:items.kanban` i18n key for Kanban tab label instead of hardcoded "Kanban" — satisfies CLAUDE.md mandatory i18n requirement while referencing the existing key
- `getActiveProduct()` deliberately avoided in favor of `products.find(p => p.id === productId)` — direct navigation to `/products/:productId/issues` does not run ProductView's `setActiveProduct` effect first
- Both queries gated with `enabled: Boolean(repoSource)` — prevents silent failures when no repo source is configured
- Labels sorted in queryKey (`[...labels].sort()`) — prevents false cache misses when multi-select order differs between renders

## Deviations from Plan

None — plan executed exactly as written. All correctness rules from the plan's action section applied. The only deviation from plan instructions was using `navigation:items.kanban` for the Kanban tab text (instead of hardcoded "Kanban") to comply with CLAUDE.md's mandatory i18n rule. This aligns with plan note 8 which explicitly listed this as the preferred option.

## Checkpoint Note

Task 2 is `type="checkpoint:human-verify"` — this requires the human to verify the browser UI at `http://localhost:5173/products/:productId/issues`. The orchestrator handles this checkpoint; this executor completed Task 1 (implementation) and this SUMMARY. Human verification steps are documented in the plan's checkpoint task.

## Issues Encountered

Pre-existing typecheck error in `api/github/repos/[owner]/[repo]/labels.test.ts` (line 52, TS2322) — confirmed present before this plan's changes (verified via git stash test). Not caused by IssuesView.tsx. Deferred to the appropriate plan to fix.

## User Setup Required

None — no external service configuration required. The feature is accessible after `npm run dev` at `/products/:productId/issues` for any product with a `repo` source configured.

## Next Phase Readiness

- Phase 2 is functionally complete: all BROWSE-01 through BROWSE-08 requirements are implemented
- Human verification checkpoint (Task 2) is the final gate before phase sign-off
- Phase 3 (cross-repo aggregation) can build on the `useInfiniteQuery` and `IssueListRow` patterns established here
- Known blocker: pre-existing TS2322 in `labels.test.ts` should be fixed before Phase 3 ships

## Self-Check

**Commit exists:** 5253545e — feat(02-07): implement full IssuesView component replacing stub
**File exists:** apps/web/src/client/components/IssuesView.tsx (282 lines, full implementation)
**Tests pass:** 21/21 (4 test files)
**No stubs:** no TODO/FIXME/placeholder text in modified file

## Self-Check: PASSED

- [x] `apps/web/src/client/components/IssuesView.tsx` — 282 lines, full implementation confirmed
- [x] Commit `5253545e` — verified in git log
- [x] Tests: 21 passed (4 files)
- [x] No stubs or placeholder text
- [x] All acceptance criteria met (grep checks passed for all 10 criteria)
