# Stack Research — GitHub Issues Triage

**Project:** Currents — GitHub Issues Browser + Triage
**Researched:** 2026-04-21
**Overall confidence:** HIGH (verified against official docs and existing codebase)

---

## Recommendation Summary

- **Keep the existing raw-fetch proxy pattern** (`githubFetch` / `githubGraphQL`) on the server side. Octokit adds ~150kb bundle weight and duplicates what the current abstraction already handles correctly. No benefit justifies introducing a new dependency at this scope.
- **Add TanStack Query (React Query v5)** as the client-side server-state layer for issues. It handles caching, deduplication, background refresh, and `useInfiniteQuery` for load-more — none of which Zustand is designed to do without significant hand-rolling.
- **Use page-based pagination with a "Load More" button**, not full infinite scroll or cursor-based pagination. The GitHub Issues REST API (`/repos/{owner}/{repo}/issues`) uses page/per_page params (max 100), not cursor-based. The existing issues endpoint already passes `page` and `per_page`. A manual "Load More" button is the right UX for a triage workflow where users need to pause and act on issues, not scroll past them.
- **Extend the existing proxy endpoint** to accept `labels` and `assignee` query params and pass them through to the GitHub REST API. Do not add a GraphQL-based search layer — the REST endpoint is sufficient for the current feature scope.
- **Sync filter state to URL params** using `react-router-dom`'s `useSearchParams` (v7 is already in `package.json`). This makes filter states shareable, bookmarkable, and survives hard refreshes — consistent with how triage sessions work across team members.

---

## Pagination & Infinite Scroll

### Decision: Page-based "Load More", not cursor-based or full infinite scroll

**GitHub API constraints:**

The GitHub Issues REST API (`GET /repos/{owner}/{repo}/issues`) uses integer `page` and `per_page` params (1–100). It does NOT support cursor-based pagination (`before`/`after`) for the issues endpoint. Cursor pagination exists only for specific endpoints (Dependabot alerts, secret scanning) and GitHub Projects GraphQL. The existing `issues.ts` endpoint already reads `page` and `per_page` from the query and forwards them to GitHub — this is correct.

A field note from the ecosystem: teams hitting large repos receive "Pagination with the page parameter is not supported for large datasets, please use cursor-based pagination" — but this is isolated to specific newer endpoints (alerts, activity), not the core issues list. For the issues endpoint, page-based is stable and documented.

**UX decision:**

Full infinite scroll (IntersectionObserver firing as you scroll) is wrong for triage. Triage is a deliberate act — you read an issue, decide what to do with it, then move on. A "Load More" button at the bottom of the list gives the user control and natural stopping points. This matches GitHub's own native Issues UI.

**Implementation:**

```typescript
// TanStack Query useInfiniteQuery for issues
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['issues', owner, repo, filters],
  queryFn: ({ pageParam = 1 }) =>
    api.github.listIssues(owner, repo, { ...filters, page: pageParam }),
  initialPageParam: 1,
  getNextPageParam: (lastPage, pages) =>
    lastPage.hasMore ? pages.length + 1 : undefined,
});
```

The existing `hasMore` field in the endpoint response (derived from the GitHub `Link` header `rel="next"`) feeds directly into `getNextPageParam` without any server changes.

**Per-page size:** Use `per_page=50` (already the default). Fetching 100 at once slows perceived initial load; 50 is a good triage session batch size.

---

## API Caching Strategy

### Two-tier caching: TanStack Query client-side + ETag conditional requests server-side

**Client-side (TanStack Query):**

TanStack Query's default `staleTime: 0` means it refetches on every mount. For issues browsing, set `staleTime: 5 * 60 * 1000` (5 minutes) per query key. This prevents hammering the Vercel proxy and GitHub API when a user navigates away and back to the issues view within a session.

Cache should be keyed by `[owner, repo, state, labels, assignee, page]` so different filter combinations get independent caches. Filter changes invalidate only their own cache key, not all issues data.

**Server-side (ETag conditional requests):**

The existing `githubFetch` helper does not yet pass ETags. Extend it (or the issues handler specifically) to:
1. Cache the `ETag` response header from GitHub per `(owner, repo, params)` combination — in-memory on the Vercel function is not durable across cold starts, but a short TTL in-memory map or Turso row suffices.
2. On subsequent requests, send `If-None-Match: <cached-etag>`. A 304 response from GitHub does NOT count against the 5000/hour rate limit quota.

