# Phase 2: Single-Repo Issues Browser - Research

**Researched:** 2026-04-21
**Domain:** React data fetching (TanStack Query v5), React Router v7, GitHub REST API, Markdown rendering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Issues browser lives inside the product view as a tab switcher — Kanban tab and Issues tab appear at the top of the content area. No sidebar changes required.
- **D-02:** Routes: `/products/:productId` stays Kanban. Add `/products/:productId/issues` for the Issues browser. Both tabs share the same product context.
- **D-03:** Filter state (state=open|closed, labels, assignee) is preserved in the URL so links are shareable and the browser back button restores filter state.
- **D-04:** Issues are rendered as dense list rows (not cards). Each row shows: issue number + title + label color dots + assignee avatar + open/closed state badge.
- **D-05:** Labels in list rows: small colored circles (`h-2 w-2 rounded-full`) — not full label name badges. Full label names appear in the detail panel.
- **D-06:** Clicking an issue opens a slide-in right panel (~40% viewport width). The issue list stays visible and scrollable on the left.
- **D-07:** Panel shows: issue title, number, open/closed badge, labels (full names with colors), assignee (avatar + login), created date, rendered Markdown body, "View on GitHub" link.
- **D-08:** Label filter: fetch all available repo labels from GitHub on page load (parallel to first issues fetch). On fetch failure, dropdown shows error but issues still load.
- **D-09:** Assignee filter: single-select dropdown. Assignee list derived from issues already loaded — no separate API call.
- **D-10:** Search: client-side title filter only. Instant, no extra requests. Only matches issues in the currently loaded set.
- **D-11:** State filter: toggle between Open and Closed. Default: Open.
- **D-12:** "Load More" button appends next page of 50 issues to the existing list. Disappears when `hasMore` is false.
- **D-13:** Filter/search changes reset to page 1 and replace the current list.
- **D-14:** Default sort: `sort=updated, direction=desc`.
- **D-15:** Use TanStack Query v5 (`@tanstack/react-query`) for issues data fetching and caching — install as new dependency.
- **D-16:** A `QueryClientProvider` wraps the authenticated app in `App.tsx`. Existing Zustand stores for products, tasks, auth are unaffected.
- **D-17:** Issue body rendered with `react-markdown` + `remark-gfm` plugin. No `dangerouslySetInnerHTML`.
- **D-18:** Loading: show 8 animated skeleton rows matching list row height while the first page of issues is fetching.
- **D-19:** Empty: when a product has zero open (or closed) issues, show branded empty state with GitHub icon, contextual message, and a link.

### Claude's Discretion

- Exact skeleton row markup and animation (Tailwind `animate-pulse` or dedicated skeleton component — follow codebase consistency)
- Whether the tab switcher uses a `<Tabs>` Radix component or a custom `<NavLink>` pair — follow existing patterns
- `QueryClient` cache settings (stale time, garbage collection) — use sensible defaults for a 50-issue page
- How the right panel is implemented (CSS transform slide, Radix Sheet, or custom div) — Claude decides the cleanest approach

### Deferred Ideas (OUT OF SCOPE)

- Body + comment search (GitHub Search API)
- Assignee filter from repo collaborators list
- Sort order user toggle (UI control to switch between updated/created)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BROWSE-01 | User can view open GitHub issues for a connected product repo | Existing `/api/github/repos/[owner]/[repo]/issues.ts` supports `state=open`; TanStack Query `useQuery`/`useInfiniteQuery` pattern |
| BROWSE-02 | User can view closed GitHub issues for a connected product repo | Same endpoint supports `state=closed`; state toggle in URL via `useSearchParams` |
| BROWSE-03 | User can filter issues by one or more labels (multi-select) | Existing `labels` param on issues endpoint; new `/api/github/repos/[owner]/[repo]/labels.ts` needed; `DropdownMenuCheckboxItem` pattern from KanbanFilterBar |
| BROWSE-04 | User can filter issues by assignee | Existing `assignee` param on issues endpoint; assignees derived from loaded issues; `DropdownMenuRadioItem` pattern |
| BROWSE-05 | User can search issues by keyword in title | Client-side `filter()` on loaded issues array; no API call |
| BROWSE-06 | User can open an issue detail panel showing rendered Markdown body, labels, assignee, and created date | `IssueDetailPanel` component with `react-markdown` + `remark-gfm`; slide-in CSS transform |
| BROWSE-07 | User can load more issues using a "Load More" button (50 issues per page) | `useInfiniteQuery` with `getNextPageParam` deriving next page number from `hasMore`; `fetchNextPage()` on button click |
| BROWSE-08 | User can navigate to the original issue on github.com from the detail panel | `issue.htmlUrl` field from `mapGitHubIssue()` output; `Button variant="link"` with `ExternalLink` icon |
</phase_requirements>

---

## Summary

