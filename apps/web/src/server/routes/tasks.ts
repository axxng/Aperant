import { Router } from 'express';
import * as tasksDb from '../db/tasks.js';
import type { TaskStatus } from '../../shared/types/task.js';
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema, setTaskOrderSchema } from '../validation.js';
import { broadcastEvent } from './events.js';

export const taskRoutes = Router();

// GET /api/tasks — list tasks (optional ?productId= filter for per-product, omit for consolidated)
taskRoutes.get('/', (req, res) => {
  const productId = req.query.productId as string | undefined;
  const tasks = productId ? tasksDb.getTasksByProduct(productId) : tasksDb.getAllTasks();
  res.json(tasks);
});

// GET /api/tasks/order/:scope — get task ordering for a scope (productId or 'consolidated')
// NOTE: Must be defined BEFORE /:id routes to avoid 'order' being parsed as an id
taskRoutes.get('/order/:scope', (req, res) => {
  const order = tasksDb.getTaskOrder(req.params.scope);
  res.json(order);
});

// PUT /api/tasks/order/:scope/:status — update task ordering for a column
taskRoutes.put('/order/:scope/:status', (req, res) => {
  const result = setTaskOrderSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }
  tasksDb.setTaskOrder(req.params.scope, req.params.status as TaskStatus, result.data.taskIds);
  broadcastEvent('tasks_reordered', { scope: req.params.scope, status: req.params.status });
  res.json({ success: true });
});

// GET /api/tasks/:id — get single task
taskRoutes.get('/:id', (req, res) => {
  const task = tasksDb.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks — create task
taskRoutes.post('/', (req, res) => {
  const result = createTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }
  const task = tasksDb.createTask(result.data);
  broadcastEvent('task_created', task);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id — update task
taskRoutes.patch('/:id', (req, res) => {
  const result = updateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }
  const task = tasksDb.updateTask(req.params.id, result.data);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  broadcastEvent('task_updated', task);
  res.json(task);
});

// PATCH /api/tasks/:id/status — update task status (convenience for drag-and-drop)
taskRoutes.patch('/:id/status', (req, res) => {
  const result = updateTaskStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }
  const task = tasksDb.updateTask(req.params.id, { status: result.data.status });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  broadcastEvent('task_updated', task);
  res.json(task);
});

// DELETE /api/tasks/:id — delete task
taskRoutes.delete('/:id', (req, res) => {
  const deleted = tasksDb.deleteTask(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
  broadcastEvent('task_deleted', { id: req.params.id });
  res.json({ success: true });
});
