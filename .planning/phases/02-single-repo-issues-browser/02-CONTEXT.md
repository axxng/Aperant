# Phase 2: Single-Repo Issues Browser - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a read-only GitHub issues browser per product:
- Issues list with label/assignee filters, keyword search, and "Load More" pagination
- Issue detail panel (rendered Markdown body, labels, assignee, created date, link to github.com)
- Tab-based navigation within the existing product view (Kanban ↔ Issues)

No triage actions in this phase (Phase 4). No cross-repo aggregation (Phase 3). Pure browse + inspect.

</domain>

<decisions>
## Implementation Decisions

### Navigation & Routing
- **D-01:** Issues browser lives inside the product view as a **tab switcher** — Kanban tab and Issues tab appear at the top of the content area. No sidebar changes required.
- **D-02:** Routes: `/products/:productId` stays Kanban. Add `/products/:productId/issues` for the Issues browser. Both tabs share the same product context.
- **D-03:** Filter state (state=open|closed, labels, assignee) is preserved in the URL so links are shareable and the browser back button restores filter state.

### Issue List Layout
- **D-04:** Issues are rendered as **dense list rows** (not cards). Each row shows: issue number + title + label color dots + assignee avatar + open/closed state badge. Maximises issues visible without scrolling; matches GitHub's native list feel.
- **D-05:** Labels in list rows: small colored circles (same approach as TaskCard's label dots) — not full label name badges. Full label names appear in the detail panel.

### Detail Panel
- **D-06:** Clicking an issue opens a **slide-in right panel** (~40% viewport width). The issue list stays visible and scrollable on the left. Users can click another issue row to replace the panel content without closing it.
- **D-07:** Panel shows: issue title, number, open/closed badge, labels (full names with colors), assignee (avatar + login), created date, rendered Markdown body, and a "View on GitHub" link.

### Filters & Search
- **D-08:** **Label filter**: fetch all available repo labels from GitHub on page load (parallel to the first issues fetch). Labels are ready in the dropdown immediately when the user opens the filter. On fetch failure, the dropdown shows an error message but issues still load.
- **D-09:** **Assignee filter**: single-select dropdown. Assignee list is derived from issues already loaded (collect unique assignees) — no separate API call for repo collaborators.
- **D-10:** **Search**: client-side title filter only — no GitHub Search API. Instant, no extra requests. Only matches issues in the currently loaded set. Aligns with BROWSE-05 requirement (search by title keyword).
- **D-11:** **State filter**: toggle between Open and Closed (not multi-select). Default: Open.

### Pagination
- **D-12:** **"Load More" button** appends the next page of 50 issues to the existing list (accumulate, don't replace). Disappears when `hasMore` from the API is false.
- **D-13:** Filter/search changes reset to page 1 and replace the current list.

### Sort Order
- **D-14:** Default sort: **`sort=updated, direction=desc`** — most recently active issues first. This matches GitHub's own default and is best for monitoring active discussions.

### Data Layer
- **D-15:** Use **TanStack Query v5** (`@tanstack/react-query`) for issues data fetching and caching — install it as a new dependency. This was decided in STATE.md for all Phase 2+ data fetching. Existing Zustand stores are NOT used for issues data.
- **D-16:** A `QueryClientProvider` wraps the authenticated app in `App.tsx`. Existing Zustand stores for products, tasks, auth are unaffected.

### Markdown Rendering
- **D-17:** Issue body is rendered with **`react-markdown`** + **`remark-gfm`** plugin (GitHub Flavored Markdown: task lists, tables, strikethrough, autolinks). No `dangerouslySetInnerHTML`.

### Loading & Empty States
- **D-18:** **Loading**: show 8 animated skeleton rows matching list row height while the first page of issues is fetching.
- **D-19:** **Empty**: when a product has zero open (or closed) issues, show a branded empty state with a GitHub icon, contextual message (e.g. "No open issues"), and a link to open issues on github.com.

### Claude's Discretion
- Exact skeleton row markup and animation (use Tailwind `animate-pulse` or a dedicated skeleton component — follow whatever pattern is most consistent with the codebase)
- Whether the tab switcher uses a `<Tabs>` Radix component or a custom `<NavLink>` pair — follow existing patterns
- `QueryClient` cache settings (stale time, garbage collection) — use sensible defaults for a 50-issue page
- How the right panel is implemented (CSS transform slide, Radix Sheet, or custom div) — Claude decides the cleanest approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing GitHub API layer
- `apps/web/api/github/repos/[owner]/[repo]/issues.ts` — existing issues proxy (state, page, per_page, labels, assignee params); `hasMore` from Link header
- `apps/web/api/_lib/github.ts` — `githubFetch()`, `mapGitHubIssue()`, `GitHubRateLimitError` — reuse these
- `apps/web/api/_lib/validation.ts` — `githubIssueQuerySchema` — understand existing params before extending

### Auth & route patterns
- `apps/web/api/_lib/auth/middleware.ts` — `authenticateRequest()` pattern (all API routes use this)
- `apps/web/src/client/App.tsx` — existing React Router v6 route structure; add Issues route here

### UI component patterns
- `apps/web/src/client/components/TaskCard.tsx` — label dots pattern, assignee avatar pattern, Badge usage
- `apps/web/src/client/components/KanbanFilterBar.tsx` — search input + DropdownMenu filter pattern to follow
- `apps/web/src/client/components/Sidebar.tsx` — NavLink pattern, collapsed/expanded state

### State management
- `apps/web/src/client/stores/task-store.ts` — Zustand pattern (existing); issues data does NOT go here — use TanStack Query instead

### Requirements
- `.planning/REQUIREMENTS.md` — BROWSE-01 through BROWSE-08 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card`, `Badge`, `Button`, `Input`, `DropdownMenu`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `ScrollArea`, `Tooltip` — all exist in `src/client/components/ui/`; use these for list rows, filter bar, and detail panel
- `mapGitHubIssue()` (`api/_lib/github.ts`) — already maps GitHub API issue shape; understand its output type before building UI types
- Label color dot pattern from `TaskCard.tsx:239` — `h-2 w-2 rounded-full` with `style={{ backgroundColor }}` — reuse for issue list rows
- Assignee avatar pattern from `TaskCard.tsx:260` — 20×20px circle with img or initials fallback — reuse in list rows and detail panel

### Established Patterns
- State management: Zustand stores in `src/client/stores/`. TanStack Query is NEW for this phase — install and wrap at `App.tsx` level
- i18n: all UI text via `react-i18next`; add keys to both `src/shared/i18n/locales/en/*.json` and `src/shared/i18n/locales/fr/*.json`. Use a new `issues` namespace
- Filter bar: `KanbanFilterBar` pattern — search input (left) + dropdown filter buttons (right) + active-filter count badges + reset button
- Route params: `useParams<{ productId: string }>()` to get product context; derive `owner`/`repo` from product data in product-store

### Integration Points
- `App.tsx`: add `<Route path="/products/:productId/issues" element={<IssuesView />} />` and wrap `AuthenticatedApp` with `<QueryClientProvider>`
- `Sidebar.tsx`: no changes needed (tabs live in the content area)
- Product store (`product-store.ts`): read `githubRepo` field from the active product to get `owner/repo` for API calls
- `apps/web/api/github/repos/[owner]/[repo]/labels.ts`: this route may need to be created if it doesn't exist yet — check before planning

</code_context>

<specifics>
## Specific Ideas

- Slide-in panel: consider ~40% viewport width on desktop (`w-[40%]`); on mobile it can cover full width. Use `overflow-y-auto` with `ScrollArea` for long issue bodies.
- Tab switcher visual: simple underline tabs (Kanban | Issues) at the top of the content area — not full Radix Tabs if a simple NavLink pair suffices.
- Label fetch parallel to issues: use `Promise.all([fetchIssues(), fetchLabels()])` or two TanStack Query `useQuery` calls in the component — they will run in parallel.
- The GitHub labels API endpoint: `GET /repos/{owner}/{repo}/labels` — check if `apps/web/api/github/repos/[owner]/[repo]/labels.ts` already exists; if not, it needs to be created in Phase 2.

</specifics>

<deferred>
## Deferred Ideas

- Body + comment search (GitHub Search API) — deferred; client-side title filter covers BROWSE-05 requirement, full-text search adds rate-limit complexity
- Assignee filter from repo collaborators list — deferred; deriving from loaded issues is sufficient for now
- Sort order user toggle (UI control to switch between updated/created) — deferred; default `sort=updated` covers the common case

</deferred>

---

*Phase: 02-single-repo-issues-browser*
*Context gathered: 2026-04-21*
