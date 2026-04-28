# Phase 4: Cross-Repo Unified View - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 7 (1 new component, 3 modified files, 2 i18n files, 1 new hook)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/client/components/AllIssuesView.tsx` | component | request-response, fan-out | `apps/web/src/client/components/IssuesView.tsx` | exact (same view role, adapted for multi-repo) |
| `apps/web/src/client/components/IssueListRow.tsx` | component | transform | `apps/web/src/client/components/IssueListRow.tsx` | self — backward-compatible prop extension |
| `apps/web/src/client/hooks/useAllIssuesFilters.ts` | hook | request-response | `apps/web/src/client/hooks/useIssuesFilters.ts` | exact (simplified variant) |
| `apps/web/src/client/App.tsx` | config/routing | request-response | `apps/web/src/client/App.tsx` | self — add one `<Route>` |
| `apps/web/src/client/components/Sidebar.tsx` | component | request-response | `apps/web/src/client/components/Sidebar.tsx` | self — add one `NavLink` |
| `apps/web/src/shared/i18n/locales/en/issues.json` | config | transform | existing `en/issues.json` | self — add `allIssues.*` keys |
| `apps/web/src/shared/i18n/locales/fr/issues.json` | config | transform | existing `fr/issues.json` | self — add `allIssues.*` keys (French) |

---

## Pattern Assignments

### `apps/web/src/client/components/AllIssuesView.tsx` (component, fan-out)

**Analog:** `apps/web/src/client/components/IssuesView.tsx`

**Imports pattern** (lines 1–14 of IssuesView.tsx):
```typescript
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';          // switch from useInfiniteQuery
import { AlertCircle, Inbox } from 'lucide-react';
import { useProductStore } from '../stores/product-store';
import { useAllIssuesFilters } from '../hooks/useAllIssuesFilters';  // new hook
import { IssueListRow } from './IssueListRow';
import { IssueDetailPanel } from './IssueDetailPanel';
import { IssueSkeletonRow } from './IssueSkeletonRow';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { GitHubIssue } from '@shared/types/github';
import type { Product, RepoSource } from '@shared/types/product';
```

**useQueries fan-out pattern** (modeled on IssuesView.tsx lines 57–86):
```typescript
const { products } = useProductStore();
const { state, search, setSearch, setStateFilter, resetFilters, hasActiveFilters } =
  useAllIssuesFilters();

const productsWithRepo = useMemo(
  () => products.filter(p => p.sources.some(s => s.type === 'repo')),
  [products]
);

const issueQueries = useQueries({
  queries: productsWithRepo.map(product => {
    const repoSource = product.sources.find(s => s.type === 'repo') as RepoSource;
    return {
      // Prefix with 'all' to avoid cache collision with IssuesView (Pitfall 1 from RESEARCH.md)
      queryKey: ['issues', 'all', product.id, state],
      queryFn: async () => {
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
```

**Merge + sort pattern** (modeled on IssuesView.tsx line 105):
```typescript
// Each query result maps 1:1 to productsWithRepo[i] — keep productsWithRepo memoized (Pitfall 2)
const allIssues = useMemo(() => {
  const issues: Array<GitHubIssue & { product: Product }> = [];
  issueQueries.forEach((query, i) => {
    if (query.data) {
      const product = productsWithRepo[i];
      query.data.issues.forEach((issue: GitHubIssue) => {
        issues.push({ ...issue, product });
      });
    }
  });
  // Sort by updatedAt desc (D-06)
  return issues.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}, [issueQueries, productsWithRepo]);
```

**Client-side search filter** (mirrors IssuesView.tsx lines 108–112):
```typescript
const filteredIssues = useMemo(() => {
  if (!search.trim()) return allIssues;
  const q = search.toLowerCase();
  return allIssues.filter(i => i.title.toLowerCase().includes(q));
}, [allIssues, search]);
```

**Loading state pattern** (mirrors IssuesView.tsx lines 161–163):
```typescript
// isLoading only = all queries still initializing; once any resolves, show partial results
const isAllLoading = issueQueries.length > 0 && issueQueries.every(q => q.isLoading);

// In JSX:
{isAllLoading && Array.from({ length: 8 }).map((_, i) => <IssueSkeletonRow key={i} />)}
```

