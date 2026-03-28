import { tool } from 'ai';
import { z } from 'zod';

/**
 * Web search tool - placeholder that can be connected to a search API.
 * For now, returns a message indicating search is not configured.
 * Can be wired to Tavily, Serper, or similar APIs later.
 */
export function createWebSearchTool() {
  return tool({
    description: 'Search the web for information. Returns search results.',
    parameters: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => {
      // TODO: Connect to a search API (Tavily, Serper, etc.)
      return `Web search is not yet configured. Query was: "${query}". Configure a search API key in settings to enable this tool.`;
    },
  });
}
