import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Idea, IdeationType, IdeaStatus, IdeationPhase, IdeationConfig } from '@shared/types/ideation';

interface IdeationState {
  // Session data
  ideas: Idea[];
  sessionId: string | null;
  config: IdeationConfig;

  // Generation state
  phase: IdeationPhase;
  progress: number;
  streamingText: string;
  error: string | null;

  // UI state
  activeType: IdeationType | 'all';
  selectedIdeaId: string | null;
  showDismissed: boolean;
  selectedIds: Set<string>;

  // Actions
  setSession: (sessionId: string, ideas: Idea[], config: IdeationConfig) => void;
  clearSession: () => void;
  setPhase: (phase: IdeationPhase) => void;
  setProgress: (progress: number) => void;
  appendStreamingText: (delta: string) => void;
  clearStreamingText: () => void;
  setError: (error: string | null) => void;

  // Idea manipulation
  updateIdeaStatus: (ideaId: string, status: IdeaStatus) => void;
  dismissIdea: (ideaId: string) => void;
  dismissAll: () => void;
  deleteIdea: (ideaId: string) => void;
  deleteSelected: () => void;
  setIdeaTaskId: (ideaId: string, taskId: string) => void;

  // UI actions
  setActiveType: (type: IdeationType | 'all') => void;
  setSelectedIdeaId: (id: string | null) => void;
  toggleShowDismissed: () => void;
  toggleSelectIdea: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  // Selectors (computed)
  getFilteredIdeas: () => Idea[];
  getSummary: () => { total: number; byType: Record<string, number>; byStatus: Record<string, number> };
}

const defaultConfig: IdeationConfig = {
  enabledTypes: ['code_improvements', 'security_hardening', 'performance_optimizations'],
  maxIdeasPerType: 5,
};

export const useIdeationStore = create<IdeationState>()(
  devtools(
    (set, get) => ({
      // Session data
      ideas: [],
      sessionId: null,
      config: { ...defaultConfig },

      // Generation state
      phase: 'idle',
      progress: 0,
      streamingText: '',
      error: null,

      // UI state
      activeType: 'all',
      selectedIdeaId: null,
      showDismissed: false,
      selectedIds: new Set<string>(),

      // Actions
      setSession: (sessionId, ideas, config) =>
        set({ sessionId, ideas, config, phase: 'idle', progress: 0, error: null, streamingText: '' }),

      clearSession: () =>
        set({
          sessionId: null,
          ideas: [],
          config: { ...defaultConfig },
          phase: 'idle',
          progress: 0,
          streamingText: '',
          error: null,
          selectedIdeaId: null,
          selectedIds: new Set<string>(),
        }),

      setPhase: (phase) => set({ phase }),
      setProgress: (progress) => set({ progress }),
      appendStreamingText: (delta) => set((s) => ({ streamingText: s.streamingText + delta })),
      clearStreamingText: () => set({ streamingText: '' }),
      setError: (error) => set({ error, phase: error ? 'error' : 'idle' }),

      // Idea manipulation
      updateIdeaStatus: (ideaId, status) =>
        set((s) => ({
          ideas: s.ideas.map((idea) => (idea.id === ideaId ? { ...idea, status } : idea)),
        })),

      dismissIdea: (ideaId) =>
        set((s) => ({
          ideas: s.ideas.map((idea) =>
            idea.id === ideaId ? { ...idea, status: 'dismissed' as IdeaStatus } : idea
          ),
        })),

      dismissAll: () =>
        set((s) => ({
          ideas: s.ideas.map((idea) =>
            idea.status !== 'dismissed' && idea.status !== 'converted' && idea.status !== 'archived'
              ? { ...idea, status: 'dismissed' as IdeaStatus }
              : idea
          ),
        })),

      deleteIdea: (ideaId) =>
        set((s) => {
          const newSelectedIds = new Set(s.selectedIds);
          newSelectedIds.delete(ideaId);
          return {
            ideas: s.ideas.filter((idea) => idea.id !== ideaId),
            selectedIds: newSelectedIds,
            selectedIdeaId: s.selectedIdeaId === ideaId ? null : s.selectedIdeaId,
          };
        }),

      deleteSelected: () =>
        set((s) => {
          const idsToDelete = s.selectedIds;
          return {
            ideas: s.ideas.filter((idea) => !idsToDelete.has(idea.id)),
            selectedIds: new Set<string>(),
            selectedIdeaId: s.selectedIdeaId && idsToDelete.has(s.selectedIdeaId) ? null : s.selectedIdeaId,
          };
        }),

      setIdeaTaskId: (ideaId, taskId) =>
        set((s) => ({
          ideas: s.ideas.map((idea) =>
            idea.id === ideaId ? { ...idea, taskId, status: 'converted' as IdeaStatus } : idea
          ),
        })),

      // UI actions
      setActiveType: (type) => set({ activeType: type }),
      setSelectedIdeaId: (id) => set({ selectedIdeaId: id }),
      toggleShowDismissed: () => set((s) => ({ showDismissed: !s.showDismissed })),

      toggleSelectIdea: (id) =>
        set((s) => {
          const newSelectedIds = new Set(s.selectedIds);
          if (newSelectedIds.has(id)) {
            newSelectedIds.delete(id);
          } else {
            newSelectedIds.add(id);
          }
          return { selectedIds: newSelectedIds };
        }),

      selectAll: (ids) => set({ selectedIds: new Set(ids) }),
      clearSelection: () => set({ selectedIds: new Set<string>() }),

      // Selectors (computed)
      getFilteredIdeas: () => {
        const { ideas, activeType, showDismissed } = get();
        return ideas.filter((idea) => {
          // Always filter out archived ideas
          if (idea.status === 'archived') return false;
          // Filter out dismissed unless showDismissed is true
          if (idea.status === 'dismissed' && !showDismissed) return false;
          // Filter by type unless 'all'
          if (activeType !== 'all' && idea.type !== activeType) return false;
          return true;
        });
      },

      getSummary: () => {
        const { ideas } = get();
        const byType: Record<string, number> = {};
        const byStatus: Record<string, number> = {};

        for (const idea of ideas) {
          byType[idea.type] = (byType[idea.type] || 0) + 1;
          byStatus[idea.status] = (byStatus[idea.status] || 0) + 1;
        }

        return { total: ideas.length, byType, byStatus };
      },
    }),
    { name: 'ideation-store' }
  )
);
