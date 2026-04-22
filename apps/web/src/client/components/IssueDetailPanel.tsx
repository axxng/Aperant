import { useEffect, startTransition, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, CheckCircle2, Circle, AlertTriangle, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
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
import { authenticatedFetch } from '../lib/api-client';
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
  /** Called when the user clicks the X close button. Parent should set selectedIssueId(null). */
  onClose?: () => void;
}

export function IssueDetailPanel({ issue, isOpen, onTriageLoad, onClose }: IssueDetailPanelProps) {
  const { t } = useTranslation('issues');

  // Derive owner/repo from issue.repoFullName — no new props needed (RESEARCH.md Pattern 5)
  const [owner, repo] = (issue?.repoFullName ?? '/').split('/');

  const queryClient = useQueryClient();
  const { error: toastError, success: toastSuccess } = useToast();

  // D-07: lazy fetch — fires when issue prop changes (panel opens for a new issue)
  // staleTime: 0 — always fetch fresh when panel opens (triage changes matter)
  const { data: triageData, isLoading: triageLoading } = useQuery({
    queryKey: ['triage', owner, repo, issue?.number],
    queryFn: async () => {
      if (!owner || !repo || !issue) throw new Error('no issue');
      const res = await authenticatedFetch(`/triage/${owner}/${repo}/${issue.number}`);
      if (!res.ok) throw new Error('triage fetch failed');
      return res.json() as Promise<{ isTriaged: boolean; priority: string | null }>;
    },
    enabled: Boolean(issue && owner && repo),
    staleTime: 0,
  });

  // D-08: optimistic mutation — update UI before server responds; rollback on error
  // Gap 4 fix: mutationFn receives vars with owner/repo/number — no stale closure capture
  const triageMutation = useMutation({
    mutationFn: async (vars: { isTriaged?: boolean; priority?: string | null; owner: string; repo: string; number: number }) => {
      const res = await authenticatedFetch(`/triage/${vars.owner}/${vars.repo}/${vars.number}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTriaged: vars.isTriaged, priority: vars.priority }),
      });
      if (!res.ok) throw new Error('triage save failed');
      return res.json();
    },
    onMutate: async (vars) => {
      // No await — keeps setQueryData synchronous so React batches it before Radix's ref cleanup runs.
      // Awaiting cancelQueries defers setQueryData to a microtask, which races with the DropdownMenu
      // unmount commit phase and causes "Maximum update depth exceeded" in React 19.
      queryClient.cancelQueries({ queryKey: ['triage', vars.owner, vars.repo, vars.number] });
      const previous = queryClient.getQueryData(['triage', vars.owner, vars.repo, vars.number]);
      queryClient.setQueryData(['triage', vars.owner, vars.repo, vars.number], (old: { isTriaged: boolean; priority: string | null } | undefined) => ({
        ...(old ?? { isTriaged: false, priority: null }),
        ...(vars.isTriaged !== undefined ? { isTriaged: vars.isTriaged } : {}),
        ...(vars.priority !== undefined ? { priority: vars.priority } : {}),
      }));
      return { previous, vars };
    },
    onError: (_err, vars, context) => {
      // CRITICAL: rollback first, THEN show error toast (RESEARCH.md Anti-Pattern)
      queryClient.setQueryData(['triage', vars.owner, vars.repo, vars.number], context?.previous);
      toastError(t('triage.saveError'));
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['triage', vars.owner, vars.repo, vars.number] });
    },
  });

  // Note section state (D-02: ephemeral only — text not stored in DB)
  const [noteText, setNoteText] = useState('');
  const [sent, setSent] = useState(false);

  // Note mutation — no optimistic update (no cache to roll back, unlike triageMutation)
  const noteMutation = useMutation({
    mutationFn: async (vars: { body: string; owner: string; repo: string; number: number }) => {
      const res = await authenticatedFetch(
        `/github/repos/${vars.owner}/${vars.repo}/issues/${vars.number}/comment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: vars.body }),
        }
      );
      if (!res.ok) throw new Error('comment post failed');
      return res.json();
    },
    onSuccess: () => {
      setNoteText('');
      setSent(true);
      toastSuccess(t('notes.postSuccess'));
      setTimeout(() => setSent(false), 2000);
    },
    onError: () => {
      // D-05: noteText is NOT cleared so user can retry without retyping
      toastError(t('notes.postError'));
    },
  });

  // Notify parent when triageData loads/changes — enables TriageBadgeSlot without N API calls.
  // startTransition defers the parent setState (issueTriageCache) until after the current commit
  // finishes, preventing Radix's DropdownMenu Collection refs from being mutated mid-close
  // (React 19 "Maximum update depth exceeded" when optimistic setQueryData fires during onSelect).
  useEffect(() => {
    if (issue && triageData) {
      startTransition(() => onTriageLoad?.(issue.id, triageData));
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
              <div className="flex items-start gap-2 flex-wrap w-full">
                <Badge
                  variant={issue.state === 'open' ? 'success' : 'muted'}
                  className="flex-shrink-0 mt-0.5"
                >
                  {t(`state.${issue.state}`)}
                </Badge>
                <span className="text-xs text-muted-foreground flex-shrink-0 mt-1">
                  #{issue.number}
                </span>
                {onClose && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 ml-auto -mt-0.5"
                    aria-label={t('detail.closePanel')}
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
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
                  onClick={() => {
                    if (!issue) return;
                    triageMutation.mutate({ isTriaged: !(triageData?.isTriaged ?? false), owner, repo, number: issue.number });
                  }}
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
                      <DropdownMenuItem key={p} onSelect={() => {
                        if (!issue) return;
                        triageMutation.mutate({ priority: p, owner, repo, number: issue.number });
                      }}>
                        <span className={cn('h-1.5 w-1.5 rounded-full mr-2 flex-shrink-0', PRIORITY_DOT_CLASSES[p])} />
                        {t(`triage.priority.${p}`)}
                      </DropdownMenuItem>
                    ))}
                    {/* Clear option — shown only when priority is set (RESEARCH.md Open Question #2) */}
                    {triageData?.priority && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => {
                          if (!issue) return;
                          triageMutation.mutate({ priority: null, owner, repo, number: issue.number });
                        }}>
                          {t('triage.priorityClear')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Note section — D-01: between triage controls and meta divider */}
            <div className="border-t border-border" />

            <div className="flex flex-col gap-2">
              <label htmlFor="note-textarea" className="text-xs text-muted-foreground">
                {t('notes.sectionLabel')}
              </label>
              <Textarea
                id="note-textarea"
                rows={4}
                placeholder={t('notes.placeholder')}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={noteMutation.isPending}
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === 'Enter' && noteText.trim() && !noteMutation.isPending) {
                    noteMutation.mutate({ body: noteText, owner, repo, number: issue.number });
                  }
                }}
              />
              <div aria-live="polite" className="flex justify-end">
                <Button
                  variant={sent ? 'success' : 'default'}
                  size="default"
                  disabled={!noteText.trim() || noteMutation.isPending || sent}
                  onClick={() => {
                    if (!issue) return;
                    noteMutation.mutate({ body: noteText, owner, repo, number: issue.number });
                  }}
                >
                  {sent
                    ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />{t('notes.sentButton')}</>
                    : t('notes.postButton')
                  }
                </Button>
              </div>
            </div>

            {/* Divider */}
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
