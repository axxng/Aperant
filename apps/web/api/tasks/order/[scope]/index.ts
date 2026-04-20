import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../../_lib/auth/middleware.js';
import { getTaskOrder } from '../../../_lib/db/tasks.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const scope = req.query.scope as string;
  const order = await getTaskOrder(scope);
  res.json(order);
}
