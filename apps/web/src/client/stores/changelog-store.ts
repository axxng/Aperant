import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChangelogFormat, ChangelogAudience, ChangelogSourceMode, ChangelogPhase } from '@shared/types/changelog';

interface ChangelogEntry {
  id: string;
  content: string;
  config: {
    sourceMode: ChangelogSourceMode;
    version: string;
    date: string;
    format: ChangelogFormat;
    audience: ChangelogAudience;
  };
  createdAt: string;
  updatedAt: string;
}

interface ChangelogState {
  // Entries
  entries: ChangelogEntry[];
  selectedEntryId: string | null;

  // Generation config
  sourceMode: ChangelogSourceMode;
  version: string;
  date: string;
  format: ChangelogFormat;
  audience: ChangelogAudience;
  customInstructions: string;

  // Generation state
  phase: ChangelogPhase;
  progress: number;
  streamingText: string;
  generatedContent: string;
  error: string | null;

  // View state
  previewMode: 'edit' | 'preview';

  // Actions - entries
  setEntries: (entries: ChangelogEntry[]) => void;
  addEntry: (entry: ChangelogEntry) => void;
  removeEntry: (id: string) => void;
  setSelectedEntryId: (id: string | null) => void;

  // Actions - config
  setSourceMode: (mode: ChangelogSourceMode) => void;
  setVersion: (version: string) => void;
  setDate: (date: string) => void;
  setFormat: (format: ChangelogFormat) => void;
  setAudience: (audience: ChangelogAudience) => void;
  setCustomInstructions: (instructions: string) => void;

  // Actions - generation
  setPhase: (phase: ChangelogPhase) => void;
  setProgress: (progress: number) => void;
  appendStreamingText: (delta: string) => void;
  clearStreamingText: () => void;
  setGeneratedContent: (content: string) => void;
  setError: (error: string | null) => void;

  // Actions - view
  setPreviewMode: (mode: 'edit' | 'preview') => void;

  // Reset
  resetGeneration: () => void;
}

export const useChangelogStore = create<ChangelogState>()(
  devtools(
    (set) => ({
      // Initial state
      entries: [],
      selectedEntryId: null,
      sourceMode: 'tasks',
      version: '1.0.0',
      date: new Date().toISOString().split('T')[0],
      format: 'keep-a-changelog',
      audience: 'user-facing',
      customInstructions: '',
      phase: 'idle',
      progress: 0,
      streamingText: '',
      generatedContent: '',
      error: null,
      previewMode: 'preview',

      // Entry actions
      setEntries: (entries) => set({ entries }),
      addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter(e => e.id !== id) })),
      setSelectedEntryId: (selectedEntryId) => set({ selectedEntryId }),

      // Config actions
      setSourceMode: (sourceMode) => set({ sourceMode }),
      setVersion: (version) => set({ version }),
      setDate: (date) => set({ date }),
      setFormat: (format) => set({ format }),
      setAudience: (audience) => set({ audience }),
      setCustomInstructions: (customInstructions) => set({ customInstructions }),

      // Generation actions
      setPhase: (phase) => set({ phase }),
      setProgress: (progress) => set({ progress }),
      appendStreamingText: (delta) => set((s) => ({ streamingText: s.streamingText + delta })),
      clearStreamingText: () => set({ streamingText: '' }),
      setGeneratedContent: (generatedContent) => set({ generatedContent }),
      setError: (error) => set({ error }),

      // View actions
      setPreviewMode: (previewMode) => set({ previewMode }),

      // Reset
      resetGeneration: () => set({
        phase: 'idle',
        progress: 0,
        streamingText: '',
        generatedContent: '',
        error: null,
      }),
    }),
    { name: 'changelog-store' }
  )
);
