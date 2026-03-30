export interface GitLabProject {
  id: number;
  name: string;
  pathWithNamespace: string;
  description: string | null;
  webUrl: string;
  defaultBranch: string;
  visibility: 'private' | 'internal' | 'public';
  avatarUrl: string | null;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed';
  labels: string[];
  assignees: Array<{ id: number; name: string; username: string; avatarUrl: string | null }>;
  author: { id: number; name: string; username: string; avatarUrl: string | null };
  milestone: { id: number; title: string } | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  userNotesCount: number;
  webUrl: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  sourceBranch: string;
  targetBranch: string;
  author: { id: number; name: string; username: string; avatarUrl: string | null };
  assignees: Array<{ id: number; name: string; username: string; avatarUrl: string | null }>;
  labels: string[];
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  mergeStatus: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: { id: number; name: string; username: string };
  createdAt: string;
  system: boolean;
}
