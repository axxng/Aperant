---
phase: "07"
plan: "03"
subsystem: "web/src/client/components + web/shared/i18n"
tags: ["tdd", "green-phase", "promote-to-backlog", "frontend", "i18n"]
dependency_graph:
  requires:
    - "07-01 RED test stubs for IssueDetailPanel PROMOTE-01/03/04/05"
    - "07-02 backend GET /api/tasks/by-github-issue + POST /api/tasks 409 guard"
  provides:
    - "Full Promote to Backlog feature in IssueDetailPanel (GREEN)"
    - "triagePriorityToTaskPriority exported pure function"
    - "productId prop on IssueDetailPanel + propagated from IssuesView and AllIssuesView"
    - "7 promote i18n keys in en/issues.json and fr/issues.json"
  affects:
    - "apps/web/src/client/components/IssueDetailPanel.tsx"
    - "apps/web/src/client/components/IssueDetailPanel.test.tsx"
    - "apps/web/src/client/components/IssuesView.tsx"
    - "apps/web/src/client/components/AllIssuesView.tsx"
    - "apps/web/src/shared/i18n/locales/en/issues.json"
    - "apps/web/src/shared/i18n/locales/fr/issues.json"
tech_stack:
  added: []
  patterns:
    - "Pure domain logic export (triagePriorityToTaskPriority) before component definition"
    - "useQuery for existing task detection with task-by-github-issue key"
    - "useMutation for promote with 409 alreadyExists handling"
    - "Conditional render: promote button vs View in Backlog badge"
    - "callCount % 3 useMutation mock pattern for 3-mutation component tests"
key_files:
  created: []
  modified:
    - apps/web/src/client/components/IssueDetailPanel.tsx
    - apps/web/src/client/components/IssueDetailPanel.test.tsx
    - apps/web/src/client/components/IssuesView.tsx
    - apps/web/src/client/components/AllIssuesView.tsx
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
decisions:
  - "Badge does not support asChild (no Radix Slot) — rendered anchor inside Badge div instead"
  - "AllIssuesView passes selectedIssue?.product.id ?? '' as productId (issues always have product attached)"
  - "Fixed pre-existing test fixture body: null → undefined to satisfy GitHubIssue type (body: string | undefined)"
  - "setupNoteMocks updated from callCount % 2 to callCount % 3 now that promote mutation is 3rd hook"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  files_modified: 6
---

# Phase 07 Plan 03: Frontend GREEN — Promote to Backlog Summary

Wave 2 GREEN phase — implements the full Promote to Backlog feature in IssueDetailPanel, satisfying all PROMOTE-01/03/04/05 tests and adding i18n coverage in both en and fr locales.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add triagePriorityToTaskPriority + productId prop + existingTask query + promoteMutation + conditional render to IssueDetailPanel | a4196e9f | IssueDetailPanel.tsx, IssueDetailPanel.test.tsx |
| 2 | Update IssuesView + AllIssuesView to pass productId + add i18n keys to both locale files | 462a1c5f | IssuesView.tsx, AllIssuesView.tsx, en/issues.json, fr/issues.json |
| fix | TypeScript fixes — Badge asChild removal + test fixture body type | c28ad005 | IssueDetailPanel.tsx, IssueDetailPanel.test.tsx |

## GREEN Test State

All 139 tests pass (18 test files). Key PROMOTE tests now GREEN:

- PROMOTE-01: "renders Promote to Backlog button when no existing task" — PASS
- PROMOTE-01: "calls promoteMutation.mutate with correct fields on button click" — PASS
- PROMOTE-03: "renders View in Backlog badge when existingTask query returns a task" — PASS
- PROMOTE-03: "does not render promote button when existingTask exists" — PASS
- PROMOTE-04: "maps critical to urgent" — PASS
- PROMOTE-04: "passes high/medium/low through unchanged" — PASS
- PROMOTE-04: "maps null to undefined" — PASS
- PROMOTE-05: "shows duplicate toast when promote onSuccess fires with alreadyExists=true" — PASS
- PROMOTE-05: "shows success toast when promote onSuccess fires without alreadyExists" — PASS

