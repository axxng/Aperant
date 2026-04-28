import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { getClient } from './client.js';
import { taskDbRowSchema } from '../validation.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatusKey, TaskOrderState, GithubSyncState } from '../../../src/shared/types/task.js';

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// === Pure domain logic ===

/** Build a GithubSyncState discriminated union from raw DB column values */
export function buildSyncState(pending: number, retryCount: number): GithubSyncState {
  if (pending === 1 && retryCount === 0) return { kind: 'pending' };
  if (pending === 1 && retryCount > 0) return { kind: 'retrying', retryCount };
  if (pending === 0 && retryCount > 0) return { kind: 'failed', retryCount };
  return { kind: 'idle' };
}

/** Map a raw DB task row to a typed Task discriminated union variant */
export function rowToTask(row: unknown): Task {
  const parsed = taskDbRowSchema.parse(row);

  const base = {
    id: parsed.id,
    productId: parsed.product_id,
    title: parsed.title,
    description: parsed.description,
    priority: parsed.priority ?? undefined,
    category: parsed.category ?? undefined,
    githubIssueNumber: parsed.github_issue_number ?? undefined,
    githubIssueUrl: parsed.github_issue_url ?? undefined,
    githubRepo: parsed.github_repo ?? undefined,
    githubProjectItemId: parsed.github_project_item_id ?? undefined,
    githubSyncState: buildSyncState(parsed.github_sync_pending, parsed.github_sync_retry_count),
    labels: safeJsonParse(parsed.labels, []),
    assignees: safeJsonParse(parsed.assignees, []),
    milestone: parsed.milestone ? safeJsonParse(parsed.milestone, undefined) : undefined,
    metadata: safeJsonParse(parsed.metadata, {}),
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };

  switch (parsed.status) {
    case 'backlog':
      return { ...base, status: 'backlog' };
    case 'queue':
      return { ...base, status: 'queue' };
    case 'in_progress':
      return { ...base, status: 'in_progress' };
    case 'done':
      return { ...base, status: 'done' };
    case 'ai_review':
      return { ...base, status: 'ai_review', reviewReason: parsed.review_reason ?? undefined } as Task;
    case 'human_review':
      return { ...base, status: 'human_review', reviewReason: parsed.review_reason ?? undefined } as Task;
    case 'error':
      return { ...base, status: 'error', reviewReason: parsed.review_reason ?? undefined } as Task;
    case 'pr_created':
      if (!parsed.github_issue_number || !parsed.github_issue_url || !parsed.github_repo) {
        throw new Error(
          `DB integrity: pr_created task ${parsed.id} is missing required GitHub fields`
        );
      }
      return {
        ...base,
        status: 'pr_created',
        githubIssueNumber: parsed.github_issue_number,
        githubIssueUrl:    parsed.github_issue_url,
        githubRepo:        parsed.github_repo,
      };
  }
}

/** Build the flat SQL args object for createTask — pure function, no side effects */
export function buildCreateTaskInput(
  input: CreateTaskInput,
  id: string,
  now: string,
): {
  id: string;
  product_id: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  category: string | null;
  github_issue_number: number | null;
  github_issue_url: string | null;
  github_repo: string | null;
  github_project_item_id: string | null;
  labels: string;
  assignees: string;
  metadata: string;
  created_at: string;
  updated_at: string;
} {
  return {
    id,
    product_id: input.productId,
    title: input.title,
    description: input.description,
    status: input.status || 'backlog',
    priority:               input.priority              ?? null,
    category:               input.category              ?? null,
    github_issue_number:    input.githubIssueNumber     ?? null,
    github_issue_url:       input.githubIssueUrl        ?? null,
    github_repo:            input.githubRepo            ?? null,
    github_project_item_id: input.githubProjectItemId   ?? null,
    labels: JSON.stringify(input.labels || []),
    assignees: JSON.stringify(input.assignees || []),
    metadata: JSON.stringify(input.metadata || {}),
    created_at: now,
    updated_at: now,
  };
}

/** Build SQL updates and values array from UpdateTaskInput — pure function, no side effects */
export function buildUpdateTaskFields(input: UpdateTaskInput): { updates: string[]; values: any[] } {
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

  return { updates, values };
}

// === Internal helper for write-back sync state updates ===

/** Write github_sync_pending and github_sync_retry_count directly — internal use only */
export async function updateTaskSyncState(id: string, pending: boolean, retryCount: number): Promise<void> {
  const now = new Date().toISOString();
  await getClient().execute({
    sql: 'UPDATE tasks SET github_sync_pending = ?, github_sync_retry_count = ?, updated_at = ? WHERE id = ?',
    args: [pending ? 1 : 0, retryCount, now, id],
  });
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
  const fields = buildCreateTaskInput(input, id, now);

  await getClient().execute({
    sql: `INSERT INTO tasks (id, product_id, title, description, status, priority, category,
            github_issue_number, github_issue_url, github_repo, github_project_item_id,
            labels, assignees, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      fields.id,
      fields.product_id,
      fields.title,
      fields.description,
      fields.status,
      fields.priority,
      fields.category,
      fields.github_issue_number,
      fields.github_issue_url,
      fields.github_repo,
      fields.github_project_item_id,
      fields.labels,
      fields.assignees,
      fields.metadata,
      fields.created_at,
      fields.updated_at,
    ],
  });

  return (await getTaskById(id))!;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const { updates, values } = buildUpdateTaskFields(input);

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

export async function getTasksPendingSync(): Promise<Task[]> {
  const result = await getClient().execute(
    'SELECT * FROM tasks WHERE github_sync_pending = 1'
  );
  return result.rows.map(rowToTask);
}

const taskStatuses = ['backlog', 'queue', 'in_progress', 'ai_review', 'human_review', 'done', 'pr_created', 'error'] as const;

export async function getTaskOrder(scope: string): Promise<TaskOrderState> {
  const result = await getClient().execute({
    sql: 'SELECT status, task_ids FROM task_order WHERE scope = ?',
    args: [scope],
  });

  const order: Partial<TaskOrderState> = {};
  for (const row of result.rows) {
    const statusKey = z.enum(taskStatuses).parse(row.status);
    order[statusKey] = safeJsonParse(row.task_ids as string, []);
  }

  for (const status of taskStatuses) {
    if (!order[status]) order[status] = [];
  }

  return order as TaskOrderState;
}

export async function setTaskOrder(scope: string, status: TaskStatusKey, taskIds: string[]): Promise<void> {
  await getClient().execute({
    sql: `INSERT INTO task_order (scope, status, task_ids) VALUES (?, ?, ?)
          ON CONFLICT(scope, status) DO UPDATE SET task_ids = excluded.task_ids`,
    args: [scope, status, JSON.stringify(taskIds)],
  });
}
