import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useProductStore } from '../stores/product-store';
import { useTaskStore } from '../stores/task-store';
import { SortableTaskCard } from './SortableTaskCard';
import { TaskCard } from './TaskCard';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { Plus, RefreshCw, ChevronDown, ChevronRight, Search, SlidersHorizontal, GripVertical } from 'lucide-react';
import { useKanbanFilters } from '../hooks/useKanbanFilters';
import { KanbanFilterBar } from './KanbanFilterBar';
import { useToast } from '../hooks/useToast';
import type { Task, TaskStatus } from '@shared/types/task';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onNewTaskClick?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const COLUMNS: { status: TaskStatus; colorClass: string }[] = [
  { status: 'backlog', colorClass: 'border-t-muted-foreground/30' },
  { status: 'in_progress', colorClass: 'border-t-blue-500' },
  { status: 'human_review', colorClass: 'border-t-amber-500' },
  { status: 'done', colorClass: 'border-t-emerald-500' },
];

export const KanbanBoard = memo(function KanbanBoard({
  tasks,
  onTaskClick,
  onNewTaskClick,
  onRefresh,
  isRefreshing,
}: KanbanBoardProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { products, activeProductId } = useProductStore();
  const { updateTaskStatus, reorderTasks, taskOrder, loadTaskOrder } = useTaskStore();
  const { warning } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());
  const [viewMode, setViewMode] = useState<'sort' | 'priority'>('sort');

  const isConsolidated = activeProductId === null;

  const {
    searchQuery, setSearchQuery,
    priorities, togglePriority,
    categories, toggleCategory,
    sortBy, setSortBy,
    hasActiveFilters, resetFilters,
    filteredTasks,
  } = useKanbanFilters(tasks);

  useEffect(() => {
    if (viewMode === 'priority') {
      const scope = activeProductId || 'consolidated';
      loadTaskOrder(scope);
    }
  }, [viewMode, activeProductId, loadTaskOrder]);

  // Build product lookup map
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  // Group tasks by status — in priority mode, use persisted order
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      queue: [],
      in_progress: [],
      ai_review: [],
      human_review: [],
      done: [],
      pr_created: [],
      error: [],
    };
    const source = viewMode === 'sort' ? filteredTasks : tasks;
    for (const task of source) {
      const displayStatus = mapToDisplayStatus(task.status);
      grouped[displayStatus].push(task);
    }
    // In priority mode, apply persisted order
    if (viewMode === 'priority' && taskOrder) {
      for (const status of Object.keys(grouped) as TaskStatus[]) {
        const order = taskOrder[status];
        if (order?.length) {
          const orderMap = new Map(order.map((id, idx) => [id, idx]));
          grouped[status].sort((a, b) => {
            const aIdx = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
            const bIdx = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
            return aIdx - bIdx;
          });
        }
      }
    }
    return grouped;
  }, [filteredTasks, tasks, viewMode, taskOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => t.id === activeId) : null),
    [activeId, tasks]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const overData = over.data?.current;
      let targetStatus: TaskStatus | null = null;

      if (overData?.type === 'column') {
        targetStatus = overData.status as TaskStatus;
      } else if (overData?.sortable) {
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask) {
          targetStatus = mapToDisplayStatus(overTask.status);
        }
      }

      const currentStatus = mapToDisplayStatus(task.status);

      if (viewMode === 'priority' && targetStatus === currentStatus && overData?.sortable) {
        // Reorder within column
        const columnTasks = tasksByStatus[currentStatus];
        const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
        const newIndex = columnTasks.findIndex((t) => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = [...columnTasks];
          const [moved] = reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, moved);
          const scope = activeProductId || 'consolidated';
          await reorderTasks(scope, currentStatus, reordered.map((t) => t.id));
        }
      } else if (targetStatus && targetStatus !== currentStatus) {
        const updatedTask = await updateTaskStatus(taskId, targetStatus);
        if ((updatedTask as Task & { githubSyncStatus?: string }).githubSyncStatus === 'failed') {
          warning(t('tasks:sync.pendingToast'));
        }
      }
    },
    [tasks, tasksByStatus, updateTaskStatus, reorderTasks, viewMode, activeProductId]
  );

  const toggleColumn = useCallback((status: TaskStatus) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">
          {isConsolidated ? t('common:consolidatedBacklog') : t('common:board')}
        </h2>
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={viewMode === 'sort' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setViewMode('sort')}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
            {t('tasks:views.sort')}
          </Button>
          <Button
            variant={viewMode === 'priority' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setViewMode('priority')}
          >
            <GripVertical className="h-3.5 w-3.5 mr-1" />
            {t('tasks:views.priority')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          )}
          {onNewTaskClick && (
            <Button size="sm" onClick={onNewTaskClick}>
              <Plus className="h-4 w-4 mr-1" />
              {t('tasks:kanban.newTask')}
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar — only in sort mode */}
      {viewMode === 'sort' && (
        <KanbanFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          priorities={priorities}
          onTogglePriority={togglePriority}
          categories={categories}
          onToggleCategory={toggleCategory}
          sortBy={sortBy}
          onSortChange={setSortBy}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />
      )}

      {/* No results state — only in sort mode */}
      {viewMode === 'sort' && hasActiveFilters && filteredTasks.length === 0 && tasks.length > 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">{t('filters.noResults')}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={resetFilters}>
            {t('filters.reset')}
          </Button>
        </div>
      )}

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-3 p-4 overflow-x-auto">
          {COLUMNS.map(({ status, colorClass }) => {
            const columnTasks = tasksByStatus[status];
            const isCollapsed = collapsedColumns.has(status);

            return (
              <KanbanColumn
                key={status}
                status={status}
                tasks={columnTasks}
                colorClass={colorClass}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => toggleColumn(status)}
                onTaskClick={onTaskClick}
                productMap={isConsolidated ? productMap : null}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              onClick={() => {}}
              productName={isConsolidated ? productMap.get(activeTask.productId)?.name : undefined}
              productColor={isConsolidated ? productMap.get(activeTask.productId)?.color : undefined}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});

/** Map agent-specific statuses to visible board columns */
function mapToDisplayStatus(status: TaskStatus): TaskStatus {
  switch (status) {
    case 'queue':
      return 'backlog';
    case 'ai_review':
      return 'human_review';
    case 'pr_created':
      return 'done';
    case 'error':
      return 'human_review';
    default:
      return status;
  }
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  colorClass: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTaskClick: (task: Task) => void;
  productMap: Map<string, { name: string; color: string }> | null;
}

const KanbanColumn = memo(function KanbanColumn({
  status,
  tasks,
  colorClass,
  isCollapsed,
  onToggleCollapse,
  onTaskClick,
  productMap,
}: KanbanColumnProps) {
  const { t } = useTranslation('tasks');
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      className={cn(
        'flex flex-col bg-card rounded-lg border border-border border-t-2 transition-all',
        colorClass,
        isCollapsed ? 'w-10' : 'w-72 min-w-[288px]'
      )}
      data-type="column"
      data-status={status}
    >
      {/* Column header */}
      <button
        className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/30 transition-colors rounded-t-lg"
        onClick={onToggleCollapse}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">{t(`status.${status}`)}</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {tasks.length}
            </Badge>
          </>
        )}
        {isCollapsed && (
          <Badge variant="secondary" className="text-xs px-1 py-0">
            {tasks.length}
          </Badge>
        )}
      </button>

      {/* Column content */}
      {!isCollapsed && (
        <ScrollArea className="flex-1 px-2 pb-2">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {t(`kanban.empty${status.charAt(0).toUpperCase() + status.slice(1).replace('_', '')}`, { defaultValue: 'No tasks' })}
                </div>
              ) : (
                tasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    id={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    productName={productMap?.get(task.productId)?.name}
                    productColor={productMap?.get(task.productId)?.color}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      )}
    </div>
  );
});
