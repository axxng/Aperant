import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth-store';

type EventHandler = (data: any) => void;

interface UseEventStreamOptions {
  onEvent?: (event: string, data: any) => void;
  handlers?: Record<string, EventHandler>;
  enabled?: boolean;
}

export function useEventStream({ onEvent, handlers, enabled = true }: UseEventStreamOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;
  const token = useAuthStore((s) => s.token);

  const connect = useCallback(() => {
    if (!enabled || !token) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      reconnectAttempts.current = 0;
    };

    es.onerror = () => {
      es.close();
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
      reconnectAttempts.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    // Listen for specific event types
    const eventTypes = [
      'sync_complete', 'sync_error', 'sync_started',
      'task_created', 'task_updated', 'task_deleted', 'tasks_reordered',
      'product_updated',
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          onEvent?.(type, data);
          handlers?.[type]?.(data);
        } catch {
          // Ignore parse errors
        }
      });
    }
  }, [enabled, token, onEvent, handlers]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    close: () => eventSourceRef.current?.close(),
    reconnect: connect,
  };
}
