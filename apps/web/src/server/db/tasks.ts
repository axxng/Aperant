import { v4 as uuid } from 'uuid';
import { getDb } from './schema.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskOrderState } from '../../shared/types/task.js';

export function getTasksByProduct(productId: string): Task[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tasks WHERE product_id = ? ORDER BY created_at DESC').all(productId) as any[];
  return rows.map(rowToTask);
}

export function getAllTasks(): Task[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as any[];
  return rows.map(rowToTask);
}

export function getTaskById(id: string): Task | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  return row ? rowToTask(row) : null;
}

export function getTaskByGitHubIssue(repo: string, issueNumber: number): Task | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM tasks WHERE github_repo = ? AND github_issue_number = ?'
  ).get(repo, issueNumber) as any;
  return row ? rowToTask(row) : null;
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, product_id, title, description, status, priority, category,
      github_issue_number, github_issue_url, github_repo, github_project_item_id,
      labels, assignees, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.productId,
    input.title,
    input.description,
    input.status || 'backlog',
    input.priority || null,
    input.category || null,
    input.githubIssueNumber || null,
    input.githubIssueUrl || null,
    input.githubRepo || null,
    input.githubProjectItemId || null,
    JSON.stringify(input.labels || []),
    JSON.stringify(input.assignees || []),
    JSON.stringify(input.metadata || {}),
    now,
    now,
  );

  return getTaskById(id)!;
}

export function updateTask(id: string, input: UpdateTaskInput): Task | null {
  const db = getDb();
  const existing = getTaskById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
  if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
  if (input.status !== undefined) { updates.push('status = ?'); values.push(input.status); }
  if (input.priority !== undefined) { updates.push('priority = ?'); values.push(input.priority); }
  if (input.category !== undefined) { updates.push('category = ?'); values.push(input.category); }
  if (input.reviewReason !== undefined) { updates.push('review_reason = ?'); values.push(input.reviewReason); }
  if (input.labels !== undefined) { updates.push('labels = ?'); values.push(JSON.stringify(input.labels)); }
  if (input.assignees !== undefined) { updates.push('assignees = ?'); values.push(JSON.stringify(input.assignees)); }
  if (input.metadata !== undefined) { updates.push('metadata = ?'); values.push(JSON.stringify(input.metadata)); }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getTaskById(id)!;
}

export function deleteTask(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

// Task ordering
export function getTaskOrder(scope: string): TaskOrderState {
  const db = getDb();
  const rows = db.prepare('SELECT status, task_ids FROM task_order WHERE scope = ?').all(scope) as any[];
  const order: Partial<TaskOrderState> = {};
  for (const row of rows) {
    order[row.status as TaskStatus] = JSON.parse(row.task_ids);
  }
  // Fill missing statuses with empty arrays
  const statuses: TaskStatus[] = ['backlog', 'queue', 'in_progress', 'ai_review', 'human_review', 'done', 'pr_created', 'error'];
  for (const status of statuses) {
    if (!order[status]) order[status] = [];
  }
  return order as TaskOrderState;
}

export function setTaskOrder(scope: string, status: TaskStatus, taskIds: string[]): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO task_order (scope, status, task_ids) VALUES (?, ?, ?)
    ON CONFLICT(scope, status) DO UPDATE SET task_ids = excluded.task_ids
  `).run(scope, status, JSON.stringify(taskIds));
}

function rowToTask(row: any): Task {
  return {
    id: row.id,
    productId: row.product_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    reviewReason: row.review_reason || undefined,
    priority: row.priority || undefined,
    category: row.category || undefined,
    githubIssueNumber: row.github_issue_number || undefined,
    githubIssueUrl: row.github_issue_url || undefined,
    githubRepo: row.github_repo || undefined,
    githubProjectItemId: row.github_project_item_id || undefined,
    labels: JSON.parse(row.labels || '[]'),
    assignees: JSON.parse(row.assignees || '[]'),
    milestone: row.milestone ? JSON.parse(row.milestone) : undefined,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
