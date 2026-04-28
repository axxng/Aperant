---
phase: "04"
plan: "02"
subsystem: "frontend-components-hooks-i18n"
tags: [react, tdd, productBadge, i18n, hooks, zustand, cross-repo]
dependency_graph:
  requires:
    - "04-01: dual-vitest-project-config + failing Wave 0 stubs"
  provides:
    - extended-IssueListRow-with-productBadge
    - useAllIssuesFilters-hook
    - allIssues-i18n-keys-en-fr
    - navigation-allIssues-i18n-key-en-fr
  affects:
    - apps/web/src/client/components/IssueListRow.tsx
    - apps/web/src/client/hooks/useAllIssuesFilters.ts
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
    - apps/web/src/shared/i18n/locales/en/navigation.json
    - apps/web/src/shared/i18n/locales/fr/navigation.json
tech_stack:
  added: []
  patterns:
    - "Optional prop extension pattern — additive interface change, existing callers unaffected"
    - "URL-persisted filter state via functional setSearchParams updater (avoids param clobbering)"
    - "Inline backgroundColor style for product color dots (not CSS variable)"
    - "i18n allIssues.* namespace added to issues.json and navigation.json"
key_files:
  created:
    - apps/web/src/client/hooks/useAllIssuesFilters.ts
  modified:
    - apps/web/src/client/components/IssueListRow.tsx
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
    - apps/web/src/shared/i18n/locales/en/navigation.json
    - apps/web/src/shared/i18n/locales/fr/navigation.json
decisions:
  - "productBadge uses inline style={{ backgroundColor }} not CSS variable — color is arbitrary hex from product store"
  - "search state is client-side only (not URL-persisted) per D-09 decision; state filter is URL-persisted per D-08"
  - "Dot aria-hidden=true; name span provides accessible text — no tooltip added per UI-SPEC"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 5
---

# Phase 04 Plan 02: IssueListRow Extension + useAllIssuesFilters Hook Summary

## One-liner

Extended IssueListRow with optional productBadge prop (color dot + truncated name), created useAllIssuesFilters hook with URL-persisted state filter, and added all allIssues.* i18n keys to en/fr files.

## What Was Built

### Task 1: IssueListRow productBadge prop (CROSS-02) — TDD GREEN

Turned the Wave 0 RED test stubs green by adding the `productBadge?` prop to `IssueListRow.tsx`:

- Added `ProductBadgeInfo` interface (`{ color: string; name: string }`)
- Extended `IssueListRowProps` with `productBadge?: ProductBadgeInfo`
- Renders after the state badge: colored dot (`h-2 w-2 rounded-full`, `aria-hidden="true"`, inline `backgroundColor`) + name span (`text-[11px] text-muted-foreground truncate max-w-[80px]`)
- All existing callers (`IssuesView.tsx`) pass no `productBadge` — behavior unchanged

### Task 2: useAllIssuesFilters hook + i18n keys

Created `useAllIssuesFilters.ts` as a simplified variant of `useIssuesFilters.ts`:
- `state` — read from `?state=` URL param (D-08), defaults to `'open'`
- `search` — client-side local state only (D-09)
- `setStateFilter(newState)` — functional updater to avoid clobbering unrelated URL params
- `resetFilters()` — clears search state + deletes `?state=` from URL
- `hasActiveFilters` — true when state !== 'open' or search !== ''

Added i18n keys:
- `en/issues.json` and `fr/issues.json` — `allIssues.*` block with heading, searchPlaceholder, empty (openHeading, closedHeading, body), error (heading, body, rateLimit, rateLimitUnknown, retry, dismiss), productBadge.tooltip
- `en/navigation.json` and `fr/navigation.json` — `items.allIssues` key

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend IssueListRow with optional productBadge prop | `024d7a71` | IssueListRow.tsx |
| 2 | Create useAllIssuesFilters hook + add i18n keys | `8d29228b` | useAllIssuesFilters.ts, en/issues.json, fr/issues.json, en/navigation.json, fr/navigation.json |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing node_modules and Phase 2/3 source files**
- **Found during:** Task 1 verification
- **Issue:** Worktree branch `worktree-agent-a07e81d5` was based on commit `41f325fe` (pre-Phase 2), missing `IssueListRow.tsx`, `useIssuesFilters.ts`, and all Phase 2/3 files. Also had no `node_modules` so tests couldn't run.
- **Fix:** Fast-forward merged `c4517a8d` (chore/cleanup HEAD) into the worktree branch, then ran `npm install` in `apps/web`
- **Files modified:** Worktree branch HEAD (fast-forward merge, no conflict)
- **Commit:** Fast-forward (no separate merge commit created)

None beyond the blocking issue above — plan executed exactly as written once unblocked.

## Verification

- `grep "productBadge" apps/web/src/client/components/IssueListRow.tsx` → `productBadge?: ProductBadgeInfo` ✓
- `grep "allIssues" apps/web/src/shared/i18n/locales/en/issues.json` → allIssues block present ✓
- `grep "allIssues" apps/web/src/shared/i18n/locales/en/navigation.json` → `"allIssues": "All Issues"` ✓
- `apps/web/src/client/hooks/useAllIssuesFilters.ts` exists and exports `useAllIssuesFilters` and `IssueState` ✓
- `cd apps/web && npm test -- --project=frontend` → IssueListRow.test.tsx: 3 pass ✓ (AllIssuesView.test.tsx fails as expected Wave 0 RED — component not yet built)
- `cd apps/web && npm test -- --project=api` → 32 API tests pass, no regressions ✓

## Known Stubs

None — all plan artifacts are fully implemented. `AllIssuesView.test.tsx` remains failing as expected Wave 0 RED state (the component is built in Plan 03).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. CSS `backgroundColor` from product color is not an XSS vector.

## Self-Check: PASSED

- `apps/web/src/client/components/IssueListRow.tsx` — modified, contains `productBadge?: ProductBadgeInfo` ✓
- `apps/web/src/client/hooks/useAllIssuesFilters.ts` — created, exports `useAllIssuesFilters` and `IssueState` ✓
- `apps/web/src/shared/i18n/locales/en/issues.json` — contains `allIssues` block ✓
- `apps/web/src/shared/i18n/locales/fr/issues.json` — contains `allIssues` block ✓
- `apps/web/src/shared/i18n/locales/en/navigation.json` — contains `"allIssues": "All Issues"` ✓
- `apps/web/src/shared/i18n/locales/fr/navigation.json` — contains `"allIssues": "Toutes les issues"` ✓
- Commit `024d7a71` — exists ✓
- Commit `8d29228b` — exists ✓
