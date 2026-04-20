import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb, getClient } from '../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';

const VALID_KEYS = [
  'theme',
  'colorTheme',
  'language',
  'anthropicApiKey',
  'githubToken',
  'gitlabToken',
  'gitlabInstanceUrl',
  'syncInterval',
  'defaultModel',
] as const;

const SENSITIVE_KEYS = ['anthropicApiKey', 'githubToken', 'gitlabToken'];

const bulkSettingsSchema = z.record(z.enum(VALID_KEYS), z.string());

function maskValue(key: string, value: string): string {
  if (SENSITIVE_KEYS.includes(key)) {
    return value ? '••••••••' : '';
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  switch (req.method) {
    case 'GET': {
      const result = await getClient().execute('SELECT key, value FROM settings');
      const settings: Record<string, string> = {};
      for (const row of result.rows) {
        const key = row.key as string;
        const value = row.value as string;
        settings[key] = maskValue(key, value);
      }
      return res.json(settings);
    }

    case 'PUT': {
      const parsed = bulkSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid settings', details: parsed.error.flatten() });
      }

      const c = getClient();
      for (const [key, value] of Object.entries(parsed.data)) {
        await c.execute({
          sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
          args: [key, value, value],
        });
      }
      return res.json({ success: true });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
