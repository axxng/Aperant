import { Router } from 'express';
import { getProductById } from '../db/products.js';

export const githubRoutes = Router();

const GITHUB_API = 'https://api.github.com';

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
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
    const { state = 'open', page = '1', per_page = '50' } = req.query as Record<string, string>;
    const response = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=${per_page}&sort=updated&direction=desc`
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
    res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: retryError.message });
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/github/repos/:owner/:repo/issues/:number/comment — post comment on issue
githubRoutes.post('/repos/:owner/:repo/issues/:number/comment', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'body is required' });

    const response = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/issues/${number}/comments`,
      { method: 'POST', body: JSON.stringify({ body }), headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    res.json(await response.json());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/github/repos/:owner/:repo/issues/:number — update issue (close, reopen, add labels)
githubRoutes.patch('/repos/:owner/:repo/issues/:number', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const response = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/issues/${number}`,
      { method: 'PATCH', body: JSON.stringify(req.body), headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
    }
    res.json(await response.json());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
