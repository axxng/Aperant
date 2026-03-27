import { create } from 'zustand';
import { api } from '../lib/api-client';
import type { GitHubIssue } from '@shared/types/github';

interface GitHubIssuesState {
  issues: GitHubIssue[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  selectedIssueNumber: number | null;
  filterState: 'open' | 'closed' | 'all';
  currentPage: number;
  hasMore: boolean;

  loadIssues: (owner: string, repo: string, state?: 'open' | 'closed' | 'all') => Promise<void>;
  loadMoreIssues: (owner: string, repo: string) => Promise<void>;
  setFilterState: (state: 'open' | 'closed' | 'all') => void;
  selectIssue: (issueNumber: number | null) => void;
  clearIssues: () => void;

  getSelectedIssue: () => GitHubIssue | null;
  getOpenIssuesCount: () => number;
}

export const useGitHubIssuesStore = create<GitHubIssuesState>((set, get) => ({
  issues: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  selectedIssueNumber: null,
  filterState: 'open',
  currentPage: 1,
  hasMore: false,

  loadIssues: async (owner, repo, state) => {
    const filterState = state || get().filterState;
    set({ isLoading: true, error: null, currentPage: 1 });
    try {
      const result = await api.github.getIssues(owner, repo, { state: filterState, page: '1' });
      set({
        issues: result.issues,
        hasMore: result.hasMore,
        isLoading: false,
        filterState,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  loadMoreIssues: async (owner, repo) => {
    const { currentPage, filterState, isLoadingMore } = get();
    if (isLoadingMore) return;
    const nextPage = currentPage + 1;
    set({ isLoadingMore: true });
    try {
      const result = await api.github.getIssues(owner, repo, {
        state: filterState,
        page: String(nextPage),
      });
      set((state) => {
        // Deduplicate by issue number
        const existingNumbers = new Set(state.issues.map((i) => i.number));
        const newIssues = result.issues.filter((i) => !existingNumbers.has(i.number));
        return {
          issues: [...state.issues, ...newIssues],
          hasMore: result.hasMore,
          currentPage: nextPage,
          isLoadingMore: false,
        };
      });
    } catch (error: any) {
      set({ isLoadingMore: false });
    }
  },

  setFilterState: (filterState) => set({ filterState }),

  selectIssue: (issueNumber) => set({ selectedIssueNumber: issueNumber }),

  clearIssues: () =>
    set({
      issues: [],
      selectedIssueNumber: null,
      currentPage: 1,
      hasMore: false,
      error: null,
    }),

  getSelectedIssue: () => {
    const { issues, selectedIssueNumber } = get();
    return issues.find((i) => i.number === selectedIssueNumber) || null;
  },

  getOpenIssuesCount: () => {
    return get().issues.filter((i) => i.state === 'open').length;
  },
}));
