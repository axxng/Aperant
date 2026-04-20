import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { listUsers, getUserByEmail, createUserWithoutPassword } from '../../_lib/db/users.js';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  switch (req.method) {
    case 'GET': {
      const users = await listUsers();
      return res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at })));
    }

    case 'POST': {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const existing = await getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const id = uuid();
      await createUserWithoutPassword(id, parsed.data.email, parsed.data.name, parsed.data.role);
      return res.status(201).json({ id, email: parsed.data.email, name: parsed.data.name, role: parsed.data.role });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
