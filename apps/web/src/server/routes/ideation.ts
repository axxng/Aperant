import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { getIdeationSession, createIdeationSession, updateIdeationSession, deleteIdeationSession } from '../db/ideation.js';
import { runAgentSession } from '../ai/session/runner.js';
import type { CoreMessage } from 'ai';

export const ideationRoutes = Router();

function setupSSE(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  return {
    send(event: string, data: unknown) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); },
    close() { res.end(); },
  };
}

const generateSchema = z.object({
  enabledTypes: z.array(z.string()),
  maxIdeasPerType: z.number().optional(),
  modelId: z.string().optional(),
});

const updateSchema = z.object({
  ideas: z.string(),
});

const IDEATION_SYSTEM_PROMPT = `You are an expert software analyst discovering improvements, issues, and opportunities in a codebase. You have access to file reading and search tools.

For each enabled idea type, analyze the codebase and generate actionable ideas:

- **code_improvements**: Architecture improvements, better patterns, refactoring opportunities
- **ui_ux_improvements**: Usability, accessibility, visual, and interaction improvements
- **documentation_gaps**: Missing docs, outdated comments, needed examples
- **security_hardening**: Vulnerabilities, input validation, data protection issues
- **performance_optimizations**: Bundle size, runtime, memory, rendering optimizations
- **code_quality**: Code smells, complexity, duplication, naming issues

For each idea, provide:
- A clear, actionable title
- Detailed description of the issue or opportunity
- Rationale explaining why this matters
- Category within the type
- Severity or estimated effort level
- Affected files when applicable
- Implementation approach when useful

Return your findings as a JSON array wrapped in a markdown code block:
\`\`\`json
[
  {
    "type": "code_improvements",
    "title": "...",
    "description": "...",
    "rationale": "...",
    "category": "...",
    "severity": "medium",
    "estimatedEffort": "small",
    "affectedFiles": ["..."],
    "implementation": "..."
  }
]
\`\`\``;

function parseIdeasFromText(text: string): any[] {
  // Try to find ```json ... ``` blocks and parse them
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]!.trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to next strategy
    }
  }

  // Fall back to finding any [...] array in the text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through
    }
  }

  return [];
}

/** GET /:productId — Get current ideation session for a product */
ideationRoutes.get('/:productId', (req: Request, res: Response) => {
  const session = getIdeationSession(req.params.productId);
  if (!session) { res.status(404).json({ error: 'No ideation session found' }); return; }
  res.json({
    id: session.id,
    productId: session.product_id,
    ideas: JSON.parse(session.ideas),
    config: JSON.parse(session.config),
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  });
});

/** PATCH /:id — Update idea statuses (dismiss, archive, etc.) */
ideationRoutes.patch('/:id', (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() }); return; }
  updateIdeationSession(req.params.id, parsed.data.ideas);
  res.json({ success: true });
});

/** DELETE /:id — Delete a session */
ideationRoutes.delete('/:id', (req: Request, res: Response) => {
  deleteIdeationSession(req.params.id);
  res.json({ success: true });
});

/** POST /:productId/generate — SSE streaming AI ideation generation */
ideationRoutes.post('/:productId/generate', async (req: Request, res: Response) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() }); return; }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI provider not configured. Set ANTHROPIC_API_KEY.' });
    return;
  }

  const productId = req.params.productId;
  const { enabledTypes, maxIdeasPerType, modelId } = parsed.data;

  const sse = setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  sse.send('status', { phase: 'analyzing', message: 'Analyzing codebase...', progress: 10 });

  const maxPerType = maxIdeasPerType ?? 5;
  const userMessage = `Analyze the codebase and generate ideas for the following types: ${enabledTypes.join(', ')}.

Generate up to ${maxPerType} ideas per type. Focus on actionable, high-impact findings. Use the available tools to explore the codebase before generating ideas.

Return all ideas as a single JSON array in a markdown code block as specified in your instructions.`;

  const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];
  let fullText = '';

  try {
    sse.send('status', { phase: 'generating', message: 'Generating ideas...', progress: 30 });

    const result = await runAgentSession(
      {
        agentType: 'ideation',
        systemPrompt: IDEATION_SYSTEM_PROMPT,
        messages,
        modelId,
        cwd: process.cwd(),
        abortSignal: abortController.signal,
      },
      {
        onEvent: (event) => {
          if (event.type === 'text-delta') {
            const { text } = event.data as { text: string };
            fullText += text;
            sse.send('text', { delta: text });
          } else if (event.type === 'step-finish') {
            sse.send('status', { phase: 'generating', message: 'Analyzing findings...', progress: 60 });
          } else if (event.type === 'error') {
            sse.send('error', { message: (event.data as any)?.error ?? 'Unknown error' });
          }
        },
      },
    );

    // Parse ideas from AI response
    const ideas = parseIdeasFromText(fullText);

    if (ideas.length === 0) {
      sse.send('error', { message: 'Failed to parse ideas from AI response' });
      sse.close();
      return;
    }

    sse.send('status', { phase: 'saving', message: 'Saving results...', progress: 90 });

    // Save to database — create or update existing session
    const config = JSON.stringify({ enabledTypes, maxIdeasPerType: maxPerType, modelId });
    const ideasJson = JSON.stringify(ideas);

    const existing = getIdeationSession(productId);
    let sessionId: string;

    if (existing) {
      updateIdeationSession(existing.id, ideasJson);
      sessionId = existing.id;
    } else {
      sessionId = uuid();
      createIdeationSession(sessionId, productId, ideasJson, config);
    }

    const sessionData = {
      id: sessionId,
      productId,
      ideas,
      config: { enabledTypes, maxIdeasPerType: maxPerType, modelId },
      createdAt: existing?.created_at ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sse.send('status', { phase: 'complete', message: 'Ideation complete!', progress: 100 });
    sse.send('complete', { session: sessionData });
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      sse.send('error', { message: err.message ?? 'Generation failed' });
    }
  } finally {
    sse.close();
  }
});
