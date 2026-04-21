import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../../_lib/db/client.js';
import { authenticateRequest } from '../../../_lib/auth/middleware.js';
import { getTriageRecord, upsertTriageRecord } from '../../../_lib/db/triage.js';
import { githubOwnerRepoSchema } from '../../../_lib/validation.js';

// Validate path parameters (D-06: auth required, path must be valid)
const triagePathSchema = githubOwnerRepoSchema.extend({
  number: z.string().regex(/^\d+$/, 'Issue number must be a positive integer'),
});

// PUT body schema — accepts any subset of { isTriaged, priority } per D-05
const triagePutBodySchema = z.object({
  isTriaged: z.boolean().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  // D-06: require authentication on both GET and PUT
  const user = await authenticateRequest(req, res);
  if (!user) return;

  // Validate path params
  const pathResult = triagePathSchema.safeParse({
    owner: req.query.owner,
    repo: req.query.repo,
    number: req.query.number,
  });
  if (!pathResult.success) {
    return res.status(400).json({ error: 'Invalid path parameters', details: pathResult.error.flatten().fieldErrors });
  }

  const { owner, repo, number } = pathResult.data;
  const repoFull = `${owner}/${repo}`;
  const issueNumber = parseInt(number, 10);

  try {
    switch (req.method) {
      case 'GET': {
        // D-04: always 200 — return default empty state if no record exists, never 404
        const record = await getTriageRecord(repoFull, issueNumber);
        return res.json(
          record ?? {
            isTriaged: false,
            priority: null,
            githubCommentId: null,
            commentStatus: null,
          }
        );
      }

      case 'PUT': {
        // D-05: upsert semantics — create if absent, update if present
        const bodyResult = triagePutBodySchema.safeParse(req.body);
        if (!bodyResult.success) {
          return res.status(400).json({
            error: 'Invalid input',
            details: bodyResult.error.flatten().fieldErrors,
          });
        }
        const record = await upsertTriageRecord(repoFull, issueNumber, bodyResult.data);
        return res.json(record);
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
