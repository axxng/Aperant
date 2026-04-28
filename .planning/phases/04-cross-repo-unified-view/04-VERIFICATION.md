---
phase: 04-cross-repo-unified-view
verified: 2026-04-21T23:16:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /issues in the running app and verify all connected repos' issues appear in a single merged list sorted by most-recently-updated first"
    expected: "Issues from all connected product repos appear in one list, newest first. URL shows /issues."
    why_human: "Requires a running dev server with real GitHub credentials and connected products; cannot verify data aggregation programmatically without live GitHub tokens"
  - test: "Inspect each issue row in the unified list for product color badge"
    expected: "A small colored dot and product name label appear at the right side of each issue row. The dot color matches the product color shown in the sidebar."
    why_human: "Visual verification of color accuracy and badge positioning requires rendering in a browser"
  - test: "Block one repo's issues endpoint in DevTools and navigate to /issues"
    expected: "A red/warning alert banner appears for the blocked repo. Other repos' issues still load below the banner. Retry button retries only that repo. Dismiss (x) hides the banner."
    why_human: "Partial failure behavior requires browser DevTools network blocking to simulate a real API failure; cannot mock in automated tests without a running server"
  - test: "Verify sidebar collapsed/expanded behavior for All Issues NavLink"
    expected: "Expanded: Inbox icon + 'All Issues' label. Collapsed: Inbox icon only, no label. Active state highlights when on /issues."
    why_human: "Visual sidebar collapse/expand behavior requires browser rendering"
---

# Phase 4: Cross-Repo Unified View Verification Report

