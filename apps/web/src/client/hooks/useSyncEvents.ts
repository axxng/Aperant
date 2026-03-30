import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventStream } from './useEventStream';
import { useToast } from './useToast';
import { useTaskStore } from '../stores/task-store';
import { useProductStore } from '../stores/product-store';

export function useSyncEvents() {
  const { t } = useTranslation(['common']);
  const { success, error, info } = useToast();
  const { loadTasks } = useTaskStore();
  const { activeProductId, loadProducts } = useProductStore();

  const handleEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case 'sync_complete':
        success(
          t('common:syncComplete'),
          data.productId ? t('common:syncCompleteDescription') : undefined
        );
        // Refresh tasks for the synced product
        if (activeProductId && data.productId === activeProductId) {
          loadTasks(activeProductId);
        }
        break;

      case 'sync_error':
        error(t('common:syncError'), data.error || t('common:syncErrorDescription'));
        break;

      case 'sync_started':
        info(t('common:syncStarted'));
        break;

      case 'task_created':
      case 'task_updated':
      case 'task_deleted':
        // Refresh task list on any task change
        if (activeProductId) {
          loadTasks(activeProductId);
        } else {
          loadTasks();
        }
        break;

      case 'product_updated':
        loadProducts();
        break;
    }
  }, [activeProductId, loadTasks, loadProducts, success, error, info, t]);

  useEventStream({ onEvent: handleEvent });
}
