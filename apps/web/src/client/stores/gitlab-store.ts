import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GitLabIssue, GitLabMergeRequest } from '@shared/types/gitlab';

interface GitLabState {
  // Connection
  connected: boolean;
  connectionError: string | null;

  // Issues
  issues: GitLabIssue[];
  issuesTotal: number;
  issuesPage: number;
  issuesState: 'opened' | 'closed' | 'all';
  issuesSearch: string;
  issuesLoading: boolean;
  selectedIssueIid: number | null;

  // Merge Requests
  mergeRequests: GitLabMergeRequest[];
  mrsTotal: number;
  mrsPage: number;
  mrsState: 'opened' | 'closed' | 'merged' | 'all';
  mrsSearch: string;
  mrsLoading: boolean;
  selectedMrIid: number | null;

  // Actions - connection
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;

  // Actions - issues
  setIssues: (issues: GitLabIssue[], total: number) => void;
  appendIssues: (issues: GitLabIssue[], total: number) => void;
  setIssuesPage: (page: number) => void;
  setIssuesState: (state: 'opened' | 'closed' | 'all') => void;
  setIssuesSearch: (search: string) => void;
  setIssuesLoading: (loading: boolean) => void;
  setSelectedIssueIid: (iid: number | null) => void;

  // Actions - MRs
  setMergeRequests: (mrs: GitLabMergeRequest[], total: number) => void;
  appendMergeRequests: (mrs: GitLabMergeRequest[], total: number) => void;
  setMrsPage: (page: number) => void;
  setMrsState: (state: 'opened' | 'closed' | 'merged' | 'all') => void;
  setMrsSearch: (search: string) => void;
  setMrsLoading: (loading: boolean) => void;
  setSelectedMrIid: (iid: number | null) => void;

  // Reset
  resetIssues: () => void;
  resetMrs: () => void;
}

export const useGitLabStore = create<GitLabState>()(
  devtools(
    (set) => ({
      connected: false,
      connectionError: null,

      issues: [],
      issuesTotal: 0,
      issuesPage: 1,
      issuesState: 'opened',
      issuesSearch: '',
      issuesLoading: false,
      selectedIssueIid: null,

      mergeRequests: [],
      mrsTotal: 0,
      mrsPage: 1,
      mrsState: 'opened',
      mrsSearch: '',
      mrsLoading: false,
      selectedMrIid: null,

      setConnected: (connected) => set({ connected }),
      setConnectionError: (connectionError) => set({ connectionError }),

      setIssues: (issues, issuesTotal) => set({ issues, issuesTotal }),
      appendIssues: (issues, issuesTotal) => set((s) => ({ issues: [...s.issues, ...issues], issuesTotal })),
      setIssuesPage: (issuesPage) => set({ issuesPage }),
      setIssuesState: (issuesState) => set({ issuesState, issuesPage: 1, issues: [], selectedIssueIid: null }),
      setIssuesSearch: (issuesSearch) => set({ issuesSearch, issuesPage: 1, issues: [], selectedIssueIid: null }),
      setIssuesLoading: (issuesLoading) => set({ issuesLoading }),
      setSelectedIssueIid: (selectedIssueIid) => set({ selectedIssueIid }),

      setMergeRequests: (mergeRequests, mrsTotal) => set({ mergeRequests, mrsTotal }),
      appendMergeRequests: (mrs, mrsTotal) => set((s) => ({ mergeRequests: [...s.mergeRequests, ...mrs], mrsTotal })),
      setMrsPage: (mrsPage) => set({ mrsPage }),
      setMrsState: (mrsState) => set({ mrsState, mrsPage: 1, mergeRequests: [], selectedMrIid: null }),
      setMrsSearch: (mrsSearch) => set({ mrsSearch, mrsPage: 1, mergeRequests: [], selectedMrIid: null }),
      setMrsLoading: (mrsLoading) => set({ mrsLoading }),
      setSelectedMrIid: (selectedMrIid) => set({ selectedMrIid }),

      resetIssues: () => set({ issues: [], issuesTotal: 0, issuesPage: 1, selectedIssueIid: null }),
      resetMrs: () => set({ mergeRequests: [], mrsTotal: 0, mrsPage: 1, selectedMrIid: null }),
    }),
    { name: 'gitlab-store' }
  )
);