Phase 2 delivers a read-only GitHub issues browser integrated into the existing product view via a tab switcher. The implementation scope is well-bounded: the existing GitHub API proxy layer (`issues.ts`, `github.ts`, `validation.ts`) already handles the data transport, and the existing UI component library (`Badge`, `Button`, `Input`, `DropdownMenu`, `ScrollArea`, `Tooltip`) covers all UI primitives. No existing files need structural changes — the work is purely additive.

The two net-new dependencies are `@tanstack/react-query` v5 (for data fetching, caching, and pagination) and `react-markdown` + `remark-gfm` (for Markdown rendering). Neither is currently installed. `@tailwindcss/typography` is also needed for prose styling of the Markdown body, and it is not currently installed. All three are stable, widely adopted packages.

The most architecturally significant new element is that filter state lives in the URL (`useSearchParams` from `react-router-dom`) rather than in a Zustand store. This is the first time this pattern appears in the codebase and requires careful design of the `useIssuesFilters` hook. The `useInfiniteQuery` approach fits "Load More" pagination directly; the query key must encode all active filter/page state so that React Query re-fetches correctly when filters change.

**Primary recommendation:** Use `useInfiniteQuery` for issues pagination (accumulate pages), `useQuery` for labels (single fetch), derive assignees from loaded issues client-side, and sync filter state bidirectionally through `useSearchParams`. Implement the detail panel as a CSS-transform slide div (no Radix Sheet dependency needed).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Issues list display | Browser / Client | — | React component rendering in-browser; data arrives pre-filtered from API |
| Filter state management | Browser / Client | — | URL search params via `useSearchParams`; client-side filter (search, assignee derivation) |
| Issues data fetching + caching | Browser / Client (TanStack Query) | API / Backend proxy | `useInfiniteQuery` in the browser; Vercel serverless function is the proxy to GitHub |
| Labels data fetching | Browser / Client (TanStack Query) | API / Backend proxy | `useQuery` parallel to issues; needs new `labels.ts` proxy route |
| GitHub API authentication | API / Backend | — | `githubFetch()` injects server-side token; client never touches GitHub directly |
| Markdown rendering | Browser / Client | — | `react-markdown` runs entirely client-side |
| Rate limit error handling | API / Backend + Browser / Client | — | `GitHubRateLimitError` thrown server-side; client displays rate-limit copy from `issues` i18n namespace |
| Issue detail panel | Browser / Client | — | In-component state (`selectedIssueId`); CSS transform; no server round-trip |

---

## Standard Stack

### Core (new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | 5.99.2 | Data fetching, caching, pagination | Decided in STATE.md for Phase 2+; industry standard for server-state management in React |
| `react-markdown` | 10.1.0 | Markdown → React element rendering | No `dangerouslySetInnerHTML`; configurable plugin system; type-safe |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks) | The GFM plugin for `react-markdown`; required for GitHub issue body fidelity |
| `@tailwindcss/typography` | 0.5.19 | `prose` utility classes for Markdown body styling | Standard pairing with `react-markdown`; required for `prose prose-sm dark:prose-invert` on detail panel body |

[VERIFIED: npm registry — versions confirmed 2026-04-21]

### Already Installed (confirm, no reinstall needed)

| Library | Version in package.json | Purpose |
|---------|------------------------|---------|
| `react-router-dom` | ^7.6.1 | `useSearchParams` for URL filter state; `NavLink` for tab switcher |
| `zustand` | ^5.0.5 | NOT used for issues data — listed for contrast only |
| `lucide-react` | ^0.511.0 | `GitBranch`, `ExternalLink`, `AlertCircle`, `Loader2` icons |
| `@radix-ui/react-dropdown-menu` | ^2.1.15 | Label multi-select, assignee single-select, state toggle |
| `@radix-ui/react-scroll-area` | ^1.2.9 | Detail panel scroll |
| `@radix-ui/react-tooltip` | ^1.2.7 | Assignee avatar tooltip |
| `react-i18next` | ^15.4.1 | All user-facing text; new `issues` namespace |
| `tailwindcss` | ^4.1.7 | Utility-first CSS; `animate-pulse` for skeletons |

[VERIFIED: apps/web/package.json]

**Installation:**
```bash
cd apps/web && npm install @tanstack/react-query react-markdown remark-gfm @tailwindcss/typography
```

Note: `@tailwindcss/typography` must be registered as a Tailwind plugin. With Tailwind CSS v4 + `@tailwindcss/vite`, add `@plugin "@tailwindcss/typography"` to `globals.css`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useInfiniteQuery` | Manual `useState` + `page` counter | Hand-rolling loses automatic `hasNextPage`, `isFetchingNextPage`, cache dedup — `useInfiniteQuery` wins for this use case |
| `react-markdown` | `marked` + `DOMPurify` | `react-markdown` outputs React nodes natively (no `dangerouslySetInnerHTML`); cleaner and locked by D-17 |
| CSS transform slide panel | `@radix-ui/react-dialog` | No new Radix dep needed; CSS transform is lighter and the panel is not a true modal |

---

## Architecture Patterns

### System Architecture Diagram

```
User action (URL change / filter change / Load More click)
        │
        ▼
