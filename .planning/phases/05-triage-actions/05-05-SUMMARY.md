---
phase: 05-triage-actions
plan: "05"
subsystem: web-ui
tags: [bug-fix, triage, keyboard-navigation, mock-services, i18n]
dependency_graph:
  requires: [05-04]
  provides: [gap-1-close-button, gap-1-escape-handler, gap-2-jk-direction, gap-3-mock-state-filter, gap-4-stale-closure-fix]
  affects: [IssueDetailPanel, IssuesView, AllIssuesView, github-fixtures]
tech_stack:
  added: []
  patterns: [tanstack-query-variables-pattern, keyboard-event-escape-handler, mock-query-param-filter]
key_files:
  created: []
  modified:
    - apps/web/src/client/components/IssueDetailPanel.tsx
    - apps/web/src/client/components/IssuesView.tsx
    - apps/web/src/client/components/AllIssuesView.tsx
    - apps/web/src/client/components/IssuesView.test.tsx
    - apps/web/src/client/components/IssueDetailPanel.test.tsx
    - apps/web/scripts/mocks/github-fixtures.ts
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
decisions:
  - "Gap 4: mutationFn variables pattern (pass owner/repo/number as vars) eliminates stale closure bug during j/k navigation"
  - "Gap 2: j=previous/up (currentIndex-1), k=next/down (currentIndex+1) matches user vim mental model"
  - "Gap 3: filter applied after .map() in mock handler — no changes to fixture generator needed"
  - "Gap 1 close: onClose prop is optional on IssueDetailPanel — backward compatible; button only renders when provided"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-22T11:46:44Z"
  tasks_completed: 3
  files_modified: 8
---

# Phase 05 Plan 05: UAT Gap Closure Summary

## One-liner

Closed all 4 UAT gaps: X close button + Escape handler, j/k direction swap (j=prev, k=next), mock state filter for Closed/Open, and stale closure elimination via TanStack Query variables pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Gap 4 stale closure + Gap 1 close button in IssueDetailPanel | 26855cc9 | IssueDetailPanel.tsx, en/issues.json, fr/issues.json |
| 2 | Gap 1 Escape handler + Gap 2 j/k direction swap | 938503fa | IssuesView.tsx, AllIssuesView.tsx, IssuesView.test.tsx |
| 3 | Gap 3 mock issues handler filters by state | 542075ad | github-fixtures.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] IssueDetailPanel.test.tsx assertions used old mutation signature**
- **Found during:** Post-task full test suite run (after Task 1)
- **Issue:** 3 existing tests asserted `mutate({ isTriaged: true })`, `mutate({ priority: 'high' })`, `mutate({ priority: null })` — the old closure-based signature. After the Gap 4 fix, the new signature requires `owner`, `repo`, `number` in every mutate call.
- **Fix:** Updated 3 test descriptions and assertions to include `owner: 'org', repo: 'repo', number: 42` matching the `baseIssue` fixture.
- **Files modified:** `apps/web/src/client/components/IssueDetailPanel.test.tsx`
- **Commit:** 1f9fd2ad

## Gap Closure Summary

### Gap 1: No way to close the detail panel
- **IssueDetailPanel:** Added `onClose?: () => void` prop; X button (lucide-react `<X>`) renders in header when prop provided; `aria-label={t('detail.closePanel')}` uses new i18n key.
- **IssuesView + AllIssuesView:** Escape key handler calls `setSelectedIssueId(null)` when panel is open; `onClose={() => setSelectedIssueId(null)}` passed to IssueDetailPanel.
- **i18n:** `detail.closePanel` key added to both `en/issues.json` ("Close panel") and `fr/issues.json` ("Fermer le panneau").

### Gap 2: j/k direction reversed vs user expectation
- **Both views:** `j` now maps to `currentIndex - 1` (previous/up in list); `k` now maps to `currentIndex + 1` (next/down in list). Boundary guards preserved.
- **IssuesView.test.tsx:** All 4 direction tests updated with correct assertions; 1 new Escape close test added. Total: 7 passing tests.

### Gap 3: Closed filter does nothing in mock dev env
- **github-fixtures.ts:** GET handler now reads `req.query.state` and filters fixtures before mapping. `state=open` returns 15 open issues; `state=closed` returns 5 closed issues; no state param returns all 20 (no regression). No changes to `buildIssueFixtures()`.

### Gap 4: Priority mutations target wrong issue during j/k navigation
- **IssueDetailPanel.tsx:** `mutationFn` now receives `vars: { isTriaged?, priority?, owner, repo, number }` — no closure capture. All three `onMutate`/`onError`/`onSettled` callbacks use `vars.owner`/`vars.repo`/`vars.number`. All three `triageMutation.mutate()` call sites pass `owner`, `repo`, `number: issue!.number` explicitly.

## Test Results

```
Test Files: 15 passed (15)
Tests:      98 passed | 3 todo (101)
Duration:   688ms
```

Zero regressions. All pre-existing tests pass. New Escape test added (IssuesView.test.tsx).

## Self-Check: PASSED

- IssueDetailPanel.tsx: onClose prop present, X button renders conditionally, mutation uses variables pattern
- IssuesView.tsx: Escape handler present, j/k direction swapped, onClose prop passed
- AllIssuesView.tsx: Escape handler present, j/k direction swapped, onClose prop passed
- github-fixtures.ts: req.query.state filter applied
- en/issues.json + fr/issues.json: detail.closePanel key present
- Commits verified: 26855cc9, 938503fa, 542075ad, 1f9fd2ad all exist in git log
