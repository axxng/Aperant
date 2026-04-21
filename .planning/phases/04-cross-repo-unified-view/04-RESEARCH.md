# Phase 4: Cross-Repo Unified View - Research

**Researched:** 2026-04-21
**Domain:** React client-side fan-out, TanStack Query v5 `useQueries`, product color badges, partial failure UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Unified view at new top-level route `/issues`, new "All Issues" sidebar link positioned below "All Products" and above the product list.
- **D-02:** Sidebar gets a new `NavLink` entry for `/issues` using `Inbox` icon from lucide-react (per UI-SPEC).
- **D-03:** New `AllIssuesView` component added to `App.tsx` as `<Route path="/issues">`.
- **D-04:** Client-side parallel fetches — frontend fires one TanStack Query per product in parallel, reusing existing per-product issues API endpoint. No new server-side fan-out endpoint.
- **D-05:** `useQueries()` (TanStack Query v5) — one query per product that has a `repo` source. Failed queries don't block successful ones.
- **D-06:** Merged results sorted by `updated_at` desc globally.
- **D-07:** State toggle (open/closed) + client-side keyword search only. No label or assignee filters in the unified view.
- **D-08:** Filter state preserved in URL query params (`?state=open&q=keyword`).
- **D-09:** Client-side title search across all loaded issues — instant, no debounce.
- **D-10:** Product color badge on each issue row using `product.color` (hex string from product-store).
- **D-11:** Badge shows product name (truncated) alongside color dot — not just color alone.
- **D-12:** Dismissible alert banner per failing repo: "⚠ Acme API — could not load issues [Retry] [×]". Multiple banners stack.
- **D-13:** Banner includes a Retry button that re-triggers that repo's failed query specifically.
- **D-14:** Banner is dismissible (×). Other repos' successfully loaded issues remain visible.
- **D-15:** Rate-limit errors (`GitHubRateLimitError`) surface the retry-after time in the banner when available.

### Claude's Discretion

- Whether `useQueries()` or multiple `useQuery()` hooks are used — use whichever TanStack Query v5 pattern is cleanest for dynamic product count. (`useQueries` is the right choice.)
- Exact icon for "All Issues" sidebar link — `Inbox` from lucide-react (confirmed in UI-SPEC).
- Whether `IssueListRow` is extended via prop or a thin wrapper adds the product badge — follow the simplest approach.
- Loading state: show `IssueSkeletonRow` while any queries are still loading; once all resolve or error, show results + banners.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 4 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CROSS-01 | User can view all GitHub issues from every connected product repo in a single unified list | `useQueries()` fan-out over all products with `repo` source; merge + sort by `updated_at`; `AllIssuesView` component at `/issues` |
| CROSS-02 | Each issue in the unified list shows a product color badge indicating which repo it belongs to | Extend `IssueListRow` with optional `productBadge` prop (`{ color: string; name: string }`); render `h-2 w-2 rounded-full` dot + truncated product name |
| CROSS-03 | When one repo's GitHub request fails, other repos' issues still display with a per-repo error indicator | `useQueries()` isolates failures per query; `isError`/`error`/`refetch` per result; dismissible banners with optional `retryAfter` from `GitHubRateLimitError` |
</phase_requirements>

---

## Summary

Phase 4 adds a top-level `/issues` route that aggregates GitHub issues from all connected product repos into a single sorted list. The implementation is purely additive: one new React component (`AllIssuesView`), a new sidebar entry, a product badge prop extension on `IssueListRow`, and i18n key additions. No new API routes are needed — the existing `/api/github/repos/:owner/:repo/issues` endpoint is reused per product.

The core technical pattern is TanStack Query v5's `useQueries()` hook, which fires one query per product in parallel. Each query result carries independent `isLoading`, `isError`, `error`, and `refetch` properties, which directly enable the partial-failure banner pattern (CROSS-03). Failed queries are isolated — they do not prevent successful queries from rendering.

