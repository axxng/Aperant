import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { getTaskById, updateTask, deleteTask } from '../../_lib/db/tasks.js';
import { updateTaskSchema } from '../../_lib/validation.js';
import { broadcastEvent } from '../../_lib/events.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const id = req.query.id as string;

  switch (req.method) {
    case 'GET': {
      const task = await getTaskById(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      return res.json(task);
    }

    case 'PATCH': {
      const result = updateTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
      }
      const task = await updateTask(id, result.data);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      await broadcastEvent('task_updated', task);
      return res.json(task);
    }

    case 'DELETE': {
      const deleted = await deleteTask(id);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      await broadcastEvent('task_deleted', { id });
      return res.json({ success: true });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
