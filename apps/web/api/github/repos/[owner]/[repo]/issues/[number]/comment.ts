import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API } from '../../../../../../_lib/github.js';
import { githubCommentSchema, githubOwnerRepoSchema } from '../../../../../../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — path params (programmer bug if invalid → throws → 500)
  const { owner, repo } = githubOwnerRepoSchema.parse(req.query);
  const number = z.string().regex(/^\d+$/).parse(req.query.number as string);
  // body is user input → safeParse + 400
  const bodyResult = githubCommentSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(number)}/comments`,
      { method: 'POST', body: JSON.stringify({ body: bodyResult.data.body }), headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }

    res.json(await response.json());
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
