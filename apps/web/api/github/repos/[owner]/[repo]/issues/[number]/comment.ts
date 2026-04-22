import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../../../_lib/auth/middleware.js';
import { GITHUB_API } from '../../../../../../_lib/github.js';
import { githubCommentSchema, githubOwnerRepoSchema } from '../../../../../../_lib/validation.js';
import { getUserById } from '../../../../../../_lib/db/users.js';
import { getTriageRecord, upsertTriageRecord } from '../../../../../../_lib/db/triage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — path params throw on invalid (programmer bug → 500); body safeParse (user input → 400)
  const { owner, repo } = githubOwnerRepoSchema.parse(req.query);
  const number = z.string().regex(/^\d+$/).parse(req.query.number as string);
  const bodyResult = githubCommentSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    // 3. Pure domain logic

    // D-04: look up per-user OAuth token — do NOT use githubFetch() / GITHUB_TOKEN env var
    const dbUser = await getUserById(user.userId);
    if (!dbUser?.github_token) {
      return res.status(403).json({ error: 'No GitHub token for user' });
    }

    // D-03: idempotency check — if comment already posted, return early without calling GitHub
    const existing = await getTriageRecord(`${owner}/${repo}`, parseInt(number, 10));
    if (existing?.githubCommentId) {
      return res.json({ alreadyPosted: true, commentId: existing.githubCommentId });
    }

    // Post to GitHub using raw fetch with per-user token (bypasses githubFetch() which uses GITHUB_TOKEN)
    const response = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(number)}/comments`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${dbUser.github_token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: bodyResult.data.body }),
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }

    const comment = await response.json();

    // Save idempotency guard so retries return early without duplicating the comment
    await upsertTriageRecord(`${owner}/${repo}`, parseInt(number, 10), {
      githubCommentId: comment.id,
      commentStatus: 'posted',
    });

    // 4. Respond
    return res.json(comment);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
