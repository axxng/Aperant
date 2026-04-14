import { v4 as uuid } from 'uuid';
import { getClient } from './client.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskOrderState } from '../../../src/shared/types/task.js';

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function getTasksByProduct(productId: string): Promise<Task[]> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM tasks WHERE product_id = ? ORDER BY created_at DESC',
    args: [productId],
  });
  return result.rows.map(rowToTask);
}

export async function getAllTasks(): Promise<Task[]> {
  const result = await getClient().execute('SELECT * FROM tasks ORDER BY created_at DESC');
  return result.rows.map(rowToTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM tasks WHERE id = ?',
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToTask(row) : null;
}

export async function getTaskByGitHubIssue(repo: string, issueNumber: number): Promise<Task | null> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM tasks WHERE github_repo = ? AND github_issue_number = ?',
    args: [repo, issueNumber],
  });
  const row = result.rows[0];
  return row ? rowToTask(row) : null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const id = uuid();
  const now = new Date().toISOString();

  await getClient().execute({
    sql: `INSERT INTO tasks (id, product_id, title, description, status, priority, category,
            github_issue_number, github_issue_url, github_repo, github_project_item_id,
            labels, assignees, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
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
    ],
  });

  return (await getTaskById(id))!;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
  const existing = await getTaskById(id);
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

  await getClient().execute({
    sql: `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
    args: values,
  });

  return (await getTaskById(id))!;
}

export async function deleteTask(id: string): Promise<boolean> {
  const result = await getClient().execute({
    sql: 'DELETE FROM tasks WHERE id = ?',
    args: [id],
  });
  return result.rowsAffected > 0;
}

export async function getTaskOrder(scope: string): Promise<TaskOrderState> {
  const result = await getClient().execute({
    sql: 'SELECT status, task_ids FROM task_order WHERE scope = ?',
    args: [scope],
  });

  const order: Partial<TaskOrderState> = {};
  for (const row of result.rows) {
    order[row.status as TaskStatus] = safeJsonParse(row.task_ids as string, []);
  }

  const statuses: TaskStatus[] = ['backlog', 'queue', 'in_progress', 'ai_review', 'human_review', 'done', 'pr_created', 'error'];
  for (const status of statuses) {
    if (!order[status]) order[status] = [];
  }

  return order as TaskOrderState;
}

export async function setTaskOrder(scope: string, status: TaskStatus, taskIds: string[]): Promise<void> {
  await getClient().execute({
    sql: `INSERT INTO task_order (scope, status, task_ids) VALUES (?, ?, ?)
          ON CONFLICT(scope, status) DO UPDATE SET task_ids = excluded.task_ids`,
    args: [scope, status, JSON.stringify(taskIds)],
  });
}

function rowToTask(row: any): Task {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    reviewReason: (row.review_reason as Task['reviewReason']) || undefined,
    priority: (row.priority as Task['priority']) || undefined,
    category: (row.category as Task['category']) || undefined,
    githubIssueNumber: row.github_issue_number ? Number(row.github_issue_number) : undefined,
    githubIssueUrl: (row.github_issue_url as string) || undefined,
    githubRepo: (row.github_repo as string) || undefined,
    githubProjectItemId: (row.github_project_item_id as string) || undefined,
    labels: safeJsonParse(row.labels as string, []),
    assignees: safeJsonParse(row.assignees as string, []),
    milestone: row.milestone ? safeJsonParse(row.milestone as string, undefined) : undefined,
    metadata: safeJsonParse(row.metadata as string, {}),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
