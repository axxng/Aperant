export type ChangelogFormat = 'keep-a-changelog' | 'simple-list' | 'github-release';
export type ChangelogAudience = 'technical' | 'user-facing' | 'marketing';
export type ChangelogSourceMode = 'tasks' | 'git-history' | 'branch-diff';

export interface GitCommit {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export interface ChangelogConfig {
  sourceMode: ChangelogSourceMode;
  version: string;
  date: string;
  format: ChangelogFormat;
  audience: ChangelogAudience;
  customInstructions?: string;
}

export interface ChangelogSession {
  id: string;
  productId: string;
  content: string;
  config: ChangelogConfig;
  createdAt: string;
  updatedAt: string;
}

export type ChangelogPhase = 'idle' | 'loading' | 'generating' | 'complete' | 'error';
