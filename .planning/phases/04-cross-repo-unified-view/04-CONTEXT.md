# Phase 4: Cross-Repo Unified View - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a top-level unified issues view that aggregates GitHub issues from all connected product repos into a single list. After this phase:
- A new "All Issues" sidebar link navigates to `/issues` showing issues from every connected product
- Each issue displays a product color badge identifying which repo it belongs to (CROSS-02)
- When one repo's fetch fails, a dismissible per-repo error banner appears while other repos' issues still load (CROSS-03)

No triage actions (Phase 5). No notes or comments (Phase 6). No promotion to backlog (Phase 7). Pure aggregated browse.

</domain>

<decisions>
## Implementation Decisions

### Navigation Entry Point
- **D-01:** The unified view lives at a new top-level route `/issues`, accessible via a new **"All Issues" sidebar link** positioned below "All Products" and above the product list. This mirrors the per-product Issues tab but at the global level.
- **D-02:** The Sidebar component needs a new NavLink entry for `/issues` (with an appropriate icon — e.g., `GitBranch` or `Inbox` from lucide-react, consistent with existing icons).
- **D-03:** A new `AllIssuesView` component (or `CrossRepoIssuesView`) is added to `App.tsx` as a `<Route path="/issues">`.

### Fan-out Strategy
- **D-04:** **Client-side parallel fetches** — the frontend fires one TanStack Query per product in parallel, reusing the existing per-product issues API endpoint (`/api/github/repos/:owner/:repo/issues`). No new server-side fan-out API endpoint needed.
- **D-05:** Each product's issues query runs independently using `useQueries()` (TanStack Query v5's parallel queries API) — one query per product that has a repo source. Failed queries don't block successful ones.
- **D-06:** Merged results are sorted by `updated_at` desc globally — most recently active issues appear first regardless of which repo they belong to.

### Filtering
- **D-07:** The unified view offers **state toggle (open/closed) + client-side keyword search** only. Label and assignee filters are omitted — labels are repo-specific and cross-repo label matching creates edge cases. Users who need label-filtered views use the per-product issues browser.
- **D-08:** Filter state (open/closed, search keyword) is preserved in the URL query params for shareability and back-button support (same pattern as Phase 2).
- **D-09:** Client-side title search filters across all loaded issues — same instant approach as Phase 2 (`D-10` there).

### Product Color Badges
- **D-10:** Each issue row in the unified list displays a **product color badge** — a small colored dot/pill using `product.color` (already in product-store). The `IssueListRow` component from Phase 2 should be extended or the unified view uses a wrapper/variant that adds the product badge.
- **D-11:** The badge shows the product name (truncated if needed) alongside the color dot — not just a color alone — so users know which repo each issue belongs to even if products share similar colors.

### Partial Failure (CROSS-03)
- **D-12:** When a repo's fetch fails, a **dismissible alert banner** appears at the top of the issues list for that repo: e.g., "⚠ Acme API — could not load issues [Retry] [×]". Multiple banners stack if multiple repos fail.
- **D-13:** The banner includes a **Retry button** that re-triggers the failed query for that repo specifically.
- **D-14:** The banner is **dismissible** (user can close it with ×). Other repos' successfully loaded issues remain visible below.
- **D-15:** Rate-limit errors (`GitHubRateLimitError`) in the banner should surface the retry-after time if available (e.g., "⚠ Acme API — rate limited, retry in 42s").

### Claude's Discretion
- Whether `useQueries()` or multiple `useQuery()` hooks are used for the per-product fetching — use whichever TanStack Query v5 pattern is cleanest for dynamic product count
- The exact icon for the "All Issues" sidebar link — pick one consistent with lucide-react icons already used
- Whether `IssueListRow` is extended via prop or a thin wrapper component adds the product badge — follow the simplest approach
- Loading state: show skeleton rows (same `IssueSkeletonRow` from Phase 2) while any queries are still loading; once all either resolve or error, show results + banners

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Issues UI (Phase 2)
- `apps/web/src/client/components/IssuesView.tsx` — single-repo issues view; `AllIssuesView` follows same structure, adapts for multi-repo
- `apps/web/src/client/components/IssueListRow.tsx` — reuse; needs product badge extension
- `apps/web/src/client/components/IssueDetailPanel.tsx` — reuse as-is
- `apps/web/src/client/components/IssueSkeletonRow.tsx` — reuse for loading states
- `apps/web/src/client/hooks/useIssuesFilters.ts` — reuse or adapt (drop label/assignee; keep state + search)

