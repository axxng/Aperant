import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { getTaskById, updateTask, deleteTask } from '../../_lib/db/tasks.js';
import { updateTaskSchema } from '../../_lib/validation.js';
import { broadcastEvent } from '../../_lib/events.js';
import { syncTaskToGitHub } from '../../_lib/sync/github-writeback.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const id = req.query.id as string;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
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
      const task = await updateTask(id, result.data);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // Sync changes to GitHub if task is linked
      let githubSyncStatus: 'synced' | 'failed' | 'pending' | undefined;
      if (task.githubRepo && task.githubIssueNumber) {
        const syncResult = await syncTaskToGitHub(task, result.data);
        if (syncResult.success) {
          await updateTask(id, { githubSyncPending: false, githubSyncRetryCount: 0 });
          githubSyncStatus = 'synced';
        } else {
          await updateTask(id, { githubSyncPending: true });
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
