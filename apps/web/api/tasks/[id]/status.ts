import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { updateTask } from '../../_lib/db/tasks.js';
import { updateTaskStatusSchema } from '../../_lib/validation.js';
import { broadcastEvent } from '../../_lib/events.js';
import { syncTaskToGitHub } from '../../_lib/sync/github-writeback.js';

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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const result = updateTaskStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }

  const task = await updateTask(id, { status: result.data.status });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Sync status change to GitHub if task is linked
  let githubSyncStatus: 'synced' | 'failed' | 'pending' | undefined;
  if (task.githubRepo && task.githubIssueNumber) {
    const syncResult = await syncTaskToGitHub(task, { status: result.data.status });
    if (syncResult.success) {
      if (task.githubSyncPending) {
        await updateTask(id, { githubSyncPending: false });
      }
      githubSyncStatus = 'synced';
    } else {
      await updateTask(id, { githubSyncPending: true });
      githubSyncStatus = 'failed';
    }
  }

  await broadcastEvent('task_updated', task);
  res.json({ ...task, githubSyncStatus });
}