All existing TRIAGE-01/02/03/06, NOTES-01/03, and close-button tests still PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Badge component does not support asChild prop**
- **Found during:** Task 1 typecheck
- **Issue:** Plan specified `<Badge variant="success" asChild>` but Badge is a plain div component without Radix Slot — `asChild` is not in BadgeProps and TypeScript errors
- **Fix:** Removed `asChild`; rendered anchor inside Badge div with `className="inline-flex items-center gap-1"` — visually equivalent
- **Files modified:** apps/web/src/client/components/IssueDetailPanel.tsx
- **Commit:** c28ad005

**2. [Rule 1 - Bug] Test fixture used body: null (invalid type)**
- **Found during:** Task 2 typecheck
- **Issue:** `baseIssue.body = null` but `GitHubIssue.body` is typed as `string | undefined` — TypeScript errors on PROMOTE test renders which added new `issue={baseIssue}` references
- **Fix:** Changed `body: null` to `body: undefined` in test fixture
- **Files modified:** apps/web/src/client/components/IssueDetailPanel.test.tsx
- **Commit:** c28ad005

**3. [Rule 2 - Missing critical] AllIssuesView also uses IssueDetailPanel but was missing productId**
- **Found during:** Task 2 typecheck
- **Issue:** After making productId a required prop, AllIssuesView had a TypeScript error — plan only mentioned IssuesView
- **Fix:** Added `productId={selectedIssue?.product.id ?? ''}` — safe because allIssues items always have `product` attached (typed as `GitHubIssue & { product: Product }`)
- **Files modified:** apps/web/src/client/components/AllIssuesView.tsx
- **Commit:** 462a1c5f

**4. [Deferred item from 07-01] Updated setupNoteMocks from callCount % 2 to callCount % 3**
- **Found during:** Task 1 implementation
- **Issue:** Plan 07-01 SUMMARY documented this as a deferred item: update % 2 to % 3 when promote mutation is added
- **Fix:** Updated mock to route: slot 1=triageMutate, slot 2=noteMutate, slot 0 (3rd)=promoteMutate; captures promoteMutationOptionsRef for PROMOTE-05 tests
- **Files modified:** apps/web/src/client/components/IssueDetailPanel.test.tsx
- **Commit:** a4196e9f

## Pre-existing TypeScript Errors (Out of Scope)

Two pre-existing typecheck errors existed before this plan and were not introduced by our changes:
- `api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` — TokenPayload missing `exp` field
- `src/client/components/DevModeBanner.tsx` — `ImportMeta.env` property not found

These are logged to deferred items. They do not affect test execution (Vitest runs independently of tsc).

## Known Stubs

None — all promote functionality is fully wired. The "View in Backlog" badge links to `/products/${productId}` which is the real product Kanban page.

## Threat Flags

No new threat surface introduced. All mutation paths go through `authenticatedFetch` (authenticated cookie-based requests). Server-side validation at POST /api/tasks is handled by Plan 07-02 (Wave 1).

## Self-Check

| Item | Status |
|------|--------|
| apps/web/src/client/components/IssueDetailPanel.tsx | FOUND |
| apps/web/src/client/components/IssueDetailPanel.test.tsx | FOUND |
| apps/web/src/client/components/IssuesView.tsx | FOUND |
| apps/web/src/client/components/AllIssuesView.tsx | FOUND |
| apps/web/src/shared/i18n/locales/en/issues.json | FOUND |
| apps/web/src/shared/i18n/locales/fr/issues.json | FOUND |
| Commit a4196e9f | FOUND |
| Commit 462a1c5f | FOUND |
| Commit c28ad005 | FOUND |
| npm test: 139/139 passing | CONFIRMED |

## Self-Check: PASSED
