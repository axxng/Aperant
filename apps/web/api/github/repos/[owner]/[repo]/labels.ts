import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';
import { getUserById } from '../../../../_lib/db/users.js';
import { githubFetch, GITHUB_API, GitHubRateLimitError } from '../../../../_lib/github.js';
import { githubOwnerRepoSchema } from '../../../../_lib/validation.js';

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  const dbUser = await getUserById(user.userId);
  if (!dbUser?.github_token) {
    return res.status(403).json({ error: 'GitHub account not connected' });
  }

  try {
    const pathResult = githubOwnerRepoSchema.safeParse(req.query);
    if (!pathResult.success) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    const { owner, repo } = pathResult.data;

    const response = await githubFetch(
      dbUser.github_token,
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels?per_page=100`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }

    const rawLabels: GitHubLabel[] = await response.json();
    res.json({
      labels: rawLabels.map(l => ({
        id: l.id,
        name: l.name,
        color: l.color,
        description: l.description ?? null,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof GitHubRateLimitError) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
