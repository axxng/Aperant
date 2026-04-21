---
phase: "04"
plan: "04"
subsystem: "frontend-routing-navigation"
tags: [react-router, sidebar, navlink, route, i18n, lucide-react]
dependency_graph:
  requires:
    - "04-03: AllIssuesView component (AllIssuesView.tsx)"
    - "04-02: allIssues i18n key in navigation.json"
  provides:
    - /issues-route-mapped-to-AllIssuesView
    - All-Issues-sidebar-NavLink-CROSS-01
  affects:
    - apps/web/src/client/App.tsx
    - apps/web/src/client/components/Sidebar.tsx
tech_stack:
  added: []
  patterns:
    - "NavLink isActive callback for active route highlighting — identical pattern to All Products NavLink"
    - "!isCollapsed guard on label span — consistent collapsed sidebar pattern"
    - "Route inserted inside AuthenticatedApp Routes block — behind auth guard (T-04-04-01)"
key_files:
  created: []
  modified:
    - apps/web/src/client/App.tsx
    - apps/web/src/client/components/Sidebar.tsx
decisions:
  - "Route placed after /products/:productId/issues and before /products/:productId/settings — preserves existing route order and avoids ambiguity"
  - "NavLink positioned between All Products NavLink and ScrollArea opening tag — satisfies D-01 placement requirement"
  - "Inbox icon (not GitBranch, not List) — mandated by D-02 and PATTERNS.md Pattern 5"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 2
---

# Phase 04 Plan 04: Route and Sidebar Wiring Summary

## One-liner

Surgical two-file wiring: `/issues` route added to `App.tsx` inside `AuthenticatedApp` and "All Issues" `NavLink` with `Inbox` icon inserted in `Sidebar.tsx` between "All Products" and the product `ScrollArea`.

## What Was Built

**`apps/web/src/client/App.tsx`:**
- Added `import { AllIssuesView } from './components/AllIssuesView'` alongside the existing `IssuesView` import
- Added `<Route path="/issues" element={<AllIssuesView />} />` inside `AuthenticatedApp`'s `<Routes>` block, after the Phase 2 per-product issues route and before `/products/:productId/settings`
- The route lives inside `AuthenticatedApp` which is only rendered when `token && user` — unauthenticated users see `LoginPage` (satisfies T-04-04-01)

**`apps/web/src/client/components/Sidebar.tsx`:**
- Added `Inbox` to the lucide-react import line
- Inserted `<NavLink to="/issues">` with `Inbox` icon and `t('navigation:items.allIssues')` i18n label between the "All Products" NavLink and the `<ScrollArea>` opening tag
- Active state: `bg-accent text-accent-foreground font-medium` — identical to All Products NavLink
- Hover: `hover:bg-accent/50` — identical to All Products NavLink
- Collapsed behaviour: `{!isCollapsed && <span>...</span>}` — icon-only when collapsed

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add /issues route to App.tsx and All Issues NavLink to Sidebar.tsx | `a149dd88` | App.tsx, Sidebar.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -n 'path="/issues"' App.tsx` → line 108 ✓
- `grep -n "AllIssuesView" App.tsx` → lines 15 (import) + 109 (route element) ✓
- `grep -n "Inbox" Sidebar.tsx` → lines 6 (import) + 69 (comment) + 79 (icon usage) ✓
- `grep -n "allIssues" Sidebar.tsx` → line 80 (i18n key) ✓
- `cd apps/web && npm test` → 39 tests pass (8 test files) ✓
- `cd apps/web && npx tsc --noEmit` → zero errors ✓

## Known Stubs

None — both files are fully wired. `AllIssuesView` was built in Plan 03 with full data fetching, product badges, and error banners.

## Threat Flags

None — no new network endpoints. The `/issues` route is inside `AuthenticatedApp`, which is already behind the `!token || !user` auth guard at App.tsx lines 60-64. T-04-04-01 is satisfied.

## Self-Check: PASSED

- `apps/web/src/client/App.tsx` — modified, contains `AllIssuesView` import and `/issues` route ✓
- `apps/web/src/client/components/Sidebar.tsx` — modified, contains `Inbox` import and `allIssues` NavLink ✓
- Commit `a149dd88` — exists ✓
- 39 tests pass ✓
- TypeScript: zero errors ✓
