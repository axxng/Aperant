import { getProductById } from '../db/products.js';
import { getTaskByGitHubIssue, createTask, updateTask, getTasksByProduct } from '../db/tasks.js';
import { getSyncState, upsertSyncState } from '../db/sync-state.js';
import type { Product, RepoSource, MultiRepoSource } from '../../shared/types/product.js';
import type { TaskStatus, CreateTaskInput } from '../../shared/types/task.js';
import type { SyncResult } from '../../shared/types/github.js';

const GITHUB_API = 'https://api.github.com';

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return token;
}

async function githubFetch(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${getGitHubToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...headers,
    },
  });
}

/** Sync a single repo's issues into the product's backlog */
async function syncRepo(productId: string, owner: string, repo: string): Promise<SyncResult> {
  const sourceKey = `${owner}/${repo}`;
  const syncState = getSyncState(productId, sourceKey);
  const result: SyncResult = { created: 0, updated: 0, closed: 0, errors: [] };

  try {
    // Fetch issues updated since last sync
    let url = `${GITHUB_API}/repos/${owner}/${repo}/issues?state=all&sort=updated&direction=desc&per_page=100`;
    if (syncState?.lastSyncedAt) {
      url += `&since=${syncState.lastSyncedAt}`;
    }

    const headers: Record<string, string> = {};
    if (syncState?.etag) {
      headers['If-None-Match'] = syncState.etag;
    }

    const response = await githubFetch(url, headers);

    // Not modified
    if (response.status === 304) {
      return result;
    }

    if (!response.ok) {
      result.errors.push(`GitHub API error: ${response.status} ${response.statusText}`);
      return result;
    }

    const issues = (await response.json()).filter((issue: any) => !issue.pull_request);
    const etag = response.headers.get('ETag') || undefined;

    for (const issue of issues) {
      try {
        const existingTask = getTaskByGitHubIssue(sourceKey, issue.number);

        if (existingTask) {
          // Update existing task
          const newStatus = issue.state === 'closed' ? 'done' : existingTask.status;
          updateTask(existingTask.id, {
            title: issue.title,
            description: issue.body || '',
            status: newStatus !== existingTask.status ? newStatus as TaskStatus : undefined,
            labels: issue.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
            assignees: issue.assignees?.map((a: any) => ({ login: a.login, avatarUrl: a.avatar_url })) || [],
          });
          if (issue.state === 'closed' && existingTask.status !== 'done') {
            result.closed++;
          } else {
            result.updated++;
          }
        } else if (issue.state !== 'closed') {
          // Create new task for open issues only
          const taskInput: CreateTaskInput = {
            productId,
            title: issue.title,
            description: issue.body || '',
            status: 'backlog',
            githubIssueNumber: issue.number,
            githubIssueUrl: issue.html_url,
            githubRepo: sourceKey,
            labels: issue.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
            assignees: issue.assignees?.map((a: any) => ({ login: a.login, avatarUrl: a.avatar_url })) || [],
            metadata: { sourceType: 'github' },
          };
          createTask(taskInput);
          result.created++;
        }
      } catch (error: any) {
        result.errors.push(`Issue #${issue.number}: ${error.message}`);
      }
    }

    // Update sync state
    upsertSyncState({
      productId,
      sourceKey,
      lastSyncedAt: new Date().toISOString(),
      etag,
    });
  } catch (error: any) {
    result.errors.push(`Sync error for ${sourceKey}: ${error.message}`);
  }

  return result;
}

/** Sync all sources for a product */
export async function syncProduct(productId: string): Promise<SyncResult> {
  const product = getProductById(productId);
  if (!product) throw new Error(`Product ${productId} not found`);

  const combined: SyncResult = { created: 0, updated: 0, closed: 0, errors: [] };

  for (const source of product.sources) {
    let result: SyncResult;
    switch (source.type) {
      case 'repo':
        result = await syncRepo(productId, source.owner, source.repo);
        break;
      case 'repos':
        result = { created: 0, updated: 0, closed: 0, errors: [] };
        for (const r of source.repos) {
          const repoResult = await syncRepo(productId, r.owner, r.repo);
          result.created += repoResult.created;
          result.updated += repoResult.updated;
          result.closed += repoResult.closed;
          result.errors.push(...repoResult.errors);
        }
        break;
      case 'github_project':
        result = await syncGitHubProject(productId, source.owner, source.projectNumber, product.statusMapping);
        break;
      default:
        result = { created: 0, updated: 0, closed: 0, errors: [`Unknown source type`] };
    }
    combined.created += result.created;
    combined.updated += result.updated;
    combined.closed += result.closed;
    combined.errors.push(...result.errors);
  }

  return combined;
}

