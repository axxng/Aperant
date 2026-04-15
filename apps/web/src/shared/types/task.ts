/**
 * Task types for the web platform.
 * Extends desktop task types with multi-product and GitHub sync support.
 */

export type TaskStatus = 'backlog' | 'queue' | 'in_progress' | 'ai_review' | 'human_review' | 'done' | 'pr_created' | 'error';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'feature' | 'bug_fix' | 'refactoring' | 'documentation' | 'security' | 'performance' | 'ui_ux' | 'infrastructure' | 'testing';
export type ReviewReason = 'completed' | 'errors' | 'qa_rejected' | 'plan_review' | 'stopped';

export interface Task {
  id: string;
  /** Product this task belongs to */
  productId: string;
  title: string;
  description: string;
  status: TaskStatus;
  reviewReason?: ReviewReason;
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
  /** Whether this task has pending changes to sync to GitHub */
  githubSyncPending?: boolean;

  // GitHub issue metadata (synced)
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string; avatarUrl?: string }>;
  milestone?: { title: string; state: 'open' | 'closed' };

  // Metadata
  metadata?: TaskMetadata;

  createdAt: string;
  updatedAt: string;
}

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
  status?: TaskStatus;
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
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  reviewReason?: ReviewReason;
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string; avatarUrl?: string }>;
  metadata?: TaskMetadata;
  githubSyncPending?: boolean;
}

/** Per-column task ordering */
export type TaskOrderState = Record<TaskStatus, string[]>;

/** Ordering scope — either a product ID or 'consolidated' for the unified view */
export type OrderScope = string;
