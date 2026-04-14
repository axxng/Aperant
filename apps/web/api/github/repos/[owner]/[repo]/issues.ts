import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API, mapGitHubIssue } from '../../../../_lib/github.js';
import { githubIssueQuerySchema } from '../../../../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const owner = req.query.owner as string;
    const repo = req.query.repo as string;

    const queryResult = githubIssueQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }

    const { state, page, per_page } = queryResult.data;
    const params = new URLSearchParams({ state, page, per_page, sort: 'updated', direction: 'desc' });

    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params}`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }

    const issues = await response.json();
    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const filteredIssues = issues.filter((issue: any) => !issue.pull_request);
    const mapped = filteredIssues.map(mapGitHubIssue(owner, repo));
    const linkHeader = response.headers.get('Link');
    const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;

    res.json({ issues: mapped, hasMore });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
