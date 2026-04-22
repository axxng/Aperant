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

  // Stub: return 501 until Wave 1 implements full handler
  return res.status(501).json({ error: 'Not implemented' });
}
