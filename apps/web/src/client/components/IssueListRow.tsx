import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import type { GitHubIssue } from '@shared/types/github';

interface IssueListRowProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
}

export const IssueListRow = memo(function IssueListRow({
  issue,
  isSelected,
  onClick,
}: IssueListRowProps) {
  const { t } = useTranslation('issues');

  return (
    <div
      onClick={onClick}
      className={cn(
        'h-11 flex items-center gap-3 px-4 border-b border-border cursor-pointer transition-colors',
        'hover:bg-accent/50',
        isSelected && 'bg-accent/50 border-l-2 border-primary'
      )}
    >
      {/* Issue number — Caption (11px) */}
      <span className="text-[11px] text-muted-foreground w-12 flex-shrink-0">
        {t('list.issueNumber', { number: issue.number })}
      </span>

      {/* Title — Body (14px) — PRIMARY VISUAL ANCHOR */}
      <span className="text-sm font-normal flex-1 truncate">{issue.title}</span>

      {/* Label color dots — max 4 visible; MUST use #${label.color} */}
      {issue.labels.length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {issue.labels.slice(0, 4).map(label => (
            <Tooltip key={label.name}>
              <TooltipTrigger asChild>
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `#${label.color}` }}
                />
              </TooltipTrigger>
              <TooltipContent>{label.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Assignee avatars — max 3 visible */}
      {issue.assignees.length > 0 && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {issue.assignees.slice(0, 3).map(assignee => (
            <Tooltip key={assignee.login}>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>{assignee.login}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* State badge — Caption (11px) */}
      <Badge
        variant={issue.state === 'open' ? 'success' : 'muted'}
        className="text-[11px] px-1.5 py-0 flex-shrink-0"
      >
        {t(`state.${issue.state}`)}
      </Badge>
    </div>
  );
});
