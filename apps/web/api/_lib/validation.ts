import { z } from 'zod';

// Reusable schemas
const uuidSchema = z.string().uuid();
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color');

const taskStatuses = ['backlog', 'queue', 'in_progress', 'ai_review', 'human_review', 'done', 'pr_created', 'error'] as const;
const taskPriorities = ['low', 'medium', 'high', 'urgent'] as const;
const taskCategories = ['feature', 'bug_fix', 'refactoring', 'documentation', 'security', 'performance', 'ui_ux', 'infrastructure', 'testing'] as const;
const reviewReasons = ['completed', 'errors', 'qa_rejected', 'plan_review', 'stopped'] as const;

// Product source schemas
const repoSourceSchema = z.object({
  type: z.literal('repo'),
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
});

const multiRepoSourceSchema = z.object({
  type: z.literal('repos'),
  repos: z.array(z.object({ owner: z.string().min(1).max(100), repo: z.string().min(1).max(100) })).min(1).max(50),
});

const githubProjectSourceSchema = z.object({
  type: z.literal('github_project'),
  owner: z.string().min(1).max(100),
  projectNumber: z.number().int().positive(),
});

const gitlabProjectSourceSchema = z.object({
  type: z.literal('gitlab_project'),
  path: z.string().min(1).max(255),
});

const productSourceSchema = z.discriminatedUnion('type', [repoSourceSchema, multiRepoSourceSchema, githubProjectSourceSchema, gitlabProjectSourceSchema]);

const statusMappingSchema = z.record(z.string().max(100), z.enum(taskStatuses));

// Product schemas
export const createProductSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional(),
  color: hexColorSchema.optional(),
  sources: z.array(productSourceSchema).min(1).max(20),
  statusMapping: statusMappingSchema.optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).optional(),
  color: hexColorSchema.optional(),
  sources: z.array(productSourceSchema).min(1).max(20).optional(),
  statusMapping: statusMappingSchema.optional(),
});

// Task schemas
const labelSchema = z.object({ name: z.string().max(100), color: z.string().max(20) });
const assigneeSchema = z.object({ login: z.string().max(100), avatarUrl: z.string().url().optional() });

const taskMetadataSchema = z.object({
  sourceType: z.enum(['github', 'manual']).optional(),
  complexity: z.enum(['trivial', 'small', 'medium', 'large', 'complex']).optional(),
  impact: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  rationale: z.string().max(5000).optional(),
  affectedFiles: z.array(z.string().max(500)).max(100).optional(),
  acceptanceCriteria: z.array(z.string().max(1000)).max(50).optional(),
}).optional();

export const createTaskSchema = z.object({
  productId: uuidSchema,
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(50000).default(''),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  category: z.enum(taskCategories).optional(),
  githubIssueNumber: z.number().int().positive().optional(),
  githubIssueUrl: z.string().url().optional(),
  githubRepo: z.string().max(201).regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Must be in owner/repo format').optional(),
  githubProjectItemId: z.string().max(100).optional(),
  labels: z.array(labelSchema).max(50).optional(),
  assignees: z.array(assigneeSchema).max(50).optional(),
  metadata: taskMetadataSchema,
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().max(50000).optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  category: z.enum(taskCategories).optional(),
  reviewReason: z.enum(reviewReasons).optional(),
  labels: z.array(labelSchema).max(50).optional(),
  assignees: z.array(assigneeSchema).max(50).optional(),
  metadata: taskMetadataSchema,
  updatedAt: z.string().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(taskStatuses),
  updatedAt: z.string().optional(),
});

export const setTaskOrderSchema = z.object({
  taskIds: z.array(uuidSchema).max(1000),
});

// GitHub route schemas
export const githubIssueQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.string().regex(/^\d+$/).default('1'),
  per_page: z.string().regex(/^\d+$/).default('50'),
  labels: z.string().optional(),   // comma-separated GitHub label names, passed through as-is
  assignee: z.string().optional(), // single GitHub login string
});

