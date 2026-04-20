import { getClient } from './client.js';

export async function insertEvent(type: string, data: any): Promise<void> {
  await getClient().execute({
    sql: 'INSERT INTO events (type, data) VALUES (?, ?)',
    args: [type, JSON.stringify(data)],
  });
}

export async function getEventsSince(since: string): Promise<Array<{ id: number; type: string; data: any; createdAt: string }>> {
  const result = await getClient().execute({
    sql: 'SELECT id, type, data, created_at FROM events WHERE created_at > ? ORDER BY created_at ASC LIMIT 100',
    args: [since],
  });
  return result.rows.map((row: any) => ({
    id: Number(row.id),
    type: row.type as string,
    data: JSON.parse(row.data as string),
    createdAt: row.created_at as string,
  }));
}

export async function purgeOldEvents(olderThanMinutes: number = 5): Promise<void> {
  await getClient().execute({
    sql: `DELETE FROM events WHERE created_at < datetime('now', '-' || ? || ' minutes')`,
    args: [olderThanMinutes],
  });
}
