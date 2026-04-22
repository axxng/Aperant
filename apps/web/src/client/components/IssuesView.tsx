import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { GitBranch, AlertCircle, Loader2 } from 'lucide-react';
import { useProductStore } from '../stores/product-store';
import { useIssuesFilters } from '../hooks/useIssuesFilters';
import { IssuesFilterBar } from './IssuesFilterBar';
import { IssueListRow } from './IssueListRow';
import { IssueDetailPanel } from './IssueDetailPanel';
import { IssueSkeletonRow } from './IssueSkeletonRow';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { GitHubIssue, PaginatedIssuesResult } from '@shared/types/github';

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

interface LabelsResult {
  labels: GitHubLabel[];
}

export function IssuesView() {
  const { productId } = useParams<{ productId: string }>();
  const { t } = useTranslation('issues');
  const { t: tNav } = useTranslation('navigation');
  const { products, setActiveProduct } = useProductStore();
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

  // issueTriageCache — stores triage state per issue.id; populated via onTriageLoad callback
  // Enables TriageBadgeSlot to update immediately after panel action without N API calls on load (D-07)
  const [issueTriageCache, setIssueTriageCache] = useState<
    Map<number, { isTriaged: boolean; priority: 'critical' | 'high' | 'medium' | 'low' | null }>
  >(new Map());

  // handleTriageLoad — called by IssueDetailPanel when triage data loads or changes
  // useCallback prevents re-creation on every render (stable ref for IssueDetailPanel dep array)
  const handleTriageLoad = useCallback(
    (issueId: number, triageState: { isTriaged: boolean; priority: string | null }) => {
      const priority = triageState.priority as 'critical' | 'high' | 'medium' | 'low' | null;
      setIssueTriageCache(prev => new Map(prev).set(issueId, { isTriaged: triageState.isTriaged, priority }));
    },
    []
  );

  // Sync active product so sidebar and breadcrumbs reflect current product (Pitfall 3 avoidance)
  useEffect(() => {
    if (productId) setActiveProduct(productId);
  }, [productId, setActiveProduct]);

  // Derive owner/repo directly from products array — NOT getActiveProduct() (Pitfall 3)
  const product = products.find(p => p.id === productId);
  const repoSource = product?.sources.find(s => s.type === 'repo');

  const { state, labels, assignee, search, setSearch, setFilters, resetFilters, hasActiveFilters } =
    useIssuesFilters();

  // Issues query — useInfiniteQuery for "Load More" pagination (BROWSE-07)
  // queryKey includes all filter state for correct cache invalidation (Pitfall 2)
  // labels array sorted to avoid false cache misses from ordering differences
  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
    refetch,
  } = useInfiniteQuery<PaginatedIssuesResult>({
    queryKey: ['issues', repoSource?.owner, repoSource?.repo, {
      state,
      labels: [...labels].sort(),
      assignee,
    }],
    queryFn: async ({ pageParam }) => {
      if (!repoSource) throw new Error('No repo source');
      const params = new URLSearchParams({
        state,
        page: String(pageParam ?? 1),
        per_page: '50',
      });
      if (labels.length > 0) params.set('labels', labels.join(','));
      if (assignee) params.set('assignee', assignee);
      const res = await fetch(
        `/api/github/repos/${repoSource.owner}/${repoSource.repo}/issues?${params}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<PaginatedIssuesResult>;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    enabled: Boolean(repoSource),
  });

  // Labels query — parallel to issues (D-08); staleTime=5min because labels change rarely
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

  // Flatten pages into single array — memoized to prevent filteredIssues/useEffect churn on every render
  const allIssues: GitHubIssue[] = useMemo(
    () => data?.pages.flatMap(p => p.issues) ?? [],
    [data]
  );

  // Client-side title search — instant, no API calls (D-10)
  const filteredIssues = useMemo(() => {
    if (!search.trim()) return allIssues;
    const q = search.toLowerCase();
    return allIssues.filter(i => i.title.toLowerCase().includes(q));
  }, [allIssues, search]);

  // Derive assignees from loaded issues — no separate API call (D-09)
  const availableAssignees = useMemo(() => {
    const logins = new Set(allIssues.flatMap(i => i.assignees.map(a => a.login)));
    return Array.from(logins).sort();
  }, [allIssues]);

  const selectedIssue = allIssues.find(i => i.id === selectedIssueId) ?? null;

  // Batch pre-fetch triage state for all visible issues (GAP-1 fix)
  // Fires on first render and whenever the visible issue list changes.
  // Uses functional setState to avoid overwriting newer optimistic updates from onTriageLoad.
  useEffect(() => {
    if (!repoSource || filteredIssues.length === 0) return;
    const numbers = filteredIssues.map(i => i.number);
    fetch(
      `/api/triage/${repoSource.owner}/${repoSource.repo}?numbers=${numbers.join(',')}`,
      { credentials: 'include' }
    )
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { records: Array<{ issueNumber: number; isTriaged: boolean; priority: string | null }> }) => {
        // Build a number→id lookup so we can key the cache by issue.id (same as onTriageLoad)
        const numberToId = new Map(filteredIssues.map(i => [i.number, i.id]));
        setIssueTriageCache(prev => {
          const next = new Map(prev);
          for (const record of data.records) {
            const id = numberToId.get(record.issueNumber);
            if (id === undefined) continue;
            // Only seed entries that are NOT already in the cache (preserve optimistic updates)
            if (!next.has(id)) {
              next.set(id, {
                isTriaged: record.isTriaged,
                priority: record.priority as 'critical' | 'high' | 'medium' | 'low' | null,
              });
            }
          }
          return next;
        });
      })
      .catch(() => { /* silent — list renders without badges if fetch fails */ });
  }, [filteredIssues, repoSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // j/k/Escape keyboard navigation — D-05: only active when panel is open (selectedIssueId !== null)
  // RESEARCH.md Pitfall 2: cleanup removeEventListener is MANDATORY to prevent stacking
  useEffect(() => {
    if (!selectedIssueId) return; // panel closed — j/k/Escape inactive

    function handleKeyDown(e: KeyboardEvent) {
      // RESEARCH.md Pitfall 5: never hijack focus from form elements (accessibility)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key !== 'j' && e.key !== 'k' && e.key !== 'Escape') return;
      e.preventDefault();
      // Gap 1: Escape closes the panel
      if (e.key === 'Escape') { setSelectedIssueId(null); return; }
      const currentIndex = filteredIssues.findIndex(i => i.id === selectedIssueId);
      if (currentIndex === -1) return; // selected issue filtered out — do nothing
      // j = next/down (currentIndex + 1), k = prev/up (currentIndex - 1) — vim convention
      if (e.key === 'j' && currentIndex < filteredIssues.length - 1) {
        setSelectedIssueId(filteredIssues[currentIndex + 1].id);
      } else if (e.key === 'k' && currentIndex > 0) {
        setSelectedIssueId(filteredIssues[currentIndex - 1].id);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown); // cleanup — Pitfall 2
  }, [selectedIssueId, filteredIssues]); // filteredIssues in deps — recalculates when filter changes

  // No repo source — show error state (Assumption A1: handle gracefully)
  if (!repoSource) {
    return (
      <div className="flex flex-col h-full">
        <TabSwitcher productId={productId ?? ''} tNav={tNav} t={t} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {t('error.noRepoSource', 'This product does not have a connected GitHub repository.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab switcher: Kanban | Issues */}
      <TabSwitcher productId={productId ?? ''} tNav={tNav} t={t} />

      {/* Filter bar */}
      <IssuesFilterBar
        filters={{ state, labels, assignee }}
        search={search}
        onSearchChange={setSearch}
        onFilterChange={setFilters}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        availableLabels={labelsData?.labels ?? []}
        labelsError={labelsError}
        availableAssignees={availableAssignees}
      />

      {/* Split pane: issues list + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Issues list pane */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {isLoading ? (
            // 8 skeleton rows while first page loads (D-18)
            Array.from({ length: 8 }).map((_, i) => <IssueSkeletonRow key={i} />)
          ) : error ? (
            // Error state with retry button
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-medium">{t('error.heading')}</h3>
                <p className="text-xs text-muted-foreground">{t('error.body')}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t('error.retry')}
                </Button>
              </div>
            </div>
          ) : filteredIssues.length === 0 ? (
            // Empty state (D-19)
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center space-y-3">
                <GitBranch className="h-8 w-8 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-medium">
                  {state === 'open' ? t('empty.openHeading') : t('empty.closedHeading')}
                </h3>
                <p className="text-xs text-muted-foreground">{t('empty.body')}</p>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://github.com/${repoSource.owner}/${repoSource.repo}/issues`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('empty.viewOnGitHub')}
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {filteredIssues.map(issue => (
                <IssueListRow
                  key={issue.id}
                  issue={issue}
                  isSelected={issue.id === selectedIssueId}
                  onClick={() => setSelectedIssueId(issue.id)}
                  triageState={issueTriageCache.get(issue.id)}
                />
              ))}

              {/* Load More button (BROWSE-07) — visible only when hasNextPage is true */}
              {hasNextPage && (
                <div className="flex justify-center p-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('list.loadMore')}
                      </>
                    ) : (
                      t('list.loadMore')
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel — slide-in from right (BROWSE-06) */}
        <IssueDetailPanel
          issue={selectedIssue}
          isOpen={selectedIssueId !== null}
          onTriageLoad={handleTriageLoad}
          onClose={() => setSelectedIssueId(null)}
        />
      </div>
    </div>
  );
}

// ─── Internal sub-components ────────────────────────────────────────────────

interface TabSwitcherProps {
  productId: string;
  tNav: (key: string) => string;
  t: (key: string) => string;
}

function TabSwitcher({ productId, tNav, t }: TabSwitcherProps) {
  return (
    <div className="flex items-center border-b border-border px-4 flex-shrink-0">
      {/* Kanban tab — 'end' prop ensures it only matches /products/:id exactly,
          NOT /products/:id/issues (NavLink without 'end' would match both) */}
      <NavLink
        to={`/products/${productId}`}
        end
        className={({ isActive }) =>
          cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            isActive
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )
        }
      >
        {tNav('items.kanban')}
      </NavLink>
      <NavLink
        to={`/products/${productId}/issues`}
        className={({ isActive }) =>
          cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            isActive
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )
        }
      >
        {t('tab.issues')}
      </NavLink>
    </div>
  );
}
