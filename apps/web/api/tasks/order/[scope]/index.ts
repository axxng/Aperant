import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../../_lib/auth/middleware.js';
import { getTaskOrder } from '../../../_lib/db/tasks.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — scope is a path param
  const scope = z.string().min(1).parse(req.query.scope as string);

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // 3. DB call + 4. Respond
  const order = await getTaskOrder(scope);
  res.json(order);
}
