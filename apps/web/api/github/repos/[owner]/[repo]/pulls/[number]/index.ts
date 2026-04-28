import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API, mapGitHubPR } from '../../../../../../_lib/github.js';
import { githubOwnerRepoSchema } from '../../../../../../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — path params (programmer bug if invalid → throws → 500)
  const { owner, repo } = githubOwnerRepoSchema.parse(req.query);
  const number = z.string().regex(/^\d+$/).parse(req.query.number as string);

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(number)}`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }

    const pr = await response.json();
    res.json(mapGitHubPR(pr));
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
