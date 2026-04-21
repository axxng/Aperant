# Phase 2: Single-Repo Issues Browser - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 12
**Analogs found:** 10 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/api/github/repos/[owner]/[repo]/labels.ts` | route | request-response | `apps/web/api/github/repos/[owner]/[repo]/issues.ts` | exact |
| `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts` | test | request-response | `apps/web/api/_lib/github.test.ts` | role-match |
| `apps/web/api/github/repos/[owner]/[repo]/labels.test.ts` | test | request-response | `apps/web/api/_lib/github.test.ts` | role-match |
| `apps/web/src/client/App.tsx` | config/route | request-response | `apps/web/src/client/App.tsx` (self — modify) | exact |
| `apps/web/src/client/components/IssuesView.tsx` | component | request-response | `apps/web/src/client/App.tsx` (ProductView fn) | role-match |
| `apps/web/src/client/components/IssuesFilterBar.tsx` | component | event-driven | `apps/web/src/client/components/KanbanFilterBar.tsx` | exact |
| `apps/web/src/client/components/IssueListRow.tsx` | component | event-driven | `apps/web/src/client/components/TaskCard.tsx` | role-match |
| `apps/web/src/client/components/IssueDetailPanel.tsx` | component | request-response | `apps/web/src/client/components/TaskCard.tsx` | partial |
| `apps/web/src/client/components/IssueSkeletonRow.tsx` | component | — | none (pattern from RESEARCH.md) | no-analog |
| `apps/web/src/client/hooks/useIssuesFilters.ts` | hook | event-driven | `apps/web/src/client/hooks/useKanbanFilters.ts` | role-match |
| `apps/web/src/shared/i18n/locales/en/issues.json` | config | — | `apps/web/src/shared/i18n/locales/en/tasks.json` | exact |
| `apps/web/src/shared/i18n/locales/fr/issues.json` | config | — | `apps/web/src/shared/i18n/locales/fr/tasks.json` | exact |

---

## Pattern Assignments

### `apps/web/api/github/repos/[owner]/[repo]/labels.ts` (route, request-response)

**Analog:** `apps/web/api/github/repos/[owner]/[repo]/issues.ts`

**Imports pattern** (lines 1-5):
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API, GitHubRateLimitError } from '../../../../_lib/github.js';
import { githubOwnerRepoSchema } from '../../../../_lib/validation.js';
```

Note: Use `githubOwnerRepoSchema` (not `githubIssueQuerySchema`) for path param validation — it's already defined in `validation.ts` lines 131-134 with regex guards for `owner`/`repo`.

