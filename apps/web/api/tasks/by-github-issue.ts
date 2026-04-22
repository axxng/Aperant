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

  // 1. Parse — query string params are programmer-level inputs (use z.parse() → ZodError → 500)
  const repo = z
    .string()
    .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/)
    .parse(req.query.repo as string);
  const number = z.coerce.number().int().positive().parse(req.query.number as string);

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
