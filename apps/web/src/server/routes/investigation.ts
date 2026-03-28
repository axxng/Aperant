import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { runAgentSession } from '../ai/session/runner.js';
import type { CoreMessage } from 'ai';

export const investigationRoutes = Router();

const investigateSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  issueNumber: z.number(),
  issueTitle: z.string(),
  issueBody: z.string().optional().default(''),
  labels: z.array(z.string()).optional().default([]),
  comments: z.array(z.object({
    author: z.string(),
    body: z.string(),
  })).optional().default([]),
});

const INVESTIGATION_SYSTEM_PROMPT = `You are an expert software engineer investigating a GitHub issue. Your goal is to analyze the issue thoroughly and provide actionable insights.

Analyze the issue and provide:

1. **Summary** — A concise explanation of what the issue is about
2. **Root Cause Analysis** — What might be causing this issue based on the description and any error details
3. **Affected Areas** — Which parts of the codebase are likely affected
4. **Proposed Solution** — A concrete approach to resolve the issue
5. **Complexity Assessment** — Rate as simple/standard/complex with justification
6. **Acceptance Criteria** — What "done" looks like for this issue

Format your response in clear markdown sections. Be specific and actionable — avoid vague suggestions.`;

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
    close() {
      res.end();
    },
  };
}

/**
 * POST /api/investigate — Run AI investigation on a GitHub issue.
 * Returns SSE stream with text-delta events and a final investigation-result event.
 */
investigationRoutes.post('/', async (req: Request, res: Response) => {
  const parsed = investigateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI provider not configured. Set ANTHROPIC_API_KEY.' });
    return;
  }

  const { owner, repo, issueNumber, issueTitle, issueBody, labels, comments } = parsed.data;

  const sse = setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  // Send initial progress
  sse.send('progress', { phase: 'analyzing', progress: 10, message: `Analyzing issue #${issueNumber}...` });

  // Build the user message with issue context
  const commentsSection = comments.length > 0
    ? `\n\n## Comments (${comments.length}):\n${comments.map(c => `**${c.author}:** ${c.body}`).join('\n\n')}`
    : '';

  const labelsSection = labels.length > 0 ? `\n**Labels:** ${labels.join(', ')}` : '';

  const userMessage = `Please investigate this GitHub issue:

# Issue #${issueNumber}: ${issueTitle}

**Repository:** ${owner}/${repo}
${labelsSection}

## Description:
${issueBody || 'No description provided.'}
${commentsSection}

Provide a thorough analysis with actionable recommendations.`;

  const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];
  let fullText = '';

  try {
    sse.send('progress', { phase: 'analyzing', progress: 30, message: 'AI is analyzing the issue...' });

    const result = await runAgentSession(
      {
        agentType: 'investigator',
        systemPrompt: INVESTIGATION_SYSTEM_PROMPT,
        messages,
        cwd: process.cwd(),
        abortSignal: abortController.signal,
      },
      {
        onEvent: (event) => {
          if (event.type === 'text-delta') {
            const { text } = event.data as { text: string };
            fullText += text;
            sse.send('text-delta', { text });
          } else if (event.type === 'step-finish') {
            sse.send('progress', { phase: 'analyzing', progress: 60, message: 'Processing findings...' });
          } else if (event.type === 'error') {
            sse.send('error', event.data);
          }
        },
      },
    );

    sse.send('progress', { phase: 'complete', progress: 100, message: 'Investigation complete' });
    sse.send('investigation-result', {
      success: result.outcome === 'completed',
      issueNumber,
      analysis: fullText,
      outcome: result.outcome,
      usage: result.usage,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    sse.send('error', { error: err.message ?? 'Investigation failed' });
  } finally {
    sse.close();
  }
});
