import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type IssueState = 'open' | 'closed';

export function useAllIssuesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  // client-side only — NOT serialized to URL (D-09)
  const [search, setSearch] = useState('');

  // Read state from URL (D-08: ?state=open|closed)
  const state = (searchParams.get('state') as IssueState) ?? 'open';

  const hasActiveFilters = state !== 'open' || search !== '';

  // ALWAYS use functional updater form to avoid clobbering unrelated params
  // (same pattern as useIssuesFilters.ts — see PATTERNS.md URL-Persisted Filter State)
  const setStateFilter = useCallback(
    (newState: IssueState) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('state', newState);
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
      return next;
    });
  }, [setSearchParams]);

  return {
    state,
    search,
    setSearch,
    setStateFilter,
    resetFilters,
    hasActiveFilters,
  };
}
