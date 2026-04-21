import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest } from '../_lib/auth/middleware.js';
import { getUserById } from '../_lib/db/users.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  const dbUser = await getUserById(user.userId);
  if (!dbUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, githubLogin: dbUser.github_login ?? null });
}
