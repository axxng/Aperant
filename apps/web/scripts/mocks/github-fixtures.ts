import type { Application, Request, Response } from 'express';
import { createToken } from '../../api/_lib/auth/jwt.js';
import { upsertOAuthUser, userCount } from '../../api/_lib/db/users.js';
import { ensureDb } from '../../api/_lib/db/client.js';

// ===== Pure fixture builders (exported for unit testing) =====

export type LabelFixture = {
  id: number;
  name: string;
  color: string;
  description: string | null;
};

export type IssueFixture = {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: LabelFixture[];
  assignees: Array<{ login: string; avatar_url: string }>;
  user: { login: string; avatar_url: string };
  milestone: null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  url: string;
  html_url: string;
};

const LABELS: LabelFixture[] = [
  { id: 1, name: 'bug', color: 'd73a4a', description: 'Something is broken' },
  { id: 2, name: 'enhancement', color: '0075ca', description: 'New feature request' },
  { id: 3, name: 'documentation', color: '0075ca', description: null },
  { id: 4, name: 'question', color: 'e4e669', description: null },
  { id: 5, name: 'good first issue', color: '7057ff', description: null },
];

const ISSUE_TITLES = [
  'Fix null pointer exception in auth flow',
  'Add pagination to issues list',
  'Improve error messages for rate limit',
  'Document API endpoints',
  'Refactor product settings component',
  'Support multiple assignees in filter bar',
  'Fix label color rendering',
  'Add keyboard shortcut for triage panel',
  'Implement sync state retry logic',
  'Handle closed issue warning in triage',
  'Add export to CSV feature',
  'Fix sidebar layout on mobile',
  'Improve performance of issues query',
  'Add issue detail print view',
  'Support dark mode for issue panel',
  'Fix redirect after OAuth login',
  'Add confirmation dialog for priority change',
  'Improve loading skeleton timing',
  'Fix race condition in sync state update',
  'Add filter persistence across page reload',
];

function repoIdBase(owner: string, repo: string): number {
  const str = `${owner}/${repo}`;
  return (str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 900 + 100) * 1000;
}

export function buildIssueFixtures(owner: string, repo: string): IssueFixture[] {
  const issues: IssueFixture[] = [];
  const now = new Date().toISOString();
  const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const idBase = repoIdBase(owner, repo);

  for (let i = 0; i < 20; i++) {
    const isOpen = i < 15; // 15 open + 5 closed
    const issueNumber = i + 1;
    const labelSubset = LABELS.slice(0, (i % 3) + 1); // 1–3 labels per issue
    issues.push({
      id: idBase + issueNumber,
      number: issueNumber,
      title: ISSUE_TITLES[i % ISSUE_TITLES.length]!,
      body: `Issue body for #${issueNumber} in ${owner}/${repo}. Describes the problem or feature in detail.`,
      state: isOpen ? 'open' : 'closed',
      labels: labelSubset,
      assignees: i % 3 === 0 ? [{ login: 'dev-admin', avatar_url: 'https://github.com/ghost.png' }] : [],
      user: { login: 'dev-admin', avatar_url: 'https://github.com/ghost.png' },
      milestone: null,
      created_at: past,
      updated_at: now,
      closed_at: isOpen ? null : now,
      comments: i % 4,
      url: `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      html_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
    });
  }
  return issues;
}

export function buildLabelFixtures(): LabelFixture[] {
  return LABELS;
}

// ===== Express mock route registration =====

export function registerMockRoutes(app: Application): void {
  if (process.env.MOCK_SERVICES !== 'true') throw new Error('registerMockRoutes must only be called when MOCK_SERVICES=true');
  // Mock OAuth initiate — redirect directly to callback (no real GitHub redirect)
  app.get('/api/auth/github', (_req: Request, res: Response) => {
    res.redirect(302, '/api/auth/github/callback');
  });

  // Mock OAuth callback — issue JWT for seeded admin user
  app.get('/api/auth/github/callback', async (_req: Request, res: Response) => {
    try {
      await ensureDb();
      const count = await userCount();
      const user = await upsertOAuthUser({
        githubId: 'mock-12345',
        email: 'dev-admin@github.invalid',
        name: 'Dev Admin',
        githubLogin: 'dev-admin',
        githubToken: 'mock-token',
        role: count === 0 ? 'admin' : 'member',
      });
      const jwt = createToken(user.id, user.email, user.role);
      res.redirect(302, `/?token=${jwt}`);
    } catch (err) {
      console.error('[mock] OAuth callback error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Mock OAuth error' });
    }
  });

  // Mock GitHub issues — returns PaginatedIssuesResult shape with camelCase fields (matching real handler)
  app.get('/api/github/repos/:owner/:repo/issues', (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const repoFullName = `${owner}/${repo}`;
    const issues = buildIssueFixtures(owner, repo).map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels.map((l) => ({ id: l.id, name: l.name, color: l.color, description: l.description ?? undefined })),
      assignees: issue.assignees.map((a) => ({ login: a.login, avatarUrl: a.avatar_url })),
      author: { login: issue.user.login, avatarUrl: issue.user.avatar_url },
      milestone: undefined,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at ?? undefined,
      commentsCount: issue.comments,
      url: issue.url,
      htmlUrl: issue.html_url,
      repoFullName,
    }));
    res.json({ issues, hasMore: false });
  });

  // Mock GitHub labels
  app.get('/api/github/repos/:owner/:repo/labels', (_req: Request, res: Response) => {
    res.json(buildLabelFixtures());
  });
}
