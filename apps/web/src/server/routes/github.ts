import { Router } from 'express';
import { getProductById } from '../db/products.js';
import { githubIssueQuerySchema, githubCommentSchema, githubUpdateIssueSchema, githubCreatePRSchema, githubOwnerRepoSchema, githubPRQuerySchema } from '../validation.js';
import type { GitHubPR, PRFile } from '../../shared/types/pr.js';

import { resolveConfig } from '../config-resolver.js';

export const githubRoutes = Router();

const GITHUB_API = 'https://api.github.com';

function getGitHubToken(): string {
  const token = resolveConfig('githubToken', 'GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return token;
}

async function githubFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getGitHubToken();
  return fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
}

async function githubGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  const token = getGitHubToken();
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL error: ${data.errors.map((e: any) => e.message).join(', ')}`);
  }
  return data.data;
}

// GET /api/github/repos/:owner/:repo/issues — list issues from a repo
githubRoutes.get('/repos/:owner/:repo/issues', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const queryResult = githubIssueQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    const { state, page, per_page } = queryResult.data;
    const params = new URLSearchParams({ state, page, per_page, sort: 'updated', direction: 'desc' });
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params}`
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    const issues = await response.json();
    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const filteredIssues = issues.filter((issue: any) => !issue.pull_request);
    const mapped = filteredIssues.map(mapGitHubIssue(owner, repo));
    const linkHeader = response.headers.get('Link');
    const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;
    res.json({ issues: mapped, hasMore });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/github/projects/:owner/:number — get GitHub Project info