export const githubCommentSchema = z.object({
  body: z.string().min(1).max(65536),
});

// GitHub update issue — allow only safe fields
export const githubUpdateIssueSchema = z.object({
  state: z.enum(['open', 'closed']).optional(),
  title: z.string().min(1).max(500).optional(),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string().max(100)).max(50).optional(),
  assignees: z.array(z.string().max(100)).max(50).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required' });

// Triage batch query row — lightweight schema (only columns used by batch endpoint)
export const triageBatchRowSchema = z.object({
  github_issue_number: z.number(),
  is_triaged: z.number(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).nullable(),
});

// Path parameter schemas
export const githubOwnerRepoSchema = z.object({
  owner: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
});

export const githubOwnerNumberSchema = z.object({
  owner: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  number: z.string().regex(/^\d+$/),
});

// GitHub PR creation
export const githubCreatePRSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().max(65536).optional(),
  head: z.string().min(1).max(255),
  base: z.string().min(1).max(255),
  draft: z.boolean().optional(),
});

// GitHub PR list query
export const githubPRQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.string().regex(/^\d+$/).default('1'),
  per_page: z.string().regex(/^\d+$/).default('30'),
});

// DB row schemas — used for parse-don't-validate at the DB boundary

export const taskDbRowSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['backlog', 'queue', 'in_progress', 'ai_review', 'human_review', 'done', 'pr_created', 'error']),
  review_reason: z.enum(['completed', 'errors', 'qa_rejected', 'plan_review', 'stopped']).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).nullable().optional(),
  category: z.enum(['feature', 'bug_fix', 'refactoring', 'documentation', 'security', 'performance', 'ui_ux', 'infrastructure', 'testing']).nullable().optional(),
  github_issue_number: z.number().nullable().optional(),
  github_issue_url: z.string().nullable().optional(),
  github_repo: z.string().nullable().optional(),
  github_project_item_id: z.string().nullable().optional(),
  labels: z.string().nullable().optional(),
  assignees: z.string().nullable().optional(),
  milestone: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
  github_sync_pending: z.number(),
  github_sync_retry_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const productDbRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  color: z.string(),
  sources: z.string(),
  status_mapping: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const triageDbRowSchema = z.object({
  github_repo: z.string(),
  github_issue_number: z.number(),
  is_triaged: z.number(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).nullable(),
  github_comment_id: z.number().nullable(),
  comment_status: z.enum(['posted', 'failed']).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// GitHub API response schemas
export const gitHubApiIssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable().optional(),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.object({
    id: z.number(),
    name: z.string(),
    color: z.string(),
    description: z.string().nullable().optional(),
  })).default([]),
  assignees: z.array(z.object({
    login: z.string(),
    avatar_url: z.string().optional(),
  })).default([]),
  user: z.object({ login: z.string(), avatar_url: z.string().optional() }),
  milestone: z.object({
    id: z.number(),
    title: z.string(),
    state: z.enum(['open', 'closed']),
  }).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  comments: z.number().default(0),
  url: z.string(),
  html_url: z.string(),
  pull_request: z.unknown().optional(),
});

export const gitHubApiPRSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable().optional(),
  state: z.enum(['open', 'closed']),
  merged_at: z.string().nullable().optional(),
  user: z.object({ login: z.string(), avatar_url: z.string().optional() }).nullable().optional(),
  head: z.object({ ref: z.string() }),
  base: z.object({ ref: z.string() }),
  additions: z.number().default(0),
  deletions: z.number().default(0),
  changed_files: z.number().default(0),
  labels: z.array(z.object({ name: z.string(), color: z.string() })).default([]),
  assignees: z.array(z.object({ login: z.string() })).default([]),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string(),
  draft: z.boolean().default(false),
});

// OAuth response schemas
export const oauthTokenResponseSchema = z.object({
  access_token: z.string(),
  error: z.string().optional(),
});

export const gitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});