useSearchParams (react-router-dom)
  ─ read: state, labels, assignee from URL
  ─ write: setSearchParams() on filter change
        │
        ▼
useInfiniteQuery (TanStack Query v5)
  queryKey: ['issues', productId, { state, labels, assignee }]
  queryFn: authenticatedFetch('/api/github/repos/owner/repo/issues?...')
  getNextPageParam: (lastPage) => lastPage.hasMore ? nextPage : undefined
        │                         (page number derived from pageParams length)
        ▼
Vercel serverless → githubFetch() → GitHub REST API
  /repos/{owner}/{repo}/issues?state&page&per_page=50&sort=updated&direction=desc
        │
        ▼
mapGitHubIssue(owner, repo) → GitHubIssue[]
  Returns: { issues: GitHubIssue[], hasMore: boolean }
        │
        ▼
Client-side transforms (browser only, no extra requests)
  ─ Client search: issues.filter(i => i.title.includes(query))
  ─ Assignee list: [...new Set(issues.flatMap(i => i.assignees.map(a => a.login)))]
        │
        ▼
IssuesView renders:
  ─ Tab switcher (NavLink pair)
  ─ IssuesFilterBar (search + label dropdown + assignee dropdown + state toggle)
  ─ Split pane: IssueListRow × N | IssueDetailPanel (slide-in)
  ─ Load More button → fetchNextPage()

useQuery (labels, parallel to issues)
  queryKey: ['labels', productId]
  queryFn: authenticatedFetch('/api/github/repos/owner/repo/labels')
  staleTime: 5 minutes (labels change rarely)
        │
        ▼
Vercel serverless → githubFetch() → GET /repos/{owner}/{repo}/labels
  Returns: GitHubLabel[]  (new route to create)
```

### Recommended Project Structure

```
apps/web/
├── api/
│   └── github/
│       └── repos/[owner]/[repo]/
│           ├── issues.ts              (EXISTING — no changes needed)
│           └── labels.ts              (NEW — must create)
└── src/
    ├── client/
    │   ├── components/
    │   │   ├── IssuesView.tsx          (NEW — top-level route component)
    │   │   ├── IssuesFilterBar.tsx     (NEW — search + dropdowns + state toggle)
    │   │   ├── IssueListRow.tsx        (NEW — single dense list row)
    │   │   ├── IssueDetailPanel.tsx    (NEW — slide-in detail panel)
    │   │   └── IssueSkeletonRow.tsx    (NEW — animated placeholder row)
    │   └── hooks/
    │       └── useIssuesFilters.ts     (NEW — URL-synced filter state hook)
    └── shared/
        └── i18n/locales/
            ├── en/issues.json          (NEW — issues namespace)
            └── fr/issues.json          (NEW — issues namespace, French)
```

### Pattern 1: QueryClientProvider Setup in App.tsx

**What:** Wrap `AuthenticatedApp` with `QueryClientProvider`. Create `QueryClient` outside the component to avoid re-creation on render.

**When to use:** Once, at the app root. Existing Zustand stores are unaffected.

```typescript
// Source: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/installation.md
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,  // 2 minutes — sensible for issues list
      gcTime: 5 * 60 * 1000,     // 5 minutes garbage collection
      retry: 1,                   // one retry; rate limit errors should not retry
      refetchOnWindowFocus: false, // issues browser is read-only; avoid surprise refetches
    },
  },
});

