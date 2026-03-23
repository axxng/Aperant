import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../stores/task-store';
import { useProductStore } from '../stores/product-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { TaskPriority, TaskCategory } from '@shared/types/task';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProductId?: string;
}

export function CreateTaskDialog({ open, onOpenChange, defaultProductId }: CreateTaskDialogProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { createTask } = useTaskStore();
  const { products, activeProductId } = useProductStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState(defaultProductId || activeProductId || '');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [category, setCategory] = useState<TaskCategory | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('');
    setCategory('');
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    const targetProductId = productId || activeProductId;
    if (!title.trim() || !targetProductId) return;

    setIsSubmitting(true);
    try {
      await createTask({
        productId: targetProductId,
        title: title.trim(),
        description: description.trim(),
        priority: priority || undefined,
        category: category || undefined,
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showProductPicker = !activeProductId; // Show in consolidated view

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tasks:kanban.newTask')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Product picker (only in consolidated view) */}
          {showProductPicker && (
            <div className="space-y-1.5">
              <Label>{t('tasks:form.product')}</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">{t('tasks:form.selectProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.title')}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tasks:form.titlePlaceholder')}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.description')}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tasks:form.descriptionPlaceholder')}
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>{t('tasks:form.priority')}</Label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
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
              {(['feature', 'bug_fix', 'refactoring', 'documentation', 'security', 'performance'] as const).map((c) => (
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || (showProductPicker && !productId)}
          >
            {isSubmitting ? t('common:loading') : t('tasks:form.createTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
