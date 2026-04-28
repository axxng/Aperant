import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type IssueState = 'open' | 'closed';

export interface IssuesFilters {
  state: IssueState;
  labels: string[];
  assignee: string;
}

export function useIssuesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  // client-side only — NOT serialized to URL (per D-10)
  const [search, setSearch] = useState('');

  // Read filter state from URL (per D-03)
  const state = (searchParams.get('state') as IssueState) ?? 'open';
  const labels = searchParams.getAll('label'); // multi-value: ?label=bug&label=feature
  const assignee = searchParams.get('assignee') ?? '';

  const hasActiveFilters =
    state !== 'open' || labels.length > 0 || assignee !== '' || search !== '';

  // ALWAYS use functional updater form to avoid clobbering unrelated params (Pitfall 5)
  const setFilters = useCallback(
    (updates: Partial<IssuesFilters>) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (updates.state !== undefined) next.set('state', updates.state);
        if (updates.labels !== undefined) {
          next.delete('label');
          updates.labels.forEach(l => next.append('label', l));
        }
        if (updates.assignee !== undefined) {
          if (updates.assignee) next.set('assignee', updates.assignee);
          else next.delete('assignee');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('state');
      next.delete('label');
      next.delete('assignee');
      return next;
    });
  }, [setSearchParams]);

  return {
    state,
    labels,
    assignee,
    search,
    setSearch,
    setFilters,
    resetFilters,
    hasActiveFilters,
  };
}