**Phase Goal:** Users can see all GitHub issues from every connected product repo in a single list, with clear origin labelling and graceful partial failure
**Verified:** 2026-04-21T23:16:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can navigate to /issues via the sidebar "All Issues" link | ✓ VERIFIED | `Sidebar.tsx` line 71: `to="/issues"` NavLink with `Inbox` icon; `App.tsx` line 108: `path="/issues"` route mapped to `AllIssuesView` |
| 2 | AllIssuesView fires one useQueries query per product that has a repo source | ✓ VERIFIED | `AllIssuesView.tsx` lines 32-56: `useQueries({ queries: productsWithRepo.map(...) })` with `queryKey: ['issues', 'all', product.id, state]` |
| 3 | Issues from all successful queries are merged and sorted by updatedAt desc | ✓ VERIFIED | `AllIssuesView.tsx` lines 60-73: `useMemo` merges `query.data.issues` from all queries, sorts by `new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()` |
| 4 | Each issue displays a product color badge (dot + name) | ✓ VERIFIED | `IssueListRow.tsx` lines 97-108: conditional `productBadge` render with `aria-hidden="true"` dot + `truncate max-w-[80px]` name span; `AllIssuesView.tsx` line 203: `productBadge={{ color: issue.product.color, name: issue.product.name }}` |
| 5 | Failed queries show dismissible per-repo error banners with Retry while successful repos still display | ✓ VERIFIED | `AllIssuesView.tsx` lines 127-176: `role="alert"` banners for `isError` queries; `setDismissedRepos` on dismiss; `query.refetch()` on retry; successful queries' issues render unconditionally in `filteredIssues` list |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/vite.config.ts` | Dual test environment: node (api/) + jsdom (src/client/) | ✓ VERIFIED | Lines 26/43: `test.projects` with `api` (node) and `frontend` (jsdom) environments |
| `apps/web/src/test-setup.ts` | Global jest-dom setup | ✓ VERIFIED | Imports `@testing-library/jest-dom` |
| `apps/web/src/client/components/IssueListRow.test.tsx` | 3 tests covering CROSS-02 | ✓ VERIFIED | Exists; 3 tests pass |
| `apps/web/src/client/components/AllIssuesView.test.tsx` | 4 tests covering CROSS-01, CROSS-03 | ✓ VERIFIED | Exists; 4 tests pass |
| `apps/web/src/client/components/IssueListRow.tsx` | Extended with optional `productBadge` prop | ✓ VERIFIED | Lines 8-11: `ProductBadgeInfo` interface; line 17: `productBadge?: ProductBadgeInfo` in props |
| `apps/web/src/client/hooks/useAllIssuesFilters.ts` | Exports `useAllIssuesFilters` and `IssueState` | ✓ VERIFIED | Exists; exports both; URL-persisted state filter + client-side search |
| `apps/web/src/shared/i18n/locales/en/issues.json` | Contains `allIssues.*` keys | ✓ VERIFIED | Line 43: `"allIssues"` block with all required keys |
| `apps/web/src/shared/i18n/locales/fr/issues.json` | Contains `allIssues.*` keys (French) | ✓ VERIFIED | Line 43: `"allIssues"` block with French translations |
| `apps/web/src/shared/i18n/locales/en/navigation.json` | Contains `items.allIssues` key | ✓ VERIFIED | Line 4: `"allIssues": "All Issues"` inside `items` |
| `apps/web/src/shared/i18n/locales/fr/navigation.json` | Contains `items.allIssues` key (French) | ✓ VERIFIED | Line 4: `"allIssues": "Toutes les issues"` inside `items` |
| `apps/web/src/client/components/AllIssuesView.tsx` | Cross-repo unified issues view | ✓ VERIFIED | 219 lines; exports `AllIssuesView`; substantive implementation |
| `apps/web/src/client/App.tsx` | Route `/issues` mapped to `AllIssuesView` | ✓ VERIFIED | Line 108: `path="/issues"`; line 109: `element={<AllIssuesView />}` |
| `apps/web/src/client/components/Sidebar.tsx` | All Issues NavLink with Inbox icon | ✓ VERIFIED | Line 71: `to="/issues"`; line 79: `<Inbox className="h-4 w-4 shrink-0" />`; line 80: `!isCollapsed` guard |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Sidebar.tsx` | `App.tsx /issues route` | `NavLink to="/issues"` | ✓ WIRED | Sidebar line 71 NavLink; App.tsx line 108 Route |
| `App.tsx` | `AllIssuesView.tsx` | `<Route path='/issues'>` | ✓ WIRED | App.tsx line 15 import + line 109 element |
| `AllIssuesView.tsx` | `/api/github/repos/:owner/:repo/issues` | `fetch in queryFn with credentials: include` | ✓ WIRED | Lines 39-41: `fetch(/api/github/repos/${owner}/${repo}/issues?${params}, { credentials: 'include' })` |
| `AllIssuesView.tsx` | `IssueListRow.tsx` | `productBadge prop` | ✓ WIRED | Line 203: `productBadge={{ color: issue.product.color, name: issue.product.name }}` |
| `AllIssuesView.tsx` | `useAllIssuesFilters.ts` | `useAllIssuesFilters hook` | ✓ WIRED | Line 6 import + line 19 destructure |
| `AllIssuesView.tsx` | `product-store.ts` | `useProductStore` | ✓ WIRED | Line 5 import + line 18: `const { products } = useProductStore()` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AllIssuesView.tsx` | `issueQueries` | `useQueries` → `fetch /api/github/repos/:owner/:repo/issues` | Yes — live GitHub API via authenticated proxy | ✓ FLOWING |
| `AllIssuesView.tsx` | `allIssues` | `useMemo` merging `issueQueries[i].data.issues` | Yes — derived from real query results | ✓ FLOWING |
| `AllIssuesView.tsx` | `products` | `useProductStore()` | Yes — loaded from DB in `AuthenticatedApp` via `loadProducts()` | ✓ FLOWING |
| `IssueListRow.tsx` | `productBadge` | Passed from `AllIssuesView` `issue.product.color/name` | Yes — from real product store + query results | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 39 tests pass (api + frontend) | `cd apps/web && npm test` | 8 test files, 39 tests passed | ✓ PASS |
| CROSS-02 tests (productBadge) | Included in full suite | 3 IssueListRow tests pass | ✓ PASS |
| CROSS-01/03 tests (AllIssuesView) | Included in full suite | 4 AllIssuesView tests pass | ✓ PASS |
| TypeScript compiles with zero errors | `cd apps/web && npx tsc --noEmit` | Confirmed in 04-04-SUMMARY | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CROSS-01 | 04-01, 04-03, 04-04 | User can view all GitHub issues from every connected product repo in a single unified list | ✓ SATISFIED | `AllIssuesView.tsx` uses `useQueries` fan-out per product; merges and renders as one sorted list; route `/issues` accessible from sidebar |
| CROSS-02 | 04-01, 04-02, 04-03, 04-04 | Each issue in the unified list shows a product color badge indicating which repo it belongs to | ✓ SATISFIED | `IssueListRow.tsx` renders color dot + product name when `productBadge` prop provided; `AllIssuesView.tsx` passes badge to every row |
| CROSS-03 | 04-01, 04-03, 04-04 | When one repo's GitHub request fails, other repos' issues still display with a per-repo error indicator | ✓ SATISFIED | `AllIssuesView.tsx` renders `role="alert"` banners for `isError` queries; successful queries render independently; dismiss and retry per-banner |

