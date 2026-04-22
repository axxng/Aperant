import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';
import { getAllTasks, getTasksByProduct, createTask, getTaskByGitHubIssue } from '../_lib/db/tasks.js';
import { createTaskSchema } from '../_lib/validation.js';
import { broadcastEvent } from '../_lib/events.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  switch (req.method) {
    case 'GET': {
      // 1. Parse input — optional productId query param
      const productId = req.query.productId
        ? z.string().uuid().parse(req.query.productId as string)
        : undefined;
      // 2. Authorize
      const user = await authenticateRequest(req, res);
      if (!user) return;
      if (!hasRole(user, 'admin', 'member')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      // 3. DB call
      const tasks = productId ? await getTasksByProduct(productId) : await getAllTasks();
      // 4. Respond
      return res.json(tasks);
    }

    case 'POST': {
      // 1. Parse input — user-submitted body → safeParse + 400
      const result = createTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
      }
      // 2. Authorize
      const user = await authenticateRequest(req, res);
      if (!user) return;
      if (!hasRole(user, 'admin', 'member')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      // 3. DB call — wrapped in try/catch to intercept UNIQUE constraint violation
      try {
        const task = await createTask(result.data);
        await broadcastEvent('task_created', task);
        // 4. Respond
        return res.status(201).json(task);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('UNIQUE constraint failed')) {
          // Return existing task so client can show "View in Backlog" badge (PROMOTE-05)
          const existing = await getTaskByGitHubIssue(
            result.data.githubRepo!,
            result.data.githubIssueNumber!
          );
          return res.status(409).json({
            error: 'This issue is already in the backlog.',
            existingTask: existing,
          });
        }
        throw err;
      }
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
