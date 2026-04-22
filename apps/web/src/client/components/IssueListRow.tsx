import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import type { GitHubIssue } from '@shared/types/github';

interface ProductBadgeInfo {
  color: string;   // hex from product.color e.g. '#3B82F6' — applied via inline style
  name: string;    // product.name, truncated in render via max-w-[80px] truncate
}

interface TriageStateDisplay {
  isTriaged: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
}

interface IssueListRowProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
  productBadge?: ProductBadgeInfo;   // NEW — optional; absent = single-repo IssuesView unchanged
  triageState?: TriageStateDisplay;  // optional; mirrors productBadge pattern
}

const PRIORITY_PILL_CLASSES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high:     'bg-orange-500/10 text-orange-500',
  medium:   'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400',
  low:      'bg-muted text-muted-foreground',
};

export const IssueListRow = memo(function IssueListRow({
  issue,
  isSelected,
  onClick,
  productBadge,
  triageState,
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

      {/* Product badge — shown in unified AllIssuesView only (CROSS-02) */}
      {productBadge && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: productBadge.color }}
          />
          <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
            {productBadge.name}
          </span>
        </div>
      )}

      {/* TriageBadge slot — D-03, D-04: checkmark + priority pill (TRIAGE-04) */}
      {triageState && (triageState.isTriaged || triageState.priority) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Priority pill — shown when priority set (D-04); always shows label text, never color-only */}
          {triageState.priority && (
            <span
              className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0 text-[11px] font-semibold h-5',
                PRIORITY_PILL_CLASSES[triageState.priority]
              )}
            >
              {triageState.priority.charAt(0).toUpperCase() + triageState.priority.slice(1)}
            </span>
          )}
          {/* Checkmark — shown when triaged (D-03) */}
          {triageState.isTriaged && (
            <CheckCircle2
              className="h-3.5 w-3.5 text-success flex-shrink-0"
              aria-label={t('triage.triaged')}
            />
          )}
        </div>
      )}
    </div>
  );
});
