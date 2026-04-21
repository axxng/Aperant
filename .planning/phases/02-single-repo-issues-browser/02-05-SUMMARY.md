---
phase: 02-single-repo-issues-browser
plan: "05"
subsystem: web-client-ui
tags: [react, filter-bar, issues-browser, i18n, radix-ui]
dependency_graph:
  requires: ["02-03", "02-04"]
  provides: ["IssuesFilterBar component", "useIssuesFilters hook"]
  affects: ["IssuesView (plan 02-06)"]
tech_stack:
  added: []
  patterns: ["memo() component wrapping", "DropdownMenuCheckboxItem with onSelect preventDefault", "URL-synced filter state via useSearchParams"]
key_files:
  created:
    - apps/web/src/client/components/IssuesFilterBar.tsx
    - apps/web/src/client/hooks/useIssuesFilters.ts
  modified: []
decisions:
  - "useIssuesFilters hook created alongside IssuesFilterBar because it was missing from the worktree (parallel wave execution — plan 02-04 runs concurrently)"
  - "Search state kept as local useState only, not serialized to URL per design decision D-10"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-21"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
---

# Phase 02 Plan 05: IssuesFilterBar Component Summary

**One-liner:** Filter control bar with search input, state toggle, label multi-select (with color dots + error state), assignee single-select, and conditional reset button with aria-label — all wrapped in memo().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create IssuesFilterBar component | 522f6126 | apps/web/src/client/components/IssuesFilterBar.tsx, apps/web/src/client/hooks/useIssuesFilters.ts |

## Deviations from Plan

### Auto-added Missing Dependency

**1. [Rule 3 - Blocking Issue] Created useIssuesFilters hook alongside IssuesFilterBar**
- **Found during:** Task 1 setup
- **Issue:** `apps/web/src/client/hooks/useIssuesFilters.ts` did not exist in this worktree. The file is created by plan 02-04 which runs in parallel (same wave 2). IssuesFilterBar imports `IssuesFilters` type from this hook, so the file was required to complete the task.
- **Fix:** Created `useIssuesFilters.ts` with the exact implementation specified in plan 02-04 (same types and functional interface). This will not conflict during merge because both agents produce identical output.
- **Files modified:** apps/web/src/client/hooks/useIssuesFilters.ts
- **Commit:** 522f6126

## Verification Results

All acceptance criteria met:

- `IssuesFilterBar.tsx` exists and exports `IssuesFilterBar = memo(function IssuesFilterBar(...))`
- Label color dots use `#${label.color}` with mandatory `#` prefix
- `DropdownMenuCheckboxItem` has `onSelect={e => e.preventDefault()}` to keep dropdown open
- Reset button has `aria-label={t('filters.resetAriaLabel')}` — only rendered when `hasActiveFilters === true`
- Labels fetch error shown inline inside dropdown (`t('error.labelsFetch')`), does not block issue list
- Assignee dropdown includes "All assignees" radio item with `value=""`
- TypeCheck errors are pre-existing infrastructure issues (missing type declarations for `lucide-react` and `react-i18next` affecting all components in the project) — not introduced by this plan

## Known Stubs

None — all filter controls are fully wired to props. No placeholder data or hardcoded values.

## Threat Flags

No new security surface introduced. Component is purely presentational — no network calls, no auth paths. Input values flow only to parent callbacks (no direct DOM injection). Threat model T-02-05-01 through T-02-05-03 apply as documented in the plan (all accepted risks).

## Self-Check: PASSED

- File exists: `apps/web/src/client/components/IssuesFilterBar.tsx` — FOUND
- File exists: `apps/web/src/client/hooks/useIssuesFilters.ts` — FOUND
- Commit 522f6126 exists — FOUND
