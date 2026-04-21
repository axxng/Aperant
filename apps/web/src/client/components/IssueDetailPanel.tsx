import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import type { GitHubIssue } from '@shared/types/github';

interface IssueDetailPanelProps {
  issue: GitHubIssue | null;
  isOpen: boolean;
}

export function IssueDetailPanel({ issue, isOpen }: IssueDetailPanelProps) {
  const { t } = useTranslation('issues');

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
