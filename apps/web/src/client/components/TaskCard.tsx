import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, MoreVertical, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn, formatRelativeTime } from '../lib/utils';
import type { Task, TaskStatus, TaskCategory } from '@shared/types/task';

/** All columns available for status changes */
const TASK_STATUS_COLUMNS: TaskStatus[] = [
  'backlog',
  'queue',
  'in_progress',
  'ai_review',
  'human_review',
  'done',
];

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'tasks:status.backlog',
  queue: 'tasks:status.queue',
  in_progress: 'tasks:status.inProgress',
  ai_review: 'tasks:status.aiReview',
  human_review: 'tasks:status.humanReview',
  done: 'tasks:status.done',
  pr_created: 'tasks:status.prCreated',
  error: 'tasks:status.error',
};

const CATEGORY_I18N_KEYS: Record<TaskCategory, string> = {
  feature: 'tasks:category.feature',
  bug_fix: 'tasks:category.bug_fix',
  refactoring: 'tasks:category.refactoring',
  documentation: 'tasks:category.documentation',
  security: 'tasks:category.security',
  performance: 'tasks:category.performance',
  ui_ux: 'tasks:category.ui_ux',
  infrastructure: 'tasks:category.infrastructure',
  testing: 'tasks:category.testing',
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  feature: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  bug_fix: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  refactoring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  documentation: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  security: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  performance: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  ui_ux: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  infrastructure: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  testing: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
};

const PRIORITY_I18N_KEYS: Record<string, string> = {
  urgent: 'tasks:priority.urgent',
  high: 'tasks:priority.high',
  medium: 'tasks:priority.medium',
  low: 'tasks:priority.low',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  low: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
};

export interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onStatusChange?: (newStatus: TaskStatus) => void;
  productName?: string;
  productColor?: string;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function taskCardPropsAreEqual(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prevTask = prevProps.task;
  const nextTask = nextProps.task;

  if (
    prevTask === nextTask &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onStatusChange === nextProps.onStatusChange &&
    prevProps.productName === nextProps.productName &&
    prevProps.productColor === nextProps.productColor &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.onToggleSelect === nextProps.onToggleSelect
  ) {
    return true;
  }

  if (
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.productName !== nextProps.productName ||
    prevProps.productColor !== nextProps.productColor
  ) {
    return false;
  }

  return (
    prevTask.id === nextTask.id &&
    prevTask.status === nextTask.status &&
    prevTask.title === nextTask.title &&
    prevTask.updatedAt === nextTask.updatedAt &&
    prevTask.priority === nextTask.priority &&
    prevTask.category === nextTask.category &&
    prevTask.labels?.length === nextTask.labels?.length &&
    prevTask.assignees?.length === nextTask.assignees?.length &&
    prevTask.githubSyncState?.kind === nextTask.githubSyncState?.kind
  );
}

export const TaskCard = memo(function TaskCard({
  task,
  onClick,
  onStatusChange,
  productName,
  productColor,
  isSelected,
  onToggleSelect,
}: TaskCardProps) {
  const { t } = useTranslation(['tasks', 'common']);

  const relativeTime = useMemo(
    () => formatRelativeTime(new Date(task.updatedAt)),
    [task.updatedAt]
  );

  const statusMenuItems = useMemo(() => {
    if (!onStatusChange) return null;
    return TASK_STATUS_COLUMNS.filter(status => status !== task.status).map((status) => (
      <DropdownMenuItem
        key={status}
        onClick={() => onStatusChange(status)}
      >
        {t(TASK_STATUS_LABELS[status])}
      </DropdownMenuItem>
    ));
  }, [task.status, onStatusChange, t]);

  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'in_progress':
        return 'info' as const;
      case 'ai_review':
        return 'warning' as const;
      case 'human_review':
        return 'purple' as const;
      case 'done':
        return 'success' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary/50 hover:shadow-md',
        isSelected && 'ring-2 ring-ring border-ring bg-accent/10'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Product indicator (for consolidated view) */}
          {productName && (
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: productColor || '#6b7280' }}
              />
              <span className="text-[10px] text-muted-foreground truncate">
                {productName}
              </span>
            </div>
          )}

          {/* Selection checkbox + Title */}
          <div className="flex gap-2">
            {onToggleSelect && (
              <div className="flex-shrink-0 pt-0.5">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onToggleSelect}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  aria-label={`Select task: ${task.title}`}
                />
              </div>
            )}
            <h3
              className="font-semibold text-sm text-foreground line-clamp-2 leading-snug flex-1"
              title={task.title}
            >
              {task.title}
            </h3>
          </div>

          {/* Category + Priority badges */}
          {(task.category || task.priority) && (
            <div className="flex flex-wrap gap-1">
              {task.category && (
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0', CATEGORY_COLORS[task.category])}
                >
                  {t(CATEGORY_I18N_KEYS[task.category])}
                </Badge>
              )}
              {task.priority && (
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0', PRIORITY_COLORS[task.priority])}
                >
                  {t(PRIORITY_I18N_KEYS[task.priority])}
                </Badge>
              )}
            </div>
          )}

          {/* GitHub labels */}
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <div
                  key={label.name}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={label.name}
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `#${label.color}` }}
                  />
                  <span className="truncate max-w-[80px]">{label.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Assignee avatars */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex items-center gap-1">
              {task.assignees.map((assignee) => (
                <div
                  key={assignee.login}
                  className="h-5 w-5 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
                  title={assignee.login}
                >
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
              ))}
            </div>
          )}

          {/* GitHub sync pending indicator */}
          {(task.githubSyncState?.kind === 'pending' || task.githubSyncState?.kind === 'retrying') && task.githubRepo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-[11px] text-amber-500">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>{t('tasks:sync.pendingTooltip')}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('tasks:sync.pendingToast')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Footer: relative time + status dropdown */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{relativeTime}</span>
            </div>

            <div className="flex items-center gap-1">
              <Badge
                variant={getStatusBadgeVariant(task.status)}
                className="text-[10px] px-1.5 py-0"
              >
                {t(TASK_STATUS_LABELS[task.status])}
              </Badge>

              {statusMenuItems && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t('tasks:actions.moveTo', { defaultValue: 'Move to' })}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuLabel>
                      {t('tasks:actions.moveTo', { defaultValue: 'Move to' })}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {statusMenuItems}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, taskCardPropsAreEqual);