/** Sync GitHub Project board items into tasks */
async function syncGitHubProject(
  productId: string,
  owner: string,
  projectNumber: number,
  statusMapping?: Record<string, TaskStatus>,
): Promise<SyncResult> {
  const sourceKey = `project:${owner}/${projectNumber}`;
  const syncState = getSyncState(productId, sourceKey);
  const result: SyncResult = { created: 0, updated: 0, closed: 0, errors: [] };

  const defaultStatusMapping: Record<string, TaskStatus> = {
    'Todo': 'backlog',
    'Backlog': 'backlog',
    'In Progress': 'in_progress',
    'In progress': 'in_progress',
    'In Review': 'human_review',
    'Done': 'done',
    'Closed': 'done',
  };
  const mapping = statusMapping || defaultStatusMapping;

  try {
    let cursor = syncState?.cursor || null;
    let hasMore = true;

    while (hasMore) {
      const query = `
        query($owner: String!, $number: Int!, $cursor: String) {
          user(login: $owner) {
            projectV2(number: $number) {
              items(first: 50, after: $cursor) {
                nodes {
                  id
                  content {
                    __typename
                    ... on Issue {
                      number title state body url
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
        }
      `;

      let data: any;
      try {
        const response = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getGitHubToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables: { owner, number: projectNumber, cursor } }),
        });
        const json = await response.json();
        if (json.errors) {
          // Try as org
          const orgQuery = query.replace('user(login: $owner)', 'organization(login: $owner)');
          const orgResponse = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getGitHubToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: orgQuery, variables: { owner, number: projectNumber, cursor } }),
          });
          const orgJson = await orgResponse.json();
          if (orgJson.errors) throw new Error(orgJson.errors[0].message);
          data = orgJson.data.organization.projectV2;
        } else {
          data = json.data.user.projectV2;
        }
      } catch (error: any) {
        result.errors.push(`GraphQL error: ${error.message}`);
        break;
      }

      if (!data) {
        result.errors.push('Project not found');
        break;
      }

      for (const node of data.items.nodes) {
        if (node.content?.__typename !== 'Issue') continue;
        const issue = node.content;
        const repoFullName = issue.repository?.nameWithOwner;
        if (!repoFullName) continue;

        try {
          const existingTask = getTaskByGitHubIssue(repoFullName, issue.number);
          const statusColumnName = node.fieldValueByName?.name;
          const mappedStatus = statusColumnName ? (mapping[statusColumnName] || 'backlog') : 'backlog';

          if (existingTask) {
            updateTask(existingTask.id, {
              title: issue.title,
              description: issue.body || '',
              status: mappedStatus,
              labels: issue.labels?.nodes?.map((l: any) => ({ name: l.name, color: l.color })) || [],
              assignees: issue.assignees?.nodes?.map((a: any) => ({ login: a.login, avatarUrl: a.avatarUrl })) || [],
            });
            result.updated++;
          } else if (issue.state !== 'CLOSED') {
            createTask({
              productId,
              title: issue.title,
              description: issue.body || '',
              status: mappedStatus,
              githubIssueNumber: issue.number,
              githubIssueUrl: issue.url,
              githubRepo: repoFullName,
              githubProjectItemId: node.id,
              labels: issue.labels?.nodes?.map((l: any) => ({ name: l.name, color: l.color })) || [],
              assignees: issue.assignees?.nodes?.map((a: any) => ({ login: a.login, avatarUrl: a.avatarUrl })) || [],
              metadata: { sourceType: 'github' },
            });
            result.created++;
          }
        } catch (error: any) {
          result.errors.push(`Project item ${node.id}: ${error.message}`);
        }
      }

      hasMore = data.items.pageInfo.hasNextPage;
      cursor = data.items.pageInfo.endCursor;
    }

    upsertSyncState({
      productId,
      sourceKey,
      lastSyncedAt: new Date().toISOString(),
      cursor: cursor || undefined,
    });
  } catch (error: any) {
    result.errors.push(`Sync error for project ${owner}/${projectNumber}: ${error.message}`);
  }

  return result;
}

/** Sync all products */
export async function syncAllProducts(): Promise<Map<string, SyncResult>> {
  const { getAllProducts } = await import('../db/products.js');
  const products = getAllProducts();
  const results = new Map<string, SyncResult>();
  for (const product of products) {
    results.set(product.id, await syncProduct(product.id));
  }
  return results;
}
