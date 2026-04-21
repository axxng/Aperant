---
phase: "04"
plan: "01"
subsystem: "frontend-test-infrastructure"
tags: [vitest, testing, jsdom, tdd, wave-0]
dependency_graph:
  requires: []
  provides:
    - dual-vitest-project-config
    - jsdom-frontend-test-environment
    - failing-stubs-cross-01-02-03
  affects:
    - apps/web/vite.config.ts
    - apps/web/src/client/components/IssueListRow.test.tsx
    - apps/web/src/client/components/AllIssuesView.test.tsx
tech_stack:
  added:
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom@6.9.1"
    - "jsdom@29.0.2"
  patterns:
    - "Vitest projects config (test.projects) for dual node/jsdom environments"
    - "React Testing Library + jsdom for frontend component tests"
key_files:
  created:
    - apps/web/src/test-setup.ts
    - apps/web/src/client/components/IssueListRow.test.tsx
    - apps/web/src/client/components/AllIssuesView.test.tsx
  modified:
    - apps/web/vite.config.ts
    - apps/web/package.json
decisions:
  - "Used test.projects (Vitest 4 API) instead of test.workspace (removed in Vitest 4) — plan specified workspace but runtime rejected it"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 04 Plan 01: Frontend Test Infrastructure (Wave 0) Summary

## One-liner

Vitest dual-project config (api=node, frontend=jsdom) with failing Wave 0 stubs for CROSS-01/02/03 behaviors.

## What Was Built

Extended `apps/web/vite.config.ts` with `test.projects` to support two parallel Vitest environments:

1. **api project** — node environment, covers `api/**/*.test.ts` (32 existing tests, unchanged)
2. **frontend project** — jsdom environment, covers `src/**/*.test.tsx` and `src/**/*.test.ts` with `@testing-library/jest-dom` setup

Created two failing test stub files as Wave 0 RED gates for all Phase 4 behaviors:

- **IssueListRow.test.tsx** — 3 tests for CROSS-02 (productBadge prop: renders color dot + name; absent = nothing; truncate class)
- **AllIssuesView.test.tsx** — 4 tests for CROSS-01 (merged issues sorted by updatedAt desc) and CROSS-03 (error banner; dismiss hides banner; retry calls refetch)

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Vitest config with jsdom projects | `62951b12` | vite.config.ts, package.json, src/test-setup.ts, package-lock.json |
| 2 | Create failing test stubs | `c4d3c7d2` | IssueListRow.test.tsx, AllIssuesView.test.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used `test.projects` instead of `test.workspace`**
- **Found during:** Task 1 verification
- **Issue:** Plan specified `test.workspace` but Vitest 4 removed this option — runtime error: "The `test.workspace` option was removed in Vitest 4. Please, migrate to `test.projects` instead."
- **Fix:** Changed config key from `workspace` to `projects` — the inner structure is identical; only the top-level key changed
- **Files modified:** `apps/web/vite.config.ts`
- **Commit:** `62951b12`

## Verification

- `cd apps/web && npm test -- --project=api` → 32 tests pass (no regressions)
- `cd apps/web && npm test -- --project=frontend` → fails with expected errors:
  - AllIssuesView: "Failed to resolve import './AllIssuesView'" (component not yet built)
  - IssueListRow: "Unable to find an element" (productBadge prop not implemented yet)
- Frontend test failures are implementation-absent failures, not config errors

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| AllIssuesView component | AllIssuesView.test.tsx imports non-existent component | Wave 0 RED state — component built in plan 04-02 |
| productBadge prop | IssueListRow.test.tsx passes prop not yet in interface | Wave 0 RED state — prop added in plan 04-02 |

## Threat Flags

None — test infrastructure only; no production network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `apps/web/vite.config.ts` — modified with projects config ✓
- `apps/web/src/test-setup.ts` — created ✓
- `apps/web/src/client/components/IssueListRow.test.tsx` — created ✓
- `apps/web/src/client/components/AllIssuesView.test.tsx` — created ✓
- Commit `62951b12` — exists ✓
- Commit `c4d3c7d2` — exists ✓
