import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { broadcastEvent } from '../../_lib/events.js';
import { syncProduct } from '../../_lib/sync/github-sync.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — id is a path param (programmer bug if invalid → throws → 500)
  const productId = z.string().uuid().parse(req.query.id as string);

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // 3. + 4. Respond
  try {
    await broadcastEvent('sync_started', { productId });
    const result = await syncProduct(productId);

    await broadcastEvent('sync_complete', { productId, result });
    return res.json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Sync failed', message: error.message });
  }
}
