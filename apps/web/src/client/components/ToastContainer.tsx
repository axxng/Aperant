import { memo } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useToastStore, type ToastType } from '../hooks/useToast';

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-500',
  error: 'border-red-500/30 bg-red-500/10 text-red-500',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
};

const TOAST_ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export const ToastContainer = memo(function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5',
              TOAST_STYLES[toast.type]
            )}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && (
                <p className="text-xs mt-0.5 opacity-80">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
});
