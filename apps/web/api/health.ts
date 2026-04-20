import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from './_lib/db/client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}