// In App() — wrap the entire authenticated subtree:
return (
  <QueryClientProvider client={queryClient}>
    <AuthenticatedApp />
  </QueryClientProvider>
);
```

### Pattern 2: useInfiniteQuery for "Load More" Pagination

**What:** Accumulate pages of issues. `hasMore` from the API response drives `getNextPageParam`.

**When to use:** Issues list only. The existing API returns `{ issues: GitHubIssue[], hasMore: boolean }`.

```typescript
// Source: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/infinite-queries.md
import { useInfiniteQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '../lib/api-client';
import type { PaginatedIssuesResult } from '@shared/types/github';

function useIssues(owner: string, repo: string, filters: IssuesFilters) {
  return useInfiniteQuery<PaginatedIssuesResult>({
    queryKey: ['issues', owner, repo, filters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        state: filters.state,
        page: String(pageParam),
        per_page: '50',
      });
      if (filters.labels.length > 0) params.set('labels', filters.labels.join(','));
      if (filters.assignee) params.set('assignee', filters.assignee);
      const res = await authenticatedFetch(
        `/github/repos/${owner}/${repo}/issues?${params}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 429) throw new RateLimitError(body.retryAfter);
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
  });
}

// Flatten pages for rendering:
const allIssues = data?.pages.flatMap(p => p.issues) ?? [];
```

### Pattern 3: URL Filter State with useSearchParams

**What:** Sync filter state (state, labels, assignee) bidirectionally with URL search params.

**When to use:** `IssuesView` and `useIssuesFilters` hook. This is the first URL-synced filter in the codebase.

```typescript
// Source: react-router-dom v7 — useSearchParams
import { useSearchParams } from 'react-router-dom';

function useIssuesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = (searchParams.get('state') as 'open' | 'closed') ?? 'open';
  const labels = searchParams.getAll('label');  // multi-value: ?label=bug&label=feature
  const assignee = searchParams.get('assignee') ?? '';
  const [search, setSearch] = useState(''); // client-side only, NOT in URL (title filter)

  const setFilters = useCallback((updates: Partial<IssuesFilters>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (updates.state !== undefined) next.set('state', updates.state);
      if (updates.labels !== undefined) {
        next.delete('label');
        updates.labels.forEach(l => next.append('label', l));
      }
      if (updates.assignee !== undefined) {
        if (updates.assignee) next.set('assignee', updates.assignee);
        else next.delete('assignee');
      }
      return next;
    });
  }, [setSearchParams]);

  return { state, labels, assignee, search, setSearch, setFilters };
}
```

Note: Keyword search (`search`) is NOT serialized to URL — it is client-side only per D-10. The URL reflects only the API-level filters (state, labels, assignee).

### Pattern 4: Deriving Owner/Repo from Product

**What:** `IssuesView` needs `owner` and `repo` strings to construct API calls. The active product's `sources` array holds this data.

**When to use:** In `IssuesView` after reading `useParams({ productId })` and `useProductStore`.

```typescript
// Source: apps/web/src/shared/types/product.ts — ProductSource discriminated union
import { useProductStore } from '../stores/product-store';
import { useParams } from 'react-router-dom';

function IssuesView() {
  const { productId } = useParams<{ productId: string }>();
  const { products } = useProductStore();
  const product = products.find(p => p.id === productId);

  // Find the first repo source — Phase 2 assumes single repo per product
  const repoSource = product?.sources.find(s => s.type === 'repo');
  // repoSource is of type RepoSource: { type: 'repo'; owner: string; repo: string }

  if (!repoSource) {
    // Product has no repo source — show empty/error state
    return <NoRepoSource />;
  }

  const { owner, repo } = repoSource;
  // ...
}
```

Important: `product-store.ts`'s `getActiveProduct()` helper exists but relies on `activeProductId` being set. In `IssuesView`, prefer direct `products.find(p => p.id === productId)` to avoid dependency on `setActiveProduct` having been called.

### Pattern 5: Labels API Route (new file)

**What:** New Vercel serverless route proxying `GET /repos/{owner}/{repo}/labels` to GitHub.

**When to use:** Created once; called by `useQuery` in `IssuesView` parallel to the issues query.

```typescript
// Source: apps/web/api/github/repos/[owner]/[repo]/issues.ts — same structure to follow
// File: apps/web/api/github/repos/[owner]/[repo]/labels.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API, GitHubRateLimitError } from '../../../../_lib/github.js';

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await authenticateRequest(req, res);
  if (!user) return;

  const owner = req.query.owner as string;
  const repo = req.query.repo as string;

  try {
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels?per_page=100`
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    const labels: GitHubLabel[] = await response.json();
    res.json({ labels: labels.map(l => ({ id: l.id, name: l.name, color: l.color, description: l.description })) });
  } catch (error) {
    if (error instanceof GitHubRateLimitError) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Anti-Patterns to Avoid

- **Putting issues in Zustand:** D-15 explicitly forbids this. Issues data belongs in TanStack Query cache only.
- **Using `getActiveProduct()` from product-store for IssuesView:** It returns `null` until `setActiveProduct` is called, which `ProductView` handles but `IssuesView` as a sibling route would not inherit. Read directly from `products.find(...)` with the URL `productId`.
- **Storing URL filters in useState:** Filter state that should be in the URL must be read/written via `setSearchParams`. Do not duplicate it in component state (except client-side-only search).
- **queryKey without full filter state:** If `queryKey` does not include `state`, `labels`, and `assignee`, React Query will not re-fetch when filters change. Always encode all API-affecting parameters in the key.
- **Calling `useInfiniteQuery` without resetting on filter change:** Filter changes must reset pagination. React Query handles this automatically when the `queryKey` includes filter state — changing a filter changes the key, which triggers a fresh fetch from page 1.
- **Label color without `#` prefix:** The existing `mapGitHubIssue()` returns `label.color` as a hex string **without** `#` prefix (e.g., `"e4e669"`). TaskCard applies `style={{ backgroundColor: \`#${label.color}\` }}`. IssueListRow and IssueDetailPanel must do the same.
- **`@tailwindcss/typography` import as devDependency:** It must be in `dependencies` (not `devDependencies`) since it generates CSS at build time via the Tailwind plugin chain.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Caching + deduplication of issue fetches | Custom cache Map + fetch wrapper | `useInfiniteQuery` cache | React Query handles stale-while-revalidate, request deduplication, garbage collection |
| Pagination state machine | `useState(page)` + append logic | `useInfiniteQuery` + `fetchNextPage()` | `isFetchingNextPage`, `hasNextPage` are provided; manual state is error-prone |
| GitHub Markdown rendering | Custom MD parser | `react-markdown` + `remark-gfm` | GFM has ~20 edge cases (task lists, tables, autolinks, footnotes) that manual parsers miss |
| XSS sanitization of Markdown | `DOMPurify` + `innerHTML` | `react-markdown` (outputs React nodes) | `react-markdown` never uses `innerHTML`; no sanitization library needed |
| URL search param manipulation | Manual `location.search` parsing | `useSearchParams` from react-router-dom v7 | Handles encoding, multi-value params, history integration |

---

## Key Code Facts (Verified)

### `mapGitHubIssue()` Output Shape

The existing `mapGitHubIssue(owner, repo)` in `api/_lib/github.ts` returns:

```typescript
{
  id: number,
  number: number,
  title: string,
  body: string | null,           // null for issues with no body
  state: 'open' | 'closed',
  labels: Array<{ id: number; name: string; color: string; description?: string }>,
  assignees: Array<{ login: string; avatarUrl: string }>,
  author: { login: string; avatarUrl: string },
  milestone?: { id: number; title: string; state: 'open' | 'closed' },
  createdAt: string,             // ISO 8601
  updatedAt: string,
  closedAt: string | null,
  commentsCount: number,
  url: string,                   // API URL (not for display)
  htmlUrl: string,               // github.com URL — use this for "View on GitHub"
  repoFullName: string,          // "owner/repo"
}
```

This matches `GitHubIssue` in `src/shared/types/github.ts`. No new type definition needed for the fetched issue shape.

**Label color:** stored WITHOUT `#` prefix (e.g., `"e4e669"`). Apply `#` when using as CSS color value.

[VERIFIED: apps/web/api/_lib/github.ts:106-125, apps/web/src/shared/types/github.ts:5-22]

### Existing Issues Endpoint

`GET /api/github/repos/[owner]/[repo]/issues` accepts:
- `state`: `'open' | 'closed' | 'all'` (default: `'open'`)
- `page`: digit string (default: `'1'`)
- `per_page`: digit string (default: `'50'`)
- `labels`: comma-separated label names (optional)
- `assignee`: single GitHub login (optional)

Response: `{ issues: GitHubIssue[], hasMore: boolean }`

Sort is hardcoded server-side to `sort=updated&direction=desc` — no client-side sort param needed (aligns with D-14).

[VERIFIED: apps/web/api/github/repos/[owner]/[repo]/issues.ts, apps/web/api/_lib/validation.ts:109-115]

### Labels API Route: DOES NOT EXIST

`apps/web/api/github/repos/[owner]/[repo]/labels.ts` was confirmed absent. The existing files in that directory are:
- `issues.ts` (exists)
- `issues/[number]/comment.ts` (exists)
- `branches.ts` (exists)
- `pulls/` directory (exists)

**A `labels.ts` route must be created as part of this phase.**

[VERIFIED: filesystem check 2026-04-21]

### React Router Version

The project uses `react-router-dom@^7.6.1` — this is **v7, not v6**. The `useSearchParams` hook API is identical between v6 and v7 for this use case. Route definition in `App.tsx` uses `<Routes>` and `<Route>` from react-router-dom (not the new framework mode).

[VERIFIED: apps/web/package.json, apps/web/src/client/App.tsx]

### New Route Position in App.tsx

The `AuthenticatedApp` component's `<Routes>` block currently has:
1. `path="/"` → `ConsolidatedView`
2. `path="/products/:productId"` → `ProductView`
3. `path="/products/:productId/settings"` → `ProductSettings`
4. `path="/settings"` → `Settings`

Add `path="/products/:productId/issues"` → `<IssuesView />` **after** the `/products/:productId` route. `QueryClientProvider` wraps the outer `AuthenticatedApp` return value.

[VERIFIED: apps/web/src/client/App.tsx:65-95]

### Product Store: Owner/Repo Derivation

`useProductStore` exposes `products: Product[]` and `getActiveProduct(): Product | null`. The `Product` type has `sources: ProductSource[]`. For Phase 2 (single-repo products), read `sources.find(s => s.type === 'repo')` which has shape `{ type: 'repo'; owner: string; repo: string }`.

No utility function for `owner/repo` extraction exists — must be implemented inline in `IssuesView`.

[VERIFIED: apps/web/src/client/stores/product-store.ts, apps/web/src/shared/types/product.ts]

### i18n Namespaces

Existing namespaces in `apps/web/src/shared/i18n/locales/en/`:
- `auth.json`, `common.json`, `navigation.json`, `settings.json`, `tasks.json`

**No `issues.json` namespace exists.** Both `en/issues.json` and `fr/issues.json` must be created.

All i18n keys are documented in `02-UI-SPEC.md` (Copywriting Contract section).

[VERIFIED: filesystem check 2026-04-21]

### QueryClientProvider: NOT YET PRESENT

`@tanstack/react-query` is not in `package.json`. No `QueryClientProvider` exists anywhere in `src/`. It must be added to `App.tsx` wrapping `AuthenticatedApp`.

[VERIFIED: apps/web/package.json — no `@tanstack/react-query` entry]

### Existing Test Infrastructure

Tests live in `api/**/*.test.ts` only (backend unit tests). Vitest is configured with `environment: 'node'` and `include: ['api/**/*.test.ts']`. There are no frontend component tests. The test configuration is in `vite.config.ts` (no separate `vitest.config.ts`).

[VERIFIED: apps/web/vite.config.ts:test section]

### Badge Variants Available

The existing `badge.tsx` has variants: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `info`, `purple`, `muted`.

For issues:
- Open badge: `variant="success"` (maps to `--success: #4EBE96`)
- Closed badge: `variant="muted"` (maps to `--muted-foreground`)

[VERIFIED: apps/web/src/client/components/ui/badge.tsx]

### Label Color Dot Pattern (from TaskCard.tsx)

```typescript
// Source: apps/web/src/client/components/TaskCard.tsx:240-253
<span
  className="h-2 w-2 rounded-full flex-shrink-0"
  style={{ backgroundColor: `#${label.color}` }}   // note: # prefix required
/>
```

### Assignee Avatar Pattern (from TaskCard.tsx)

```typescript
// Source: apps/web/src/client/components/TaskCard.tsx:260-276
<div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
  {assignee.avatarUrl ? (
    <img src={assignee.avatarUrl} alt={assignee.login} className="h-full w-full object-cover" />
  ) : (
    <span className="text-[9px] font-medium text-muted-foreground uppercase">
      {assignee.login.slice(0, 2)}
    </span>
  )}
</div>
```

---

## Common Pitfalls

### Pitfall 1: Label Color Missing `#` Prefix

**What goes wrong:** Labels render with incorrect background color — the `style` attribute receives a non-CSS-color string.

**Why it happens:** `mapGitHubIssue()` returns `label.color` as a raw hex value like `"e4e669"` (no `#`). CSS requires `#e4e669`.

**How to avoid:** Always apply `#${label.color}` when setting `backgroundColor` inline. The TaskCard pattern already does this — follow it exactly.

**Warning signs:** Label dots appear as no color / transparent in development.

### Pitfall 2: queryKey Not Including All Filter State

**What goes wrong:** Changing a filter (e.g., switching Open → Closed) does not trigger a new fetch; stale data is shown.

**Why it happens:** React Query uses `queryKey` referential equality. If `filters` object is not included in the key, the key never changes when filters change.

**How to avoid:** `queryKey: ['issues', owner, repo, { state, labels: [...labels].sort(), assignee }]` — include all API-level parameters. Sort `labels` array to avoid false cache misses from ordering changes.

**Warning signs:** Switching Open/Closed shows same issues list; labels don't re-apply.

### Pitfall 3: Calling `ProductView`'s `setActiveProduct` From `IssuesView`

**What goes wrong:** `useProductStore().getActiveProduct()` returns `null` when navigating directly to `/products/:productId/issues` without first visiting `/products/:productId`.

**Why it happens:** `setActiveProduct(productId)` is called in `ProductView`'s `useEffect` — but `IssuesView` is a separate route and doesn't inherit this effect.

**How to avoid:** In `IssuesView`, call `setActiveProduct(productId)` in its own `useEffect`, or (preferred) bypass `getActiveProduct()` entirely and read `products.find(p => p.id === productId)` directly.

**Warning signs:** Detail panel sidebar items show nothing; product name missing from page title.

### Pitfall 4: `@tailwindcss/typography` Not Registered as Plugin

**What goes wrong:** `prose` classes are present in JSX but have no effect — the Markdown body has no typographic styling.

**Why it happens:** Tailwind CSS v4 requires explicit plugin registration in `globals.css` via `@plugin`.

**How to avoid:** Add `@plugin "@tailwindcss/typography";` to `apps/web/src/client/styles/globals.css`. This must be done before the `IssueDetailPanel` component is built.

**Warning signs:** Rendered Markdown body has no paragraph spacing, no `<h2>` styling, bare `<code>` blocks.

### Pitfall 5: `useSearchParams` Clobbers Unrelated URL Params

**What goes wrong:** Calling `setSearchParams({ state: 'closed' })` (object form) wipes all other params.

**Why it happens:** The object overload replaces the entire params object. Must use the functional updater that receives the current params.

**How to avoid:** Always use the functional form: `setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('state', 'closed'); return next; })`.

### Pitfall 6: `react-markdown` `remark-gfm` import syntax

**What goes wrong:** TypeScript error or runtime crash because `remark-gfm` is imported incorrectly.

**Why it happens:** `remark-gfm` v4 is ESM-only. With Vite (ESM bundler), it works as `import remarkGfm from 'remark-gfm'` and is passed as `remarkPlugins={[remarkGfm]}` to `<ReactMarkdown>`.

**How to avoid:** Use default import. Do not use `require('remark-gfm')`.

---

## Runtime State Inventory

Not applicable — Phase 2 is a greenfield feature addition with no rename/refactor. No runtime state migration required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm install` | ✓ | (system) | — |
| `@tanstack/react-query` | Issues data layer | ✗ (not installed) | — | Must install: `npm install @tanstack/react-query` |
| `react-markdown` | Issue detail panel body | ✗ (not installed) | — | Must install: `npm install react-markdown remark-gfm` |
| `@tailwindcss/typography` | `prose` classes for Markdown | ✗ (not installed) | — | Must install: `npm install @tailwindcss/typography` |
| GitHub API token | `githubFetch()` at runtime | ✓ (configured in Phase 1) | — | — |

**Missing dependencies with no fallback:**
- `@tanstack/react-query` — required by D-15; no alternative chosen
- `react-markdown` + `remark-gfm` — required by D-17; no alternative chosen
- `@tailwindcss/typography` — required for `prose prose-sm dark:prose-invert` Markdown styling

All three must be installed in Wave 0 before any component implementation begins.

---

## Validation Architecture

nyquist_validation is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `apps/web/vite.config.ts` (`test` section) |
| Quick run command | `cd apps/web && npm test` |
| Full suite command | `cd apps/web && npm test` |

Note: existing test environment is `node`, targeting `api/**/*.test.ts` only. Frontend component tests do not currently exist and are not testable under the current config (no jsdom).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROWSE-01 | Issues API returns open issues with correct shape | unit (API) | `cd apps/web && npm test -- api/github/repos/\\[owner\\]/\\[repo\\]/issues.test.ts` | ❌ Wave 0 |
| BROWSE-02 | Issues API returns closed issues when state=closed | unit (API) | same file | ❌ Wave 0 |
| BROWSE-03 | Issues API passes labels param to GitHub | unit (API) | same file | ❌ Wave 0 |
| BROWSE-04 | Issues API passes assignee param to GitHub | unit (API) | same file | ❌ Wave 0 |
| BROWSE-05 | Client-side title filter (manual-only — no component tests) | manual | — | N/A |
| BROWSE-06 | Detail panel renders (manual-only — no jsdom in config) | manual | — | N/A |
| BROWSE-07 | Labels API returns label list with correct shape | unit (API) | `cd apps/web && npm test -- api/github/repos/\\[owner\\]/\\[repo\\]/labels.test.ts` | ❌ Wave 0 |
| BROWSE-08 | `htmlUrl` field present in mapped issue | unit (API) | covered by issues.test.ts | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/web && npm test`
- **Per wave merge:** `cd apps/web && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `api/github/repos/[owner]/[repo]/issues.test.ts` — covers BROWSE-01 through BROWSE-04, BROWSE-08 (follows existing `github.test.ts` pattern)
- [ ] `api/github/repos/[owner]/[repo]/labels.test.ts` — covers BROWSE-07 (follows same pattern)

*(Frontend component tests are not feasible under current node test environment; BROWSE-05, BROWSE-06 are manual-only)*

---

## Security Domain

`security_enforcement` is not explicitly set in `.planning/config.json` — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authenticateRequest()` on all new API routes; existing JWT pattern |
| V3 Session Management | no | Session management unchanged from Phase 1 |
| V4 Access Control | yes | `authenticateRequest()` gate on `labels.ts`; same as `issues.ts` |
| V5 Input Validation | yes | `githubOwnerRepoSchema` from `validation.ts` — validate `owner` and `repo` path params on `labels.ts` |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `owner`/`repo` params | Tampering | `githubOwnerRepoSchema` regex validation — already enforced on `issues.ts`, must be applied to `labels.ts` |
| Unauthenticated labels endpoint | Information Disclosure | `authenticateRequest()` — do not skip it on the new route |
| XSS via rendered Markdown | Tampering | `react-markdown` outputs React nodes (no `innerHTML`); inherently safe |
| Labels multi-value injection via `?label=a,b,c` | Tampering | Labels passed as comma-separated string to GitHub API; GitHub API handles validation |

**Critical:** The new `labels.ts` route must apply `githubOwnerRepoSchema` validation and `authenticateRequest()`. The existing `issues.ts` shows the exact pattern — follow it exactly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `product.sources.find(s => s.type === 'repo')` is sufficient for Phase 2 — all products have at least one `'repo'` source | Architecture Patterns / Pattern 4 | If a product uses `'github_project'` or `'repos'` source type only, `IssuesView` will show a "no repo source" error; handle gracefully | 
| A2 | GitHub labels endpoint `GET /repos/{owner}/{repo}/labels?per_page=100` returns all labels in a single page for typical repos | Pattern 5 / labels.ts | Repos with > 100 labels will silently truncate; add Link header pagination in a follow-up if needed |
| A3 | `remark-gfm` v4.0.1 is compatible with `react-markdown` v10.1.0 | Standard Stack | Both are current latest as of 2026-04-21 — should be compatible, but check changelog if install fails |

---

## Open Questions (RESOLVED)

1. **Products with non-repo sources**
   - What we know: `ProductSource` is a discriminated union; `RepoSource` has `owner`/`repo`; `GitHubProjectSource` does not.
   - What's unclear: Should `IssuesView` work for products configured with `github_project` or `repos` (multi-repo) sources? Multi-repo is Phase 3 scope.
   - Recommendation: In Phase 2, if no `'repo'` source found, show a "This product does not have a single connected GitHub repository. Issues browser requires a repo source." empty state rather than crashing.
   - RESOLVED: Plan 02-07 Task 1 implements an explicit `repoSource` guard — if `product.sources.find(s => s.type === 'repo')` returns undefined, a "no repo source" error state is shown instead of crashing.

2. **`@tailwindcss/typography` dark mode compatibility with Tailwind v4**
   - What we know: Typography plugin 0.5.x was designed for Tailwind v3; v4 changes the plugin API.
   - What's unclear: Whether `@plugin "@tailwindcss/typography"` works seamlessly with Tailwind v4.1.7 in `globals.css`.
   - Recommendation: Test the install in Wave 0. If the `prose` classes do not generate, fall back to manual Markdown body styling (apply `text-sm leading-relaxed space-y-3` on the container and targeted heading/code styles).
   - RESOLVED: Plan 02-01 Task 1 includes a conditional fallback — if `prose` classes do not generate after install, apply manual `text-sm leading-relaxed space-y-3` Markdown body styling as the fallback.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `fetch` + `useState` for pagination | `useInfiniteQuery` from TanStack Query v5 | v5 stable (2023) | Built-in `hasNextPage`, `isFetchingNextPage`, cache key invalidation |
| `react-markdown` v8 (`remarkPlugins={[gfm]}`) | v10 with `remark-gfm` as peer plugin | 2024 | Same API; `remarkGfm` default import unchanged |
| Tailwind CSS v3 `@tailwindcss/typography` | v4 uses `@plugin` directive | Tailwind v4 (2025) | `tailwind.config.js` plugins array removed; add `@plugin "@tailwindcss/typography"` in CSS file instead |

---

## Project Constraints (from CLAUDE.md)

These directives from `./CLAUDE.md` affect this phase:

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| **i18n required** — all frontend user-facing text uses `react-i18next` | All `IssuesView`, `IssuesFilterBar`, `IssueListRow`, `IssueDetailPanel` text must use `t('issues:...')` keys; create `en/issues.json` and `fr/issues.json` |
| **No `console.log` in production code** | Use no debug logging in new components; errors surface via TanStack Query error state |
| **PR target `develop`** | Any PR created for this phase targets `develop`, not `main` |
| **Vercel AI SDK only** | Not applicable — Phase 2 has no AI interactions |
| **Platform abstraction** | Not applicable — Phase 2 is browser-only React code |
| **Biome linting** | Run `npm run lint:fix` before committing; Biome enforces consistent import order and formatting |
| **TypeScript strict mode** | All new `.ts`/`.tsx` files must type-check with `npm run typecheck`; avoid `any` types in new code |

---

## Sources

### Primary (HIGH confidence)
- Verified from filesystem: `apps/web/api/_lib/github.ts`, `apps/web/api/github/repos/[owner]/[repo]/issues.ts`, `apps/web/api/_lib/validation.ts`, `apps/web/src/client/App.tsx`, `apps/web/src/client/stores/product-store.ts`, `apps/web/src/client/components/TaskCard.tsx`, `apps/web/src/client/components/KanbanFilterBar.tsx`, `apps/web/src/shared/types/github.ts`, `apps/web/src/shared/types/product.ts`, `apps/web/package.json`, `apps/web/vite.config.ts`
- Context7 `/tanstack/query` — `useInfiniteQuery` Load More pattern, `QueryClientProvider` setup
- npm registry — `@tanstack/react-query@5.99.2`, `react-markdown@10.1.0`, `remark-gfm@4.0.1`, `@tailwindcss/typography@0.5.19` (verified 2026-04-21)

### Secondary (MEDIUM confidence)
- `02-CONTEXT.md` + `02-UI-SPEC.md` — user decisions and UI design contract (produced by prior discussion phase)
- React Router v7 `useSearchParams` — same API as v6 for this use case [ASSUMED compatible based on docs]

### Tertiary (LOW confidence)
- `@tailwindcss/typography` v4 compatibility — `@plugin` directive approach based on Tailwind v4 migration guide [ASSUMED — see Open Questions #2]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, package.json confirmed
- Architecture: HIGH — all canonical files read and patterns confirmed
- Pitfalls: HIGH — derived from direct code inspection of existing patterns
- `@tailwindcss/typography` v4 compatibility: MEDIUM — common pattern but not tested in this repo

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable libraries; npm packages rarely change APIs in 30 days)
