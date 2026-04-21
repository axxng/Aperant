import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';
import { AlertCircle, Inbox, X } from 'lucide-react';
import { useProductStore } from '../stores/product-store';
import { useAllIssuesFilters } from '../hooks/useAllIssuesFilters';
import { IssueListRow } from './IssueListRow';
import { IssueDetailPanel } from './IssueDetailPanel';
import { IssueSkeletonRow } from './IssueSkeletonRow';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import type { GitHubIssue, PaginatedIssuesResult } from '@shared/types/github';
import type { Product, RepoSource } from '@shared/types/product';

export function AllIssuesView() {
  const { t } = useTranslation('issues');
  const { products } = useProductStore();
  const { state, search, setSearch, setStateFilter } = useAllIssuesFilters();
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [dismissedRepos, setDismissedRepos] = useState<Set<string>>(new Set());

  // Only products with a 'repo' source participate (D-04, CONTEXT.md)
  // Memoized to prevent index drift between useQueries result array and productsWithRepo array (Pitfall 2)
  const productsWithRepo = useMemo(
    () => products.filter(p => p.sources.some(s => s.type === 'repo')),
    [products]
  );

  // One query per product — fired in parallel (D-05)
  // queryKey prefix 'all' prevents cache collision with IssuesView ['issues', owner, repo, ...] (Pitfall 1)
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
              const err = new Error('rate_limited') as Error & { retryAfter?: number };
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

  // Merge all successful query results into a single array sorted by updatedAt desc (D-06)
  // Each query result maps 1:1 to productsWithRepo[i] — safe because productsWithRepo is memoized
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
    return issues.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [issueQueries, productsWithRepo]);

  // Client-side title search — instant, no debounce, no API call (D-09)
  const filteredIssues = useMemo(() => {
    if (!search.trim()) return allIssues;
    const q = search.toLowerCase();
    return allIssues.filter(i => i.title.toLowerCase().includes(q));
  }, [allIssues, search]);

  // Show skeleton only when ALL queries are still initializing
  // Once any resolve (success or error), start showing partial results + banners (UI-SPEC loading state)
  const isAllLoading = issueQueries.length > 0 && issueQueries.every(q => q.isLoading);

  const selectedIssue = allIssues.find(i => i.id === selectedIssueId) ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-medium flex-shrink-0">{t('allIssues.heading')}</h2>
        <div className="flex items-center gap-2 flex-1">
          {/* State toggle — open/closed (D-07, UI-SPEC Interaction Patterns) */}
          <Button
            variant={state === 'open' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setStateFilter('open')}
          >
            {t('filters.open')}
          </Button>
          <Button
            variant={state === 'closed' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setStateFilter('closed')}
          >
            {t('filters.closed')}
          </Button>
          {/* Keyword search — client-side, no debounce (D-09) */}
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('allIssues.searchPlaceholder')}
            className="h-7 text-xs flex-1 max-w-xs"
            aria-label={t('allIssues.searchPlaceholder')}
          />
        </div>
      </div>

      {/* Split pane: issues list + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Issues list pane — primary focal point (UI-SPEC visual hierarchy) */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Per-repo error banners — stacked with space-y-2, dismissible (D-12, D-13, D-14, D-15) */}
          {issueQueries.some((q, i) => q.isError && !dismissedRepos.has(productsWithRepo[i]?.id)) && (
            <div className="space-y-2 px-4 py-2">
              {issueQueries.map((query, i) => {
                const product = productsWithRepo[i];
                if (!query.isError || dismissedRepos.has(product.id)) return null;
                const isRateLimit = (query.error as Error)?.message === 'rate_limited';
                const retryAfter = (query.error as Error & { retryAfter?: number })?.retryAfter;
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
                          : isRateLimit
                          ? t('allIssues.error.rateLimitUnknown', { repoName: product.name })
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
                        onClick={() =>
                          setDismissedRepos(prev => new Set([...prev, product.id]))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading skeleton — only when ALL queries still initializing */}
          {isAllLoading ? (
            Array.from({ length: 8 }).map((_, i) => <IssueSkeletonRow key={i} />)
          ) : filteredIssues.length === 0 ? (
            /* Empty state */
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
          ) : (
            /* Issue list — productBadge passed to each row (CROSS-02) */
            <ol>
              {filteredIssues.map(issue => (
                <li key={issue.id}>
                  <IssueListRow
                    issue={issue}
                    isSelected={issue.id === selectedIssueId}
                    onClick={() => setSelectedIssueId(issue.id)}
                    productBadge={{ color: issue.product.color, name: issue.product.name }}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Detail panel — reused as-is from Phase 2 */}
        <IssueDetailPanel
          issue={selectedIssue}
          isOpen={selectedIssueId !== null}
        />
      </div>
    </div>
  );
}
