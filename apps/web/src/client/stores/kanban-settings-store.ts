import { create } from 'zustand';
import type { TaskStatus } from '@shared/types/task';

interface KanbanColumnPreference {
  width: number;
  isCollapsed: boolean;
  isLocked: boolean;
}

type KanbanPreferences = Record<TaskStatus, KanbanColumnPreference>;

const DEFAULT_COLUMN_WIDTH = 280;

const DEFAULT_PREFERENCES: KanbanPreferences = {
  backlog: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: false, isLocked: false },
  queue: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: false, isLocked: false },
  in_progress: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: false, isLocked: false },
  ai_review: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: true, isLocked: false },
  human_review: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: false, isLocked: false },
  done: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: false, isLocked: false },
  pr_created: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: true, isLocked: false },
  error: { width: DEFAULT_COLUMN_WIDTH, isCollapsed: true, isLocked: false },
};

interface KanbanSettingsState {
  preferences: KanbanPreferences;
  currentScope: string | null;
  setColumnWidth: (status: TaskStatus, width: number) => void;
  toggleColumnCollapsed: (status: TaskStatus) => void;
  toggleColumnLocked: (status: TaskStatus) => void;
  loadPreferences: (scope: string) => void;
}

function getStorageKey(scope: string) {
  return `kanban-prefs-${scope}`;
}

export const useKanbanSettingsStore = create<KanbanSettingsState>((set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  currentScope: null,

  setColumnWidth: (status, width) => {
    set((state) => {
      const prefs = {
        ...state.preferences,
        [status]: { ...state.preferences[status], width: Math.max(180, Math.min(600, width)) },
      };
      return { preferences: prefs };
    });
  },

  toggleColumnCollapsed: (status) => {
    set((state) => {
      const prefs = {
        ...state.preferences,
        [status]: { ...state.preferences[status], isCollapsed: !state.preferences[status].isCollapsed },
      };
      return { preferences: prefs };
    });
  },

  toggleColumnLocked: (status) => {
    set((state) => {
      const prefs = {
        ...state.preferences,
        [status]: { ...state.preferences[status], isLocked: !state.preferences[status].isLocked },
      };
      return { preferences: prefs };
    });
  },

  loadPreferences: (scope) => {
    try {
      const stored = localStorage.getItem(getStorageKey(scope));
      if (stored) {
        set({ preferences: { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }, currentScope: scope });
      } else {
        set({ preferences: DEFAULT_PREFERENCES, currentScope: scope });
      }
    } catch {
      set({ preferences: DEFAULT_PREFERENCES, currentScope: scope });
    }
  },
}));

// Persist preferences on change
useKanbanSettingsStore.subscribe((state) => {
  if (state.currentScope) {
    try {
      localStorage.setItem(getStorageKey(state.currentScope), JSON.stringify(state.preferences));
    } catch {
      // localStorage may be unavailable
    }
  }
});
