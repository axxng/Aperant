import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { usePRReviewStore } from '../stores/pr-review-store';
import { useProductStore } from '../stores/product-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import {
  Search, X, RefreshCw, ExternalLink, GitPullRequest, GitMerge,
  User, Calendar,
  Loader2, FileCode, Plus, Minus,
  ArrowRight,
} from 'lucide-react';
import type { GitHubPR, PRFile } from '@shared/types/pr';
import type { Product } from '@shared/types/product';

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

export function GitHubPRList() {
  const { t } = useTranslation(['prs', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const { products } = useProductStore();
  const {
    pullRequests, isLoading, isLoadingMore, hasMore, filterState,
    selectedPRNumber, selectedPR, prFiles, isLoadingFiles,
    reviewStatus, reviewText, isReviewing, error,
    loadPullRequests, loadMorePullRequests, setFilterState,
    selectPR, loadPRFiles, setReviewStatus, appendReviewText,
    startReview, resetReview, clearPRs,
  } = usePRReviewStore();

  const [searchQuery, setSearchQuery] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const product = products.find((p) => p.id === productId);
  const repos = product ? getRepos(product) : [];
  const primaryRepo = repos[0];

  // Load PRs on mount or filter change
  useEffect(() => {
    if (primaryRepo) {
      loadPullRequests(primaryRepo.owner, primaryRepo.repo, filterState);
    }
    return () => clearPRs();
  }, [primaryRepo?.owner, primaryRepo?.repo, filterState, loadPullRequests, clearPRs]);

  // Load files when PR is selected
  useEffect(() => {
    if (selectedPRNumber && primaryRepo) {
      loadPRFiles(primaryRepo.owner, primaryRepo.repo, selectedPRNumber);
    }
  }, [selectedPRNumber, primaryRepo, loadPRFiles]);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && primaryRepo && !isLoadingMore) {
          loadMorePullRequests(primaryRepo.owner, primaryRepo.repo);
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, primaryRepo, isLoadingMore, loadMorePullRequests]);

  // Filter by search
  const filteredPRs = useMemo(() => {
    if (!searchQuery) return pullRequests;
    const q = searchQuery.toLowerCase();
    return pullRequests.filter(
      (pr) => pr.title.toLowerCase().includes(q) || pr.body?.toLowerCase().includes(q)
    );
  }, [pullRequests, searchQuery]);

  const handleRefresh = useCallback(() => {
    if (primaryRepo) {
      loadPullRequests(primaryRepo.owner, primaryRepo.repo, filterState);
    }
  }, [primaryRepo, filterState, loadPullRequests]);

  const handleReview = useCallback(async () => {
    if (!selectedPR || !primaryRepo) return;
    startReview();

    try {
      const response = await fetch('/api/pr-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: primaryRepo.owner,
          repo: primaryRepo.repo,
          prNumber: selectedPR.number,
          prTitle: selectedPR.title,
          prBody: selectedPR.body,
          headRef: selectedPR.headRefName,
          baseRef: selectedPR.baseRefName,
          files: prFiles,
        }),
      });

      if (!response.ok) {
        setReviewStatus({ phase: 'error', progress: 0, message: 'Request failed', error: `HTTP ${response.status}` });
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
                appendReviewText(data.text);
              } else if (eventType === 'progress') {
                setReviewStatus({ phase: data.phase, progress: data.progress, message: data.message });
              } else if (eventType === 'review-result') {
                setReviewStatus({ phase: 'complete', progress: 100, message: 'Review complete' });
              } else if (eventType === 'error') {
                setReviewStatus({ phase: 'error', progress: 0, message: data.error, error: data.error });
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
        setReviewStatus({ phase: 'error', progress: 0, message: err.message, error: err.message });
      }
    }
  }, [selectedPR, primaryRepo, prFiles, startReview, setReviewStatus, appendReviewText]);

  if (!product || repos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">{t('prs:noRepos')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('prs:title')}</h2>
          <Badge variant="secondary" className="text-xs">
            {primaryRepo.owner}/{primaryRepo.repo}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('prs:searchPlaceholder')}
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
        {(['open', 'closed', 'all'] as const).map((state) => (
          <Button
            key={state}
            variant={filterState === state ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setFilterState(state)}
          >
            {t(`prs:state.${state}`)}
          </Button>
        ))}
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* PR list (left) */}
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
          ) : filteredPRs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {t('prs:empty')}
            </div>
          ) : (
            <div>
              {filteredPRs.map((pr) => (
                <PRListItem
                  key={pr.number}
                  pr={pr}
                  isSelected={pr.number === selectedPRNumber}
                  onClick={() => selectPR(pr.number)}
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

        {/* PR detail (right) */}
        <div className="w-1/2 overflow-auto">
          {selectedPR ? (
            <PRDetail
              pr={selectedPR}
              files={prFiles}
              isLoadingFiles={isLoadingFiles}
              reviewStatus={reviewStatus}
              reviewText={reviewText}
              isReviewing={isReviewing}
              onReview={handleReview}
              onResetReview={resetReview}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t('prs:selectPR')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** PR list item */
const PRListItem = memo(function PRListItem({
  pr,
  isSelected,
  onClick,
}: {
  pr: GitHubPR;
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
        {pr.state === 'merged' ? (
          <GitMerge className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
        ) : (
          <GitPullRequest className={cn('h-4 w-4 mt-0.5 shrink-0', pr.state === 'open' ? 'text-green-500' : 'text-red-500')} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">#{pr.number}</span>
            <span className="text-sm font-medium truncate">{pr.title}</span>
            {pr.draft && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">Draft</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {pr.author.login}
            </span>
            <span className="flex items-center gap-1">
              <Plus className="h-3 w-3 text-green-500" />
              {pr.additions}
              <Minus className="h-3 w-3 text-red-500 ml-1" />
              {pr.deletions}
            </span>
            <span className="flex items-center gap-1">
              <FileCode className="h-3 w-3" />
              {pr.changedFiles}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
});

/** PR detail panel */
function PRDetail({
  pr,
  files,
  isLoadingFiles,
  reviewStatus,
  reviewText,
  isReviewing,
  onReview,
  onResetReview,
}: {
  pr: GitHubPR;
  files: PRFile[];
  isLoadingFiles: boolean;
  reviewStatus: { phase: string; progress: number; message: string; error?: string };
  reviewText: string;
  isReviewing: boolean;
  onReview: () => void;
  onResetReview: () => void;
}) {
  const { t } = useTranslation(['prs', 'common']);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={pr.state === 'open' ? 'success' : pr.state === 'merged' ? 'default' : 'secondary'}>
            {pr.state === 'merged' ? (
              <GitMerge className="h-3 w-3 mr-1" />
            ) : (
              <GitPullRequest className="h-3 w-3 mr-1" />
            )}
            {t(`prs:state.${pr.state === 'merged' ? 'closed' : pr.state}`)}
          </Badge>
          {pr.draft && <Badge variant="outline">{t('prs:draft')}</Badge>}
          <span className="text-sm text-muted-foreground">#{pr.number}</span>
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <h3 className="text-lg font-semibold">{pr.title}</h3>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {pr.author.login}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(pr.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Branch info */}
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="secondary" className="font-mono">{pr.headRefName}</Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Badge variant="secondary" className="font-mono">{pr.baseRefName}</Badge>
      </div>

      {/* Diff stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="text-green-500">+{pr.additions} {t('prs:additions')}</span>
        <span className="text-red-500">-{pr.deletions} {t('prs:deletions')}</span>
        <span>{pr.changedFiles} {t('prs:changedFiles')}</span>
      </div>

      {/* Labels */}
      {pr.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pr.labels.map((label) => (
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

      {/* Actions */}
      <div className="flex gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          onClick={onReview}
          disabled={isReviewing}
        >
          {isReviewing ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-1" />
          )}
          {isReviewing ? t('prs:reviewing') : t('prs:review')}
        </Button>
        <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            <ExternalLink className="h-4 w-4 mr-1" />
            {t('prs:viewOnGitHub')}
          </Button>
        </a>
      </div>

      {/* Review Panel */}
      {(isReviewing || reviewText || reviewStatus.phase === 'error') && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
            <span className="text-sm font-medium">{t('prs:reviewAnalysis')}</span>
            <div className="flex items-center gap-2">
              {isReviewing && (
                <span className="text-xs text-muted-foreground">{reviewStatus.message}</span>
              )}
              {reviewStatus.phase === 'complete' && (
                <Badge variant="success" className="text-xs">{t('prs:reviewComplete')}</Badge>
              )}
              {reviewStatus.phase === 'error' && (
                <Badge variant="destructive" className="text-xs">{t('prs:reviewError')}</Badge>
              )}
              {!isReviewing && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onResetReview}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {isReviewing && reviewStatus.progress > 0 && (
            <div className="h-1 bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${reviewStatus.progress}%` }}
              />
            </div>
          )}
          <div className="p-3 max-h-96 overflow-auto">
            {reviewStatus.phase === 'error' ? (
              <p className="text-sm text-destructive">{reviewStatus.error}</p>
            ) : reviewText ? (
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
                {reviewText}
              </pre>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{reviewStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Files */}
      <div className="border-t border-border pt-3">
        <h4 className="text-sm font-medium mb-2">{t('prs:files')} ({files.length})</h4>
        {isLoadingFiles ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('prs:noFiles')}</p>
        ) : (
          <div className="space-y-1">
            {files.map((file) => (
              <div key={file.path} className="flex items-center gap-2 text-xs py-1">
                <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono truncate flex-1">{file.path}</span>
                <span className="text-green-500 shrink-0">+{file.additions}</span>
                <span className="text-red-500 shrink-0">-{file.deletions}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {pr.body && (
        <div className="border-t border-border pt-3">
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
            {pr.body}
          </pre>
        </div>
      )}
    </div>
  );
}
