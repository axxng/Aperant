# Phase 5: Triage Actions - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 9 (7 modify, 2 new)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/client/components/IssueDetailPanel.tsx` | component | request-response (useQuery + useMutation) | `apps/web/src/client/components/IssuesView.tsx` | role-match (same query pattern) |
| `apps/web/src/client/components/IssueListRow.tsx` | component | transform (optional prop slot) | `apps/web/src/client/components/IssueListRow.tsx` (self — productBadge pattern) | exact |
| `apps/web/src/client/components/IssuesView.tsx` | component | event-driven (keyboard + useEffect) | `apps/web/src/client/components/AllIssuesView.tsx` | exact |
| `apps/web/src/client/components/AllIssuesView.tsx` | component | event-driven (keyboard + useEffect) | `apps/web/src/client/components/IssuesView.tsx` | exact |
| `apps/web/src/client/components/IssueListRow.test.tsx` | test | — | `apps/web/src/client/components/IssueListRow.test.tsx` (self — extend) | exact |
| `apps/web/src/client/components/IssueDetailPanel.test.tsx` | test | — | `apps/web/src/client/components/AllIssuesView.test.tsx` | role-match |
| `apps/web/src/client/components/IssuesView.test.tsx` | test | — | `apps/web/src/client/components/AllIssuesView.test.tsx` | role-match |
| `apps/web/src/shared/i18n/locales/en/issues.json` | config | — | self (extend existing namespace) | exact |
| `apps/web/src/shared/i18n/locales/fr/issues.json` | config | — | self (extend existing namespace) | exact |

---

## Pattern Assignments

### `apps/web/src/client/components/IssueDetailPanel.tsx` (component, request-response)

**Analog:** `apps/web/src/client/components/IssuesView.tsx` (useQuery pattern) and `apps/web/api/_lib/db/triage.ts` (TriageRecord type)

**Imports pattern to add** (lines 1-9 of IssueDetailPanel.tsx — add to existing block):
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { useToast } from '../hooks/useToast';
```

**Props interface pattern** (IssueDetailPanel.tsx lines 11-14 — no new props needed):
```typescript
// DO NOT add owner/repo props — derive from issue.repoFullName inside the component
interface IssueDetailPanelProps {
  issue: GitHubIssue | null;
  isOpen: boolean;
  // Optional callback so parent can cache triageState for list row badges (see Open Question #1 in RESEARCH.md)
  onTriageLoad?: (issueId: number, triageState: { isTriaged: boolean; priority: string | null }) => void;
}
```

**Lazy fetch pattern** — copy structure from IssuesView.tsx lines 89-102 (useQuery for labels), adapted:
```typescript
// IssueDetailPanel.tsx — inside the component body, before return
const [owner, repo] = (issue?.repoFullName ?? '/').split('/');

const { data: triageData, isLoading: triageLoading } = useQuery({
  queryKey: ['triage', owner, repo, issue?.number],
  queryFn: async () => {
    const res = await fetch(
      `/api/triage/${owner}/${repo}/${issue!.number}`,
      { credentials: 'include' }
    );
    if (!res.ok) throw new Error('triage fetch failed');
    return res.json() as Promise<{ isTriaged: boolean; priority: string | null }>;
  },
  enabled: Boolean(issue && owner && repo),
  staleTime: 0, // always fresh when panel opens for an issue
});
```

**Optimistic mutation pattern** — derived from TanStack Query v5 docs and IssuesView.tsx query patterns:
```typescript
// IssueDetailPanel.tsx — inside component body
const queryClient = useQueryClient();
const { error: toastError } = useToast();
const { t } = useTranslation('issues');

