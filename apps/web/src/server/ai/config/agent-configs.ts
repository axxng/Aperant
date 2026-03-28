import type { ThinkingLevel } from '../providers/factory.js';

/**
 * Agent types available in the web app.
 * Subset of the desktop app's 25+ agent types, focused on web-relevant features.
 */
export type AgentType =
  | 'insights'        // Codebase analysis and Q&A
  | 'reviewer'        // PR review agent
  | 'investigator'    // Issue investigation
  | 'roadmap'         // Roadmap generation
  | 'ideation'        // Discover improvements and issues
  | 'changelog'       // Generate release notes
  | 'analyzer';       // General-purpose analysis

export interface AgentConfig {
  /** Tool names this agent is allowed to use */
  tools: readonly string[];
  /** Default thinking level */
  thinkingDefault: ThinkingLevel;
  /** Default model shorthand */
  defaultModel: string;
  /** Maximum agentic steps */
  maxSteps: number;
  /** Description shown in UI */
  description: string;
}

// Tool groupings
export const BASE_READ_TOOLS = ['Read', 'Glob', 'Grep'] as const;
export const WEB_TOOLS = ['WebFetch', 'WebSearch'] as const;
export const ALL_READ_TOOLS = [...BASE_READ_TOOLS, ...WEB_TOOLS] as const;

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  insights: {
    tools: ALL_READ_TOOLS,
    thinkingDefault: 'medium',
    defaultModel: 'sonnet',
    maxSteps: 30,
    description: 'Explore and understand your codebase',
  },
  reviewer: {
    tools: [...BASE_READ_TOOLS, 'WebFetch'],
    thinkingDefault: 'high',
    defaultModel: 'sonnet',
    maxSteps: 50,
    description: 'Review pull requests for quality and correctness',
  },
  investigator: {
    tools: ALL_READ_TOOLS,
    thinkingDefault: 'medium',
    defaultModel: 'sonnet',
    maxSteps: 40,
    description: 'Investigate GitHub issues and suggest solutions',
  },
  roadmap: {
    tools: ALL_READ_TOOLS,
    thinkingDefault: 'high',
    defaultModel: 'sonnet',
    maxSteps: 20,
    description: 'Generate strategic roadmaps from codebase analysis',
  },
  ideation: {
    tools: ALL_READ_TOOLS,
    thinkingDefault: 'medium',
    defaultModel: 'sonnet',
    maxSteps: 30,
    description: 'Discover improvements, issues, and opportunities',
  },
  changelog: {
    tools: [...BASE_READ_TOOLS],
    thinkingDefault: 'low',
    defaultModel: 'haiku',
    maxSteps: 10,
    description: 'Generate release notes from completed work',
  },
  analyzer: {
    tools: ALL_READ_TOOLS,
    thinkingDefault: 'medium',
    defaultModel: 'sonnet',
    maxSteps: 25,
    description: 'General-purpose code analysis',
  },
} as const;

/** Get the config for a given agent type */
export function getAgentConfig(agentType: AgentType): AgentConfig {
  const config = AGENT_CONFIGS[agentType];
  if (!config) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }
  return config;
}
