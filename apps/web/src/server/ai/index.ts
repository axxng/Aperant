/**
 * AI module — provider factory, session runner, tools, and agent configs.
 * Entry point for all AI functionality in the web server.
 */

export { createProvider, resolveModelId, buildThinkingProviderOptions, clearProviderCache } from './providers/factory.js';
export type { ProviderType, ThinkingLevel, ModelShorthand, CreateProviderOptions } from './providers/factory.js';
export { MODEL_SHORTHANDS, THINKING_BUDGET_MAP } from './providers/factory.js';

export { runAgentSession } from './session/runner.js';
export type { SessionConfig, RunnerOptions } from './session/runner.js';
export type { SessionResult, SessionOutcome, StreamEvent, StreamEventCallback } from './session/types.js';

export { getAgentConfig, AGENT_CONFIGS, BASE_READ_TOOLS, WEB_TOOLS, ALL_READ_TOOLS } from './config/agent-configs.js';
export type { AgentType, AgentConfig } from './config/agent-configs.js';

export { createBuiltinTools, getToolsForAgent } from './tools/index.js';
export type { ToolContext } from './tools/index.js';