**Auth + method guard pattern** (lines 7-15):
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;
```

**Core fetch pattern** (lines 17-46):
```typescript
  try {
    const pathResult = githubOwnerRepoSchema.safeParse(req.query);
    if (!pathResult.success) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    const { owner, repo } = pathResult.data;

    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels?per_page=100`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }

    const labels = await response.json();
    res.json({ labels: labels.map((l: any) => ({ id: l.id, name: l.name, color: l.color, description: l.description ?? null })) });
  } catch (error: any) {
    if (error instanceof GitHubRateLimitError) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Error handling pattern** (lines 47-52 of issues.ts):
```typescript
  } catch (error: any) {
    if (error instanceof GitHubRateLimitError) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
```

---

### `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts` (test, request-response)

**Analog:** `apps/web/api/_lib/github.test.ts`

**Test file structure pattern** (lines 1-17 of github.test.ts):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import the module under test and its direct dependencies to mock
import { GitHubRateLimitError, githubFetch } from './github.js';

// Mock dependencies that have side effects (DB, credentials, network)
vi.mock('../../../../_lib/config-resolver.js', () => ({
  resolveConfig: vi.fn().mockResolvedValue('fake-token'),
}));
vi.mock('../../../../_lib/db/client.js', () => ({ ensureDb: vi.fn() }));
vi.mock('../../../../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

// Helper to create mock Response objects
function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Response;
}
```

**Test describe/it pattern** (lines 19-71 of github.test.ts):
```typescript
describe('issues handler', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  it('returns open issues with correct shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, [
      { id: 1, number: 1, title: 'Test issue', body: 'body', state: 'open',
        labels: [{ id: 10, name: 'bug', color: 'ee0701', description: null }],
        assignees: [{ login: 'alice', avatar_url: 'https://...' }],
        user: { login: 'bob', avatar_url: 'https://...' },
        created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z',
        closed_at: null, comments: 2, html_url: 'https://github.com/owner/repo/issues/1',
        url: 'https://api.github.com/repos/owner/repo/issues/1',
      }
    ], { link: '' }));

    // Call the handler with a mock req/res ...
    expect(result.issues[0]).toMatchObject({ number: 1, title: 'Test issue', state: 'open' });
    expect(result.hasMore).toBe(false);
  });
});
```

---

### `apps/web/api/github/repos/[owner]/[repo]/labels.test.ts` (test, request-response)

**Analog:** `apps/web/api/_lib/github.test.ts`

Same test file structure pattern as `issues.test.ts` above. Tests should verify:
- Labels returned with `id`, `name`, `color`, `description` shape
- `authenticateRequest` enforced (handler returns early without user)
- 405 on non-GET method
- `GitHubRateLimitError` causes 429 response with `retryAfter`

---

### `apps/web/src/client/App.tsx` (config/route — MODIFY)

**Analog:** self

**QueryClientProvider wrap pattern** — add above `AuthenticatedApp` return (lines 60-98):
```typescript
// Add at top of file with other imports:
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IssuesView } from './components/IssuesView';

// Declare outside component to avoid re-creation on render:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // 2 minutes
      gcTime: 5 * 60 * 1000,          // 5 minutes GC
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

**Existing Routes block pattern** (lines 65-82 of App.tsx — add IssuesView route after line 73):
```typescript
// Wrap the TooltipProvider return value:
return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar onAddProduct={() => setShowCreateProduct(true)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<ConsolidatedView ... />} />
            <Route path="/products/:productId" element={<ProductView ... />} />
            {/* ADD THIS ROUTE: */}
            <Route path="/products/:productId/issues" element={<IssuesView />} />
            <Route path="/products/:productId/settings" element={<ProductSettings />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      {/* ... dialogs ... */}
    </TooltipProvider>
  </QueryClientProvider>
);
```

---

### `apps/web/src/client/components/IssuesView.tsx` (component, request-response)

**Analog:** `apps/web/src/client/App.tsx` (ProductView function, lines 122-143)

**Imports pattern** (follow App.tsx style):
```typescript
import { useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useProductStore } from '../stores/product-store';
import { IssuesFilterBar } from './IssuesFilterBar';
import { IssueListRow } from './IssueListRow';
import { IssueDetailPanel } from './IssueDetailPanel';
import { IssueSkeletonRow } from './IssueSkeletonRow';
import { useIssuesFilters } from '../hooks/useIssuesFilters';
import { Button } from './ui/button';
```

**useParams + product store derivation pattern** (lines 123-130 of App.tsx):
```typescript
function IssuesView() {
  const { productId } = useParams<{ productId: string }>();
  const { products, setActiveProduct } = useProductStore();

  // Bypass getActiveProduct() — read directly to support direct URL navigation
  const product = products.find(p => p.id === productId);
  const repoSource = product?.sources.find(s => s.type === 'repo');

  // Sync active product (mirrors ProductView pattern):
  useEffect(() => {
    if (productId) setActiveProduct(productId);
  }, [productId, setActiveProduct]);

  if (!repoSource) {
    return <NoRepoSourceState />;
  }
  // ...
}
```

**Tab switcher pattern** — use NavLink pair (matches Sidebar NavLink pattern, avoids extra Radix dep):
```tsx
<div className="flex items-center gap-0 border-b border-border px-4">
  <NavLink
    to={`/products/${productId}`}
    end
    className={({ isActive }) =>
      cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )
    }
  >
    {t('issues:tabs.kanban')}
  </NavLink>
  <NavLink
    to={`/products/${productId}/issues`}
    className={/* same pattern */}
  >
    {t('issues:tabs.issues')}
  </NavLink>