const triageMutation = useMutation({
  mutationFn: async (updates: { isTriaged?: boolean; priority?: string | null }) => {
    const res = await fetch(`/api/triage/${owner}/${repo}/${issue!.number}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('triage save failed');
    return res.json();
  },
  onMutate: async (updates) => {
    await queryClient.cancelQueries({ queryKey: ['triage', owner, repo, issue?.number] });
    const previous = queryClient.getQueryData(['triage', owner, repo, issue?.number]);
    queryClient.setQueryData(['triage', owner, repo, issue?.number], (old: any) => ({
      ...old,
      ...updates,
    }));
    return { previous };
  },
  onError: (_err, _updates, context) => {
    // Rollback FIRST, then toast
    queryClient.setQueryData(['triage', owner, repo, issue?.number], context?.previous);
    toastError(t('triage.saveError'));
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['triage', owner, repo, issue?.number] });
  },
});
```

**TriageSection JSX placement** — insert between title section and meta section in IssueDetailPanel.tsx (after line 52, before `{/* Meta: labels... */}`):
```tsx
{/* Triage section — D-01: always visible, pinned between title and meta */}
{/* ClosedIssueWarning — D-06: inline informational banner for closed issues */}
{issue.state === 'closed' && (
  <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-warning" />
    <span>{t('triage.closedWarning')}</span>
  </div>
)}
{/* Compact horizontal row: TriagedToggle + PrioritySelector */}
<div className="flex items-center gap-2">
  {/* TriagedToggle — D-01: left side; aria-pressed for accessibility */}
  <Button
    variant="outline"
    size="sm"
    aria-pressed={triageData?.isTriaged ?? false}
    aria-label={t('triage.markTriagedAriaLabel')}
    disabled={triageLoading || triageMutation.isPending}
    onClick={() => triageMutation.mutate({ isTriaged: !(triageData?.isTriaged ?? false) })}
    className="flex items-center gap-1.5"
  >
    {triageData?.isTriaged
      ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      : <Circle className="h-3.5 w-3.5" />
    }
    {t('triage.markTriaged')}
  </Button>

  {/* PrioritySelector — D-02: DropdownMenu (action menu, not form field) */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        aria-label={t('triage.priorityAriaLabel')}
        disabled={triageLoading || triageMutation.isPending}
      >
        {triageData?.priority
          ? t('triage.prioritySet', { priority: triageData.priority })
          : t('triage.priorityNone')}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      {(['critical', 'high', 'medium', 'low'] as const).map(p => (
        <DropdownMenuItem key={p} onSelect={() => triageMutation.mutate({ priority: p })}>
          <span className={cn('h-1.5 w-1.5 rounded-full mr-2', PRIORITY_DOT_CLASSES[p])} />
          {t(`triage.priority.${p}`)}
        </DropdownMenuItem>
      ))}
      {triageData?.priority && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => triageMutation.mutate({ priority: null })}>
            {t('triage.priorityClear')}
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
<div className="border-t border-border" />
```

**Priority color constants** — add as module-level constant in IssueDetailPanel.tsx:
```typescript
// Module-level — before the component function
const PRIORITY_DOT_CLASSES: Record<string, string> = {
  critical: 'bg-destructive',
  high:     'bg-orange-500',
  medium:   'bg-yellow-400',
  low:      'bg-muted-foreground',
};

const PRIORITY_PILL_CLASSES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high:     'bg-orange-500/10 text-orange-500',
  medium:   'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400',
  low:      'bg-muted text-muted-foreground',
};
```

---

### `apps/web/src/client/components/IssueListRow.tsx` (component, transform)

**Analog:** self — the existing `productBadge` optional prop (lines 8-18 and 96-108) is the exact pattern to mirror.

**New prop in interface** (mirror lines 8-18 of IssueListRow.tsx):
```typescript
// Add after ProductBadgeInfo interface
interface TriageStateDisplay {
  isTriaged: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
}

interface IssueListRowProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
  productBadge?: ProductBadgeInfo;   // existing
  triageState?: TriageStateDisplay;  // NEW — mirrors productBadge optional pattern
}
```

**TriageBadgeSlot JSX** — insert after the productBadge block (after line 108), before closing `</div>`:
```tsx
{/* Triage badge slot — D-03, D-04: checkmark + priority pill; only when triageState provided */}
{triageState && (triageState.isTriaged || triageState.priority) && (
  <div className="flex items-center gap-1 flex-shrink-0">
    {/* Priority pill — shown when priority set (D-04) */}
    {triageState.priority && (
      <span className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0 text-[11px] font-semibold h-5',
        PRIORITY_PILL_CLASSES[triageState.priority]
      )}>
        {triageState.priority.charAt(0).toUpperCase() + triageState.priority.slice(1)}
      </span>
    )}
    {/* Checkmark — shown when triaged (D-03) */}
    {triageState.isTriaged && (
      <CheckCircle2
        className="h-3.5 w-3.5 text-success flex-shrink-0"
        aria-label={t('triage.triaged')}
      />
    )}
  </div>
)}
```

**Additional import** (add to existing import block at top of IssueListRow.tsx):
```typescript
import { CheckCircle2 } from 'lucide-react';
```

**Priority pill classes constant** — add at module level in IssueListRow.tsx (same values as IssueDetailPanel):
```typescript
const PRIORITY_PILL_CLASSES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high:     'bg-orange-500/10 text-orange-500',
  medium:   'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400',
  low:      'bg-muted text-muted-foreground',
};
```

---

### `apps/web/src/client/components/IssuesView.tsx` (component, event-driven)

**Analog:** `apps/web/src/client/components/IssuesView.tsx` (self — the existing `useEffect` for `setActiveProduct` on line 35-37 is the exact pattern shape to follow for keydown handler).

**j/k keyboard handler** — add after the existing useEffect on line 35 (before the `product` derivation on line 40):
```typescript
// j/k keyboard navigation — D-05: only active when panel is open
useEffect(() => {
  if (!selectedIssueId) return; // guard: panel is closed (selectedIssueId is the isOpen signal)

  function handleKeyDown(e: KeyboardEvent) {
    // Guard: never hijack input/textarea focus (accessibility — RESEARCH.md Pitfall 5)
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const currentIndex = filteredIssues.findIndex(i => i.id === selectedIssueId);
      if (e.key === 'j' && currentIndex < filteredIssues.length - 1) {
        setSelectedIssueId(filteredIssues[currentIndex + 1].id);
      } else if (e.key === 'k' && currentIndex > 0) {
        setSelectedIssueId(filteredIssues[currentIndex - 1].id);
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown); // RESEARCH.md Pitfall 2
}, [selectedIssueId, filteredIssues]); // filteredIssues in deps — recalculated on filter change
```

**triageState prop passthrough to IssueListRow** — in IssuesView.tsx, add `useState` for per-issue triage cache and `onTriageLoad` callback:
```typescript
// Add to existing useState declarations (line 32 area)
const [issueTriageCache, setIssueTriageCache] = useState<Map<number, { isTriaged: boolean; priority: string | null }>>(new Map());

// Callback for IssueDetailPanel — called when triage data loads/updates
const handleTriageLoad = useCallback((issueId: number, triageState: { isTriaged: boolean; priority: string | null }) => {
  setIssueTriageCache(prev => new Map(prev).set(issueId, triageState));
}, []);
```

**IssueListRow call site** — update at line 199-205:
```tsx
<IssueListRow
  key={issue.id}
  issue={issue}
  isSelected={issue.id === selectedIssueId}
  onClick={() => setSelectedIssueId(issue.id)}
  triageState={issueTriageCache.get(issue.id)}  // NEW — from cache, undefined if never opened
/>
```

**IssueDetailPanel call site** — update at line 231-234:
```tsx
<IssueDetailPanel
  issue={selectedIssue}
  isOpen={selectedIssueId !== null}
  onTriageLoad={handleTriageLoad}   // NEW
/>
```

**Additional import** (add `useCallback` to existing `useState, useEffect, useMemo` import on line 1):
```typescript
import { useState, useEffect, useMemo, useCallback } from 'react';
```

---

### `apps/web/src/client/components/AllIssuesView.tsx` (component, event-driven)

**Analog:** `apps/web/src/client/components/IssuesView.tsx` — identical j/k handler pattern and triageState passthrough.

**j/k keyboard handler** — add after `selectedIssue` derivation (line 86 area):
```typescript
// Same pattern as IssuesView.tsx — copy exactly
useEffect(() => {
  if (!selectedIssueId) return;

  function handleKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const currentIndex = filteredIssues.findIndex(i => i.id === selectedIssueId);
      if (e.key === 'j' && currentIndex < filteredIssues.length - 1) {
        setSelectedIssueId(filteredIssues[currentIndex + 1].id);
      } else if (e.key === 'k' && currentIndex > 0) {
        setSelectedIssueId(filteredIssues[currentIndex - 1].id);
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedIssueId, filteredIssues]);
```

**triageState passthrough** — same `issueTriageCache` + `handleTriageLoad` pattern as IssuesView.tsx. Add `useState`, `useCallback` to imports (line 1 already has `useState`, `useMemo` — add `useCallback`).

**IssueListRow call site** — update at line 199-204:
```tsx
<IssueListRow
  issue={issue}
  isSelected={issue.id === selectedIssueId}
  onClick={() => setSelectedIssueId(issue.id)}
  productBadge={{ color: issue.product.color, name: issue.product.name }}
  triageState={issueTriageCache.get(issue.id)}  // NEW
/>
```

---

### `apps/web/src/client/components/IssueListRow.test.tsx` (test — extend)

**Analog:** `apps/web/src/client/components/IssueListRow.test.tsx` (self — lines 1-85 show the exact test structure to extend).

**Additional mocks to add** — add after existing mocks (after line 25):
```typescript
// Mock lucide-react for CheckCircle2 (added by triage badge slot)
vi.mock('lucide-react', () => ({
  CheckCircle2: ({ className, 'aria-label': ariaLabel }: { className?: string; 'aria-label'?: string }) => (
    <svg data-testid="check-circle-2" className={className} aria-label={ariaLabel} />
  ),
  // Keep existing icons passthrough
}));
```

**New describe block to add** — append after line 85:
```typescript
describe('IssueListRow — TRIAGE-04: triage badge slot', () => {
  it('renders checkmark icon when triageState.isTriaged=true', () => {
    render(
      <IssueListRow
        issue={baseIssue}
        isSelected={false}
        onClick={() => {}}
        triageState={{ isTriaged: true, priority: null }}
      />
    );
    expect(screen.getByTestId('check-circle-2')).toBeInTheDocument();
  });

  it('renders priority pill with correct text when priority is set', () => {
    render(
      <IssueListRow
        issue={baseIssue}
        isSelected={false}
        onClick={() => {}}
        triageState={{ isTriaged: false, priority: 'high' }}
      />
    );
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders both priority pill and checkmark when triaged with priority', () => {
    render(
      <IssueListRow
        issue={baseIssue}
        isSelected={false}
        onClick={() => {}}
        triageState={{ isTriaged: true, priority: 'critical' }}
      />
    );
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByTestId('check-circle-2')).toBeInTheDocument();
  });

  it('renders nothing for triage badge when triageState prop is absent', () => {
    render(
      <IssueListRow issue={baseIssue} isSelected={false} onClick={() => {}} />
    );
    expect(screen.queryByTestId('check-circle-2')).toBeNull();
  });

  it('renders nothing for triage badge when neither triaged nor priority set', () => {
    render(
      <IssueListRow
        issue={baseIssue}
        isSelected={false}
        onClick={() => {}}
        triageState={{ isTriaged: false, priority: null }}
      />
    );
    expect(screen.queryByTestId('check-circle-2')).toBeNull();
  });
});
```

---

### `apps/web/src/client/components/IssueDetailPanel.test.tsx` (test — new file)

**Analog:** `apps/web/src/client/components/AllIssuesView.test.tsx` (lines 1-165) — view component test with mocked TanStack Query, mocked i18n, mocked stores.

**Full file structure to copy from AllIssuesView.test.tsx:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueDetailPanel } from './IssueDetailPanel';

// Mock react-i18next (copy pattern from IssueListRow.test.tsx lines 6-15)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'triage.markTriaged') return 'Mark as Triaged';
      if (key === 'triage.priorityNone') return 'Priority: None';
      if (key === 'triage.prioritySet') return `Priority: ${opts?.priority}`;
      if (key === 'triage.closedWarning') return 'This issue is closed. Triage actions are still saved in Currents.';
      if (key === 'triage.saveError') return 'Failed to save triage';
      if (key === 'triage.priority.critical') return 'Critical';
      if (key === 'triage.priority.high') return 'High';
      if (key === 'triage.priority.medium') return 'Medium';
      if (key === 'triage.priority.low') return 'Low';
      if (key === 'triage.priorityClear') return 'Clear priority';
      return key;
    },
  }),
}));