**Per-repo error banners** (D-12 to D-15; banner layout mirrors IssuesView.tsx lines 164–176):
```typescript
const [dismissedRepos, setDismissedRepos] = useState<Set<string>>(new Set());

// In JSX, above issue list:
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
          isRateLimit ? 'bg-warning/10 border-warning/30' : 'bg-destructive/10 border-destructive/30'
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

**Issue list render** (mirrors IssuesView.tsx lines 198–205 — add `productBadge` prop):
```typescript
{filteredIssues.map(issue => (
  <IssueListRow
    key={issue.id}
    issue={issue}
    isSelected={issue.id === selectedIssueId}
    onClick={() => setSelectedIssueId(issue.id)}
    productBadge={{ color: issue.product.color, name: issue.product.name }}
  />
))}
```

**Empty state pattern** (mirrors IssuesView.tsx lines 176–196):
```typescript
{filteredIssues.length === 0 && !isAllLoading && (
  <div className="flex flex-1 items-center justify-center p-8">
    <div className="text-center space-y-3">
      <Inbox className="h-8 w-8 text-muted-foreground mx-auto" />
      <h3 className="text-sm font-medium">
        {state === 'open'
          ? t('allIssues.empty.openHeading')
          : t('allIssues.empty.closedHeading')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('allIssues.empty.body')}</p>
    </div>
  </div>
)}
```

**`useTranslation` call** (mirrors IssuesView.tsx line 29):
```typescript
const { t } = useTranslation('issues');
```

---

### `apps/web/src/client/components/IssueListRow.tsx` (component, transform — backward-compatible extension)

**Analog:** `apps/web/src/client/components/IssueListRow.tsx` (self)

**Current props interface** (lines 8–12 of IssueListRow.tsx):
```typescript
interface IssueListRowProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
}
```

**Extended props interface** — add optional `productBadge` (absent = single-repo view unchanged):
```typescript
interface ProductBadgeInfo {
  color: string;   // hex from product.color e.g. '#3B82F6'
  name: string;    // product.name, truncated in render
}

interface IssueListRowProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
  productBadge?: ProductBadgeInfo;   // NEW — optional; absent = single-repo IssuesView unchanged
}
```

**Color dot pattern** (from Sidebar.tsx lines 89–92, same `h-3 w-3 rounded-full` style):
```typescript
// Sidebar.tsx uses h-3 w-3; label dots in IssueListRow.tsx use h-2 w-2. Use h-2 w-2 to match label dots.
<div
  className="h-2 w-2 rounded-full flex-shrink-0"
  style={{ backgroundColor: productBadge.color }}
/>
```

**Product badge render** — insert after state Badge (line 87 of IssueListRow.tsx), before closing `</div>`:
```typescript
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

---

### `apps/web/src/client/hooks/useAllIssuesFilters.ts` (hook, request-response)

**Analog:** `apps/web/src/client/hooks/useIssuesFilters.ts`

**Full file pattern** (lines 1–66 of useIssuesFilters.ts — drop labels/assignee, keep state + search):
```typescript
import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type IssueState = 'open' | 'closed';

export function useAllIssuesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  // client-side only — NOT serialized to URL (D-09)
  const [search, setSearch] = useState('');

  // Read state from URL (D-08: ?state=open|closed)
  const state = (searchParams.get('state') as IssueState) ?? 'open';

  const hasActiveFilters = state !== 'open' || search !== '';

  // ALWAYS use functional updater form to avoid clobbering unrelated params
  // (same pattern as useIssuesFilters.ts line 26-43)
  const setStateFilter = useCallback(
    (newState: IssueState) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('state', newState);
        return next;
      });
    },
    [setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('state');
      return next;
    });
  }, [setSearchParams]);

  return {
    state,
    search,
    setSearch,
    setStateFilter,
    resetFilters,
    hasActiveFilters,
  };
}
```

---

### `apps/web/src/client/App.tsx` (config/routing — add one `<Route>`)

**Analog:** `apps/web/src/client/App.tsx` (self)

**Route insertion pattern** (lines 100–104 of App.tsx — insert after the existing issues route):
```typescript
// Existing (line 100-104):
{/* Issues browser — Phase 2 */}
<Route
  path="/products/:productId/issues"
  element={<IssuesView />}
/>

// Add after above:
{/* All Issues unified view — Phase 4 */}
<Route
  path="/issues"
  element={<AllIssuesView />}
/>
```

**Import addition** (mirrors line 14 of App.tsx):
```typescript
import { AllIssuesView } from './components/AllIssuesView';  // add alongside IssuesView import
```

---

### `apps/web/src/client/components/Sidebar.tsx` (component — add one `NavLink`)

**Analog:** `apps/web/src/client/components/Sidebar.tsx` (self)

**Lucide import extension** (line 6 of Sidebar.tsx — add `Inbox`):
```typescript
// Before:
import { LayoutDashboard, Plus, Settings, RefreshCw, LogOut } from 'lucide-react';
// After:
import { LayoutDashboard, Plus, Settings, RefreshCw, LogOut, Inbox } from 'lucide-react';
```

