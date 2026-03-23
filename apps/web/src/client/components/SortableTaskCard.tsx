import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard, type TaskCardProps } from './TaskCard';
import { cn } from '../lib/utils';

export interface SortableTaskCardProps extends TaskCardProps {
  id: string;
}

function sortableTaskCardPropsAreEqual(
  prevProps: SortableTaskCardProps,
  nextProps: SortableTaskCardProps
): boolean {
  return (
    prevProps.id === nextProps.id &&
    prevProps.task === nextProps.task &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onStatusChange === nextProps.onStatusChange &&
    prevProps.productName === nextProps.productName &&
    prevProps.productColor === nextProps.productColor &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.onToggleSelect === nextProps.onToggleSelect
  );
}

export const SortableTaskCard = memo(function SortableTaskCard({
  id,
  task,
  onClick,
  onStatusChange,
  productName,
  productColor,
  isSelected,
  onToggleSelect,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id,
    disabled: task.status === 'in_progress',
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'touch-none transition-all duration-200',
        isDragging && 'opacity-40 scale-[0.98]',
        isOver && !isDragging && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-xl'
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        onClick={handleClick}
        onStatusChange={onStatusChange}
        productName={productName}
        productColor={productColor}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
}, sortableTaskCardPropsAreEqual);
