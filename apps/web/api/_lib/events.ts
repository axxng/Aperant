import { getClient } from './db/client.js';

/**
 * Broadcast an event by storing it in the events table.
 * In serverless mode, clients poll via GET /api/events/poll instead of SSE.
 */
export async function broadcastEvent(type: string, data: any): Promise<void> {
  await getClient().execute({
    sql: 'INSERT INTO events (type, data) VALUES (?, ?)',
    args: [type, JSON.stringify(data)],
  });
}

/**
 * Get events since a given timestamp.
 */
export async function getEventsSince(since: string): Promise<Array<{ id: number; type: string; data: any; createdAt: string }>> {
  const result = await getClient().execute({
    sql: 'SELECT id, type, data, created_at FROM events WHERE created_at > ? ORDER BY id ASC',
    args: [since],
  });
  return result.rows.map((row: any) => ({
    id: Number(row.id),
    type: row.type as string,
    data: JSON.parse(row.data as string || '{}'),
    createdAt: row.created_at as string,
  }));
}

/**
 * Purge events older than a given duration.
 */
export async function purgeOldEvents(olderThanSeconds = 3600): Promise<void> {
  await getClient().execute({
    sql: `DELETE FROM events WHERE created_at < datetime('now', '-' || ? || ' seconds')`,
    args: [olderThanSeconds],
  });
}