For this milestone scope (small team, ~20 products), rate limiting is unlikely to be a real problem. The simpler mitigation is:
- Set `staleTime: 5min` in TanStack Query to reduce proxy calls
- Cap `per_page` at 50 to reduce response size
- Defer ETag caching to a future milestone if rate limits become measurable

**Labels/assignee lists (for filter dropdowns):**

Cache label and assignee lists more aggressively — `staleTime: 30 * 60 * 1000` (30 minutes). These change rarely and are fetched from `/repos/{owner}/{repo}/labels` and `/repos/{owner}/{repo}/assignees`. Add proxy endpoints for both if they don't already exist. Results go in the same TanStack Query cache, keyed by `['labels', owner, repo]`.

---

## State Management for Server Data

### Use TanStack Query for server state; keep Zustand for UI/client state

**Verdict: Add `@tanstack/react-query` v5. Do not use SWR. Do not shoehorn issues into Zustand.**

**Why not Zustand for server data:**

The existing pattern (`task-store.ts`) of storing API data in Zustand is reasonable for tasks because tasks are deeply mutated (drag-and-drop, inline edit, status change, write-back sync) and need to be shared across many components. Issues are primarily read-only in this milestone. Putting paginated, filterable, list+detail data in Zustand requires manually building everything TanStack Query gives for free: loading states, error states, background refresh, cache invalidation, deduplication, pagination cursors, and stale-while-revalidate. The task-store already shows this pain — every action manually sets `isLoading`, catches errors, and manages state.

**Why TanStack Query over SWR:**

SWR's bundle is smaller (4.2kb vs 13kb) but it lacks first-class `useInfiniteQuery` with the `initialPageParam`/`getNextPageParam` API. The TanStack Query infinite query API is a direct fit for the load-more pagination pattern. SWR's infinite implementation (`useSWRInfinite`) is more manual. For a triage feature with multiple filter permutations, TanStack Query's query key invalidation model is also cleaner. The bundle size difference is not meaningful at this app's scale.

**Division of concerns:**

| State | Where |
|-------|-------|
| Issues list (paginated, filtered) | TanStack Query |
| Issue detail (single issue body) | TanStack Query |
| Available labels for a repo | TanStack Query |
| Available assignees for a repo | TanStack Query |
| Triage metadata (internal priority, triaged flag) | Zustand or Turso via existing API pattern |
| Active filter values (labels selected, assignee, state) | URL params via `useSearchParams` |
| Promoted task (issue → backlog) | Existing `task-store.ts` via `api.tasks.create` |

**Installation:**

```bash
npm install @tanstack/react-query
```

No `@tanstack/react-query-devtools` needed in production; include as devDependency if desired.

Wrap the app root in `<QueryClientProvider>` in `main.tsx` with a shared `QueryClient`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
```

---

## Label/Assignee Filter UX

### Multi-select popover with URL query param sync via `useSearchParams`

**Filter state in URL, not component state:**

The existing `useKanbanFilters` hook stores filter state in local `useState`. For the issues browser, filters should live in the URL. Reasons:
- Triage sessions are shared — a team lead can send a URL with `?state=open&labels=bug,high-priority` and the recipient lands in the same filtered view.
- Filter state survives page refresh (necessary for triage workflows that take minutes or hours).
- `react-router-dom` v7 is already in `package.json`; `useSearchParams` is zero additional dependency.

**Multi-value URL encoding:**

Use comma-separated label names in a single `labels` param: `?labels=bug,enhancement`. This is how GitHub's own search syntax works and keeps URLs readable. For assignees, a single `assignee` param (GitHub REST API accepts one assignee per request, or `none`/`*`). If multi-assignee filtering is needed later, use repeated params: `?assignee=alice&assignee=bob`.

**Component pattern:**

Use Radix UI `Popover` + `Checkbox` for the label filter — both are already in `package.json`. This matches the existing filter UI style in `KanbanFilterBar.tsx`.

```typescript
// Reading filters from URL
const [searchParams, setSearchParams] = useSearchParams();
const selectedLabels = searchParams.get('labels')?.split(',').filter(Boolean) ?? [];
const selectedAssignee = searchParams.get('assignee') ?? undefined;
const issueState = (searchParams.get('state') ?? 'open') as 'open' | 'closed' | 'all';

