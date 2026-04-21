---
phase: "04"
plan: "03"
subsystem: "frontend-all-issues-view"
tags: [react, tdd, useQueries, cross-repo, tanstack-query, error-banners]
dependency_graph:
  requires:
    - "04-01: dual-vitest-project-config + failing Wave 0 stubs"
    - "04-02: extended-IssueListRow-with-productBadge + useAllIssuesFilters-hook + allIssues-i18n-keys"
  provides:
    - AllIssuesView-component
    - cross-repo-unified-issues-list-CROSS-01
    - product-badges-via-IssueListRow-CROSS-02
    - per-repo-dismissible-error-banners-CROSS-03
  affects:
    - apps/web/src/client/components/AllIssuesView.tsx
tech_stack:
  added: []
  patterns:
    - "useQueries fan-out: one TanStack Query per product in parallel (not multiple useQuery in a loop)"
    - "queryKey ['issues', 'all', product.id, state] — 'all' prefix isolates cache from IssuesView"
    - "productsWithRepo memoized to prevent index drift between useQueries result array and product array"
    - "issue.id (globally unique) as React key — not issue.number (repo-scoped)"
    - "dismissedRepos Set<string> for per-banner dismiss state"
    - "role=alert on error banners for accessibility"
key_files:
  created:
    - apps/web/src/client/components/AllIssuesView.tsx
  modified: []
decisions:
  - "useQueries (not multiple useQuery) — dynamic product count requires array-based parallel queries per React hooks rules"
  - "isAllLoading: only show skeletons when ALL queries are still loading; partial results render immediately"
  - "Per-query refetch() on Retry button — not queryClient.invalidateQueries — for precise per-repo retry"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 04 Plan 03: AllIssuesView Component Summary

## One-liner

AllIssuesView with useQueries fan-out per product, merged+sorted issues, client-side search, dismissible per-repo error banners with retry, and productBadge prop on every IssueListRow (CROSS-01/02/03).

## What Was Built

Created `apps/web/src/client/components/AllIssuesView.tsx` — the core Phase 4 deliverable:

**Data layer (CROSS-01 aggregation):**
- `productsWithRepo` — memoized filtered list of products that have a `type: 'repo'` source
- `useQueries` fan-out — one TanStack Query per product with `queryKey: ['issues', 'all', product.id, state]`; the `'all'` prefix prevents cache collision with `IssuesView`'s `['issues', owner, repo, ...]` keys
- `allIssues` — merged from all successful queries, sorted by `updatedAt` desc
- `filteredIssues` — client-side title search (no debounce), no API calls

**UI (CROSS-02 product badges):**
- `productBadge={{ color: issue.product.color, name: issue.product.name }}` passed to every `IssueListRow`
- State toggle (open/closed) via `setStateFilter` from `useAllIssuesFilters` hook (URL-persisted)
- Keyword search input, empty state with `Inbox` icon, 8 skeleton rows while all queries loading

**Error handling (CROSS-03 partial failure):**
- Per-repo `role="alert"` banners for failed queries, stacked with `space-y-2`
- Rate-limit detection (`error.message === 'rate_limited'`) with `retryAfter` seconds display
- Dismiss button: `setDismissedRepos(prev => new Set([...prev, product.id]))` — local session state
- Retry button: calls `query.refetch()` on the specific failed query — not a global invalidation
- Successful queries' issues render while other queries are still loading or failed

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build AllIssuesView component | `764ba11d` | AllIssuesView.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing Phase 2/3 source files and node_modules**
- **Found during:** Task 1 pre-execution
- **Issue:** Worktree branch `worktree-agent-afe2dfd9` was based on commit `41f325fe` (pre-Phase 2), missing `IssueListRow.tsx`, `useAllIssuesFilters.ts`, `AllIssuesView.test.tsx`, and all Phase 2/3 files. Also had no `node_modules`.
- **Fix:** Fast-forward merged `89b6b9dd` (chore/cleanup HEAD) into the worktree branch, then ran `npm install` in `apps/web`
- **Files modified:** Worktree branch HEAD (fast-forward merge, no conflict)

None beyond the blocking issue above — plan executed exactly as written once unblocked.

## Verification

- `grep -n "useQueries" AllIssuesView.tsx` → line 3 (import) + line 32 (usage) ✓
- `grep -n 'role="alert"' AllIssuesView.tsx` → line 137 ✓
- `grep -n "credentials.*include" AllIssuesView.tsx` → line 41 ✓
- `grep -n "issues.*all.*product.id" AllIssuesView.tsx` → line 36 (queryKey) ✓
- `cd apps/web && npm test -- --project=frontend` → 7 tests pass (3 IssueListRow + 4 AllIssuesView) ✓
- `cd apps/web && npx tsc --noEmit` → zero errors ✓

## Known Stubs

None — all plan artifacts are fully implemented.

## Threat Flags

None — no new network endpoints introduced. `AllIssuesView` reuses the existing `/api/github/repos/:owner/:repo/issues` proxy with `credentials: 'include'` session cookies. `role="alert"` on error banners is an accessibility addition with no security surface.

## Self-Check: PASSED

- `apps/web/src/client/components/AllIssuesView.tsx` — created, exports `AllIssuesView`, contains `useQueries` ✓
- Commit `764ba11d` — exists ✓
- 7 frontend tests pass ✓
- TypeScript: zero errors ✓
