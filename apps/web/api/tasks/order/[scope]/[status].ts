import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../../_lib/auth/middleware.js';
import { setTaskOrder } from '../../../_lib/db/tasks.js';
import { setTaskOrderSchema } from '../../../_lib/validation.js';
import { broadcastEvent } from '../../../_lib/events.js';
import type { TaskStatusKey } from '../../../../src/shared/types/task.js';
import { z } from 'zod';

const taskStatusEnum = z.enum(['backlog', 'queue', 'in_progress', 'ai_review', 'human_review', 'done', 'pr_created', 'error']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — path params and body
  const scope = z.string().min(1).parse(req.query.scope as string);
  const validatedStatus: TaskStatusKey = taskStatusEnum.parse(req.query.status as string);
  const result = setTaskOrderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  await setTaskOrder(scope, validatedStatus, result.data.taskIds);
  await broadcastEvent('tasks_reordered', { scope, status });
  res.json({ success: true });
}
