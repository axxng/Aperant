import { Router } from 'express';
import * as tasksDb from '../db/tasks.js';
import type { TaskStatus } from '../../shared/types/task.js';

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
  const { taskIds } = req.body;
  if (!Array.isArray(taskIds)) {
    return res.status(400).json({ error: 'taskIds array is required' });
  }
  tasksDb.setTaskOrder(req.params.scope, req.params.status as TaskStatus, taskIds);
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
  const { productId, title, description } = req.body;
  if (!productId || !title) {
    return res.status(400).json({ error: 'productId and title are required' });
  }
  const task = tasksDb.createTask({ ...req.body, description: description || '' });
  res.status(201).json(task);
});

// PATCH /api/tasks/:id — update task
taskRoutes.patch('/:id', (req, res) => {
  const task = tasksDb.updateTask(req.params.id, req.body);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// PATCH /api/tasks/:id/status — update task status (convenience for drag-and-drop)
taskRoutes.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const task = tasksDb.updateTask(req.params.id, { status });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// DELETE /api/tasks/:id — delete task
taskRoutes.delete('/:id', (req, res) => {
  const deleted = tasksDb.deleteTask(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});
