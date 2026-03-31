import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { getChangelogs, getChangelogById, createChangelog, updateChangelog, deleteChangelog } from '../db/changelogs.js';
import { runAgentSession } from '../ai/session/runner.js';
import { resolveConfig } from '../config-resolver.js';
import type { CoreMessage } from 'ai';

export const changelogRoutes = Router();

const CHANGELOG_SYSTEM_PROMPT = `You are a technical writer who creates clear, professional changelogs.

When generating a changelog:
1. Group changes by type: Added, Changed, Fixed, Security, Performance, Deprecated, Removed
2. Write concise, descriptive entries in past tense ("Added dark mode" not "Add dark mode")
3. Focus on user-visible impact, not implementation details
4. Reference issue numbers where available
5. Keep entries actionable and meaningful

Format guidelines:
- "keep-a-changelog": Use ## [version] - date format with ### sections (Added, Changed, Fixed, etc.)
- "simple-list": Use # Release vX.Y.Z (date) with **New Features:**, **Improvements:**, **Bug Fixes:**
- "github-release": Use ## version - date with detailed descriptions and contributor mentions

Audience guidelines:
- "technical": Include technical details, API changes, internal improvements
- "user-facing": Focus on user benefits and behavior changes, avoid jargon
- "marketing": Value-driven language highlighting outcomes and improvements

Output ONLY the changelog markdown content. Do not include introductory text or explanations.`;

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

const updateContentSchema = z.object({
  content: z.string(),
});

const generateSchema = z.object({
  sourceMode: z.enum(['tasks', 'git-history', 'branch-diff']),
  version: z.string().default('1.0.0'),
  date: z.string().optional(),
  format: z.enum(['keep-a-changelog', 'simple-list', 'github-release']).default('keep-a-changelog'),
  audience: z.enum(['technical', 'user-facing', 'marketing']).default('user-facing'),
  customInstructions: z.string().optional(),
  taskSummaries: z.array(z.object({ title: z.string(), description: z.string() })).optional(),
  modelId: z.string().optional(),
});

/** GET /:productId — List changelogs for a product */
changelogRoutes.get('/:productId', (req: Request, res: Response) => {
  const changelogs = getChangelogs(req.params.productId).map(c => ({
    ...c,
    config: JSON.parse(c.config),
  }));
  res.json(changelogs);
});

/** GET /entry/:id — Get a single changelog */
changelogRoutes.get('/entry/:id', (req: Request, res: Response) => {
  const changelog = getChangelogById(req.params.id);
  if (!changelog) { res.status(404).json({ error: 'Changelog not found' }); return; }
  res.json({ ...changelog, config: JSON.parse(changelog.config) });
});

/** PATCH /:id — Update changelog content */
changelogRoutes.patch('/:id', (req: Request, res: Response) => {
  const parsed = updateContentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() }); return; }
  updateChangelog(req.params.id, parsed.data.content);
  res.json({ success: true });
});

/** DELETE /:id — Delete a changelog */
changelogRoutes.delete('/:id', (req: Request, res: Response) => {
  deleteChangelog(req.params.id);
  res.json({ success: true });
});

/** POST /:productId/generate — AI-generate a changelog via SSE */
changelogRoutes.post('/:productId/generate', async (req: Request, res: Response) => {
  if (!resolveConfig('anthropicApiKey', 'ANTHROPIC_API_KEY')) {
    res.status(503).json({ error: 'AI provider not configured. Set ANTHROPIC_API_KEY or configure it in Settings.' });
    return;
  }

  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() }); return; }

  const productId = req.params.productId;
  const { sourceMode, version, date, format, audience, customInstructions, taskSummaries, modelId } = parsed.data;

  const sse = setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  sse.send('status', { message: 'Generating changelog...' });

  // Build user message dynamically based on sourceMode
  let userMessage = `Generate a changelog with the following parameters:

**Version:** ${version}
**Date:** ${date ?? new Date().toISOString().split('T')[0]}
**Format:** ${format}
**Audience:** ${audience}
**Source:** ${sourceMode}`;

  if (taskSummaries && taskSummaries.length > 0) {
    userMessage += '\n\n**Completed Tasks:**\n';
    for (const task of taskSummaries) {
      userMessage += `- **${task.title}**: ${task.description}\n`;
    }
  }

  if (customInstructions) {
    userMessage += `\n\n**Additional Instructions:** ${customInstructions}`;
  }

  userMessage += '\n\nGenerate the changelog content now.';

  const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];
  let fullText = '';

  try {
    const result = await runAgentSession(
      {
        agentType: 'changelog',
        systemPrompt: CHANGELOG_SYSTEM_PROMPT,
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
            sse.send('text', { text });
          } else if (event.type === 'error') {
            sse.send('error', event.data);
          }
        },
      },
    );

    // Save to database
    const id = uuid();
    const config = JSON.stringify({ sourceMode, version, date: date ?? new Date().toISOString().split('T')[0], format, audience });
    createChangelog(id, productId, fullText, config);

    sse.send('complete', {
      id,
      productId,
      content: fullText,
      config: { sourceMode, version, date: date ?? new Date().toISOString().split('T')[0], format, audience },
      usage: result.usage,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      sse.send('error', { error: err.message ?? 'Generation failed' });
    }
  } finally {
    sse.close();
  }
});
