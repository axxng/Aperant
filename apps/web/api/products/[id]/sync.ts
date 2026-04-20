import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { broadcastEvent } from '../../_lib/events.js';
import { syncProduct } from '../../_lib/sync/github-sync.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const productId = req.query.id as string;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    await broadcastEvent('sync_started', { productId });
    const result = await syncProduct(productId);

    await broadcastEvent('sync_complete', { productId, result });
    return res.json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Sync failed', message: error.message });
  }
}
