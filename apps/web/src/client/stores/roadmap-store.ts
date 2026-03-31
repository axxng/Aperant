import { create } from 'zustand';
import { authenticatedFetch } from '../lib/api-client';
import type { Roadmap, RoadmapFeature, RoadmapPhase, FeatureStatus } from '@shared/types/roadmap';

export type GenerationPhase = 'idle' | 'analyzing' | 'generating' | 'complete' | 'error';

export interface GenerationStatus {
  phase: GenerationPhase;
  progress: number;
  message: string;
  error?: string;
}

type ViewMode = 'phases' | 'features' | 'priority';

interface RoadmapState {
  roadmap: Roadmap | null;
  isLoading: boolean;
  generationStatus: GenerationStatus;
  streamingText: string;
  viewMode: ViewMode;
  selectedFeatureId: string | null;

  loadRoadmap: (productId: string) => Promise<void>;
  setRoadmap: (roadmap: Roadmap) => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  appendStreamingText: (text: string) => void;
  setViewMode: (mode: ViewMode) => void;
  selectFeature: (id: string | null) => void;
  updateFeatureStatus: (featureId: string, status: FeatureStatus) => void;
  deleteFeature: (featureId: string) => void;
  saveRoadmap: () => Promise<void>;
  reset: () => void;
}

const initialGeneration: GenerationStatus = { phase: 'idle', progress: 0, message: '' };

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  roadmap: null,
  isLoading: false,
  generationStatus: initialGeneration,
  streamingText: '',
  viewMode: 'phases',
  selectedFeatureId: null,

  loadRoadmap: async (productId: string) => {
    set({ isLoading: true });
    try {
      const res = await authenticatedFetch(`/roadmap/${productId}`);
      const data = await res.json();
      set({ roadmap: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setRoadmap: (roadmap) => set({ roadmap }),
  setGenerationStatus: (status) => set({ generationStatus: status }),
  appendStreamingText: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectFeature: (id) => set({ selectedFeatureId: id }),

  updateFeatureStatus: (featureId, status) => {
    set((s) => {
      if (!s.roadmap) return s;
      const features = s.roadmap.features.map(f =>
        f.id === featureId ? { ...f, status } : f
      );
      return { roadmap: { ...s.roadmap, features } };
    });
  },

  deleteFeature: (featureId) => {
    set((s) => {
      if (!s.roadmap) return s;
      const features = s.roadmap.features.filter(f => f.id !== featureId);
      const phases = s.roadmap.phases.map(p => ({
        ...p,
        featureIds: p.featureIds.filter(id => id !== featureId),
      }));
      return {
        roadmap: { ...s.roadmap, features, phases },
        selectedFeatureId: s.selectedFeatureId === featureId ? null : s.selectedFeatureId,
      };
    });
  },

  saveRoadmap: async () => {
    const { roadmap } = get();
    if (!roadmap) return;
    await authenticatedFetch(`/roadmap/${roadmap.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        vision: roadmap.vision,
        targetAudience: roadmap.targetAudience,
        phases: roadmap.phases,
        features: roadmap.features,
      }),
    });
  },

  reset: () => set({ generationStatus: initialGeneration, streamingText: '', selectedFeatureId: null }),
}));