</div>
```

---

### `apps/web/src/client/components/IssuesFilterBar.tsx` (component, event-driven)

**Analog:** `apps/web/src/client/components/KanbanFilterBar.tsx`

**Imports pattern** (lines 1-19 of KanbanFilterBar.tsx):
```typescript
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Tag, User } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';
```

**Search input pattern** (lines 54-76 of KanbanFilterBar.tsx — copy exactly):
```tsx
<div className="relative flex-1 max-w-xs">
  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <input
    type="text"
    value={searchQuery}
    onChange={e => onSearchChange(e.target.value)}
    placeholder={t('issues:filters.searchPlaceholder')}
    className={cn(
      'w-full h-8 pl-8 pr-8 rounded-md border border-input bg-background text-sm',
      'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
    )}
  />
  {searchQuery && (
    <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
      <X className="h-3.5 w-3.5" />
    </button>
  )}
</div>
```

**Multi-select checkbox dropdown pattern** (lines 79-105 of KanbanFilterBar.tsx — use for label filter):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="h-8 gap-1.5">
      <Tag className="h-3.5 w-3.5" />
      {t('issues:filters.labels')}
      {selectedLabels.length > 0 && (
        <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
          {selectedLabels.length}
        </Badge>
      )}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" className="w-48">
    <DropdownMenuLabel>{t('issues:filters.labels')}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    {allLabels.map(label => (
      <DropdownMenuCheckboxItem
        key={label.name}
        checked={selectedLabels.includes(label.name)}
        onCheckedChange={() => onToggleLabel(label.name)}
        onSelect={e => e.preventDefault()}   // keep dropdown open on select
      >
        <span className="h-2 w-2 rounded-full flex-shrink-0 mr-1.5"
              style={{ backgroundColor: `#${label.color}` }} />
        {label.name}
      </DropdownMenuCheckboxItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

**Radio group single-select pattern** (lines 137-153 of KanbanFilterBar.tsx — use for state + assignee filters):
```tsx
<DropdownMenuRadioGroup value={state} onValueChange={v => onStateChange(v as 'open' | 'closed')}>
  <DropdownMenuRadioItem value="open">{t('issues:filters.state.open')}</DropdownMenuRadioItem>
  <DropdownMenuRadioItem value="closed">{t('issues:filters.state.closed')}</DropdownMenuRadioItem>
</DropdownMenuRadioGroup>
```

**Reset button pattern** (lines 155-161 of KanbanFilterBar.tsx):
```tsx
{hasActiveFilters && (
  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onResetFilters}>
    <X className="h-3.5 w-3.5 mr-1" />
    {t('issues:filters.reset')}
  </Button>
)}
```

---

### `apps/web/src/client/components/IssueListRow.tsx` (component, event-driven)

**Analog:** `apps/web/src/client/components/TaskCard.tsx`

**Imports pattern** (lines 1-19 of TaskCard.tsx — adapt):
```typescript
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import type { GitHubIssue } from '@shared/types/github';
```

**Label color dot pattern** (lines 239-253 of TaskCard.tsx — copy exactly):
```tsx
{issue.labels.map(label => (
  <span
    key={label.name}
    className="h-2 w-2 rounded-full flex-shrink-0"
    style={{ backgroundColor: `#${label.color}` }}  // MUST include # prefix
    title={label.name}
  />
))}
```

**Assignee avatar pattern** (lines 258-277 of TaskCard.tsx — copy exactly):
```tsx
{issue.assignees.map(assignee => (
  <div
    key={assignee.login}
    className="h-5 w-5 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
    title={assignee.login}
  >
    {assignee.avatarUrl ? (
      <img src={assignee.avatarUrl} alt={assignee.login} className="h-full w-full object-cover" />
    ) : (
      <span className="text-[9px] font-medium text-muted-foreground uppercase">
        {assignee.login.slice(0, 2)}
      </span>
    )}
  </div>
))}
```

**Badge variant pattern** (lines 154-169 of TaskCard.tsx):
```typescript
// Open issue → variant="success"   (maps to --success: #4EBE96)
// Closed issue → variant="muted"
const getStateBadgeVariant = (state: 'open' | 'closed') =>
  state === 'open' ? 'success' as const : 'muted' as const;