The product color badge requirement (CROSS-02) is satisfied by adding an optional `productBadge` prop to `IssueListRow`. When the prop is absent (single-repo `IssuesView`), the component renders exactly as before — fully backward compatible.

**Primary recommendation:** Build `AllIssuesView` as a new component modeled on `IssuesView`, using `useQueries()` for the fan-out, extending `IssueListRow` with a `productBadge` prop, and rendering per-repo error banners above the issue list for any failed queries.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fan-out to multiple repos | Browser / Client | — | D-04: client-side parallel fetches; no new server endpoint |
| Issues data fetching per repo | API / Backend | Browser cache (TanStack Query) | Existing `/api/github/repos/:owner/:repo/issues` proxy reused |
| Merging + sorting issues | Browser / Client | — | D-06: client-side sort by `updated_at` desc after all queries return |
| Filter state (open/closed, search) | Browser / Client | URL params | D-08: URL search params for shareability; `useState` for search |
| Product color badge | Browser / Client | — | `product.color` from product-store; CSS inline style |
| Partial failure banners | Browser / Client | — | `useQueries()` per-result `isError`/`refetch`; local dismiss state |
| i18n strings | Browser / Client | — | `react-i18next` `issues` namespace; `allIssues.*` prefix |
| Routing | Browser / Client | — | React Router v6 `<Route path="/issues">` in `AuthenticatedApp` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `^5.99.2` | Parallel queries, caching, error/loading state | Already installed; `useQueries` is the canonical v5 fan-out API [VERIFIED: apps/web/package.json] |
| `react-router-dom` | (existing) | `/issues` route + URL param filter state | Already used for all routes; `useSearchParams` for URL-persisted filters [VERIFIED: IssuesView.tsx] |
| `react-i18next` | (existing) | All UI text behind translation keys | CLAUDE.md mandate; `issues` namespace already exists [VERIFIED: CLAUDE.md, en/issues.json] |
| `lucide-react` | (existing) | `Inbox` icon for sidebar nav, `AlertCircle` for error banners, `X` for dismiss | Already used throughout; `Inbox` chosen per UI-SPEC D-02 [VERIFIED: Sidebar.tsx, UI-SPEC.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` (product-store) | (existing) | Access `products` array + `product.color` / `product.sources` | `useProductStore()` already loaded in `AuthenticatedApp` — no extra fetching [VERIFIED: product-store.ts, App.tsx] |
| Tailwind CSS v4 | (existing) | Styling; inline `style=` for `product.color` | All layout, spacing, and color tokens [VERIFIED: globals.css, UI-SPEC.md] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useQueries()` | Multiple `useQuery()` hooks | `useQueries` is preferred for dynamic-length arrays (can't call hooks in a loop); hooks approach is illegal in React |
| Client-side sort | Server-side fan-out endpoint | Server endpoint would require new API route; D-04 explicitly rejected this for simplicity |
| Extend `IssueListRow` via prop | Wrap with `ProductBadge` HOC | Prop extension is simpler and backward-compatible; wrapper adds indirection without benefit |

**Installation:** No new packages required. [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
User navigates to /issues
        │
        ▼
AllIssuesView (React component)
        │
        ├─ useProductStore() → products[] (already loaded by AuthenticatedApp)
        │
        ├─ useQueries({ queries: productsWithRepo.map(...) })
        │      │
        │      ├─ Query 1: GET /api/github/repos/{owner1}/{repo1}/issues?state=&page=1&per_page=50
        │      │      └─ returns { data, isLoading, isError, error, refetch }
        │      ├─ Query 2: GET /api/github/repos/{owner2}/{repo2}/issues?state=&page=1&per_page=50
        │      │      └─ returns { data, isLoading, isError, error, refetch }
        │      └─ Query N: ... (one per product with repo source)
        │
        ├─ [merge] flatMap all successful data.issues arrays
        ├─ [sort]  by updatedAt desc
        ├─ [filter] client-side keyword search on title
        │
        ├─ [loading] any isLoading → render 8x IssueSkeletonRow
        ├─ [errors]  per-repo error banners (AlertCircle + Retry + Dismiss)
        └─ [success] IssueListRow list with productBadge prop
                          │
                          └─ IssueDetailPanel (slide-in, reused as-is)
```

### Recommended Project Structure

No new directories needed. New files added to existing structure:

```
apps/web/src/client/
├── components/
│   ├── AllIssuesView.tsx          # New — Phase 4 unified view
│   └── IssueListRow.tsx           # Modified — add optional productBadge prop
├── hooks/
│   └── useIssuesFilters.ts        # Modified — drop label/assignee (or create useAllIssuesFilters)
apps/web/src/shared/i18n/locales/
├── en/
│   ├── issues.json                # Modified — add allIssues.* keys
│   └── navigation.json            # Modified — add items.allIssues key
├── fr/
│   ├── issues.json                # Modified — add allIssues.* keys (French)
│   └── navigation.json            # Modified — add items.allIssues key (French)
```

### Pattern 1: useQueries Fan-Out with Per-Product Error Isolation

**What:** Fire one TanStack Query per product in parallel; each result independently exposes `isLoading`, `isError`, `error`, `refetch`.
**When to use:** Dynamic-length parallel queries where each can fail independently.

```typescript
// Source: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/dependent-queries.md
// Adapted for products with repo sources

const productsWithRepo = products.filter(p => p.sources.some(s => s.type === 'repo'));

const issueQueries = useQueries({
  queries: productsWithRepo.map(product => {
    const repoSource = product.sources.find(s => s.type === 'repo') as RepoSource;
    return {
      queryKey: ['issues', 'all', product.id, stateFilter],
      queryFn: async () => {
        const params = new URLSearchParams({ state: stateFilter, page: '1', per_page: '50' });
        const res = await fetch(
          `/api/github/repos/${repoSource.owner}/${repoSource.repo}/issues?${params}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // Preserve rate-limit metadata for banner display
          if (res.status === 429) {
            const err = new Error('rate_limited') as any;
            err.retryAfter = body.retryAfter;
            throw err;
          }
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<PaginatedIssuesResult>;
      },
    };
  }),
});
```

**Key insight:** Each query in `issueQueries[i]` maps 1:1 to `productsWithRepo[i]`. Use the same index to correlate product metadata with query state for error banners.

### Pattern 2: Merge + Sort Issues Across Repos

**What:** Flatten successful query data into a single sorted array.
**When to use:** After `useQueries` resolves; before rendering the issue list.

```typescript
// Source: [VERIFIED: Phase 2 IssuesView.tsx pattern, adapted]
const allIssues = useMemo(() => {
  const issues: Array<GitHubIssue & { product: Product }> = [];
  issueQueries.forEach((query, i) => {
    if (query.data) {
      const product = productsWithRepo[i];
      query.data.issues.forEach(issue => {
        issues.push({ ...issue, product });
      });
    }
  });
  // Sort by updatedAt desc (D-06)
  return issues.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}, [issueQueries, productsWithRepo]);
```

### Pattern 3: IssueListRow Product Badge Extension

**What:** Add optional `productBadge` prop to `IssueListRow`; render nothing when absent (backward compatible).
**When to use:** Unified view passes badge data; single-repo `IssuesView` passes nothing.

```typescript
// Source: [VERIFIED: IssueListRow.tsx + UI-SPEC.md component contract]

interface ProductBadgeInfo {
  color: string;  // hex from product.color e.g. '#3B82F6'
  name: string;   // product.name, truncated in render
}

interface IssueListRowProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
  productBadge?: ProductBadgeInfo;  // NEW — optional, absent = single-repo view
}

// Render (inside IssueListRow, after state badge):
{productBadge && (
  <div className="flex items-center gap-1 flex-shrink-0">
    <span
      aria-hidden="true"
      className="h-2 w-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: productBadge.color }}
    />
    <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
      {productBadge.name}
    </span>
  </div>
)}
```

### Pattern 4: Per-Repo Error Banners

**What:** Dismissible banner per failed query; rate-limit errors show `retryAfter`.
**When to use:** `issueQueries[i].isError === true` and that repo is not dismissed.

```typescript
// Source: [VERIFIED: UI-SPEC.md Per-Repo Error Banner spec, CONTEXT.md D-12 to D-15]

const [dismissedRepos, setDismissedRepos] = useState<Set<string>>(new Set());

// In JSX, above the issue list:
<div className="space-y-2 px-4 py-2">
  {issueQueries.map((query, i) => {
    const product = productsWithRepo[i];
    if (!query.isError || dismissedRepos.has(product.id)) return null;
    const isRateLimit = (query.error as any)?.message === 'rate_limited';
    const retryAfter = (query.error as any)?.retryAfter as number | undefined;
    return (
      <div
        key={product.id}
        role="alert"
        className={cn(
          'flex items-start gap-3 px-4 py-3 rounded-md border',
          isRateLimit
            ? 'bg-warning/10 border-warning/30'
            : 'bg-destructive/10 border-destructive/30'
        )}
      >
        <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {isRateLimit && retryAfter
              ? t('allIssues.error.rateLimit', { repoName: product.name, retryAfter })
              : t('allIssues.error.body')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {t('allIssues.error.retry')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={t('allIssues.error.dismiss', { repoName: product.name })}
            onClick={() => setDismissedRepos(prev => new Set([...prev, product.id]))}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  })}
</div>
```

### Pattern 5: Sidebar "All Issues" NavLink

**What:** Insert `NavLink` to `/issues` between "All Products" link and the `ScrollArea`.
**When to use:** Sidebar.tsx — between line 67 and line 69 (after "All Products" NavLink, before `ScrollArea`).

```typescript
// Source: [VERIFIED: Sidebar.tsx structure, UI-SPEC.md Sidebar section]
// Add Inbox to lucide-react imports
import { LayoutDashboard, Plus, Settings, RefreshCw, LogOut, Inbox } from 'lucide-react';

// Insert between All Products NavLink and ScrollArea:
<NavLink
  to="/issues"
  className={({ isActive }) =>
    cn(
      'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50',
      isActive && 'bg-accent text-accent-foreground font-medium'
    )
  }
>
  <Inbox className="h-4 w-4 shrink-0" />
  {!isCollapsed && <span>{t('navigation:items.allIssues')}</span>}
</NavLink>
```

### Pattern 6: Filter Hook for Unified View (Adapted)

**What:** Simplified version of `useIssuesFilters` — state + search only, no labels/assignee.
**When to use:** Used by `AllIssuesView` instead of the full `useIssuesFilters`.

```typescript
// Source: [VERIFIED: useIssuesFilters.ts pattern, CONTEXT.md D-07, D-08, D-09]
// Option A: Create new useAllIssuesFilters hook (cleaner, avoids modifying shared hook)
// Option B: Reuse useIssuesFilters (labels/assignee are unused but harmless)
// Recommendation: Option A — explicit hook for this view, no dead code

export function useAllIssuesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const state = (searchParams.get('state') as IssueState) ?? 'open';
  // Search keyword in URL (D-08: `q` param, not `search`)
  // Note: UI-SPEC uses `?q=` for this view vs Phase 2's client-only search

  const hasActiveFilters = state !== 'open' || search !== '';

  const setStateFilter = useCallback((newState: IssueState) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('state', newState);
      return next;
    });
  }, [setSearchParams]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('state');
      return next;
    });
  }, [setSearchParams]);

  return { state, search, setSearch, setStateFilter, resetFilters, hasActiveFilters };
}
```

### Anti-Patterns to Avoid

- **Hook-in-loop:** Never call `useQuery()` inside a `.map()`. `useQueries()` is the correct API for dynamic-length parallel queries. [VERIFIED: TanStack Query docs]
- **Global refetch on error:** Don't call `queryClient.invalidateQueries()` when one repo fails — only call `query.refetch()` on the specific failed query per D-13.
- **Hiding errors silently:** Don't swallow `isError` state — always render the banner so users know which repos failed (CROSS-03 requirement).
- **Modifying issue IDs without product context:** After merging issues from multiple repos, issue number collisions are possible (two repos can both have issue #42). Always use the compound `repoFullName + number` as the selection key, not bare `issue.id` (GitHub IDs are globally unique across issues but not across our internal ID assignment).
- **Blocking render on all-loading:** Once some queries resolve and others are still loading, start showing resolved results. Only show full skeleton if ALL queries are still in `isLoading` state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel queries with independent failure | Manual `Promise.allSettled` + state management | `useQueries()` from TanStack Query v5 | Handles caching, retries, deduplication, stale-time, error state automatically [VERIFIED: TanStack Query docs] |
| Per-query retry | Custom retry logic | `query.refetch()` from `useQueries` result | Direct method on each query result; no custom orchestration needed |
| URL-persisted filter state | `localStorage` / `useState` | `useSearchParams` from react-router-dom | Already established pattern in Phase 2; URL is shareable, survives refresh [VERIFIED: useIssuesFilters.ts] |
| i18n string interpolation | String concatenation | `t('key', { variable })` with i18next interpolation | Required by CLAUDE.md; `{{retryAfter}}` syntax already in en/issues.json [VERIFIED: issues.json] |

**Key insight:** `useQueries` is purpose-built for this exact use case — N parallel queries that must not block each other. The result array maps 1:1 to the input queries array, making per-product error correlation trivial.

---

## Common Pitfalls

### Pitfall 1: Query Key Collision Between Single-Repo and Unified View
**What goes wrong:** If `AllIssuesView` uses the same `queryKey` structure as `IssuesView` (`['issues', owner, repo, filters]`), the two views share cache entries. State filters in one view pollute the other.
**Why it happens:** TanStack Query uses the queryKey for cache lookup; identical keys = same cache entry.
**How to avoid:** Prefix the unified view's query keys: `['issues', 'all', product.id, stateFilter]` — distinct from `['issues', owner, repo, filters]` used in IssuesView. [VERIFIED: IssuesView.tsx queryKey pattern]
**Warning signs:** Opening a product's issues page and then navigating to `/issues` shows stale filters from the single-repo view.

### Pitfall 2: Product Index Drift Between useQueries and productsWithRepo
**What goes wrong:** If `productsWithRepo` is recomputed with a different sort order or filter between renders, `issueQueries[i]` no longer maps to `productsWithRepo[i]`.
**Why it happens:** `useQueries` result array order matches the `queries` array order at call time; if the input array changes between renders, indices can shift.
**How to avoid:** Memoize `productsWithRepo` with `useMemo` so it only changes when `products` changes. Alternatively, embed product data in the queryKey and retrieve it from there rather than relying on index correlation.
**Warning signs:** Error banners showing the wrong product name for a failed query.

### Pitfall 3: Issues from PRs Leaking Into the Unified List
**What goes wrong:** GitHub's issues API returns pull requests as issues. The existing endpoint filters these out server-side (`filteredIssues = issues.filter(issue => !issue.pull_request)`), but if the raw API is called elsewhere, PRs appear.
**Why it happens:** GitHub REST API design.
**How to avoid:** Always go through the existing `/api/github/repos/:owner/:repo/issues` proxy — it already filters PRs. Do not call the GitHub API directly from the frontend. [VERIFIED: issues.ts route handler]
**Warning signs:** Issue rows with titles starting "feat:" or "fix:" — these are PRs masquerading as issues.

### Pitfall 4: GitHub API Token Scoping
**What goes wrong:** After Phase 3's OAuth migration, `github.ts` `githubFetch` still reads `process.env.GITHUB_TOKEN`. If the phase 3 migration to per-user token lookup was incomplete on specific routes, the unified view's fan-out will use the wrong token.
**Why it happens:** Phase 3 migration note: "Test 6 (GitHub issues load via OAuth token) was skipped — OAuth token lacked repo access in test env" (STATE.md concern).
**How to avoid:** Verify the existing `/api/github/repos/:owner/:repo/issues` route correctly uses the requesting user's token after Phase 3 completion. The route calls `authenticateRequest()` and passes user context — confirm `githubFetch` receives the user's token. [VERIFIED: issues.ts uses `authenticateRequest`; STATE.md flags this concern]
**Warning signs:** 401 errors on fan-out queries despite user being logged in.

### Pitfall 5: issue.id Collisions vs issue.number Collisions
**What goes wrong:** GitHub issue IDs (`issue.id`) are globally unique across GitHub. But `issue.number` is only unique within a repo. The React key in `IssueListRow.tsx` uses `issue.id` — this is correct and collision-safe.
**Why it happens:** Misunderstanding of which field is repo-scoped vs global.
**How to avoid:** Keep using `issue.id` (not `issue.number`) as the React `key` and for `selectedIssueId` state. When displaying the issue number in the row (`#{{number}}`), use `issue.number` — this is the user-visible identifier. [VERIFIED: IssueListRow.tsx, issues.ts `mapGitHubIssue` which sets `id: issue.id`]
**Warning signs:** Two issues from different repos both showing as "selected" when clicking one.

### Pitfall 6: Loading State Flicker on Navigation
**What goes wrong:** Every navigation to `/issues` shows skeleton rows even if data is fresh in cache.
**Why it happens:** TanStack Query's default `staleTime: 2 * 60 * 1000` (configured in `queryClient`) means data is fresh for 2 minutes. But if `queryKey` doesn't match the cache, a new fetch fires.
**How to avoid:** Use the same queryKey structure consistently so cache hits occur on re-navigation. The `staleTime` in `queryClient` defaults is already set globally. [VERIFIED: App.tsx QueryClient config]
**Warning signs:** Full skeleton flash every time user navigates back to `/issues`.

---

## Code Examples

### Full useQueries Setup (Verified Pattern)

```typescript
// Source: [VERIFIED: TanStack Query v5 docs, adapted from IssuesView.tsx patterns]
import { useQueries } from '@tanstack/react-query';
import { useProductStore } from '../stores/product-store';
import type { RepoSource } from '@shared/types/product';
import type { PaginatedIssuesResult } from '@shared/types/github';

// Inside AllIssuesView component:
const { products } = useProductStore();
const { state } = useAllIssuesFilters();

const productsWithRepo = useMemo(
  () => products.filter(p => p.sources.some(s => s.type === 'repo')),
  [products]
);

const issueQueries = useQueries({
  queries: productsWithRepo.map(product => {
    const repoSource = product.sources.find(s => s.type === 'repo') as RepoSource;
    return {
      queryKey: ['issues', 'all', product.id, state],
      queryFn: async (): Promise<PaginatedIssuesResult> => {
        const params = new URLSearchParams({ state, page: '1', per_page: '50' });
        const res = await fetch(
          `/api/github/repos/${repoSource.owner}/${repoSource.repo}/issues?${params}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 429) {
            const err = new Error('rate_limited') as any;
            err.retryAfter = body.retryAfter;
            throw err;
          }
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      },
    };
  }),
});

const isAnyLoading = issueQueries.some(q => q.isLoading);
```

### i18n Keys to Add (Verified Against Existing Structure)

```json
// apps/web/src/shared/i18n/locales/en/issues.json — add under allIssues:
// Source: [VERIFIED: UI-SPEC.md Copywriting Contract]
"allIssues": {
  "heading": "All Issues",
  "searchPlaceholder": "Search all issues...",
  "empty": {
    "openHeading": "No open issues",
    "closedHeading": "No closed issues",
    "body": "Issues from all connected repos will appear here."
  },
  "error": {
    "heading": "{{repoName}} — could not load issues",
    "body": "Check your GitHub connection or try again.",
    "rateLimit": "{{repoName}} — rate limited, retry in {{retryAfter}}s",
    "rateLimitUnknown": "{{repoName}} — rate limited",
    "retry": "Retry load",
    "dismiss": "Dismiss error for {{repoName}}"
  },
  "productBadge": {
    "tooltip": "From {{productName}}"
  }
}

// apps/web/src/shared/i18n/locales/en/navigation.json — add under items:
// Source: [VERIFIED: navigation.json structure, UI-SPEC.md]
"allIssues": "All Issues"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple `useQuery()` hooks for parallel queries | `useQueries()` for dynamic-length parallel queries | TanStack Query v3 → v4 | Hooks-in-loops became illegal with React rules; `useQueries` is the correct solution |
| Shared PAT via `GITHUB_TOKEN` env var | Per-user OAuth token (Phase 3) | Phase 3 completion | All GitHub API calls are now user-scoped; fan-out in Phase 4 must use authenticated user's token per request |
| `react-query` package name | `@tanstack/react-query` | v4 rebranding | Package already updated in this project [VERIFIED: package.json] |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 3 fully migrated all `/api/github/repos/:owner/:repo/issues` calls to use per-user OAuth token | Pitfall 4 | Fan-out queries fail with 401 if token lookup is still reading `GITHUB_TOKEN` env var |
| A2 | `product.color` is always a valid CSS hex string (e.g., `#3B82F6`) | Pattern 3 | Inline `style={{ backgroundColor: product.color }}` produces invalid CSS; badge renders transparent |

---

## Open Questions

1. **Per-product pagination in unified view**
   - What we know: Phase 2 uses `useInfiniteQuery` with a "Load More" button (50 items per page). The unified view (D-04) uses `useQueries` with a single page fetch.
   - What's unclear: CONTEXT.md does not specify whether `AllIssuesView` supports "Load More" pagination. The plan as described fetches page 1 (50 issues) per repo.
   - Recommendation: For Phase 4, fetch only page 1 per repo (50 issues × N repos). Do not implement cross-repo pagination in this phase. If needed, add in Phase 5 or as a follow-up. Flag in plan for human confirmation if desired.

2. **Products with no repo source**
   - What we know: `Product.sources` is typed as `ProductSource[]` which includes `repos`, `github_project`, `gitlab_project` types in addition to `repo`.
   - What's unclear: Should products with `sources.type === 'repos'` (MultiRepoSource) also appear in the unified view?
   - Recommendation: Filter for `type === 'repo'` only (as stated in CONTEXT.md code snippet). Products with `MultiRepoSource` or project sources are out of scope for Phase 4.

---

## Environment Availability

Step 2.6: Environment audit — Phase 4 is purely frontend code changes. No new CLIs, databases, or external services are required beyond what Phases 1-3 already introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Dev tooling | ✓ | (existing) | — |
| `@tanstack/react-query` | `useQueries` fan-out | ✓ | `^5.99.2` | — |
| Existing `/api/github/repos/:owner/:repo/issues` endpoint | Data fetching | ✓ | (Phase 1) | — |
| `lucide-react` (`Inbox` icon) | Sidebar NavLink | ✓ | (existing) | Use `GitBranch` or `List` if `Inbox` not in installed version |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed) |
| Config file | `apps/web/vite.config.ts` or `vitest.config.ts` |
| Quick run command | `cd apps/web && npm test` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CROSS-01 | `useQueries` issues from N repos merged + sorted | unit | `cd apps/web && npm test -- --reporter=verbose` | ❌ Wave 0 |
| CROSS-02 | `IssueListRow` renders product badge when prop provided; renders nothing when absent | unit | `cd apps/web && npm test -- --reporter=verbose` | ❌ Wave 0 |
| CROSS-03 | One failed query shows error banner; other repos' issues still display | unit | `cd apps/web && npm test -- --reporter=verbose` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/web && npm test`
- **Per wave merge:** `cd apps/web && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/src/client/components/AllIssuesView.test.tsx` — covers CROSS-01, CROSS-03
- [ ] `apps/web/src/client/components/IssueListRow.test.tsx` — covers CROSS-02 (productBadge prop rendering)
- [ ] Shared test setup for mocking `useProductStore` and `@tanstack/react-query`'s `useQueries`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authenticateRequest()` middleware already on all `/api/github/` routes [VERIFIED: issues.ts] |
| V3 Session Management | no | Session handled by Phase 3 OAuth; no new session logic in Phase 4 |
| V4 Access Control | no | No new access control surfaces — reuses existing per-user token per Phase 3 |
| V5 Input Validation | yes | URL param `state` validated by existing `githubIssueQuerySchema` on server; client reads from `useSearchParams` (string, safe) |
| V6 Cryptography | no | No new crypto; OAuth tokens managed by Phase 3 |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `?state=` param | Tampering | `state` is only `'open' | 'closed'` — validated server-side by `githubIssueQuerySchema` [VERIFIED: validation.ts usage in issues.ts] |
| XSS via issue title in search | Tampering | React escapes by default; `issue.title` rendered as text nodes, not `dangerouslySetInnerHTML` [VERIFIED: IssueListRow.tsx] |
| CSRF on API calls | Spoofing | API calls use `credentials: 'include'` with session cookie; standard same-origin protection applies |
| Token leakage in URL | Information Disclosure | OAuth tokens are in cookies / Authorization header, not URL params; fan-out queries use `credentials: 'include'` |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: apps/web/package.json] — `@tanstack/react-query ^5.99.2`, React 19, TypeScript 5.8
- [VERIFIED: apps/web/src/client/components/IssuesView.tsx] — Phase 2 query pattern, component structure
- [VERIFIED: apps/web/src/client/components/IssueListRow.tsx] — current props, render structure
- [VERIFIED: apps/web/src/client/components/Sidebar.tsx] — NavLink pattern, lucide-react imports
- [VERIFIED: apps/web/src/client/hooks/useIssuesFilters.ts] — URL param filter pattern
- [VERIFIED: apps/web/api/github/repos/[owner]/[repo]/issues.ts] — existing endpoint, auth middleware
- [VERIFIED: apps/web/api/_lib/github.ts] — `GitHubRateLimitError` shape, `retryAfter` field
- [VERIFIED: apps/web/src/shared/types/product.ts] — `Product.color`, `RepoSource` type
- [VERIFIED: apps/web/src/shared/i18n/locales/en/issues.json] — existing i18n structure
- [VERIFIED: apps/web/src/shared/i18n/locales/en/navigation.json] — navigation i18n structure
- [VERIFIED: .planning/phases/04-cross-repo-unified-view/04-UI-SPEC.md] — visual contract
- [CITED: https://github.com/tanstack/query/blob/main/docs/framework/react/guides/dependent-queries.md] — `useQueries` dynamic parallel query pattern

### Secondary (MEDIUM confidence)
- TanStack Query v5 `useQueries` API — confirmed via ctx7 CLI docs fetch

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; all components verified by file reads
- Architecture: HIGH — CONTEXT.md decisions are precise; existing code patterns directly inform the approach
- Pitfalls: HIGH — derived from direct code inspection of existing components + known TanStack Query constraints
- i18n: HIGH — existing namespace structure verified, UI-SPEC provides complete copywriting contract

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable dependencies; TanStack Query v5 API is stable)
