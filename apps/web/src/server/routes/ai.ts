import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { runAgentSession } from '../ai/session/runner.js';
import { AGENT_CONFIGS } from '../ai/config/agent-configs.js';
import type { AgentType } from '../ai/config/agent-configs.js';
import type { CoreMessage } from 'ai';

export const aiRoutes = Router();

// ── Validation schemas ──────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const sessionRequestSchema = z.object({
  agentType: z.enum(Object.keys(AGENT_CONFIGS) as [string, ...string[]]),
  messages: z.array(messageSchema).min(1),
  systemPrompt: z.string().optional(),
  modelId: z.string().optional(),
  cwd: z.string().optional(),
  maxSteps: z.number().int().positive().max(100).optional(),
});

// ── SSE helper ──────────────────────────────────────────────────────

function setupSSE(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });
  res.flushHeaders();

  return {
    send(event: string, data: unknown) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      res.end();
    },
  };
}

// ── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/ai/session — Start a streaming AI agent session.
 *
 * Body: { agentType, messages, systemPrompt?, modelId?, cwd?, maxSteps? }
 * Response: Server-Sent Events stream with text-delta, tool-call, tool-result, step-finish, error, done events.
 */
aiRoutes.post('/session', async (req: Request, res: Response) => {
  const parsed = sessionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { agentType, messages, systemPrompt, modelId, cwd, maxSteps } = parsed.data;

  // Validate API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI provider not configured. Set ANTHROPIC_API_KEY environment variable.' });
    return;
  }

  const sse = setupSSE(res);
  const abortController = new AbortController();

  // Abort on client disconnect
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const result = await runAgentSession(
      {
        agentType: agentType as AgentType,
        messages: messages as CoreMessage[],
        systemPrompt: systemPrompt ?? `You are a helpful AI assistant (${agentType} mode).`,
        modelId,
        cwd: cwd ?? process.cwd(),
        maxSteps,
        abortSignal: abortController.signal,
      },
      {
        onEvent: (event) => {
          sse.send(event.type, event.data);
        },
      },
    );

    // Send final result
    sse.send('session-result', result);
  } catch (err: any) {
    sse.send('error', { error: err.message ?? 'Unknown error' });
  } finally {
    sse.close();
  }
});

/**
 * GET /api/ai/agents — List available agent types and their configs.
 */
aiRoutes.get('/agents', (_req: Request, res: Response) => {
  const agents = Object.entries(AGENT_CONFIGS).map(([type, config]) => ({
    type,
    description: config.description,
    defaultModel: config.defaultModel,
    maxSteps: config.maxSteps,
    tools: [...config.tools],
  }));
  res.json(agents);
});

/**
 * GET /api/ai/health — Check if AI provider is configured.
 */
aiRoutes.get('/health', (_req: Request, res: Response) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({
    configured: hasKey,
    provider: hasKey ? 'anthropic' : null,
  });
});
