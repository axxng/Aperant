import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { runAgentSession } from '../ai/session/runner.js';
import type { CoreMessage } from 'ai';

import { resolveConfig } from '../config-resolver.js';

export const prReviewRoutes = Router();

const reviewSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  prNumber: z.number(),
  prTitle: z.string(),
  prBody: z.string().optional().default(''),
  headRef: z.string(),
  baseRef: z.string(),
  files: z.array(z.object({
    path: z.string(),
    additions: z.number(),
    deletions: z.number(),
    status: z.string(),
    patch: z.string().optional(),
  })).optional().default([]),
});

const REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer analyzing a GitHub pull request. Review the PR diff thoroughly and provide structured findings.

For each issue found, output it in this exact format:

### [SEVERITY: critical|high|medium|low] [CATEGORY: security|quality|logic|performance|style] — Title

**File:** \`path/to/file\` (line N)

Description of the issue.

**Suggested fix:**
\`\`\`
code suggestion
\`\`\`

---

At the end, provide:

## Summary
A 2-3 sentence summary of the PR quality.

## Overall Status
One of: APPROVE, REQUEST_CHANGES, or COMMENT

Review criteria:
- **Security**: Injection, XSS, auth issues, secret exposure, OWASP Top 10
- **Quality**: Error handling, edge cases, code duplication, naming
- **Logic**: Correctness, race conditions, off-by-one, null safety
- **Performance**: N+1 queries, unnecessary computation, memory leaks
- **Style**: Consistency with codebase patterns, readability

Be specific and actionable. Reference exact file paths and line numbers from the diff. Only flag real issues — avoid nitpicking.`;

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
 * POST /api/pr-review — Run AI review on a pull request.
 * Returns SSE stream with text-delta events and a final review-result event.
 */
prReviewRoutes.post('/', async (req: Request, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  if (!resolveConfig('anthropicApiKey', 'ANTHROPIC_API_KEY')) {
    res.status(503).json({ error: 'AI provider not configured. Set ANTHROPIC_API_KEY or configure it in Settings.' });
    return;
  }

  const { owner, repo, prNumber, prTitle, prBody, headRef, baseRef, files } = parsed.data;

  const sse = setupSSE(res);
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  sse.send('progress', { phase: 'fetching', progress: 10, message: `Reviewing PR #${prNumber}...` });

  // Build diff context from files
  const diffSections = files.map(f => {
    const statusLabel = f.status === 'added' ? 'NEW' : f.status === 'deleted' ? 'DELETED' : 'MODIFIED';
    return `### ${f.path} [${statusLabel}] (+${f.additions}/-${f.deletions})\n${f.patch || '(no diff available)'}`;
  }).join('\n\n---\n\n');

  const userMessage = `Please review this pull request:

# PR #${prNumber}: ${prTitle}

**Branch:** ${headRef} → ${baseRef}
**Repository:** ${owner}/${repo}
**Changed files:** ${files.length}

## Description
${prBody || 'No description provided.'}

## Diff

${diffSections || 'No file diffs available.'}

Provide a thorough review with specific, actionable findings.`;

  const messages: CoreMessage[] = [{ role: 'user', content: userMessage }];
  let fullText = '';

  try {
    sse.send('progress', { phase: 'analyzing', progress: 30, message: 'AI is reviewing the code...' });

    const result = await runAgentSession(
      {
        agentType: 'reviewer',
        systemPrompt: REVIEW_SYSTEM_PROMPT,
        messages,
        cwd: process.cwd(),
        maxSteps: 50,
        abortSignal: abortController.signal,
      },
      {
        onEvent: (event) => {
          if (event.type === 'text-delta') {
            const { text } = event.data as { text: string };
            fullText += text;
            sse.send('text-delta', { text });
          } else if (event.type === 'step-finish') {
            sse.send('progress', { phase: 'analyzing', progress: 60, message: 'Processing review...' });
          } else if (event.type === 'error') {
            sse.send('error', event.data);
          }
        },
      },
    );

    sse.send('progress', { phase: 'complete', progress: 100, message: 'Review complete' });
    sse.send('review-result', {
      prNumber,
      success: result.outcome === 'completed',
      analysis: fullText,
      outcome: result.outcome,
      usage: result.usage,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    sse.send('error', { error: err.message ?? 'Review failed' });
  } finally {
    sse.close();
  }
});
