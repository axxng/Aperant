/**
 * Task types for the web platform.
 * Extends desktop task types with multi-product and GitHub sync support.
 */

/** String union of all valid task status keys — use for Record<> keys and string comparisons */
export type TaskStatusKey = 'backlog' | 'queue' | 'in_progress' | 'ai_review' | 'human_review' | 'done' | 'pr_created' | 'error';

/** Backward-compatible alias — use TaskStatusKey for new code */
export type TaskStatus = TaskStatusKey;

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'feature' | 'bug_fix' | 'refactoring' | 'documentation' | 'security' | 'performance' | 'ui_ux' | 'infrastructure' | 'testing';
export type ReviewReason = 'completed' | 'errors' | 'qa_rejected' | 'plan_review' | 'stopped';

/** GitHub sync state as discriminated union — replaces githubSyncPending/githubSyncRetryCount */
export type GithubSyncState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'retrying'; retryCount: number }
  | { kind: 'failed'; retryCount: number }
  | { kind: 'complete' };

/** Shared base fields for all task variants */
type TaskBase = {
  id: string;
  /** Product this task belongs to */
  productId: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  category?: TaskCategory;

  // GitHub sync fields
  /** GitHub issue number (within the repo) */
  githubIssueNumber?: number;
  /** GitHub issue URL */
  githubIssueUrl?: string;
  /** GitHub repo in owner/repo format */
  githubRepo?: string;
  /** GitHub Project item ID (for board sync) */
  githubProjectItemId?: string;
  /** GitHub sync state (replaces githubSyncPending/githubSyncRetryCount) */
  githubSyncState?: GithubSyncState;

  // GitHub issue metadata (synced)
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string; avatarUrl?: string }>;
  milestone?: { title: string; state: 'open' | 'closed' };

  // Metadata
  metadata?: TaskMetadata;

  createdAt: string;
  updatedAt: string;
};

/** Discriminated union of all task status variants — illegal states unrepresentable */
export type Task =
  | (TaskBase & { status: 'backlog' })
  | (TaskBase & { status: 'queue' })
  | (TaskBase & { status: 'in_progress' })
  | (TaskBase & { status: 'ai_review'; reviewReason: ReviewReason })
  | (TaskBase & { status: 'human_review'; reviewReason: ReviewReason })
  | (TaskBase & { status: 'done' })
  | (TaskBase & { status: 'pr_created'; githubIssueNumber: number; githubIssueUrl: string; githubRepo: string })
  | (TaskBase & { status: 'error'; reviewReason: ReviewReason });

export interface TaskMetadata {
  sourceType?: 'github' | 'manual';
  complexity?: 'trivial' | 'small' | 'medium' | 'large' | 'complex';
  impact?: 'low' | 'medium' | 'high' | 'critical';
  rationale?: string;
  affectedFiles?: string[];
  acceptanceCriteria?: string[];
}

/** Task creation input */
export interface CreateTaskInput {
  productId: string;
  title: string;
  description: string;
  status?: TaskStatusKey;
  priority?: TaskPriority;
  category?: TaskCategory;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  githubRepo?: string;
  githubProjectItemId?: string;
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string; avatarUrl?: string }>;
  metadata?: TaskMetadata;
}

/** Task update input */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatusKey;
  priority?: TaskPriority;
  category?: TaskCategory;
  reviewReason?: ReviewReason;
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string; avatarUrl?: string }>;
  metadata?: TaskMetadata;
  /** Optimistic concurrency token — must match server's updatedAt to avoid 409 */
  updatedAt?: string;
}

/** Per-column task ordering — keyed by TaskStatusKey string union */
export type TaskOrderState = Record<TaskStatusKey, string[]>;

/** Ordering scope — either a product ID or 'consolidated' for the unified view */
export type OrderScope = string;
