---
phase: 02-single-repo-issues-browser
plan: "03"
subsystem: frontend-infrastructure
tags: [tanstack-query, react-router, i18n, react]

# Dependency graph
requires:
  - "02-01 (@tanstack/react-query installed)"
provides:
  - "QueryClientProvider wrapping AuthenticatedApp subtree"
  - "Route /products/:productId/issues registered in App.tsx"
  - "Stub IssuesView component satisfying import resolution"
  - "en/issues.json — English issues namespace (all UI-SPEC keys)"
  - "fr/issues.json — French issues namespace (all UI-SPEC keys)"
affects:
  - "02-04, 02-05, 02-06, 02-07 (all use QueryClientProvider + issues i18n keys)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "QueryClient declared at module scope (outside component) to avoid re-creation on render"
    - "QueryClientProvider as outermost provider wrapping TooltipProvider"
    - "i18n namespace issues with nested JSON keys matching UI-SPEC copywriting contract"

key-files:
  created:
    - "apps/web/src/client/components/IssuesView.tsx (stub — replaced in 02-07)"
    - "apps/web/src/shared/i18n/locales/en/issues.json"
    - "apps/web/src/shared/i18n/locales/fr/issues.json"
  modified:
    - "apps/web/src/client/App.tsx"

key-decisions:
  - "QueryClientProvider wraps TooltipProvider — QueryClientProvider is outermost to ensure all route components have cache access"
  - "queryClient at module scope with staleTime=2min, gcTime=5min, retry=1, refetchOnWindowFocus=false"
  - "IssuesView stub created to satisfy TypeScript import resolution before plan 02-07 implements full component"

# Metrics
duration: 5min
completed: 2026-04-21
---

# Phase 02 Plan 03: App Infrastructure Wiring Summary

**QueryClientProvider added to App.tsx, IssuesView route registered, and both en/fr issues i18n locale files created with all UI-SPEC copywriting contract keys**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-21T19:28:00Z
- **Completed:** 2026-04-21T19:33:00Z
- **Tasks:** 2
- **Files modified/created:** 4

## Accomplishments

- Added `QueryClient` at module scope and wrapped `AuthenticatedApp` return with `QueryClientProvider` — all Phase 2 route components can now use `useQuery`/`useInfiniteQuery`
- Added route `/products/:productId/issues` pointing to `IssuesView` inside the Routes block
- Created stub `IssuesView.tsx` component to satisfy TypeScript import resolution (full implementation in plan 02-07)
- Created `en/issues.json` and `fr/issues.json` with all 19 keys from the UI-SPEC copywriting contract including interpolation keys `#{{number}}` and `{{retryAfter}}`

## Task Commits

1. **Task 1: Add QueryClientProvider wrap and IssuesView route to App.tsx** — `3a825e41` (feat)
2. **Task 2: Create en/issues.json and fr/issues.json i18n locale files** — `aa68c3e0` (feat)

## Files Created/Modified

- `apps/web/src/client/App.tsx` — Added QueryClient, QueryClientProvider, IssuesView import, queryClient module-scope declaration, /products/:productId/issues route, QueryClientProvider wrap
- `apps/web/src/client/components/IssuesView.tsx` — Stub component (replaced in plan 02-07)
- `apps/web/src/shared/i18n/locales/en/issues.json` — Full English issues namespace
- `apps/web/src/shared/i18n/locales/fr/issues.json` — Full French issues namespace

## Decisions Made

- `QueryClientProvider` is the outermost provider (wraps `TooltipProvider`) so all route components have access to the query cache
- `queryClient` declared at module scope — avoids re-creation on render which would invalidate the entire cache
- Stub `IssuesView` created immediately rather than using a lazy import — simpler TypeScript resolution, full replacement in 02-07

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `IssuesView` stub component | `apps/web/src/client/components/IssuesView.tsx` | 2 | Import resolution placeholder; full implementation in plan 02-07 |

This stub is intentional and documented. It does not prevent the plan's goal (wiring infrastructure) from being achieved — the route is registered and the QueryClientProvider is in place.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. QueryClient is browser-side only. i18n files are static JSON loaded at app init.

## Self-Check: PASSED

- `apps/web/src/client/App.tsx` — FOUND (modified)
- `apps/web/src/client/components/IssuesView.tsx` — FOUND (created)
- `apps/web/src/shared/i18n/locales/en/issues.json` — FOUND (created)
- `apps/web/src/shared/i18n/locales/fr/issues.json` — FOUND (created)
- Commit `3a825e41` — FOUND
- Commit `aa68c3e0` — FOUND

---
*Phase: 02-single-repo-issues-browser*
*Completed: 2026-04-21*