// Mock TanStack Query (copy pattern from AllIssuesView.test.tsx lines 32-34)
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
}));

// Mock useToast
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

// Mock UI primitives not under test
vi.mock('./ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <>{children}</>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <button onClick={onSelect}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import { useQuery, useMutation } from '@tanstack/react-query';

// Fixture helpers (copy shape from IssueListRow.test.tsx baseIssue)
const baseIssue = {
  id: 1,
  number: 42,
  title: 'Fix login bug',
  state: 'open' as const,
  labels: [],
  assignees: [],
  author: { login: 'alice' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  commentsCount: 0,
  url: 'https://api.github.com/repos/org/repo/issues/42',
  htmlUrl: 'https://github.com/org/repo/issues/42',
  repoFullName: 'org/repo',
  body: null,
};

function setupMocks(triageData: { isTriaged: boolean; priority: string | null } | null = null) {
  vi.mocked(useQuery).mockReturnValue({
    data: triageData,
    isLoading: false,
    isError: false,
  } as any);
  const mutate = vi.fn();
  vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any);
  return { mutate };
}

// Tests cover TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-06
```

---

### `apps/web/src/client/components/IssuesView.test.tsx` (test — new file)

**Analog:** `apps/web/src/client/components/AllIssuesView.test.tsx` (lines 1-165) — view component with mocked TanStack Query and fireEvent for interaction.

**Key mock additions** for keyboard nav tests (copy AllIssuesView.test.tsx mock block, then add):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssuesView } from './IssuesView';

// All mocks follow AllIssuesView.test.tsx pattern:
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, tNav: (k: string) => k }) }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ productId: 'p1' }),
  NavLink: ({ children }: any) => <a>{children}</a>,
}));
vi.mock('../stores/product-store', () => ({ useProductStore: vi.fn() }));
vi.mock('../hooks/useIssuesFilters', () => ({
  useIssuesFilters: () => ({
    state: 'open', labels: [], assignee: '', search: '',
    setSearch: vi.fn(), setFilters: vi.fn(), resetFilters: vi.fn(), hasActiveFilters: false,
  }),
}));
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ cancelQueries: vi.fn(), getQueryData: vi.fn(), setQueryData: vi.fn(), invalidateQueries: vi.fn() })),
}));
// Mock IssueDetailPanel + IssueListRow to isolate keyboard nav behavior
vi.mock('./IssueDetailPanel', () => ({
  IssueDetailPanel: ({ isOpen, issue }: { isOpen: boolean; issue: any }) => (
    <div data-testid="panel" data-open={isOpen} data-issue-id={issue?.id} />
  ),
}));
vi.mock('./IssueListRow', () => ({
  IssueListRow: ({ issue, isSelected, onClick }: any) => (
    <div data-testid="row" data-id={issue.id} data-selected={isSelected} onClick={onClick}>
      {issue.title}
    </div>
  ),
}));
```

**Test block for TRIAGE-05:**
```typescript
describe('IssuesView — TRIAGE-05: j/k keyboard navigation', () => {
  it('j key moves to next issue when panel is open', () => {
    // setup: render with 3 issues, click first to open panel, press j
    // assert: panel shows second issue
  });

  it('k key moves to previous issue when panel is open', () => { /* ... */ });

  it('k on first issue does nothing (boundary guard)', () => { /* ... */ });

  it('j on last issue does nothing (boundary guard)', () => { /* ... */ });

  it('j/k do nothing when panel is closed (no issue selected)', () => { /* ... */ });

  it('j/k do nothing when focus is on INPUT element', () => { /* ... */ });
});
```

---

### `apps/web/src/shared/i18n/locales/en/issues.json` (config — extend)

**Analog:** self — existing key structure (lines 1-63). New `triage` namespace keys to add under the root object:

```json
{
  "triage": {
    "markTriaged": "Triaged",
    "markTriagedAriaLabel": "Toggle triaged status",
    "priorityNone": "Priority: None",
    "prioritySet": "Priority: {{priority}}",
    "priorityAriaLabel": "Set priority",
    "priorityClear": "Clear priority",
    "closedWarning": "This issue is closed. Triage actions are still saved in Currents.",
    "saveError": "Failed to save triage. Please try again.",
    "triaged": "Triaged",
    "priority": {
      "critical": "Critical",
      "high": "High",
      "medium": "Medium",
      "low": "Low"
    }
  }
}
```

---

### `apps/web/src/shared/i18n/locales/fr/issues.json` (config — extend)

**Analog:** self — existing French key structure (lines 1-63). Same `triage` keys in French:

```json
{
  "triage": {
    "markTriaged": "Triage effectué",
    "markTriagedAriaLabel": "Basculer le statut de triage",
    "priorityNone": "Priorité : Aucune",
    "prioritySet": "Priorité : {{priority}}",
    "priorityAriaLabel": "Définir la priorité",
    "priorityClear": "Effacer la priorité",
    "closedWarning": "Cette issue est fermée. Les actions de triage sont toujours enregistrées dans Currents.",
    "saveError": "Échec de la sauvegarde du triage. Veuillez réessayer.",
    "triaged": "Traité",
    "priority": {
      "critical": "Critique",
      "high": "Haute",
      "medium": "Moyenne",
      "low": "Faible"
    }
  }
}
```

---

## Shared Patterns

### TanStack Query useQuery Pattern
**Source:** `apps/web/src/client/components/IssuesView.tsx` lines 89-102
**Apply to:** All `useQuery` calls in `IssueDetailPanel.tsx`
```typescript
const { data: labelsData, isError: labelsError } = useQuery<LabelsResult>({
  queryKey: ['labels', repoSource?.owner, repoSource?.repo],
  queryFn: async () => {
    if (!repoSource) throw new Error('No repo source');
    const res = await fetch(
      `/api/github/repos/${repoSource.owner}/${repoSource.repo}/labels`,
      { credentials: 'include' }
    );
    if (!res.ok) throw new Error('labels fetch failed');
    return res.json() as Promise<LabelsResult>;
  },
  staleTime: 5 * 60 * 1000,
  enabled: Boolean(repoSource),
});
```
Key points: always `{ credentials: 'include' }`, always check `!res.ok`, always cast `res.json()`, use `enabled` guard.

### useToast Error Pattern
**Source:** `apps/web/src/client/hooks/useToast.ts` lines 38-53
**Apply to:** All mutation `onError` handlers
```typescript
const { error: toastError } = useToast();
// In onError:
toastError(t('triage.saveError')); // title only; description optional
```
`useToast()` returns `{ error, success, info, warning, toast, dismiss, clearAll }`. All are `(title: string, description?: string) => void`.

### DropdownMenu Action Menu Pattern
**Source:** `apps/web/src/client/components/ui/dropdown-menu.tsx` lines 1-201
**Apply to:** `PrioritySelector` in `IssueDetailPanel.tsx`
```typescript
// All exports available: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
// DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem,
// DropdownMenuRadioItem, DropdownMenuRadioGroup, DropdownMenuGroup
// Content already wraps Portal — no need to add DropdownMenuPortal manually
```

### Optional Prop Slot Pattern (productBadge → triageState)
**Source:** `apps/web/src/client/components/IssueListRow.tsx` lines 8-18, 96-108
**Apply to:** `TriageBadgeSlot` in `IssueListRow.tsx`
```typescript
// Pattern: optional prop interface + conditional JSX block
{productBadge && (
  <div className="flex items-center gap-1 flex-shrink-0">
    <span aria-hidden="true" className="h-2 w-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: productBadge.color }} />
    <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
      {productBadge.name}
    </span>
  </div>
)}
```

### useEffect Cleanup Pattern (keyboard events)
**Source:** `apps/web/src/client/components/IssuesView.tsx` lines 35-37 (structure); exact keyboard pattern from RESEARCH.md Pattern 3
**Apply to:** j/k handler in both `IssuesView.tsx` and `AllIssuesView.tsx`
```typescript
useEffect(() => {
  if (productId) setActiveProduct(productId);
}, [productId, setActiveProduct]);
// Shape: guard at top, effect body, dependencies array
// For keyboard: return () => window.removeEventListener('keydown', handler) is MANDATORY
```

### Badge CVA Variants
**Source:** `apps/web/src/client/components/ui/badge.tsx` lines 5-25
**Apply to:** Priority pill rendering in `IssueListRow.tsx` (inline className override — not a Badge variant)
```typescript
// Available variants: default, secondary, destructive, outline, success, warning, info, purple, muted
// For priority colors not matching a variant, use className override with PRIORITY_PILL_CLASSES constant
// Pattern confirmed by badge.tsx line 17: 'bg-purple-500/10 text-purple-400' — arbitrary Tailwind OK
```

### Test Mock Boilerplate
**Source:** `apps/web/src/client/components/IssueListRow.test.tsx` lines 1-41 (i18n mock + baseIssue fixture)
**Source:** `apps/web/src/client/components/AllIssuesView.test.tsx` lines 1-62 (TanStack Query mock + product/issue factory functions)
**Apply to:** `IssueDetailPanel.test.tsx` and `IssuesView.test.tsx`
- Always mock `react-i18next` with a `t` function that handles specific keys
- Always mock `@tanstack/react-query` as a module (not spyOn)
- Use `vi.mocked(hook).mockReturnValue(...)` pattern (not `vi.fn().mockReturnValue`)
- `baseIssue` fixture must include `repoFullName: 'org/repo'` (required by triage query key derivation)

### i18n Key Structure
**Source:** `apps/web/src/shared/i18n/locales/en/issues.json` lines 1-63
**Apply to:** All new triage keys in both `en/issues.json` and `fr/issues.json`
- Namespace: `issues` (useTranslation('issues'))
- Key format: `triage.{action}` and `triage.priority.{level}`
- Interpolation: `{{priority}}`, `{{retryAfter}}` (double curly — react-i18next style)
- Always add to BOTH en and fr atomically (CLAUDE.md requirement)

---

## No Analog Found

All files have close codebase analogs. No files require falling back to RESEARCH.md patterns alone.

---

## Metadata

**Analog search scope:** `apps/web/src/client/components/`, `apps/web/src/client/hooks/`, `apps/web/src/shared/i18n/`, `apps/web/api/_lib/db/`
**Files read:** 13
**Pattern extraction date:** 2026-04-22

### Key Architecture Decisions Confirmed by Analog Reading

1. `issue.repoFullName` is present on `baseIssue` in `IssueListRow.test.tsx` line 40 — confirms A1 is safe; value is always `'org/repo'` format.
2. `IssueDetailPanel` currently has no TanStack Query imports — the `useQuery`/`useMutation`/`useQueryClient` import block is the only new addition to the import section.
3. `IssuesView.tsx` `selectedIssueId` state (`useState<number | null>(null)`, line 32) is the canonical `isOpen` signal — use `selectedIssueId !== null` as the guard for j/k handler (not a separate `isOpen` boolean).
4. `AllIssuesView.tsx` does NOT currently import `useEffect` — it will need to be added to the import on line 1 when adding the keyboard handler.
5. `DropdownMenuContent` already wraps `DropdownMenuPortal` internally (line 61-75 of dropdown-menu.tsx) — do NOT add a second Portal wrapper.
6. `COALESCE` in `upsertTriageRecord` (triage.ts line 59-60) requires sending `{ priority: null }` explicitly (not omitting the field) to clear priority — UI must always send the full update object, never a partial omit.