```

**Dense row layout pattern** (not in TaskCard — use flat row, not Card):
```tsx
export const IssueListRow = memo(function IssueListRow({
  issue, isSelected, onClick
}: { issue: GitHubIssue; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 border-b border-border cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent'
      )}
    >
      {/* Issue number */}
      <span className="text-xs text-muted-foreground w-12 flex-shrink-0">#{issue.number}</span>
      {/* State badge */}
      <Badge variant={getStateBadgeVariant(issue.state)} className="text-[10px] px-1.5 py-0 flex-shrink-0">
        {issue.state}
      </Badge>
      {/* Title (truncated) */}
      <span className="flex-1 text-sm truncate">{issue.title}</span>
      {/* Label color dots */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {issue.labels.slice(0, 5).map(label => (
          <span key={label.name} className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: `#${label.color}` }} title={label.name} />
        ))}
      </div>
      {/* Assignee avatars */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {issue.assignees.slice(0, 3).map(/* assignee avatar pattern above */)}
      </div>
    </div>
  );
});
```

---

### `apps/web/src/client/components/IssueDetailPanel.tsx` (component, request-response)

**Analog:** `apps/web/src/client/components/TaskCard.tsx` (partial — structure only)

**Imports pattern**:
```typescript
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';  // default import — ESM-only package
import { ExternalLink, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import type { GitHubIssue } from '@shared/types/github';
```

**Slide-in panel layout pattern** (CSS transform, no Radix Sheet):
```tsx
<div
  className={cn(
    'fixed right-0 top-0 h-full w-[40%] min-w-[320px] bg-background border-l border-border shadow-xl',
    'transform transition-transform duration-200 ease-in-out z-50',
    isOpen ? 'translate-x-0' : 'translate-x-full'
  )}
>
  <ScrollArea className="h-full">
    <div className="p-6 space-y-4">
      {/* header, badges, body */}
    </div>
  </ScrollArea>
</div>
```

**Markdown rendering pattern** (D-17 requirement):
```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  className="prose prose-sm dark:prose-invert max-w-none"
>
  {issue.body ?? ''}
</ReactMarkdown>
```

**Label full-name with color pattern** (full badge, not just dot — for detail panel per D-07):
```tsx
{issue.labels.map(label => (
  <span
    key={label.name}
    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
    style={{ backgroundColor: `#${label.color}20`, borderColor: `#${label.color}60`, color: `#${label.color}` }}
  >
    {label.name}
  </span>
))}
```

**"View on GitHub" button pattern** (from tasks.json pr.viewOnGitHub precedent):
```tsx
<Button variant="outline" size="sm" asChild>
  <a href={issue.htmlUrl} target="_blank" rel="noreferrer" className="gap-1.5">
    <ExternalLink className="h-3.5 w-3.5" />
    {t('issues:detail.viewOnGitHub')}
  </a>
</Button>
```

---

### `apps/web/src/client/components/IssueSkeletonRow.tsx` (component, —)

**Analog:** None found in codebase. Use `animate-pulse` Tailwind pattern (per D-18 / CONTEXT.md).

**Pattern from RESEARCH.md + Tailwind animate-pulse:**
```tsx
export function IssueSkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border animate-pulse">
      <div className="h-3 w-10 rounded bg-muted flex-shrink-0" />  {/* issue number */}
      <div className="h-4 w-12 rounded bg-muted flex-shrink-0" />  {/* state badge */}
      <div className="h-3 flex-1 rounded bg-muted" />               {/* title */}
      <div className="flex gap-0.5">
        <div className="h-2 w-2 rounded-full bg-muted" />
        <div className="h-2 w-2 rounded-full bg-muted" />
      </div>
      <div className="h-5 w-5 rounded-full bg-muted flex-shrink-0" />  {/* avatar */}
    </div>
  );
}
```

Render 8 of these while `isLoading` is true in `IssuesView` (per D-18).

---

### `apps/web/src/client/hooks/useIssuesFilters.ts` (hook, event-driven)

**Analog:** `apps/web/src/client/hooks/useKanbanFilters.ts`

**Hook structure pattern** (lines 1-93 of useKanbanFilters.ts — adapt to URL params):
```typescript
import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type IssueState = 'open' | 'closed';