**NavLink pattern** (mirrors existing "All Products" NavLink, lines 55–67 of Sidebar.tsx):
```typescript
// Insert between the "All Products" NavLink (ends line 67) and the ScrollArea (line 70):
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

---

### `apps/web/src/shared/i18n/locales/en/issues.json` (config — add `allIssues.*` keys)

**Analog:** existing `en/issues.json` (self)

**Existing structure** (lines 1–43 of en/issues.json — add `allIssues` block at top level):
```json
{
  "tab": { ... },
  "filters": { ... },
  "list": { ... },
  "empty": { ... },
  "error": { ... },
  "detail": { ... },
  "state": { ... },

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
}
```

**navigation.json addition** — mirrors `navigation:items.settings` key pattern (line 5 of en/navigation.json):
```json
{
  "items": {
    "allProducts": "All Products",
    "kanban": "Kanban Board",
    "kanbanTab": "Kanban",
    "settings": "Settings",
    "allIssues": "All Issues"
  }
}
```

---

### `apps/web/src/shared/i18n/locales/fr/issues.json` (config — add French `allIssues.*` keys)

**Analog:** existing `fr/issues.json` (self)

**French additions** — mirrors en/issues.json structure (lines 1–43 of fr/issues.json):
```json
"allIssues": {
  "heading": "Toutes les issues",
  "searchPlaceholder": "Rechercher toutes les issues...",
  "empty": {
    "openHeading": "Aucune issue ouverte",
    "closedHeading": "Aucune issue fermée",
    "body": "Les issues de tous les dépôts connectés apparaîtront ici."
  },
  "error": {
    "heading": "{{repoName}} — impossible de charger les issues",
    "body": "Vérifiez votre connexion GitHub ou réessayez.",
    "rateLimit": "{{repoName}} — limite de taux atteinte, réessayez dans {{retryAfter}}s",
    "rateLimitUnknown": "{{repoName}} — limite de taux atteinte",
    "retry": "Réessayer le chargement",
    "dismiss": "Ignorer l'erreur pour {{repoName}}"
  },
  "productBadge": {
    "tooltip": "De {{productName}}"
  }
}
```

**fr/navigation.json addition**:
```json
"allIssues": "Toutes les issues"
```

---

## Shared Patterns

### Authentication / Credentials
**Source:** `apps/web/src/client/components/IssuesView.tsx` lines 72–73
**Apply to:** All `queryFn` fetch calls in `AllIssuesView`
```typescript
const res = await fetch(url, { credentials: 'include' });
```

### Error Response Shape
**Source:** `apps/web/src/client/components/IssuesView.tsx` lines 76–79
**Apply to:** `queryFn` in `AllIssuesView.tsx`
```typescript
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || `HTTP ${res.status}`);
}
```

### Client-side Search Filter
**Source:** `apps/web/src/client/components/IssuesView.tsx` lines 108–112
**Apply to:** `AllIssuesView.tsx` after merge
```typescript
const filteredIssues = useMemo(() => {
  if (!search.trim()) return allIssues;
  const q = search.toLowerCase();
  return allIssues.filter(i => i.title.toLowerCase().includes(q));
}, [allIssues, search]);
```

### URL-Persisted Filter State
**Source:** `apps/web/src/client/hooks/useIssuesFilters.ts` lines 13–18, 26–43
**Apply to:** `useAllIssuesFilters.ts`
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const state = (searchParams.get('state') as IssueState) ?? 'open';

// Functional updater form — always update via callback to avoid clobbering params
setSearchParams(prev => {
  const next = new URLSearchParams(prev);
  next.set('state', newState);
  return next;
});
```

### Skeleton Loading Rows
**Source:** `apps/web/src/client/components/IssuesView.tsx` lines 161–163
**Apply to:** `AllIssuesView.tsx` loading state
```typescript
Array.from({ length: 8 }).map((_, i) => <IssueSkeletonRow key={i} />)
```

### Product Color Dot
**Source:** `apps/web/src/client/components/Sidebar.tsx` lines 89–92
**Apply to:** `IssueListRow.tsx` product badge dot + sidebar "All Issues" NavLink does NOT need a dot
```typescript
<div
  className="h-3 w-3 rounded-full shrink-0"
  style={{ backgroundColor: product.color }}
/>
// Note: IssueListRow label dots use h-2 w-2 (IssueListRow.tsx line 46) — match that size for the product badge dot
```

### NavLink Active Style
**Source:** `apps/web/src/client/components/Sidebar.tsx` lines 56–67
**Apply to:** new "All Issues" `NavLink` in `Sidebar.tsx`
```typescript
className={({ isActive }) =>
  cn(
    'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50',
    isActive && 'bg-accent text-accent-foreground font-medium'
  )
}
```

### i18n Translation Call
**Source:** `apps/web/src/client/components/IssuesView.tsx` lines 29–30
**Apply to:** `AllIssuesView.tsx`
```typescript
const { t } = useTranslation('issues');
// For navigation key in Sidebar.tsx: useTranslation(['navigation', 'common', 'auth']) already present
```

---

## No Analog Found

All files have strong analogs within the codebase. No files require fallback to external documentation patterns.

---

## Metadata

**Analog search scope:** `apps/web/src/client/components/`, `apps/web/src/client/hooks/`, `apps/web/src/client/stores/`, `apps/web/src/client/App.tsx`, `apps/web/src/shared/i18n/`
**Files read:** 12
**Pattern extraction date:** 2026-04-21