**Note on REQUIREMENTS.md traceability table:** The table at lines 115-117 maps CROSS-01/02/03 to "Phase 3" but the ROADMAP.md and all planning artifacts correctly map them to Phase 4. This is a stale traceability table entry (Phase 3 was renumbered to GitHub OAuth after the requirements doc was written). The implementation is in Phase 4 as intended by the ROADMAP.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AllIssuesView.tsx` | 131 | `return null` | ℹ️ Info | Inside `.map()` for dismissed banners — legitimate conditional render, not a stub |
| `AllIssuesView.tsx` | 115 | `placeholder=` attribute | ℹ️ Info | HTML input `placeholder` attribute for search field — not a stub indicator |

No blockers or warnings found.

### Human Verification Required

#### 1. Cross-Repo Issue Aggregation (CROSS-01)

**Test:** Start `cd apps/web && npm run dev`, navigate to `/issues` in the sidebar, confirm issues from all connected product repos appear
**Expected:** A single merged list sorted by most-recently-updated first. URL shows `/issues`. State toggle (Open/Closed) and keyword search work without page reloads.
**Why human:** Requires a running dev server with real GitHub OAuth credentials and at least 2 connected product repos. Cannot verify live API aggregation programmatically.

#### 2. Product Color Badges (CROSS-02)

**Test:** With the app running at `/issues`, inspect each issue row
**Expected:** Each row shows a small colored dot and product name at the right side. Dot color matches the product color displayed in the sidebar. Navigating to `/products/:id/issues` shows NO product badge (backward compat).
**Why human:** Visual color accuracy and badge positioning require browser rendering to confirm.

#### 3. Partial Failure Banners (CROSS-03)

**Test:** In browser DevTools Network tab, block one repo's issues endpoint URL, then navigate to `/issues`
**Expected:** A red/warning alert banner appears at the top for the blocked repo. Other repos' issues still load below. "Retry load" retries only that repo. "×" dismisses the banner (issues remain visible).
**Why human:** Requires browser DevTools network blocking to simulate API failure. Cannot replicate with automated tests against a running server.

#### 4. Sidebar Collapse Behavior

**Test:** With the sidebar collapsed and expanded, check the All Issues NavLink
**Expected:** Expanded: Inbox icon + "All Issues" label. Collapsed: Inbox icon only. Active state highlights when on `/issues`.
**Why human:** Visual sidebar collapse/expand requires browser rendering.

### Gaps Summary

No automated gaps found. All 5 must-have truths verified, all 13 artifacts present and substantive, all 6 key links wired, data flows through real API calls. The 4 human verification items require a running application with real GitHub credentials.

---

_Verified: 2026-04-21T23:16:00Z_
_Verifier: Claude (gsd-verifier)_
