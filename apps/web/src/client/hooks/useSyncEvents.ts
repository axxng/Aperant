import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventPolling } from './useEventPolling';
import { useToast } from './useToast';
import { useTaskStore } from '../stores/task-store';
import { useProductStore } from '../stores/product-store';

export function useSyncEvents() {
  const { t } = useTranslation(['common']);
  const { success, error, info } = useToast();
  const { loadTasks } = useTaskStore();
  const { activeProductId, loadProducts } = useProductStore();

  const handlers = useMemo(() => ({
    sync_complete: (data: any) => {
      success(
        t('common:syncComplete'),
        data.productId ? t('common:syncCompleteDescription') : undefined
      );
      if (activeProductId && data.productId === activeProductId) {
        loadTasks(activeProductId);
      }
    },
    sync_error: (data: any) => {
      error(t('common:syncError'), data.error || t('common:syncErrorDescription'));
    },
    sync_started: () => {
      info(t('common:syncStarted'));
    },
    task_created: () => {
      if (activeProductId) { loadTasks(activeProductId); } else { loadTasks(); }
    },
    task_updated: () => {
      if (activeProductId) { loadTasks(activeProductId); } else { loadTasks(); }
    },
    task_deleted: () => {
      if (activeProductId) { loadTasks(activeProductId); } else { loadTasks(); }
    },
    tasks_reordered: () => {
      if (activeProductId) { loadTasks(activeProductId); } else { loadTasks(); }
    },
    product_updated: () => {
      loadProducts();
    },
  }), [activeProductId, loadTasks, loadProducts, success, error, info, t]);

  useEventPolling({ handlers });
}
