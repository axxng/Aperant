import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { listSessions, getSession, createSession, updateSession, deleteSession } from '../db/insights.js';
import { runAgentSession } from '../ai/session/runner.js';
import { resolveConfig } from '../config-resolver.js';
import type { CoreMessage } from 'ai';

export const insightsRoutes = Router();

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: Array<{ name: string; input?: string }>;
}

const messageSchema = z.object({
  content: z.string().min(1),
  modelId: z.string().optional(),
});

const INSIGHTS_SYSTEM_PROMPT = `You are an expert software engineer helping users understand and explore a codebase. You have access to file reading and search tools.

When answering questions:
- Use the Read, Glob, and Grep tools to explore the codebase
- Provide specific file paths and line numbers when referencing code
- Explain concepts clearly and concisely
- When asked about architecture, trace through the actual code paths
- Suggest relevant files to look at for deeper understanding

Be conversational but precise. Reference real code, not hypothetical examples.`;

function setupSSE(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  return {
    send(event: string, data: unknown) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() { res.end(); },
  };
}

/** GET / — List all sessions */
insightsRoutes.get('/', (_req: Request, res: Response) => {
  const sessions = listSessions().map(s => ({
    id: s.id,
    title: s.title,
    messageCount: JSON.parse(s.messages).length,
    modelConfig: JSON.parse(s.model_config),
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));
  res.json(sessions);
});

/** POST / — Create a new session */
insightsRoutes.post('/', (req: Request, res: Response) => {
  const title = req.body?.title;
  const session = createSession(title);
  res.status(201).json({
    id: session.id,
    title: session.title,
    messages: [],
    modelConfig: {},
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  });
});

/** GET /:id — Get a session with messages */
insightsRoutes.get('/:id', (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json({
    id: session.id,
    title: session.title,
    messages: JSON.parse(session.messages),
    modelConfig: JSON.parse(session.model_config),
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  });
});

/** PATCH /:id — Update session (title, modelConfig) */
insightsRoutes.patch('/:id', (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  const updates: any = {};
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.modelConfig !== undefined) updates.model_config = JSON.stringify(req.body.modelConfig);
  updateSession(req.params.id, updates);
  res.json({ success: true });
});

/** DELETE /:id — Delete a session */
insightsRoutes.delete('/:id', (req: Request, res: Response) => {
  deleteSession(req.params.id);
  res.json({ success: true });
});

/** POST /:id/messages — Send a message and get AI response via SSE */
insightsRoutes.post('/:id/messages', async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() }); return; }

  if (!resolveConfig('anthropicApiKey', 'ANTHROPIC_API_KEY')) {
    res.status(503).json({ error: 'AI provider not configured. Set ANTHROPIC_API_KEY or configure it in Settings.' });
    return;
  }

  const { content, modelId } = parsed.data;
  const messages: ChatMessage[] = JSON.parse(session.messages);

  // Add user message
  const userMessage: ChatMessage = {
    id: uuid(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
  messages.push(userMessage);

  // Save user message immediately
  updateSession(req.params.id, { messages: JSON.stringify(messages) });

  // Auto-generate title from first message
  if (!session.title && messages.length === 1) {
    const autoTitle = content.slice(0, 60) + (content.length > 60 ? '...' : '');
    updateSession(req.params.id, { title: autoTitle });
  }

  const sse = setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  // Build AI messages from history
  const aiMessages: CoreMessage[] = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  let fullText = '';
  const toolsUsed: Array<{ name: string; input?: string }> = [];

  try {
    const result = await runAgentSession(
      {
        agentType: 'insights',
        systemPrompt: INSIGHTS_SYSTEM_PROMPT,
        messages: aiMessages,
        modelId,
        cwd: process.cwd(),
        abortSignal: abortController.signal,
      },
      {
        onEvent: (event) => {
          if (event.type === 'text-delta') {
            const { text } = event.data as { text: string };
            fullText += text;
            sse.send('text-delta', { text });
          } else if (event.type === 'tool-call') {
            const { toolName, args } = event.data as { toolName: string; args: any };
            const input = args?.file_path ?? args?.pattern ?? args?.query ?? undefined;
            toolsUsed.push({ name: toolName, input });
            sse.send('tool-call', { name: toolName, input });
          } else if (event.type === 'tool-result') {
            sse.send('tool-result', event.data);
          } else if (event.type === 'error') {
            sse.send('error', event.data);
          }
        },
      },
    );

    // Save assistant message
    const assistantMessage: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: fullText,
      timestamp: new Date().toISOString(),
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    };
    messages.push(assistantMessage);
    updateSession(req.params.id, { messages: JSON.stringify(messages) });

    sse.send('done', {
      messageId: assistantMessage.id,
      usage: result.usage,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      sse.send('error', { error: err.message ?? 'Unknown error' });
    }
  } finally {
    sse.close();
  }
});
