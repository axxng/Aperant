import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { updateTask } from '../../_lib/db/tasks.js';
import { updateTaskStatusSchema } from '../../_lib/validation.js';
import { broadcastEvent } from '../../_lib/events.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const id = req.query.id as string;

  const result = updateTaskStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }

  const task = await updateTask(id, { status: result.data.status });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  await broadcastEvent('task_updated', task);
  res.json(task);
}
