import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';
import { getAllTasks, getTasksByProduct, createTask } from '../_lib/db/tasks.js';
import { createTaskSchema } from '../_lib/validation.js';
import { broadcastEvent } from '../_lib/events.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  switch (req.method) {
    case 'GET': {
      const productId = req.query.productId as string | undefined;
      const tasks = productId ? await getTasksByProduct(productId) : await getAllTasks();
      return res.json(tasks);
    }

    case 'POST': {
      const result = createTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
      }
      const task = await createTask(result.data);
      await broadcastEvent('task_created', task);
      return res.status(201).json(task);
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
