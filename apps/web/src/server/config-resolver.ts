import { getDb } from './db/schema.js';

/**
 * Resolve a config value by checking the settings DB first, then falling back to an env var.
 * Returns null if neither source has a value.
 */
export function resolveConfig(settingsKey: string, envVar: string): string | null {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(settingsKey) as
      | { value: string }
      | undefined;
    if (row?.value) return row.value;
  } catch {
    // DB not ready or key doesn't exist — fall through to env var
  }
  return process.env[envVar] || null;
}
