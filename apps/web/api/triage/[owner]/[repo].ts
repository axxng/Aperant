import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest } from '../../_lib/auth/middleware.js';
import { getTriageRecordsBatch } from '../../_lib/db/triage.js';
import { githubOwnerRepoSchema } from '../../_lib/validation.js';

// Query param schema: ?numbers=1,2,3  (comma-separated positive integers, max 100 items)
const batchQuerySchema = z.object({
  numbers: z
    .string()
    .regex(/^\d+(,\d+)*$/, 'numbers must be comma-separated positive integers')
    .transform(s => s.split(',').map(Number)),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Parse — path params are programmer bugs → throw → 500
  const { owner, repo } = githubOwnerRepoSchema.parse({
    owner: req.query.owner,
    repo: req.query.repo,
  });
  const repoFull = `${owner}/${repo}`;

  // numbers query param is user-controlled input → safeParse → 400
  const numbersResult = batchQuerySchema.safeParse({ numbers: req.query.numbers });
  if (!numbersResult.success) {
    return res.status(400).json({
      error: 'Invalid numbers parameter',
      details: numbersResult.error.flatten().fieldErrors,
    });
  }
  const issueNumbers = numbersResult.data.numbers.slice(0, 100); // hard cap at 100

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    // 3. Query
    const records = await getTriageRecordsBatch(repoFull, issueNumbers);

    // 4. Respond
    return res.json({ records });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
