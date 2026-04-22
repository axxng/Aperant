import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { getTaskById, updateTask, updateTaskSyncState } from '../../_lib/db/tasks.js';
import { updateTaskStatusSchema } from '../../_lib/validation.js';
import { broadcastEvent } from '../../_lib/events.js';
import { syncTaskToGitHub } from '../../_lib/sync/github-writeback.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — id is a path param (programmer bug if invalid → throws → 500)
  const id = z.string().uuid().parse(req.query.id as string);
  // body is user input → safeParse + 400
  const result = updateTaskStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;
  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Optimistic concurrency check
  if (result.data.updatedAt) {
    const current = await getTaskById(id);
    if (!current) return res.status(404).json({ error: 'Task not found' });
    if (current.updatedAt !== result.data.updatedAt) {
      return res.status(409).json({ error: 'Task was modified by another user. Please refresh and try again.' });
    }
  }

  const task = await updateTask(id, { status: result.data.status });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Sync status change to GitHub if task is linked
  let githubSyncStatus: 'synced' | 'failed' | 'pending' | undefined;
  if (task.githubRepo && task.githubIssueNumber) {
    const syncResult = await syncTaskToGitHub(task, { status: result.data.status });
    if (syncResult.success) {
      await updateTaskSyncState(id, false, 0);
      githubSyncStatus = 'synced';
    } else {
      await updateTaskSyncState(id, true, 0);
      githubSyncStatus = 'failed';
    }
  }

  const freshTask = await getTaskById(id);
  await broadcastEvent('task_updated', freshTask || task);
  res.json({ ...freshTask || task, githubSyncStatus });
}
