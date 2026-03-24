import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../stores/task-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Trash2 } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskCategory } from '@shared/types/task';

const STATUSES: TaskStatus[] = ['backlog', 'queue', 'in_progress', 'human_review', 'done'];
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const CATEGORIES: TaskCategory[] = [
  'feature', 'bug_fix', 'refactoring', 'documentation', 'security',
  'performance', 'ui_ux', 'infrastructure', 'testing',
];

interface TaskEditDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  productColor?: string;
}

export function TaskEditDialog({ task, open, onOpenChange, productName, productColor }: TaskEditDialogProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { updateTask, deleteTask } = useTaskStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority || '');
      setCategory(task.category || '');
      setShowDeleteConfirm(false);
    }
  }, [task]);

  const handleSubmit = async () => {
    if (!task || !title.trim()) return;

    setIsSubmitting(true);
    try {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority: priority || undefined,
        category: category || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    setIsSubmitting(true);
    try {
      await deleteTask(task.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete task:', error);
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{t('tasks:form.editTask')}</DialogTitle>
            {productName && (
              <Badge
                variant="outline"
                className="text-xs"
                style={productColor ? { borderColor: productColor, color: productColor } : undefined}
              >
                {productName}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.title')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tasks:form.titlePlaceholder')}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.description')}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tasks:form.descriptionPlaceholder')}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.status')}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t(`tasks:status.${s}`)}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.priority')}</Label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <Button
                  key={p}
                  variant={priority === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPriority(priority === p ? '' : p)}
                >
                  {t(`tasks:priority.${p}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.category')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  variant={category === c ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(category === c ? '' : c)}
                >
                  {t(`tasks:category.${c}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* GitHub info (read-only) */}
          {task.githubIssueNumber && task.githubRepo && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              {t('tasks:form.githubIssue')}: {task.githubRepo}#{task.githubIssueNumber}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">{t('tasks:form.confirmDelete')}</span>
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSubmitting}>
                  {t('common:confirm')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  {t('common:cancel')}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('common:delete')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? t('common:loading') : t('tasks:form.updateTask')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
