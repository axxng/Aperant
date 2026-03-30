import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Search, ExternalLink, GitMerge, Loader2, X, ArrowRight, User } from 'lucide-react';
import { cn, formatRelativeTime } from '../lib/utils';
import { useGitLabStore } from '../stores/gitlab-store';
import { useProductStore } from '../stores/product-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import type { GitLabMergeRequest } from '@shared/types/gitlab';

/** Extract the GitLab project path from a product's sources */
function getGitLabProjectPath(product: { sources: Array<{ type: string; [k: string]: any }> }): string | null {
  for (const source of product.sources) {
    if (source.type === 'gitlab_project' && source.projectPath) {
      return source.projectPath as string;
    }
  }
  return null;
}

const STATE_BADGE_CLASSES: Record<string, string> = {
  opened: 'bg-green-500/10 text-green-500',
  closed: 'bg-red-500/10 text-red-500',
  merged: 'bg-purple-500/10 text-purple-500',
  locked: 'bg-yellow-500/10 text-yellow-500',
};

export function GitLabMRList() {
  const { t } = useTranslation(['gitlab', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const { products } = useProductStore();
  const store = useGitLabStore();

  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const product = products.find((p) => p.id === productId);
  const projectPath = product ? getGitLabProjectPath(product as any) : null;

  const selectedMR = store.mergeRequests.find((mr) => mr.iid === store.selectedMrIid) ?? null;
  const hasMore = store.mergeRequests.length < store.mrsTotal;

  const loadMRs = useCallback(
    async (page = 1) => {
      if (!projectPath) return;
      store.setMrsLoading(true);
      try {
        const params = new URLSearchParams({
          state: store.mrsState,
          page: String(page),
          per_page: '30',
        });
        if (store.mrsSearch) params.set('search', store.mrsSearch);
        const res = await fetch(
          `/api/gitlab/${encodeURIComponent(projectPath)}/merge_requests?${params}`
        );
        const data = await res.json();
        if (page === 1) store.setMergeRequests(data.items, data.total);
        else store.appendMergeRequests(data.items, data.total);
      } finally {
        store.setMrsLoading(false);
      }
    },
    [projectPath, store.mrsState, store.mrsSearch]
  );

  // Load MRs on mount and when filters change
  useEffect(() => {
    if (projectPath) {
      store.setMrsPage(1);
      loadMRs(1);
    }
    return () => store.resetMrs();
  }, [projectPath, store.mrsState, store.mrsSearch, loadMRs]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      store.setMrsSearch(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const handleLoadMore = useCallback(() => {
    const nextPage = store.mrsPage + 1;
    store.setMrsPage(nextPage);
    loadMRs(nextPage);
  }, [store.mrsPage, loadMRs]);

  const handleStateChange = useCallback(
    (state: 'opened' | 'closed' | 'merged' | 'all') => {
      store.setMrsState(state);
    },
    []
  );

  // Not connected / no project states
  if (!product || !projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <GitMerge className="h-8 w-8" />
        <p className="text-sm font-medium">{t('gitlab:issues.noProject')}</p>
        <p className="text-xs">{t('gitlab:issues.noProjectDescription')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <GitMerge className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('gitlab:mergeRequests.title')}</h2>
          <Badge variant="secondary" className="text-xs">
            {store.mrsTotal}
          </Badge>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('gitlab:mergeRequests.searchPlaceholder')}
            className={cn(
              'w-full h-8 pl-8 pr-8 rounded-md border border-input bg-background text-sm',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {(['opened', 'closed', 'merged', 'all'] as const).map((state) => (
          <Button
            key={state}
            variant={store.mrsState === state ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => handleStateChange(state)}
          >
            {t(`gitlab:mergeRequests.state.${state}`)}
          </Button>
        ))}
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* MR list (left ~40%) */}
        <ScrollArea className="w-2/5 border-r border-border">
          {store.mrsLoading && store.mergeRequests.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : store.mergeRequests.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {t('gitlab:mergeRequests.empty')}
            </div>
          ) : (
            <div>
              {store.mergeRequests.map((mr) => (
                <MRItem
                  key={mr.iid}
                  mr={mr}
                  isSelected={mr.iid === store.selectedMrIid}
                  onClick={() => store.setSelectedMrIid(mr.iid)}
                />
              ))}
              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={store.mrsLoading}
                  >
                    {store.mrsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    {t('gitlab:mergeRequests.loadMore')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* MR detail (right ~60%) */}
        <div className="w-3/5 overflow-auto">
          {selectedMR ? (
            <MRDetail mr={selectedMR} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <p>{t('gitlab:mergeRequests.empty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Merge request list item */
const MRItem = memo(function MRItem({
  mr,
  isSelected,
  onClick,
}: {
  mr: GitLabMergeRequest;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border hover:bg-accent/30 transition-colors',
        isSelected && 'bg-accent/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <GitMerge
          className={cn(
            'h-4 w-4 mt-0.5 shrink-0',
            mr.state === 'merged'
              ? 'text-purple-500'
              : mr.state === 'opened'
                ? 'text-green-500'
                : 'text-red-500'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">!{mr.iid}</span>
            <span className="text-sm font-medium truncate">{mr.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium', STATE_BADGE_CLASSES[mr.state] ?? '')}>
              {mr.state}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {mr.author.username}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground font-mono">
            <span className="truncate max-w-[100px]">{mr.sourceBranch}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[100px]">{mr.targetBranch}</span>
          </div>
          {mr.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {mr.labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center px-1.5 py-0 rounded text-[10px] bg-muted text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          <span className="text-[10px] text-muted-foreground mt-1 block">
            {formatRelativeTime(new Date(mr.updatedAt))}
          </span>
        </div>
      </div>
    </button>
  );
});

/** Merge request detail panel */
function MRDetail({ mr }: { mr: GitLabMergeRequest }) {
  const { t } = useTranslation(['gitlab', 'common']);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATE_BADGE_CLASSES[mr.state] ?? '')}>
            <GitMerge className="h-3 w-3 mr-1" />
            {mr.state}
          </span>
          <span className="text-sm text-muted-foreground">!{mr.iid}</span>
        </div>
        <h3 className="text-lg font-semibold">{mr.title}</h3>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {mr.author.name} (@{mr.author.username})
        </span>
        {mr.assignees.length > 0 && (
          <span className="flex items-center gap-1">
            {t('common:assignees', { defaultValue: 'Assignees' })}:{' '}
            {mr.assignees.map((a) => a.username).join(', ')}
          </span>
        )}
      </div>

      {/* Labels */}
      {mr.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mr.labels.map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Branch info */}
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="secondary" className="font-mono">
          {mr.sourceBranch}
        </Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Badge variant="secondary" className="font-mono">
          {mr.targetBranch}
        </Badge>
      </div>

      {/* Merge status */}
      <div className="text-xs text-muted-foreground">
        {t('common:status', { defaultValue: 'Status' })}: {mr.mergeStatus}
      </div>

      {/* Description */}
      {mr.description && (
        <div className="border-t border-border pt-3">
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
            {mr.description}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border pt-3">
        <a href={mr.webUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            <ExternalLink className="h-4 w-4 mr-1" />
            {t('gitlab:mergeRequests.openInGitLab')}
          </Button>
        </a>
      </div>
    </div>
  );
}
