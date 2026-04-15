import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { purgeOldEvents } from '../_lib/events.js';
import { syncAllProducts } from '../_lib/sync/github-sync.js';
import { retryPendingWritebacks } from '../_lib/sync/github-writeback.js';

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
    // 1. Pull sync: GitHub → Turso
    let syncResults: any = null;
    try {
      const results = await syncAllProducts();
      syncResults = Object.fromEntries(results);
    } catch (error: any) {
      console.log(`Pull sync error: ${error.message}`);
    }

    // 2. Write-back retry: Turso → GitHub
    let writebackResults: { succeeded: number; failed: number } | null = null;
    try {
      writebackResults = await retryPendingWritebacks();
      if (writebackResults.succeeded > 0 || writebackResults.failed > 0) {
        console.log(`Write-back retry: ${writebackResults.succeeded} succeeded, ${writebackResults.failed} failed`);
      }
    } catch (error: any) {
      console.log(`Write-back retry error: ${error.message}`);
    }

    // 3. Purge old events (older than 1 hour)
    await purgeOldEvents(3600);

    res.json({
      success: true,
      pullSync: syncResults,
      writeback: writebackResults,
      purgedEvents: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Cron job failed', message: error.message });
  }
}
