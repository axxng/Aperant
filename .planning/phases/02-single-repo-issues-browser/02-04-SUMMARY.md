---
phase: 02-single-repo-issues-browser
plan: "04"
subsystem: web-client
tags: [hooks, components, url-state, filters, issues-browser]
dependency_graph:
  requires: [02-03]
  provides: [useIssuesFilters, IssueListRow, IssueSkeletonRow]
  affects: [IssuesView, IssuesFilterBar]
tech_stack:
  added: []
  patterns: [url-synced-state, functional-updater-pattern, memo-components]
key_files:
  created:
    - apps/web/src/client/hooks/useIssuesFilters.ts
    - apps/web/src/client/components/IssueListRow.tsx
    - apps/web/src/client/components/IssueSkeletonRow.tsx
  modified: []
decisions:
  - "search is local useState only — not serialized to URL per D-10 decision"
  - "Always use functional updater form setSearchParams(prev => ...) to avoid clobbering unrelated URL params"
  - "Label color prefix (#) is mandatory since GitHub API returns hex without hash"
metrics:
  duration: ~10min
  completed: 2026-04-21
---

# Phase 02 Plan 04: Filter Hook and List Row Components Summary

URL-synced filter hook (`useIssuesFilters`) and two pure display components (`IssueListRow`, `IssueSkeletonRow`) for the issues browser core UI.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useIssuesFilters hook | 4b24ab45 | apps/web/src/client/hooks/useIssuesFilters.ts |
| 2 | Create IssueListRow and IssueSkeletonRow components | 984c5e40 | apps/web/src/client/components/IssueListRow.tsx, apps/web/src/client/components/IssueSkeletonRow.tsx |

## What Was Built

### useIssuesFilters (4b24ab45)

Central filter state management hook for the issues browser:
- Reads `state`, `labels` (multi-value via `getAll`), and `assignee` from URL search params
- `search` is local `useState` only — not serialized to URL
- All URL mutations use the functional updater form `setSearchParams(prev => ...)` to avoid clobbering other params
- `hasActiveFilters` treats `open` as the default baseline (not just non-empty check)
- Exports: `useIssuesFilters`, `IssuesFilters`, `IssueState`

### IssueListRow (984c5e40)

Dense list row component for rendering individual GitHub issues:
- `h-11` (44px) height — minimum touch target per UI-SPEC
- Label color dots: `style={{ backgroundColor: '#${label.color}' }}` — `#` prefix is mandatory since GitHub API omits it
- Assignee avatars: camelCase `avatarUrl` from mapped type; falls back to 2-char initials
- State badge: `success` variant for open, `muted` for closed (matches badge.tsx variants)
- i18n keys: `issues:list.issueNumber`, `issues:state.{open|closed}` — all pre-existing in en/fr JSON
- Wrapped in `memo()` for render optimization

### IssueSkeletonRow (984c5e40)

Single animate-pulse placeholder row:
- Matches `h-11` height of `IssueListRow` for layout stability during loading
- `IssuesView` renders 8 of these in parallel during data fetch

## Deviations from Plan

None — plan executed exactly as written.

Note: `npm run typecheck` reports pre-existing errors for `react-i18next` and `lucide-react` not being installed in the worktree's `node_modules`. These errors exist in all pre-existing files using those packages (e.g., `CreateProductDialog.tsx`, `KanbanBoard.tsx`). No new errors were introduced by this plan. Similarly, `npm test` fails due to missing `@vitejs/plugin-react` in the worktree — a pre-existing infrastructure issue unrelated to this plan's changes.

## Known Stubs

None.

## Self-Check

- [x] `apps/web/src/client/hooks/useIssuesFilters.ts` exists
- [x] `apps/web/src/client/components/IssueListRow.tsx` exists
- [x] `apps/web/src/client/components/IssueSkeletonRow.tsx` exists
- [x] Commits 4b24ab45 and 984c5e40 exist in git log
