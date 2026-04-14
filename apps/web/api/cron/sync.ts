import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { purgeOldEvents } from '../_lib/events.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // TODO: Import and call syncAllProducts once the sync module is created
    // import { syncAllProducts } from '../_lib/sync.js';
    // const results = await syncAllProducts();
    const results = { status: 'stub', message: 'Sync module not yet implemented' };

    // Purge old events (older than 1 hour)
    await purgeOldEvents(3600);

    res.json({ success: true, results, purgedEvents: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Cron job failed', message: error.message });
  }
}
