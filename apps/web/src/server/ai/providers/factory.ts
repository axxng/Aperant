import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

export type ProviderType = 'anthropic'; // extensible later
export type ThinkingLevel = 'low' | 'medium' | 'high';
export type ModelShorthand = 'opus' | 'sonnet' | 'haiku';

export const MODEL_SHORTHANDS: Record<ModelShorthand, string> = {
  opus: 'claude-opus-4-20250514',
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-4-5-20251001',
};

export const THINKING_BUDGET_MAP: Record<ThinkingLevel, number> = {
  low: 1024,
  medium: 4096,
  high: 16384,
};

export interface CreateProviderOptions {
  modelId: string;
  apiKey?: string; // falls back to ANTHROPIC_API_KEY env var
  provider?: ProviderType;
}

// Cache instances
const providerCache = new Map<string, LanguageModel>();

export function resolveModelId(modelIdOrShorthand: string): string {
  return MODEL_SHORTHANDS[modelIdOrShorthand as ModelShorthand] ?? modelIdOrShorthand;
}

export function createProvider(options: CreateProviderOptions): LanguageModel {
  const modelId = resolveModelId(options.modelId);
  const provider = options.provider ?? 'anthropic';
  const cacheKey = `${provider}:${modelId}:${options.apiKey ?? 'env'}`;

  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  let model: LanguageModel;

  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      });
      model = anthropic(modelId);
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  providerCache.set(cacheKey, model);
  return model;
}

export function buildThinkingProviderOptions(
  thinkingLevel: ThinkingLevel,
): Record<string, Record<string, unknown>> {
  const budget = THINKING_BUDGET_MAP[thinkingLevel];
  return {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: budget },
    },
  };
}

export function clearProviderCache(): void {
  providerCache.clear();
}
