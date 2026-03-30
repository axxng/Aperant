import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/schema.js';

export const settingsRoutes = Router();

// Helper: get a setting value
function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row ? row.value : null;
}

// Helper: set a setting value (upsert)
function setSetting(key: string, value: string): void {
  getDb().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  ).run(key, value, value);
}

// Helper: delete a setting
function deleteSetting(key: string): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// Valid setting keys (whitelist to prevent arbitrary key storage)
const VALID_KEYS = [
  'theme',           // 'light' | 'dark' | 'system'
  'colorTheme',      // 'default' | 'ocean' | 'forest' | 'dusk' | 'lime' | 'retro' | 'neo'
  'language',         // 'en' | 'fr'
  'anthropicApiKey',  // Anthropic API key
  'githubToken',      // GitHub PAT
  'gitlabToken',      // GitLab PAT
  'gitlabInstanceUrl', // GitLab instance URL (defaults to https://gitlab.com)
  'syncInterval',     // sync interval in seconds (string)
  'defaultModel',     // default AI model shorthand
] as const;

const settingSchema = z.object({
  key: z.enum(VALID_KEYS),
  value: z.string(),
});

const bulkSettingsSchema = z.record(z.enum(VALID_KEYS), z.string());

/** GET / — Get all settings */
settingsRoutes.get('/', (_req: Request, res: Response) => {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const row of rows) {
    // Mask sensitive keys
    if (row.key === 'anthropicApiKey' || row.key === 'githubToken' || row.key === 'gitlabToken') {
      settings[row.key] = row.value ? `${'*'.repeat(Math.max(0, row.value.length - 4))}${row.value.slice(-4)}` : '';
    } else {
      settings[row.key] = row.value;
    }
  }
  res.json(settings);
});

/** GET /:key — Get a specific setting */
settingsRoutes.get('/:key', (req: Request, res: Response) => {
  const { key } = req.params;
  const value = getSetting(key);
  if (value === null) {
    res.status(404).json({ error: 'Setting not found' });
    return;
  }
  // Mask sensitive values
  if (key === 'anthropicApiKey' || key === 'githubToken' || key === 'gitlabToken') {
    res.json({ key, value: value ? `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : '' });
    return;
  }
  res.json({ key, value });
});

/** PUT /:key — Set a specific setting */
settingsRoutes.put('/:key', (req: Request, res: Response) => {
  const parsed = settingSchema.safeParse({ key: req.params.key, value: req.body.value });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid setting', details: parsed.error.flatten() });
    return;
  }
  setSetting(parsed.data.key, parsed.data.value);
  res.json({ key: parsed.data.key, success: true });
});

/** PUT / — Bulk update settings */
settingsRoutes.put('/', (req: Request, res: Response) => {
  const parsed = bulkSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid settings', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');
  db.transaction(() => {
    for (const [key, value] of Object.entries(parsed.data)) {
      stmt.run(key, value, value);
    }
  })();
  res.json({ success: true });
});

/** DELETE /:key — Delete a setting */
settingsRoutes.delete('/:key', (req: Request, res: Response) => {
  deleteSetting(req.params.key);
  res.json({ success: true });
});
