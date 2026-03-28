import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useGitHubIssuesStore } from '../stores/github-issues-store';
import { useProductStore } from '../stores/product-store';
import { useTaskStore } from '../stores/task-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import {
  Search, X, RefreshCw, ExternalLink, Tag, MessageSquare,
  User, Calendar, Import, ChevronDown, CircleDot, CircleCheck, Loader2,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { useInvestigationStore } from '../stores/investigation-store';
import type { GitHubIssue } from '@shared/types/github';
import type { Product, RepoSource, MultiRepoSource } from '@shared/types/product';

/** Extract all owner/repo pairs from a product's sources */
function getRepos(product: Product): Array<{ owner: string; repo: string }> {
  const repos: Array<{ owner: string; repo: string }> = [];
  for (const source of product.sources) {
    if (source.type === 'repo') {
      repos.push({ owner: source.owner, repo: source.repo });
    } else if (source.type === 'repos') {
      repos.push(...source.repos);
    }
  }
  return repos;
}

export function GitHubIssuesList() {
  const { t } = useTranslation(['issues', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const { products } = useProductStore();
  const { createTask } = useTaskStore();
  const {
    issues, isLoading, isLoadingMore, error, selectedIssueNumber,
    filterState, hasMore,
    loadIssues, loadMoreIssues, setFilterState, selectIssue, clearIssues,
    getSelectedIssue,
  } = useGitHubIssuesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [importingIssue, setImportingIssue] = useState<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const product = products.find((p) => p.id === productId);
  const repos = product ? getRepos(product) : [];
  const primaryRepo = repos[0];

  // Load issues on mount or filter change
  useEffect(() => {
    if (primaryRepo) {
      loadIssues(primaryRepo.owner, primaryRepo.repo, filterState);
    }
    return () => clearIssues();
  }, [primaryRepo?.owner, primaryRepo?.repo, filterState, loadIssues, clearIssues]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && primaryRepo && !isLoadingMore) {
          loadMoreIssues(primaryRepo.owner, primaryRepo.repo);
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, primaryRepo, isLoadingMore, loadMoreIssues]);

  // Filter issues by search query
  const filteredIssues = useMemo(() => {
    if (!searchQuery) return issues;
    const q = searchQuery.toLowerCase();
    return issues.filter(
      (i) => i.title.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q)
    );
  }, [issues, searchQuery]);

  const selectedIssue = getSelectedIssue();

  const handleImport = useCallback(async (issue: GitHubIssue) => {
    if (!productId || !primaryRepo) return;
    setImportingIssue(issue.number);
    try {
      await createTask({
        productId,
        title: issue.title,
        description: issue.body || '',
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.htmlUrl,
        githubRepo: issue.repoFullName,
        labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
        assignees: issue.assignees.map((a) => ({ login: a.login, avatarUrl: a.avatarUrl })),
        metadata: { sourceType: 'github' },
      });
    } catch (err) {
      console.error('Failed to import issue:', err);
    } finally {
      setImportingIssue(null);
    }
  }, [productId, primaryRepo, createTask]);

  const handleRefresh = useCallback(() => {
    if (primaryRepo) {
      loadIssues(primaryRepo.owner, primaryRepo.repo, filterState);
    }
  }, [primaryRepo, filterState, loadIssues]);

  if (!product || repos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">{t('issues:noRepos')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('issues:title')}</h2>
          <Badge variant="secondary" className="text-xs">
            {primaryRepo.owner}/{primaryRepo.repo}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('issues:searchPlaceholder')}
            className={cn(
              'w-full h-8 pl-8 pr-8 rounded-md border border-input bg-background text-sm',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* State filter */}
        {(['open', 'closed', 'all'] as const).map((state) => (
          <Button
            key={state}
            variant={filterState === state ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setFilterState(state)}
          >
            {t(`issues:state.${state}`)}
          </Button>
        ))}
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Issue list (left) */}
        <ScrollArea className="w-1/2 border-r border-border">
          {error && (
            <div className="px-4 py-3 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">
              {error}
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {t('issues:empty')}
            </div>
          ) : (
            <div>
              {filteredIssues.map((issue) => (
                <IssueListItem
                  key={issue.number}
                  issue={issue}
                  isSelected={issue.number === selectedIssueNumber}
                  onClick={() => selectIssue(issue.number)}
                />
              ))}
              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-4">
                  {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Issue detail (right) */}
        <div className="w-1/2 overflow-auto">
          {selectedIssue ? (
            <IssueDetail
              issue={selectedIssue}
              onImport={() => handleImport(selectedIssue)}
              isImporting={importingIssue === selectedIssue.number}
              repo={primaryRepo}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t('issues:selectIssue')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Issue list item */
const IssueListItem = memo(function IssueListItem({
  issue,
  isSelected,
  onClick,
}: {
  issue: GitHubIssue;
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
        {issue.state === 'open' ? (
          <CircleDot className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
        ) : (
          <CircleCheck className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">#{issue.number}</span>
            <span className="text-sm font-medium truncate">{issue.title}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {issue.author.login}
            </span>
            {issue.commentsCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {issue.commentsCount}
              </span>
            )}
            {issue.labels.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {issue.labels.length}
              </span>
            )}
          </div>
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
  repo,
}: {
  issue: GitHubIssue;
  onImport: () => void;
  isImporting: boolean;
  repo: { owner: string; repo: string };
}) {
  const { t } = useTranslation(['issues', 'common']);
  const {
    status, streamedText, isInvestigating,
    startInvestigation, setStatus, appendText, setResult, reset,
  } = useInvestigationStore();

  const handleInvestigate = useCallback(async () => {
    startInvestigation();
    const { eventSource: controller, response: responsePromise } = api.investigate.startInvestigation({
      owner: repo.owner,
      repo: repo.repo,
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body,
      labels: issue.labels.map((l) => l.name),
    });

    try {
      const response = await responsePromise;
      if (!response.ok) {
        setStatus({ phase: 'error', progress: 0, message: 'Request failed', error: `HTTP ${response.status}` });
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'text-delta') {
                appendText(data.text);
              } else if (eventType === 'progress') {
                setStatus({ phase: data.phase, progress: data.progress, message: data.message });
              } else if (eventType === 'investigation-result') {
                setResult(data);
              } else if (eventType === 'error') {
                setStatus({ phase: 'error', progress: 0, message: data.error, error: data.error });
              }
            } catch {
              // skip malformed JSON
            }
            eventType = '';
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatus({ phase: 'error', progress: 0, message: err.message, error: err.message });
      }
    }
  }, [issue, repo, startInvestigation, setStatus, appendText, setResult]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={issue.state === 'open' ? 'success' : 'secondary'}>
            {issue.state === 'open' ? (
              <CircleDot className="h-3 w-3 mr-1" />
            ) : (
              <CircleCheck className="h-3 w-3 mr-1" />
            )}
            {t(`issues:state.${issue.state}`)}
          </Badge>
          <span className="text-sm text-muted-foreground">#{issue.number}</span>
          <a
            href={issue.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <h3 className="text-lg font-semibold">{issue.title}</h3>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {issue.author.login}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(issue.createdAt).toLocaleDateString()}
        </span>
        {issue.commentsCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {issue.commentsCount} {t('issues:comments')}
          </span>
        )}
      </div>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {issue.labels.map((label) => (
            <Badge
              key={label.name}
              variant="outline"
              className="text-xs"
              style={{
                borderColor: `#${label.color}`,
                color: `#${label.color}`,
                backgroundColor: `#${label.color}15`,
              }}
            >
              {label.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Assignees */}
      {issue.assignees.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">{t('issues:assignees')}:</span>
          {issue.assignees.map((a) => (
            <Badge key={a.login} variant="secondary" className="text-xs">
              {a.login}
            </Badge>
          ))}
        </div>
      )}

      {/* Milestone */}
      {issue.milestone && (
        <div className="text-xs text-muted-foreground">
          {t('issues:milestone')}: {issue.milestone.title}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t border-border pt-3">
        <Button size="sm" onClick={onImport} disabled={isImporting}>
          {isImporting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Import className="h-4 w-4 mr-1" />
          )}
          {t('issues:importAsTask')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleInvestigate}
          disabled={isInvestigating}
        >
          {isInvestigating ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-1" />
          )}
          {isInvestigating ? t('issues:investigating') : t('issues:investigate')}
        </Button>
      </div>

      {/* Investigation Panel */}
      {(isInvestigating || streamedText || status.phase === 'error') && (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Investigation header */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
            <span className="text-sm font-medium">{t('issues:investigationAnalysis')}</span>
            <div className="flex items-center gap-2">
              {isInvestigating && (
                <span className="text-xs text-muted-foreground">{status.message}</span>
              )}
              {status.phase === 'complete' && (
                <Badge variant="success" className="text-xs">{t('issues:investigationComplete')}</Badge>
              )}
              {status.phase === 'error' && (
                <Badge variant="destructive" className="text-xs">{t('issues:investigationError')}</Badge>
              )}
              {!isInvestigating && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={reset}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {/* Investigation progress bar */}
          {isInvestigating && status.progress > 0 && (
            <div className="h-1 bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          )}
          {/* Investigation content */}
          <div className="p-3 max-h-96 overflow-auto">
            {status.phase === 'error' ? (
              <p className="text-sm text-destructive">{status.error}</p>
            ) : streamedText ? (
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
                {streamedText}
              </pre>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{status.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {issue.body && (
        <div className="border-t border-border pt-3">
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
            {issue.body}
          </pre>
        </div>
      )}
    </div>
  );
}
