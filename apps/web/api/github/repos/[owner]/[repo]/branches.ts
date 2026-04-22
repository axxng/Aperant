import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API } from '../../../../_lib/github.js';
import { githubOwnerRepoSchema } from '../../../../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — path params (programmer bug if invalid → throws → 500)
  const { owner, repo } = githubOwnerRepoSchema.parse(req.query);
  const page = (req.query.page as string) || '1';
  const perPage = (req.query.per_page as string) || '100';

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${perPage}&page=${page}`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }

    const branches = await response.json();
    res.json(branches.map((b: any) => ({ name: b.name, protected: b.protected })));
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
