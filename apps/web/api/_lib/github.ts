import type { GitHubPR, PRFile } from '../../src/shared/types/pr.js';
import { gitHubApiIssueSchema, gitHubApiPRSchema } from './validation.js';

export class GitHubRateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`GitHub rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = 'GitHubRateLimitError';
    this.retryAfter = retryAfter;
  }
}

const GITHUB_API = 'https://api.github.com';

export { GITHUB_API };

export async function githubFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var not set');
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  // Rate-limit detection: primary (429 or 403 + remaining=0) and secondary (retry-after header)
  const isRateLimitStatus = response.status === 429 || response.status === 403;
  if (isRateLimitStatus) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfterHeader = response.headers.get('retry-after');   // secondary: already in seconds
    const resetHeader = response.headers.get('x-ratelimit-reset');  // primary: unix timestamp

    const isPrimaryLimit = remaining === '0';
    const isSecondaryLimit = retryAfterHeader !== null;
    // 429 always means rate limited; 403 only when remaining=0 or retry-after present
    const is429 = response.status === 429;

    if (isPrimaryLimit || isSecondaryLimit || is429) {
      let retryAfter: number;
      if (retryAfterHeader !== null) {
        // Secondary rate limit: retry-after is in seconds
        retryAfter = Math.max(0, parseInt(retryAfterHeader, 10));
      } else if (resetHeader !== null) {
        // Primary rate limit: x-ratelimit-reset is a Unix timestamp
        retryAfter = Math.max(0, Math.ceil(parseInt(resetHeader, 10) - Date.now() / 1000));
      } else {
        retryAfter = 60; // fallback per D-02
      }
      throw new GitHubRateLimitError(retryAfter);
    }
  }

  return response;
}

export async function githubGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var not set');
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

// === Pure domain logic ===

// Helper: map raw GitHub API PR to our GitHubPR type
export function mapGitHubPR(rawPr: unknown): GitHubPR {
  const pr = gitHubApiPRSchema.parse(rawPr);
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    state: pr.merged_at ? 'merged' : pr.state,
    author: { login: pr.user?.login ?? '', avatarUrl: pr.user?.avatar_url },
    headRefName: pr.head.ref,
    baseRefName: pr.base.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
    assignees: pr.assignees.map((a) => ({ login: a.login })),
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url,
    draft: pr.draft,
  };
}

// Helper: map raw GitHub API issue to our GitHubIssue type
export function mapGitHubIssue(owner: string, repo: string) {
  return (rawIssue: unknown) => {
    const issue = gitHubApiIssueSchema.parse(rawIssue);
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels.map((l) => ({ id: l.id, name: l.name, color: l.color, description: l.description })),
      assignees: issue.assignees.map((a) => ({ login: a.login, avatarUrl: a.avatar_url })),
      author: { login: issue.user.login, avatarUrl: issue.user.avatar_url },
      milestone: issue.milestone ? { id: issue.milestone.id, title: issue.milestone.title, state: issue.milestone.state } : undefined,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at,
      commentsCount: issue.comments,
      url: issue.url,
      htmlUrl: issue.html_url,
      repoFullName: `${owner}/${repo}`,
    };
  };
}

// GraphQL queries for GitHub Projects v2
export const PROJECT_INFO_QUERY = `
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

export const PROJECT_INFO_QUERY_ORG = `
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

export const PROJECT_ITEMS_QUERY = `
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

export const PROJECT_ITEMS_QUERY_ORG = `
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
