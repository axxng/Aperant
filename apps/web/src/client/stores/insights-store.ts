import { create } from 'zustand';

export interface InsightsSessionSummary {
  id: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: Array<{ name: string; input?: string }>;
}

export interface InsightsSession {
  id: string;
  title: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type InsightsPhase = 'idle' | 'thinking' | 'streaming' | 'complete' | 'error';

interface InsightsState {
  sessions: InsightsSessionSummary[];
  currentSession: InsightsSession | null;
  isLoadingSessions: boolean;
  isLoadingSession: boolean;
  phase: InsightsPhase;
  streamingText: string;
  currentTool: { name: string; input?: string } | null;
  error: string | null;

  loadSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<InsightsSession>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  setPhase: (phase: InsightsPhase) => void;
  appendStreamingText: (text: string) => void;
  setCurrentTool: (tool: { name: string; input?: string } | null) => void;
  finalizeMessage: (message: ChatMessage) => void;
  addUserMessage: (content: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const API_BASE = '/api/insights';

export const useInsightsStore = create<InsightsState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoadingSessions: false,
  isLoadingSession: false,
  phase: 'idle',
  streamingText: '',
  currentTool: null,
  error: null,

  loadSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const res = await fetch(API_BASE);
      const sessions = await res.json();
      set({ sessions, isLoadingSessions: false });
    } catch {
      set({ isLoadingSessions: false });
    }
  },

  createSession: async (title?: string) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const session = await res.json();
    const fullSession: InsightsSession = { ...session, messages: [] };
    set((s) => ({
      sessions: [{ id: session.id, title: session.title, messageCount: 0, createdAt: session.createdAt, updatedAt: session.updatedAt }, ...s.sessions],
      currentSession: fullSession,
      phase: 'idle',
      streamingText: '',
      error: null,
    }));
    return fullSession;
  },

  selectSession: async (id: string) => {
    set({ isLoadingSession: true, phase: 'idle', streamingText: '', currentTool: null, error: null });
    try {
      const res = await fetch(`${API_BASE}/${id}`);
      const session = await res.json();
      set({ currentSession: session, isLoadingSession: false });
    } catch {
      set({ isLoadingSession: false });
    }
  },

  deleteSession: async (id: string) => {
    await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    set((s) => ({
      sessions: s.sessions.filter(sess => sess.id !== id),
      currentSession: s.currentSession?.id === id ? null : s.currentSession,
    }));
  },

  renameSession: async (id: string, title: string) => {
    await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    set((s) => ({
      sessions: s.sessions.map(sess => sess.id === id ? { ...sess, title } : sess),
      currentSession: s.currentSession?.id === id ? { ...s.currentSession, title } : s.currentSession,
    }));
  },

  setPhase: (phase) => set({ phase }),
  appendStreamingText: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  setCurrentTool: (tool) => set({ currentTool: tool }),

  addUserMessage: (content: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      currentSession: s.currentSession
        ? { ...s.currentSession, messages: [...s.currentSession.messages, msg] }
        : s.currentSession,
    }));
  },

  finalizeMessage: (message: ChatMessage) => {
    set((s) => ({
      currentSession: s.currentSession
        ? { ...s.currentSession, messages: [...s.currentSession.messages, message] }
        : s.currentSession,
      streamingText: '',
      currentTool: null,
      phase: 'complete',
      sessions: s.sessions.map(sess =>
        sess.id === s.currentSession?.id
          ? { ...sess, messageCount: sess.messageCount + 2, updatedAt: new Date().toISOString() }
          : sess
      ),
    }));
  },

  setError: (error) => set({ error, phase: error ? 'error' : 'idle' }),
  reset: () => set({ phase: 'idle', streamingText: '', currentTool: null, error: null }),
}));
