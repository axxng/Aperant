import { getClient } from './db/client.js';

export async function resolveConfig(settingsKey: string, envVar: string): Promise<string | null> {
  try {
    const result = await getClient().execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: [settingsKey],
    });
    if (result.rows[0]?.value) return result.rows[0].value as string;
  } catch {
    // DB not ready or key doesn't exist
  }
  return process.env[envVar] || null;
}