export interface IssuesFilters {
  state: IssueState;
  labels: string[];
  assignee: string;
}

export function useIssuesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');  // client-side only, NOT in URL (per D-10)

  // Read filter state from URL (per D-03)
  const state = (searchParams.get('state') as IssueState) ?? 'open';
  const labels = searchParams.getAll('label');   // multi-value: ?label=bug&label=feature
  const assignee = searchParams.get('assignee') ?? '';

  const hasActiveFilters =
    state !== 'open' || labels.length > 0 || assignee !== '' || search !== '';

  // ALWAYS use functional updater to avoid clobbering unrelated params (Pitfall 5)
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

  const resetFilters = useCallback(() => {
    setSearch('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('state'); next.delete('label'); next.delete('assignee');
      return next;
    });
  }, [setSearchParams]);

  return { state, labels, assignee, search, setSearch, setFilters, resetFilters, hasActiveFilters };
}
```

Key difference from `useKanbanFilters`: filter state lives in URL via `useSearchParams` (first use of this pattern in codebase), not local `useState`. The `search` field is the only local state.

---

### `apps/web/src/shared/i18n/locales/en/issues.json` (config, —)

**Analog:** `apps/web/src/shared/i18n/locales/en/tasks.json`

**File structure pattern** (tasks.json — follow same nesting style):
```json
{
  "tabs": {
    "kanban": "Kanban",
    "issues": "Issues"
  },
  "filters": {
    "searchPlaceholder": "Search issues...",
    "labels": "Labels",
    "assignee": "Assignee",
    "state": {
      "open": "Open",
      "closed": "Closed"
    },
    "reset": "Reset filters",
    "noResults": "No issues match your filters",
    "allAssignees": "All assignees",
    "labelsError": "Failed to load labels"
  },
  "list": {
    "loadMore": "Load more",
    "loading": "Loading issues...",
    "empty": {
      "open": "No open issues",
      "closed": "No closed issues",
      "openLink": "Open an issue on GitHub"
    }
  },
  "detail": {
    "viewOnGitHub": "View on GitHub",
    "openedBy": "Opened by",
    "on": "on",
    "noBody": "No description provided.",
    "close": "Close panel"
  },
  "errors": {
    "rateLimited": "GitHub rate limit reached. Try again in {{seconds}} seconds.",
    "fetchFailed": "Failed to load issues.",
    "noRepoSource": "This product does not have a connected GitHub repository."
  }
}
```

---

### `apps/web/src/shared/i18n/locales/fr/issues.json` (config, —)

**Analog:** `apps/web/src/shared/i18n/locales/fr/tasks.json`

**File structure pattern** (fr/tasks.json — French translations, same key structure):
```json
{
  "tabs": {
    "kanban": "Kanban",
    "issues": "Issues"
  },
  "filters": {
    "searchPlaceholder": "Rechercher des issues...",
    "labels": "Étiquettes",
    "assignee": "Assigné",
    "state": {
      "open": "Ouvertes",
      "closed": "Fermées"
    },
    "reset": "Réinitialiser les filtres",
    "noResults": "Aucune issue ne correspond à vos filtres",
    "allAssignees": "Tous les assignés",
    "labelsError": "Échec du chargement des étiquettes"
  },
  "list": {
    "loadMore": "Charger plus",
    "loading": "Chargement des issues...",
    "empty": {
      "open": "Aucune issue ouverte",
      "closed": "Aucune issue fermée",
      "openLink": "Ouvrir une issue sur GitHub"
    }
  },
  "detail": {
    "viewOnGitHub": "Voir sur GitHub",
    "openedBy": "Ouvert par",
    "on": "le",
    "noBody": "Aucune description fournie.",
    "close": "Fermer le panneau"
  },
  "errors": {
    "rateLimited": "Limite de taux GitHub atteinte. Réessayez dans {{seconds}} secondes.",
    "fetchFailed": "Échec du chargement des issues.",
    "noRepoSource": "Ce produit n'a pas de dépôt GitHub connecté."
  }
}
```

---

## Shared Patterns

### Authentication (applies to all new API routes)
**Source:** `apps/web/api/github/repos/[owner]/[repo]/issues.ts` lines 14-15
**Apply to:** `labels.ts`
```typescript
const user = await authenticateRequest(req, res);
if (!user) return;  // authenticateRequest sends the 401 response; just return
```

### Path Param Validation (applies to all new API routes)
**Source:** `apps/web/api/_lib/validation.ts` lines 131-134
**Apply to:** `labels.ts` (use `githubOwnerRepoSchema`, not `githubIssueQuerySchema`)
```typescript
export const githubOwnerRepoSchema = z.object({
  owner: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
});
```

### Rate Limit Error Handling (applies to all API routes and client fetch)
**Source:** `apps/web/api/github/repos/[owner]/[repo]/issues.ts` lines 47-52
**Apply to:** `labels.ts`, and client-side TanStack Query error handling in `IssuesView.tsx`
```typescript
if (error instanceof GitHubRateLimitError) {
  return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
}
```

### i18n Hook Usage (applies to all UI components)
**Source:** `apps/web/src/client/components/KanbanFilterBar.tsx` line 51, `TaskCard.tsx` line 135
**Apply to:** All new UI components
```typescript
const { t } = useTranslation('issues');   // single namespace
// or for multiple:
const { t } = useTranslation(['issues', 'common']);
```

### Label Color Hex Prefix (critical — applies to all label rendering)
**Source:** `apps/web/src/client/components/TaskCard.tsx` line 247
**Apply to:** `IssueListRow.tsx`, `IssueDetailPanel.tsx`, `IssuesFilterBar.tsx`
```typescript
style={{ backgroundColor: `#${label.color}` }}  // label.color is WITHOUT # (e.g. "e4e669")
```

### `memo()` for List Components (applies to row-level components)
**Source:** `apps/web/src/client/components/TaskCard.tsx` line 126, `KanbanFilterBar.tsx` line 39
**Apply to:** `IssueListRow.tsx`, `IssueSkeletonRow.tsx`, `IssuesFilterBar.tsx`
```typescript
export const IssueListRow = memo(function IssueListRow({ ... }) { ... });
```

### `onSelect={e => e.preventDefault()}` on Dropdown Checkbox Items
**Source:** `apps/web/src/client/components/KanbanFilterBar.tsx` line 99
**Apply to:** `IssuesFilterBar.tsx` label multi-select dropdown
```tsx
<DropdownMenuCheckboxItem
  onSelect={e => e.preventDefault()}   // keeps dropdown open after checking
  ...
>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/client/components/IssueSkeletonRow.tsx` | component | — | No skeleton/loading placeholder components exist in the codebase; use Tailwind `animate-pulse` pattern from RESEARCH.md |

---

## Metadata

**Analog search scope:** `apps/web/api/`, `apps/web/src/client/components/`, `apps/web/src/client/hooks/`, `apps/web/src/shared/i18n/locales/`
**Files scanned:** 10 source files read
**Pattern extraction date:** 2026-04-21
