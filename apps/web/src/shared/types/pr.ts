export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  author: { login: string; avatarUrl?: string };
  headRefName: string;
  baseRefName: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }>;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  draft: boolean;
}

export interface PRFile {
  path: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  patch?: string;
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FindingCategory = 'security' | 'quality' | 'logic' | 'performance' | 'style';

export interface PRReviewFinding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  file: string;
  line?: number;
  suggestedFix?: string;
}

export interface PRReviewResult {
  prNumber: number;
  success: boolean;
  findings: PRReviewFinding[];
  summary: string;
  overallStatus: 'approve' | 'request_changes' | 'comment';
  reviewedAt: string;
  durationMs: number;
}

export interface PaginatedPRsResult {
  pullRequests: GitHubPR[];
  hasMore: boolean;
  page: number;
}