### Routing & Sidebar
- `apps/web/src/client/App.tsx` — add `<Route path="/issues" element={<AllIssuesView />} />` here
- `apps/web/src/client/components/Sidebar.tsx` — add "All Issues" NavLink below "All Products" entry

### Data Layer
- `apps/web/api/github/repos/[owner]/[repo]/issues.ts` — existing endpoint reused; no new API routes needed
- `apps/web/api/_lib/github.ts` — `GitHubRateLimitError` shape; surface `retryAfter` in error banner (D-15)

### Product Data
- `apps/web/src/client/stores/product-store.ts` — `products[].color` for badge (D-10); `products[].sources.find(s => s.type === 'repo')` for owner/repo

### i18n
- `apps/web/src/shared/i18n/locales/en/issues.json` — add cross-repo keys here (all-issues tab label, error banners, empty state)
- `apps/web/src/shared/i18n/locales/fr/issues.json` — same keys in French

### Requirements
- `.planning/REQUIREMENTS.md` — CROSS-01, CROSS-02, CROSS-03 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IssueListRow` (`components/IssueListRow.tsx`) — renders a single issue row; needs product color badge added (prop or wrapper)
- `IssueDetailPanel` (`components/IssueDetailPanel.tsx`) — slide-in panel; reuse as-is; works with any `GitHubIssue` object
- `IssueSkeletonRow` (`components/IssueSkeletonRow.tsx`) — animated skeleton; reuse for loading state
- `useIssuesFilters` hook — manages state/label/assignee/search filter state; adapt to drop label/assignee for unified view
- `useInfiniteQuery` pattern in `IssuesView.tsx` — switch to `useQueries()` for multi-repo fan-out

### Established Patterns
- TanStack Query v5: `useInfiniteQuery` per product; `useQueries()` for parallel queries with dynamic key count
- Product color: `product.color` is a hex string (e.g., `#e11d48`); used in sidebar dots and task cards — apply same pattern for issue product badges
- i18n: `issues` namespace already exists; add new keys under `allIssues.*` or `cross.*` prefix
- Error display: `AlertCircle` icon + `Button variant="outline"` for retry — same as single-repo error state

### Integration Points
- `App.tsx`: add `/issues` route inside `AuthenticatedApp`'s `<Routes>` (no new providers needed — `QueryClientProvider` already wraps)
- `Sidebar.tsx`: add NavLink for `/issues` between the "All Products" NavLink and the product list `ScrollArea`
- Product store: `products` array is already loaded in `AuthenticatedApp` via `loadProducts()` — no extra fetching needed

</code_context>

<specifics>
## Specific Ideas

- The `useQueries()` call: `useQueries({ queries: products.map(p => ({ queryKey: ['issues', p.id, stateFilter], queryFn: () => fetchIssues(p) })) })` — each result has `data`, `isLoading`, `isError`, `error`, `refetch` for per-repo error banners and retry.
- Product badge in issue rows: small colored dot (same `h-2 w-2 rounded-full` pattern from `TaskCard`) + product name label next to it, appended at the right side of each `IssueListRow`.
- Error banner: use the existing `AlertCircle` + `Button` components; stack multiple banners with `space-y-2` if several repos fail simultaneously.
- `retryAfter` from `GitHubRateLimitError`: if the error has a `retryAfter` field (seconds), display "rate limited, retry in Xs" in the banner.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 4 scope.

</deferred>

---

*Phase: 04-cross-repo-unified-view*
*Context gathered: 2026-04-21*