githubRoutes.get('/projects/:owner/:number', async (req, res) => {
  try {
    const { owner, number: projectNumber } = req.params;
    const data = await githubGraphQL(PROJECT_INFO_QUERY, { owner, number: parseInt(projectNumber, 10) });

    const project = data.user?.projectV2 || data.organization?.projectV2;
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const statusField = project.fields?.nodes?.find(
      (f: any) => f.name === 'Status' && f.__typename === 'ProjectV2SingleSelectField'
    );

    res.json({
      id: project.id,
      title: project.title,
      number: parseInt(projectNumber, 10),
      owner,
      statusOptions: statusField?.options?.map((o: any) => ({ id: o.id, name: o.name })) || [],
    });
  } catch (error: any) {
    // Try as org if user fails
    try {
      const data = await githubGraphQL(PROJECT_INFO_QUERY_ORG, { owner: req.params.owner, number: parseInt(req.params.number, 10) });
      const project = data.organization?.projectV2;
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const statusField = project.fields?.nodes?.find(
        (f: any) => f.name === 'Status' && f.__typename === 'ProjectV2SingleSelectField'
      );
      res.json({
        id: project.id,
        title: project.title,
        number: parseInt(req.params.number, 10),
        owner: req.params.owner,
        statusOptions: statusField?.options?.map((o: any) => ({ id: o.id, name: o.name })) || [],
      });
    } catch (retryError: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/github/projects/:owner/:number/items — list items from a GitHub Project board
githubRoutes.get('/projects/:owner/:number/items', async (req, res) => {
  try {
    const { owner, number: projectNumber } = req.params;
    const cursor = req.query.cursor as string | undefined;

    // Try as user first, then as org
    let data: any;
    try {
      data = await githubGraphQL(PROJECT_ITEMS_QUERY, { owner, number: parseInt(projectNumber, 10), cursor: cursor || null });
      data = data.user?.projectV2;
    } catch {
      data = await githubGraphQL(PROJECT_ITEMS_QUERY_ORG, { owner, number: parseInt(projectNumber, 10), cursor: cursor || null });
      data = data.organization?.projectV2;
    }

    if (!data) return res.status(404).json({ error: 'Project not found' });

    const items = data.items.nodes
      .filter((node: any) => node.content?.__typename === 'Issue')
      .map((node: any) => ({
        id: node.id,
        contentId: node.content.number,
        contentType: 'Issue' as const,
        issue: {
          number: node.content.number,
          title: node.content.title,
          state: node.content.state,
          body: node.content.body,
          labels: node.content.labels?.nodes?.map((l: any) => ({ name: l.name, color: l.color })) || [],
          assignees: node.content.assignees?.nodes?.map((a: any) => ({ login: a.login, avatarUrl: a.avatarUrl })) || [],
          repository: { nameWithOwner: node.content.repository?.nameWithOwner },
          url: node.content.url,
        },
        statusFieldValue: node.fieldValueByName?.name || null,
      }));

    res.json({
      items,
      hasMore: data.items.pageInfo.hasNextPage,
      endCursor: data.items.pageInfo.endCursor,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/github/repos/:owner/:repo/issues/:number/comment — post comment on issue
githubRoutes.post('/repos/:owner/:repo/issues/:number/comment', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const bodyResult = githubCommentSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(number)}/comments`,
      { method: 'POST', body: JSON.stringify({ body: bodyResult.data.body }), headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    res.json(await response.json());
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/github/repos/:owner/:repo/issues/:number — update issue (close, reopen, add labels)
githubRoutes.patch('/repos/:owner/:repo/issues/:number', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const bodyResult = githubUpdateIssueSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(number)}`,
      { method: 'PATCH', body: JSON.stringify(bodyResult.data), headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    res.json(await response.json());
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/github/repos/:owner/:repo/pulls — create a pull request
githubRoutes.post('/repos/:owner/:repo/pulls', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const bodyResult = githubCreatePRSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ error: 'Invalid input', details: bodyResult.error.issues });
    }

    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      { method: 'POST', body: JSON.stringify(bodyResult.data), headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: `GitHub API error: ${response.statusText}`,
        message: errorBody.message || response.statusText,
      });
    }
    const pr = await response.json();
    res.json({
      number: pr.number,
      title: pr.title,
      htmlUrl: pr.html_url,
      state: pr.state,
      draft: pr.draft,
      head: pr.head?.ref,
      base: pr.base?.ref,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/github/repos/:owner/:repo/branches — list repo branches
githubRoutes.get('/repos/:owner/:repo/branches', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const page = req.query.page || '1';
    const perPage = req.query.per_page || '100';
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${perPage}&page=${page}`
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    const branches = await response.json();
    res.json(branches.map((b: any) => ({ name: b.name, protected: b.protected })));
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/github/repos/:owner/:repo/pulls — list pull requests
githubRoutes.get('/repos/:owner/:repo/pulls', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const queryResult = githubPRQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    const { state, page, per_page } = queryResult.data;
    const params = new URLSearchParams({ state, page, per_page, sort: 'updated', direction: 'desc' });
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${params}`
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    const pulls = await response.json();
    const mapped: GitHubPR[] = pulls.map((pr: any) => mapGitHubPR(pr));
    const linkHeader = response.headers.get('Link');
    const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;
    res.json({ pullRequests: mapped, hasMore, page: parseInt(page, 10) });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/github/repos/:owner/:repo/pulls/:number — get a single PR
githubRoutes.get('/repos/:owner/:repo/pulls/:number', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(number)}`
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    const pr = await response.json();
    res.json(mapGitHubPR(pr));
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/github/repos/:owner/:repo/pulls/:number/files — get PR files/diff
githubRoutes.get('/repos/:owner/:repo/pulls/:number/files', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const response = await githubFetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(number)}/files?per_page=100`
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    const files = await response.json();
    const mapped: PRFile[] = files.map((f: any) => ({
      path: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status as PRFile['status'],
      patch: f.patch,
    }));
    res.json(mapped);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: map raw GitHub API PR to our GitHubPR type
function mapGitHubPR(pr: any): GitHubPR {
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    state: pr.merged_at ? 'merged' : pr.state,
    author: { login: pr.user?.login, avatarUrl: pr.user?.avatar_url },
    headRefName: pr.head?.ref,
    baseRefName: pr.base?.ref,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
    labels: pr.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
    assignees: pr.assignees?.map((a: any) => ({ login: a.login })) || [],
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url,
    draft: pr.draft || false,
  };
}

// Helper: map raw GitHub API issue to our GitHubIssue type
function mapGitHubIssue(owner: string, repo: string) {
  return (issue: any) => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels?.map((l: any) => ({ id: l.id, name: l.name, color: l.color, description: l.description })) || [],
    assignees: issue.assignees?.map((a: any) => ({ login: a.login, avatarUrl: a.avatar_url })) || [],
    author: { login: issue.user?.login, avatarUrl: issue.user?.avatar_url },
    milestone: issue.milestone ? { id: issue.milestone.id, title: issue.milestone.title, state: issue.milestone.state } : undefined,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    commentsCount: issue.comments || 0,
    url: issue.url,
    htmlUrl: issue.html_url,
    repoFullName: `${owner}/${repo}`,
  });
}

// GraphQL queries for GitHub Projects v2
const PROJECT_INFO_QUERY = `
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      id
      title
      fields(first: 20) {
        nodes {
          __typename
          ... on ProjectV2SingleSelectField {
            name
            options { id name }
          }
        }
      }
    }
  }
}`;

const PROJECT_INFO_QUERY_ORG = `
query($owner: String!, $number: Int!) {
  organization(login: $owner) {
    projectV2(number: $number) {
      id
      title
      fields(first: 20) {
        nodes {
          __typename
          ... on ProjectV2SingleSelectField {
            name
            options { id name }
          }
        }
      }
    }
  }
}`;

const PROJECT_ITEMS_QUERY = `
query($owner: String!, $number: Int!, $cursor: String) {
  user(login: $owner) {
    projectV2(number: $number) {
      items(first: 50, after: $cursor) {
        nodes {
          id
          content {
            __typename
            ... on Issue {
              number
              title
              state
              body
              url
              labels(first: 10) { nodes { name color } }
              assignees(first: 10) { nodes { login avatarUrl } }
              repository { nameWithOwner }
            }
          }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

const PROJECT_ITEMS_QUERY_ORG = `
query($owner: String!, $number: Int!, $cursor: String) {
  organization(login: $owner) {
    projectV2(number: $number) {
      items(first: 50, after: $cursor) {
        nodes {
          id
          content {
            __typename
            ... on Issue {
              number
              title
              state
              body
              url
              labels(first: 10) { nodes { name color } }
              assignees(first: 10) { nodes { login avatarUrl } }
              repository { nameWithOwner }
            }
          }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;
