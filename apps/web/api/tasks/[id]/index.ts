import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { getTaskById, updateTask, deleteTask, updateTaskSyncState } from '../../_lib/db/tasks.js';
import { updateTaskSchema } from '../../_lib/validation.js';
import { broadcastEvent } from '../../_lib/events.js';
import { syncTaskToGitHub } from '../../_lib/sync/github-writeback.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  // 1. Parse input — id is a path param (programmer bug if invalid → throws → 500)
  const id = z.string().uuid().parse(req.query.id as string);

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

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

      // Optimistic concurrency check
      if (result.data.updatedAt) {
        const current = await getTaskById(id);
        if (!current) return res.status(404).json({ error: 'Task not found' });
        if (current.updatedAt !== result.data.updatedAt) {
          return res.status(409).json({ error: 'Task was modified by another user. Please refresh and try again.' });
        }
      }

      // Strip updatedAt from update payload (it's for concurrency check only)
      const { updatedAt: _updatedAt, ...updateData } = result.data;
      const task = await updateTask(id, updateData);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // Sync changes to GitHub if task is linked
      let githubSyncStatus: 'synced' | 'failed' | 'pending' | undefined;
      if (task.githubRepo && task.githubIssueNumber) {
        const syncResult = await syncTaskToGitHub(task, updateData);
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
      return res.json({ ...freshTask || task, githubSyncStatus });
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
