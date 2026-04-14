import { getClient } from './client.js';
import type { SyncState } from '../../../src/shared/types/github.js';

export async function getSyncState(productId: string, sourceKey: string): Promise<SyncState | null> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM sync_state WHERE product_id = ? AND source_key = ?',
    args: [productId, sourceKey],
  });
  const row = result.rows[0];
  return row
    ? {
        productId: row.product_id as string,
        sourceKey: row.source_key as string,
        lastSyncedAt: (row.last_synced_at as string) || undefined,
        etag: (row.etag as string) || undefined,
        cursor: (row.cursor as string) || undefined,
      }
    : null;
}

export async function upsertSyncState(state: SyncState): Promise<void> {
  await getClient().execute({
    sql: `INSERT INTO sync_state (product_id, source_key, last_synced_at, etag, cursor)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(product_id, source_key) DO UPDATE SET
            last_synced_at = excluded.last_synced_at,
            etag = excluded.etag,
            cursor = excluded.cursor`,
    args: [
      state.productId,
      state.sourceKey,
      state.lastSyncedAt || null,
      state.etag || null,
      state.cursor || null,
    ],
  });
}

export async function deleteSyncStatesForProduct(productId: string): Promise<void> {
  await getClient().execute({
    sql: 'DELETE FROM sync_state WHERE product_id = ?',
    args: [productId],
  });
}
