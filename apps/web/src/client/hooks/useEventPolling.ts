import { useEffect, useRef, useCallback } from 'react';
import { authenticatedFetch } from '../lib/api-client';

type EventHandler = (data: any) => void;

interface UseEventPollingOptions {
  handlers?: Record<string, EventHandler>;
  enabled?: boolean;
  intervalMs?: number;
}

export function useEventPolling({ handlers, enabled = true, intervalMs = 3000 }: UseEventPollingOptions = {}) {
  const sinceRef = useRef(new Date().toISOString());
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const poll = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`/events/poll?since=${encodeURIComponent(sinceRef.current)}`);
      if (!res.ok) return;
      const { events } = await res.json();
      if (events && events.length > 0) {
        for (const event of events) {
          const handler = handlersRef.current?.[event.type];
          if (handler) handler(event.data);
        }
        // Update since to the latest event's createdAt
        sinceRef.current = events[events.length - 1].createdAt;
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(poll, intervalMs);
    // Do an immediate poll on mount
    poll();
    return () => clearInterval(id);
  }, [enabled, intervalMs, poll]);
}
