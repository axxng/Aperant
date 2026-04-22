import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';
import { getTaskByGitHubIssue } from '../_lib/db/tasks.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse — query params are browser-submitted user inputs → safeParse + 400
  const repoResult = z.string().regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/).safeParse(req.query.repo);
  const numberResult = z.coerce.number().int().positive().safeParse(req.query.number);
  if (!repoResult.success || !numberResult.success) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }
  const repo = repoResult.data;
  const number = numberResult.data;

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;
  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // 3. DB call — getTaskByGitHubIssue already exists in db/tasks.ts
  const task = await getTaskByGitHubIssue(repo, number);

  // 4. Respond — null when not found (client shows promote button), task when found (client shows badge)
  return res.json(task ?? null);
}