// Updating filters — replace, not push, to keep history clean
const toggleLabel = (label: string) => {
  const next = selectedLabels.includes(label)
    ? selectedLabels.filter(l => l !== label)
    : [...selectedLabels, label];
  setSearchParams(prev => {
    const updated = new URLSearchParams(prev);
    if (next.length > 0) updated.set('labels', next.join(','));
    else updated.delete('labels');
    return updated;
  }, { replace: true });
};
```

**Passing filters to the GitHub API:**

The existing issues endpoint must be extended to accept `labels` (comma-separated) and `assignee` (single login) as query params and forward them to GitHub's REST API. GitHub accepts `labels=bug,enhancement` natively in this format. The `githubIssueQuerySchema` in `validation.ts` needs two new optional fields:

```typescript
labels: z.string().optional(),    // comma-separated, forwarded as-is
assignee: z.string().optional(),  // single GitHub login or 'none'
```

No server-side label parsing needed — GitHub interprets the comma-separated string as an OR filter natively.

---

## GitHub API Client

### Keep the existing `githubFetch` / `githubGraphQL` raw-fetch pattern. Do not add Octokit.

**Verdict: No change to the server-side GitHub client.**

The existing `githubFetch` helper in `api/_lib/github.ts` is clean, minimal (~15 lines), and already handles authentication, versioning headers, and token resolution via `config-resolver.ts`. It is tested implicitly by the existing issues, PRs, and projects endpoints.

**Why not Octokit:**

- Octokit (`octokit` full package) is ~150kb+ with plugins for REST, GraphQL, App, and Webhook support. The app needs exactly REST + GraphQL, which is already covered.
- `@octokit/rest` alone is ~50kb — still adds weight and a new dependency for zero functional gain over `githubFetch`.
- Octokit's TypeScript types are useful for getting typed GitHub API responses, but `mapGitHubIssue` already extracts exactly what the app needs into clean typed interfaces. Adding Octokit types would require reconciling two type systems.
- The serverless function cold-start cost matters on Vercel's free/hobby tier — unnecessary imports slow cold starts.

**The one case for Octokit:** If this app ever needs to authenticate as a GitHub App (installation tokens, webhooks, permission checks) rather than a PAT, the `@octokit/app` package would be justified. That is explicitly out of scope for this milestone.

**What to add to `githubFetch`:**

The only improvement warranted is forwarding rate limit headers to the client response so the UI can show a warning when the token is close to its 5000/hour limit:

```typescript
// In the issues handler, expose rate limit headers:
res.setHeader('X-RateLimit-Remaining', response.headers.get('X-RateLimit-Remaining') ?? '');
res.setHeader('X-RateLimit-Reset', response.headers.get('X-RateLimit-Reset') ?? '');
```

---

## Confidence Levels

| Area | Confidence | Basis |
|------|------------|-------|
| GitHub Issues API pagination (page-based, no cursor) | HIGH | Official GitHub REST API docs confirmed; cursor issues are specific to other endpoints |
| Load-more vs infinite scroll UX decision | HIGH | Direct product fit; triage UX is deliberate, not passive-scroll |
| TanStack Query v5 for server state | HIGH | Official docs verified; `useInfiniteQuery` API confirmed for page-based pagination |
| Keep `githubFetch`, no Octokit | HIGH | Bundle analysis confirmed; existing pattern is correct and sufficient |
| `useSearchParams` for filter URL sync | HIGH | react-router-dom v7 already in package.json; official docs confirmed |
| ETag conditional caching | MEDIUM | GitHub officially documents this; deferring implementation until rate limits are observed in practice |
| `staleTime: 5min` as default | MEDIUM | Community consensus; exact value should be tuned based on real usage patterns |

---

## Sources

- [REST API endpoints for issues — GitHub Docs](https://docs.github.com/en/rest/issues/issues)
- [GitHub Issues Advanced Search API (March 2025)](https://github.blog/changelog/2025-03-06-github-issues-projects-api-support-for-issues-advanced-search-and-more/)
- [TanStack Query — Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [Best practices for using the REST API — GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [useSearchParams — React Router](https://reactrouter.com/api/hooks/useSearchParams)
- [React Query vs SWR 2025 comparison — markaicode.com](https://markaicode.com/react-query-vs-swr-2025-performance-comparison/)
- [Octokit.js repository](https://github.com/octokit/octokit.js/)
