import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { updateUser, deleteUser } from '../../_lib/db/users.js';

const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const id = req.query.id as string;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  switch (req.method) {
    case 'PATCH': {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input' });
      }
      await updateUser(id, parsed.data);
      return res.json({ success: true });
    }

    case 'DELETE': {
      if (user.userId === id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }
      await deleteUser(id);
      return res.json({ success: true });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
