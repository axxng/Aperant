import { getDb } from './schema.js';
import type { SyncState } from '../../shared/types/github.js';

export function getSyncState(productId: string, sourceKey: string): SyncState | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM sync_state WHERE product_id = ? AND source_key = ?'
  ).get(productId, sourceKey) as any;
  return row ? {
    productId: row.product_id,
    sourceKey: row.source_key,
    lastSyncedAt: row.last_synced_at || undefined,
    etag: row.etag || undefined,
    cursor: row.cursor || undefined,
  } : null;
}

export function upsertSyncState(state: SyncState): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO sync_state (product_id, source_key, last_synced_at, etag, cursor)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(product_id, source_key) DO UPDATE SET
      last_synced_at = excluded.last_synced_at,
      etag = excluded.etag,
      cursor = excluded.cursor
  `).run(
    state.productId,
    state.sourceKey,
    state.lastSyncedAt || null,
    state.etag || null,
    state.cursor || null,
  );
}

export function deleteSyncStatesForProduct(productId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sync_state WHERE product_id = ?').run(productId);
}
