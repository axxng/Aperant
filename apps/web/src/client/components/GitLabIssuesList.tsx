import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Search, ExternalLink, MessageSquare, Loader2, Import,
  User, Calendar, Tag, CircleDot, CircleCheck, X,
} from 'lucide-react';
import { cn, formatRelativeTime } from '../lib/utils';
import { useGitLabStore } from '../stores/gitlab-store';
import { useProductStore } from '../stores/product-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import type { GitLabIssue } from '@shared/types/gitlab';

/**
 * Extract the GitLab project path from a product's sources array.
 * Looks for a source with type 'gitlab_project' and returns its path.
 */
function getGitLabProjectPath(product: { sources: Array<{ type: string; [key: string]: any }> }): string | null {
  for (const source of product.sources) {
    if (source.type === 'gitlab_project') {
      return (source.path ?? source.repo ?? null) as string | null;
    }
  }
  return null;
}

export function GitLabIssuesList() {
  const { t } = useTranslation(['gitlab', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const { products } = useProductStore();
  const store = useGitLabStore();

  const [searchInput, setSearchInput] = useState('');
  const [importingIssue, setImportingIssue] = useState<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const product = products.find((p) => p.id === productId);
  const projectPath = product ? getGitLabProjectPath(product) : null;

  const selectedIssue = store.issues.find((i) => i.iid === store.selectedIssueIid) ?? null;

  // Load issues from the API
  const loadIssues = useCallback(
    async (page = 1) => {
      if (!projectPath) return;
      store.setIssuesLoading(true);
      try {
        const params = new URLSearchParams({
          state: store.issuesState,
          page: String(page),
          per_page: '30',
        });
        if (store.issuesSearch) params.set('search', store.issuesSearch);
        const res = await fetch(
          `/api/gitlab/${encodeURIComponent(projectPath)}/issues?${params}`
        );
        const data = await res.json();
        if (page === 1) {
          store.setIssues(data.items, data.total);
        } else {
          store.appendIssues(data.items, data.total);
        }
      } finally {
        store.setIssuesLoading(false);
      }
    },
    [projectPath, store.issuesState, store.issuesSearch]
  );

  // Load on mount and when filters change
  useEffect(() => {
    if (projectPath) {
      loadIssues(1);
    }
    return () => {
      store.resetIssues();
    };
  }, [projectPath, store.issuesState, store.issuesSearch]);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      store.setIssuesSearch(searchInput);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  const handleLoadMore = useCallback(() => {
    const nextPage = store.issuesPage + 1;
    store.setIssuesPage(nextPage);
    loadIssues(nextPage);
  }, [store.issuesPage, loadIssues]);

  const handleStateChange = useCallback(
    (state: 'opened' | 'closed' | 'all') => {
      store.setIssuesState(state);
    },
    []
  );

  const handleImport = useCallback(
    async (issue: GitLabIssue) => {
      if (!productId) return;
      setImportingIssue(issue.iid);
      try {
        // POST to import the GitLab issue as a task
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            title: issue.title,
            description: issue.description || '',
            labels: issue.labels.map((name) => ({ name })),
            assignees: issue.assignees.map((a) => ({
              login: a.username,
              avatarUrl: a.avatarUrl,
            })),
            metadata: {
              sourceType: 'gitlab',
              gitlabIssueIid: issue.iid,
              gitlabIssueUrl: issue.webUrl,
            },
          }),
        });
      } catch (err) {
        console.error('Failed to import GitLab issue:', err);
      } finally {
        setImportingIssue(null);
      }
    },
    [productId]
  );

  const hasMore = store.issues.length < store.issuesTotal;

  // No GitLab project configured
  if (!product || !projectPath) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">{t('gitlab:issues.noProject')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('gitlab:issues.title')}</h2>
          <Badge variant="secondary" className="text-xs">
            {store.issuesTotal}
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
            placeholder={t('gitlab:issues.searchPlaceholder')}
            className={cn(
              'w-full h-8 pl-8 pr-8 rounded-md border border-input bg-background text-sm',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                store.setIssuesSearch('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* State filter */}
        {(['opened', 'closed', 'all'] as const).map((state) => (
          <Button
            key={state}
            variant={store.issuesState === state ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => handleStateChange(state)}
          >
            {t(`gitlab:issues.state.${state}`)}
          </Button>
        ))}
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Issue list (left ~40%) */}
        <ScrollArea className="w-2/5 border-r border-border">
          {store.issuesLoading && store.issues.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : store.issues.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {t('gitlab:issues.empty')}
            </div>
          ) : (
            <div>
              {store.issues.map((issue) => (
                <IssueItem
                  key={issue.iid}
                  issue={issue}
                  isSelected={issue.iid === store.selectedIssueIid}
                  onClick={() => store.setSelectedIssueIid(issue.iid)}
                />
              ))}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={store.issuesLoading}
                  >
                    {store.issuesLoading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : null}
                    {t('gitlab:issues.loadMore')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Issue detail (right ~60%) */}
        <div className="w-3/5 overflow-auto">
          {selectedIssue ? (
            <IssueDetail
              issue={selectedIssue}
              onImport={() => handleImport(selectedIssue)}
              isImporting={importingIssue === selectedIssue.iid}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t('gitlab:issues.selectIssue')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Memoized issue list item */
const IssueItem = memo(function IssueItem({
  issue,
  isSelected,
  onClick,
}: {
  issue: GitLabIssue;
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
        {issue.state === 'opened' ? (
          <CircleDot className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
        ) : (
          <CircleCheck className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">#{issue.iid}</span>
            <span className="text-sm font-medium truncate">{issue.title}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {issue.author.username}
            </span>
            {issue.milestone && (
              <span className="truncate max-w-[120px]">{issue.milestone.title}</span>
            )}
            {issue.userNotesCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {issue.userNotesCount}
              </span>
            )}
            <span>{formatRelativeTime(new Date(issue.createdAt))}</span>
          </div>
          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {issue.labels.map((label) => (
                <Badge key={label} variant="outline" className="text-[10px] px-1.5 py-0">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

/** Issue detail panel */
function IssueDetail({
  issue,
  onImport,
  isImporting,
}: {
  issue: GitLabIssue;
  onImport: () => void;
  isImporting: boolean;
}) {
  const { t } = useTranslation(['gitlab', 'common']);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={issue.state === 'opened' ? 'success' : 'secondary'}>
            {issue.state === 'opened' ? (
              <CircleDot className="h-3 w-3 mr-1" />
            ) : (
              <CircleCheck className="h-3 w-3 mr-1" />
            )}
            {t(`gitlab:issues.state.${issue.state}`)}
          </Badge>
          <span className="text-sm text-muted-foreground">#{issue.iid}</span>
        </div>
        <h3 className="text-lg font-semibold">{issue.title}</h3>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {issue.author.username}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(issue.createdAt).toLocaleDateString()}
        </span>
        {issue.userNotesCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {issue.userNotesCount} {t('gitlab:issues.comments')}
          </span>
        )}
      </div>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {issue.labels.map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Assignees */}
      {issue.assignees.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">{t('gitlab:issues.assignees')}:</span>
          {issue.assignees.map((a) => (
            <Badge key={a.username} variant="secondary" className="text-xs">
              {a.username}
            </Badge>
          ))}
        </div>
      )}

      {/* Milestone */}
      {issue.milestone && (
        <div className="text-xs text-muted-foreground">
          {t('gitlab:issues.milestone')}: {issue.milestone.title}
        </div>
      )}

      {/* Description */}
      {issue.description && (
        <div className="border-t border-border pt-3">
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
            {issue.description}
          </pre>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={onImport} disabled={isImporting}>
          {isImporting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Import className="h-4 w-4 mr-1" />
          )}
          {t('gitlab:issues.importAsTask')}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={issue.webUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            {t('gitlab:issues.openInGitLab')}
          </a>
        </Button>
      </div>
    </div>
  );
}
