import { syncAllProducts, syncProduct } from './github-sync.js';

let intervalId: ReturnType<typeof setInterval> | null = null;
const DEFAULT_INTERVAL_MS = 60_000; // 60 seconds

export function startSyncScheduler(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (intervalId) return; // Already running

  console.log(`Starting GitHub sync scheduler (interval: ${intervalMs / 1000}s)`);

  // Run initial sync after a short delay
  setTimeout(async () => {
    try {
      const results = await syncAllProducts();
      for (const [productId, result] of results) {
        if (result.created || result.updated || result.closed) {
          console.log(`Sync ${productId}: +${result.created} created, ${result.updated} updated, ${result.closed} closed`);
        }
        if (result.errors.length > 0) {
          console.warn(`Sync ${productId} errors:`, result.errors);
        }
      }
    } catch (error) {
      console.error('Initial sync failed:', error);
    }
  }, 2000);

  // Schedule periodic sync
  intervalId = setInterval(async () => {
    try {
      await syncAllProducts();
    } catch (error) {
      console.error('Periodic sync failed:', error);
    }
  }, intervalMs);
}

export function stopSyncScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('GitHub sync scheduler stopped');
  }
}

/** Trigger immediate sync for a single product */
export async function triggerSync(productId: string) {
  return syncProduct(productId);
}
