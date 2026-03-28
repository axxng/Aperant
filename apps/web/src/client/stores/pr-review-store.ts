import { create } from 'zustand';
import { api } from '../lib/api-client';
import type { GitHubPR, PRFile } from '@shared/types/pr';

export type PRReviewPhase = 'idle' | 'fetching' | 'analyzing' | 'complete' | 'error';

export interface PRReviewStatus {
  phase: PRReviewPhase;
  progress: number;
  message: string;
  error?: string;
}

interface PRReviewState {
  // PR list
  pullRequests: GitHubPR[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  filterState: 'open' | 'closed' | 'all';
  error: string | null;

  // Selected PR
  selectedPRNumber: number | null;
  selectedPR: GitHubPR | null;
  prFiles: PRFile[];
  isLoadingFiles: boolean;

  // Review state
  reviewStatus: PRReviewStatus;
  reviewText: string;
  isReviewing: boolean;

  // Actions
  loadPullRequests: (owner: string, repo: string, state?: string) => Promise<void>;
  loadMorePullRequests: (owner: string, repo: string) => Promise<void>;
  setFilterState: (state: 'open' | 'closed' | 'all') => void;
  selectPR: (prNumber: number | null) => void;
  loadPRFiles: (owner: string, repo: string, prNumber: number) => Promise<void>;
  setReviewStatus: (status: PRReviewStatus) => void;
  appendReviewText: (text: string) => void;
  startReview: () => void;
  resetReview: () => void;
  clearPRs: () => void;
}

const initialReviewStatus: PRReviewStatus = {
  phase: 'idle',
  progress: 0,
  message: '',
};

export const usePRReviewStore = create<PRReviewState>((set, get) => ({
  pullRequests: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  currentPage: 1,
  filterState: 'open',
  error: null,
  selectedPRNumber: null,
  selectedPR: null,
  prFiles: [],
  isLoadingFiles: false,
  reviewStatus: initialReviewStatus,
  reviewText: '',
  isReviewing: false,

  loadPullRequests: async (owner, repo, state) => {
    set({ isLoading: true, error: null, currentPage: 1 });
    try {
      const filterState = state ?? get().filterState;
      const result = await api.github.getPullRequests(owner, repo, { state: filterState, page: '1' });
      set({ pullRequests: result.pullRequests, hasMore: result.hasMore, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadMorePullRequests: async (owner, repo) => {
    const { currentPage, isLoadingMore, filterState } = get();
    if (isLoadingMore) return;
    const nextPage = currentPage + 1;
    set({ isLoadingMore: true });
    try {
      const result = await api.github.getPullRequests(owner, repo, { state: filterState, page: String(nextPage) });
      set((s) => ({
        pullRequests: [...s.pullRequests, ...result.pullRequests],
        hasMore: result.hasMore,
        currentPage: nextPage,
        isLoadingMore: false,
      }));
    } catch {
      set({ isLoadingMore: false });
    }
  },

  setFilterState: (state) => set({ filterState: state }),

  selectPR: (prNumber) => {
    const pr = prNumber ? get().pullRequests.find(p => p.number === prNumber) ?? null : null;
    set({ selectedPRNumber: prNumber, selectedPR: pr, prFiles: [], reviewStatus: initialReviewStatus, reviewText: '', isReviewing: false });
  },

  loadPRFiles: async (owner, repo, prNumber) => {
    set({ isLoadingFiles: true });
    try {
      const files = await api.github.getPullRequestFiles(owner, repo, prNumber);
      set({ prFiles: files, isLoadingFiles: false });
    } catch {
      set({ isLoadingFiles: false });
    }
  },

  setReviewStatus: (status) => set({ reviewStatus: status }),
  appendReviewText: (text) => set((s) => ({ reviewText: s.reviewText + text })),
  startReview: () => set({ reviewStatus: { phase: 'analyzing', progress: 0, message: 'Starting review...' }, reviewText: '', isReviewing: true }),
  resetReview: () => set({ reviewStatus: initialReviewStatus, reviewText: '', isReviewing: false }),
  clearPRs: () => set({ pullRequests: [], selectedPRNumber: null, selectedPR: null, prFiles: [], error: null }),
}));
