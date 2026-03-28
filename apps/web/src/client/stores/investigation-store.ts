import { create } from 'zustand';

export type InvestigationPhase = 'idle' | 'analyzing' | 'complete' | 'error';

export interface InvestigationStatus {
  phase: InvestigationPhase;
  progress: number;
  message: string;
  error?: string;
}

export interface InvestigationResult {
  success: boolean;
  issueNumber: number;
  analysis: string;
  outcome: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  durationMs?: number;
}

interface InvestigationState {
  status: InvestigationStatus;
  result: InvestigationResult | null;
  streamedText: string;
  isInvestigating: boolean;

  setStatus: (status: InvestigationStatus) => void;
  setResult: (result: InvestigationResult | null) => void;
  appendText: (text: string) => void;
  startInvestigation: () => void;
  reset: () => void;
}

const initialStatus: InvestigationStatus = {
  phase: 'idle',
  progress: 0,
  message: '',
};

export const useInvestigationStore = create<InvestigationState>((set) => ({
  status: initialStatus,
  result: null,
  streamedText: '',
  isInvestigating: false,

  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result, isInvestigating: false }),
  appendText: (text) => set((state) => ({ streamedText: state.streamedText + text })),
  startInvestigation: () =>
    set({
      status: { phase: 'analyzing', progress: 0, message: 'Starting...' },
      result: null,
      streamedText: '',
      isInvestigating: true,
    }),
  reset: () =>
    set({ status: initialStatus, result: null, streamedText: '', isInvestigating: false }),
}));
