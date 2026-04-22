import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API, mapGitHubPR } from '../../../../../_lib/github.js';
import { githubPRQuerySchema, githubCreatePRSchema, githubOwnerRepoSchema } from '../../../../../_lib/validation.js';
import type { GitHubPR } from '../../../../../../src/shared/types/pr.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  switch (req.method) {
    case 'GET': {
      // 1. Parse input — path params (programmer bug if invalid → throws → 500)
      const { owner, repo } = githubOwnerRepoSchema.parse(req.query);
      // user query params → safeParse + 400
      const queryResult = githubPRQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({ error: 'Invalid query parameters' });
      }
      // 2. Authorize
      const user = await authenticateRequest(req, res);
      if (!user) return;
      try {
        const { state, page, per_page } = queryResult.data;
        const params = new URLSearchParams({ state, page, per_page, sort: 'updated', direction: 'desc' });

        const response = await githubFetch(
          `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${params}`
        );

        if (!response.ok) {
          return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
        }

        const pulls = await response.json();
        const mapped: GitHubPR[] = pulls.map((pr: any) => mapGitHubPR(pr));
        const linkHeader = response.headers.get('Link');
        const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;

        return res.json({ pullRequests: mapped, hasMore, page: parseInt(page, 10) });
      } catch (error: any) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    case 'POST': {
      // 1. Parse input — path params + body
      const { owner, repo } = githubOwnerRepoSchema.parse(req.query);
      const bodyResult = githubCreatePRSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({ error: 'Invalid input', details: bodyResult.error.issues });
      }
      // 2. Authorize
      const user = await authenticateRequest(req, res);
      if (!user) return;
      try {
        const response = await githubFetch(
          `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
          { method: 'POST', body: JSON.stringify(bodyResult.data), headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          return res.status(response.status).json({
            error: `GitHub API error: ${response.statusText}`,
            message: errorBody.message || response.statusText,
          });
        }

        const pr = await response.json();
        return res.json({
          number: pr.number,
          title: pr.title,
          htmlUrl: pr.html_url,
          state: pr.state,
          draft: pr.draft,
          head: pr.head?.ref,
          base: pr.base?.ref,
        });
      } catch (error: any) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
