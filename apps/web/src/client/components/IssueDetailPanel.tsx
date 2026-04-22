import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { useToast } from '../hooks/useToast';
import { cn } from '../lib/utils';
import type { GitHubIssue } from '@shared/types/github';

const PRIORITY_DOT_CLASSES: Record<string, string> = {
  critical: 'bg-destructive',
  high:     'bg-orange-500',
  medium:   'bg-yellow-400',
  low:      'bg-muted-foreground',
};

interface IssueDetailPanelProps {
  issue: GitHubIssue | null;
  isOpen: boolean;
  /**
   * Called when triage data loads or updates for the current issue.
   * Parent stores per-issue triage state for TriageBadgeSlot in IssueListRow.
   * Solves RESEARCH.md Open Question #1 without prop-drilling or context.
   */
  onTriageLoad?: (issueId: number, triageState: { isTriaged: boolean; priority: string | null }) => void;
}

export function IssueDetailPanel({ issue, isOpen, onTriageLoad }: IssueDetailPanelProps) {
  const { t } = useTranslation('issues');

  // Derive owner/repo from issue.repoFullName — no new props needed (RESEARCH.md Pattern 5)
  const [owner, repo] = (issue?.repoFullName ?? '/').split('/');

  const queryClient = useQueryClient();
  const { error: toastError } = useToast();

  // D-07: lazy fetch — fires when issue prop changes (panel opens for a new issue)
  // staleTime: 0 — always fetch fresh when panel opens (triage changes matter)
  const { data: triageData, isLoading: triageLoading } = useQuery({
    queryKey: ['triage', owner, repo, issue?.number],
    queryFn: async () => {
      if (!owner || !repo || !issue) throw new Error('no issue');
      const res = await fetch(
        `/api/triage/${owner}/${repo}/${issue.number}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('triage fetch failed');
      return res.json() as Promise<{ isTriaged: boolean; priority: string | null }>;
    },
    enabled: Boolean(issue && owner && repo),
    staleTime: 0,
  });

  // D-08: optimistic mutation — update UI before server responds; rollback on error
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
      // No await — keeps setQueryData synchronous so React batches it before Radix's ref cleanup runs.
      // Awaiting cancelQueries defers setQueryData to a microtask, which races with the DropdownMenu
      // unmount commit phase and causes "Maximum update depth exceeded" in React 19.
      queryClient.cancelQueries({ queryKey: ['triage', owner, repo, issue?.number] });
      const previous = queryClient.getQueryData(['triage', owner, repo, issue?.number]);
      queryClient.setQueryData(['triage', owner, repo, issue?.number], (old: { isTriaged: boolean; priority: string | null } | undefined) => ({
        ...(old ?? { isTriaged: false, priority: null }),
        ...updates,
      }));
      return { previous };
    },
    onError: (_err, _updates, context) => {
      // CRITICAL: rollback first, THEN show error toast (RESEARCH.md Anti-Pattern)
      queryClient.setQueryData(['triage', owner, repo, issue?.number], context?.previous);
      toastError(t('triage.saveError'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['triage', owner, repo, issue?.number] });
    },
  });

  // Notify parent when triageData loads/changes — enables TriageBadgeSlot without N API calls
  useEffect(() => {
    if (issue && triageData) {
      onTriageLoad?.(issue.id, triageData);
    }
  }, [issue, triageData, onTriageLoad]);

  const formattedDate = issue
    ? new Date(issue.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-[40%] min-w-[320px] bg-background border-l border-border shadow-xl',
        'transform transition-transform duration-200 ease-in-out z-50',
        isOpen && issue ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {issue && (
        <ScrollArea className="h-full">
          <div className="p-6 space-y-4">
            {/* Header: title + number + state badge */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 flex-wrap">
                <Badge
                  variant={issue.state === 'open' ? 'success' : 'muted'}
                  className="flex-shrink-0 mt-0.5"
                >
                  {t(`state.${issue.state}`)}
                </Badge>
                <span className="text-xs text-muted-foreground flex-shrink-0 mt-1">
                  #{issue.number}
                </span>
              </div>
              <h2 className="text-base font-semibold leading-tight">{issue.title}</h2>
            </div>

            {/* TriageSection — D-01: always visible when panel open, pinned between header and meta */}
            <div className="space-y-2">
              {/* ClosedIssueWarning — D-06: inline informational banner; role="alert" for screen readers */}
              {issue.state === 'closed' && (
                <div
                  role="alert"
                  className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground"
                >
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{t('triage.closedWarning')}</span>
                </div>
              )}

              {/* Compact horizontal row: TriagedToggle (left) + PrioritySelector (right) — D-01, D-02 */}
              <div className="flex items-center gap-2">
                {/* TriagedToggle — aria-pressed for accessibility (UI-SPEC Accessibility Contract) */}
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={triageData?.isTriaged ?? false}
                  aria-label={t('triage.markTriagedAriaLabel')}
                  disabled={triageLoading || triageMutation.isPending}
                  onClick={() => triageMutation.mutate({ isTriaged: !(triageData?.isTriaged ?? false) })}
                  className={cn(
                    'flex items-center gap-1.5',
                    triageData?.isTriaged && 'border-success/30'
                  )}
                >
                  {triageData?.isTriaged
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  {triageData?.isTriaged ? t('triage.triaged') : t('triage.markTriaged')}
                </Button>

                {/* PrioritySelector — Radix DropdownMenu (D-02: action menu, not form field) */}
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
                        : t('triage.priorityNone')
                      }
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(['critical', 'high', 'medium', 'low'] as const).map(p => (
                      <DropdownMenuItem key={p} onSelect={() => triageMutation.mutate({ priority: p })}>
                        <span className={cn('h-1.5 w-1.5 rounded-full mr-2 flex-shrink-0', PRIORITY_DOT_CLASSES[p])} />
                        {t(`triage.priority.${p}`)}
                      </DropdownMenuItem>
                    ))}
                    {/* Clear option — shown only when priority is set (RESEARCH.md Open Question #2) */}
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
            </div>

            {/* Divider after TriageSection — matches existing divider pattern in the panel */}
            <div className="border-t border-border" />

            {/* Meta: labels + assignees + created date */}
            <div className="space-y-2">
              {/* Labels — full name with color background (D-07) */}
              {issue.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.map(label => (
                    <span
                      key={label.name}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: `#${label.color}20`,
                        borderColor: `#${label.color}60`,
                        color: `#${label.color}`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Assignees — avatar + login */}
              {issue.assignees.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {issue.assignees.map(assignee => (
                    <div key={assignee.login} className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {assignee.avatarUrl ? (
                          <img
                            src={assignee.avatarUrl}
                            alt={assignee.login}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[9px] font-medium text-muted-foreground uppercase">
                            {assignee.login.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{assignee.login}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Created date */}
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            </div>

            {/* View on GitHub link — BROWSE-08 */}
            <Button variant="outline" size="sm" asChild>
              <a
                href={issue.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('detail.viewOnGitHub')}
              </a>
            </Button>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Markdown body — react-markdown + remark-gfm (D-17) */}
            {issue.body ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {issue.body}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">{t('detail.noBody')}</p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
