export type SessionOutcome =
  | 'completed'
  | 'error'
  | 'rate_limited'
  | 'cancelled'
  | 'max_steps';

export interface SessionResult {
  outcome: SessionOutcome;
  stepsExecuted: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: { message: string; code?: string };
  durationMs: number;
  toolCallCount: number;
}

export interface StreamEvent {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'step-finish' | 'error' | 'done';
  data: unknown;
}

export type StreamEventCallback = (event: StreamEvent) => void;
