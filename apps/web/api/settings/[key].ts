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

const settingSchema = z.object({
  key: z.enum(VALID_KEYS),
  value: z.string(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  // 1. Parse input — key is a path param; validate against known keys
  const key = z.enum(VALID_KEYS).parse(req.query.key as string);

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const c = getClient();

  switch (req.method) {
    case 'GET': {
      const result = await c.execute({
        sql: 'SELECT value FROM settings WHERE key = ?',
        args: [key],
      });
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: 'Setting not found' });

      const value = row.value as string;
      if (SENSITIVE_KEYS.includes(key)) {
        return res.json({ key, value: value ? '••••••••' : '' });
      }
      return res.json({ key, value });
    }

    case 'PUT': {
      const parsed = settingSchema.safeParse({ key, value: req.body.value });
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid setting', details: parsed.error.flatten() });
      }
      await c.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        args: [parsed.data.key, parsed.data.value, parsed.data.value],
      });
      return res.json({ key: parsed.data.key, success: true });
    }

    case 'DELETE': {
      await c.execute({
        sql: 'DELETE FROM settings WHERE key = ?',
        args: [key],
      });
      return res.json({ success: true });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
