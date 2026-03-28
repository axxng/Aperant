import { streamText, type LanguageModel, type CoreMessage, stepCountIs } from 'ai';
import type { SessionResult, StreamEventCallback } from './types.js';
import type { AgentType } from '../config/agent-configs.js';
import { getAgentConfig } from '../config/agent-configs.js';
import { createProvider, resolveModelId, buildThinkingProviderOptions } from '../providers/factory.js';
import { createBuiltinTools, getToolsForAgent, type ToolContext } from '../tools/index.js';

export interface SessionConfig {
  agentType: AgentType;
  /** Model ID or shorthand (opus, sonnet, haiku) */
  modelId?: string;
  /** API key override (falls back to env) */
  apiKey?: string;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Initial messages to send */
  messages: CoreMessage[];
  /** Working directory for file tools */
  cwd: string;
  /** Max agentic steps (overrides agent config default) */
  maxSteps?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

export interface RunnerOptions {
  /** Callback for streaming events */
  onEvent?: StreamEventCallback;
}

/**
 * Run an AI agent session using streamText.
 * Simplified from the desktop version — no memory injection, account switching, or auth refresh.
 */
export async function runAgentSession(
  config: SessionConfig,
  options: RunnerOptions = {},
): Promise<SessionResult> {
  const startTime = Date.now();
  const agentConfig = getAgentConfig(config.agentType);
  const modelId = resolveModelId(config.modelId ?? agentConfig.defaultModel);

  // Create provider + model
  const model = createProvider({
    modelId,
    apiKey: config.apiKey,
  });

  // Create tools scoped to the working directory
  const toolContext: ToolContext = {
    cwd: config.cwd,
    abortSignal: config.abortSignal,
  };
  const allTools = createBuiltinTools(toolContext);
  const tools = getToolsForAgent(allTools, agentConfig.tools);

  // Build provider options for thinking
  const providerOptions = buildThinkingProviderOptions(agentConfig.thinkingDefault);

  const maxSteps = config.maxSteps ?? agentConfig.maxSteps;
  let stepsExecuted = 0;
  let toolCallCount = 0;

  try {
    const result = streamText({
      model,
      system: config.systemPrompt,
      messages: config.messages,
      tools,
      maxSteps,
      providerOptions,
      abortSignal: config.abortSignal,
      onStepFinish: ({ toolCalls }) => {
        stepsExecuted++;
        toolCallCount += toolCalls?.length ?? 0;
        options.onEvent?.({
          type: 'step-finish',
          data: { step: stepsExecuted, toolCallCount },
        });
      },
    });

    // Consume the stream and emit events
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          options.onEvent?.({ type: 'text-delta', data: { text: part.textDelta } });
          break;
        case 'tool-call':
          options.onEvent?.({
            type: 'tool-call',
            data: { toolName: part.toolName, args: part.args },
          });
          break;
        case 'tool-result':
          options.onEvent?.({
            type: 'tool-result',
            data: { toolName: part.toolName, result: part.result },
          });
          break;
        case 'error':
          options.onEvent?.({ type: 'error', data: { error: String(part.error) } });
          break;
      }
    }

    const usage = await result.usage;
    options.onEvent?.({ type: 'done', data: { outcome: 'completed' } });

    return {
      outcome: 'completed',
      stepsExecuted,
      usage: {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      },
      durationMs: Date.now() - startTime,
      toolCallCount,
    };
  } catch (err: any) {
    const message = err.message ?? String(err);
    const isRateLimit = message.includes('429') || message.includes('rate');
    const isCancelled = err.name === 'AbortError';

    const outcome = isCancelled ? 'cancelled' : isRateLimit ? 'rate_limited' : 'error';
    options.onEvent?.({ type: 'error', data: { error: message } });
    options.onEvent?.({ type: 'done', data: { outcome } });

    return {
      outcome,
      stepsExecuted,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: { message, code: isRateLimit ? '429' : undefined },
      durationMs: Date.now() - startTime,
      toolCallCount,
    };
  }
}
