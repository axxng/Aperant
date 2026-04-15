import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest } from '../_lib/auth/middleware.js';
import { getEventsSince } from '../_lib/events.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  const since = (req.query.since as string) || new Date(Date.now() - 30_000).toISOString().replace('T', ' ').replace('Z', '');
  const events = await getEventsSince(since);

  res.json({ events });
}
