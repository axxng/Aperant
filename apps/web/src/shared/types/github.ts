/**
 * GitHub integration types for the web platform.
 */

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{ id: number; name: string; color: string; description?: string }>;
  assignees: Array<{ login: string; avatarUrl?: string }>;
  author: { login: string; avatarUrl?: string };
  milestone?: { id: number; title: string; state: 'open' | 'closed' };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  commentsCount: number;
  url: string;
  htmlUrl: string;
  repoFullName: string;
}

export interface GitHubProjectItem {
  id: string;
  contentId: number;
  contentType: 'Issue' | 'PullRequest' | 'DraftIssue';
  issue?: {
    number: number;
    title: string;
    state: 'OPEN' | 'CLOSED';
    body?: string;
    labels: Array<{ name: string; color: string }>;
    assignees: Array<{ login: string; avatarUrl?: string }>;
    repository: { nameWithOwner: string };
    url: string;
  };
  /** The column/status field value from the GitHub Project board */
  statusFieldValue?: string;
}

export interface GitHubProjectInfo {
  id: string;
  title: string;
  number: number;
  owner: string;
  /** Available status field options (board columns) */
  statusOptions: Array<{ id: string; name: string }>;
}

export interface SyncState {
  productId: string;
  sourceKey: string;
  lastSyncedAt?: string;
  etag?: string;
  cursor?: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  closed: number;
  errors: string[];
}

export interface PaginatedIssuesResult {
  issues: GitHubIssue[];
  hasMore: boolean;
}
