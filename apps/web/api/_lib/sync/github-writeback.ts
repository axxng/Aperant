import { githubFetch, githubGraphQL } from '../github.js';
import { getProductById } from '../db/products.js';
import { getTasksPendingSync, updateTask, updateTaskSyncState } from '../db/tasks.js';
import type { Task, UpdateTaskInput, TaskStatusKey } from '../../../src/shared/types/task.js';
import type { StatusMapping } from '../../../src/shared/types/product.js';

const GITHUB_API = 'https://api.github.com';

export interface SyncWriteResult {
  success: boolean;
  error?: string;
}

/**
 * Push task changes back to the linked GitHub issue.
 * Returns early with success if the task is not GitHub-linked.
 */
export async function syncTaskToGitHub(
  task: Task,
  changes: UpdateTaskInput,
): Promise<SyncWriteResult> {
  if (!task.githubRepo || !task.githubIssueNumber) {
    return { success: true };
  }

  try {
    // 1. Build REST API payload for issue update
    const issuePayload: Record<string, any> = {};

    if (changes.title !== undefined) {
      issuePayload.title = changes.title;
    }
    if (changes.description !== undefined) {
      issuePayload.body = changes.description;
    }
    if (changes.status !== undefined) {
      issuePayload.state = changes.status === 'done' ? 'closed' : 'open';
    }
    if (changes.labels !== undefined) {
      issuePayload.labels = changes.labels.map((l) => l.name);
    }
    if (changes.assignees !== undefined) {
      issuePayload.assignees = changes.assignees.map((a) => a.login);
    }

    // 2. Call GitHub REST API if there are changes
    if (Object.keys(issuePayload).length > 0) {
      const [owner, repo] = task.githubRepo.split('/');
      const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${task.githubIssueNumber}`;
      const response = await githubFetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issuePayload),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `GitHub API ${response.status}: ${text}` };
      }
    }

    // 3. Update GitHub Project board column if applicable
    if (task.githubProjectItemId && changes.status !== undefined) {
      const projectResult = await syncProjectBoardColumn(task, changes.status);
      if (!projectResult.success) {
        return projectResult;
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update the GitHub Project board column for a task.
 * Uses the reversed statusMapping from the product config.
 */
async function syncProjectBoardColumn(
  task: Task,
  newStatus: TaskStatusKey,
): Promise<SyncWriteResult> {
  try {
    // Load the product to get statusMapping
    const product = await getProductById(task.productId);
    if (!product?.statusMapping) {
      // No mapping configured — skip silently
      return { success: true };
    }

    // Reverse the mapping: TaskStatus → GitHub column name
    const reverseMapping: Record<string, string> = {};
    for (const [columnName, taskStatus] of Object.entries(product.statusMapping)) {
      reverseMapping[taskStatus] = columnName;
    }

    const targetColumnName = reverseMapping[newStatus];
    if (!targetColumnName) {
      // No mapping for this status — skip silently
      return { success: true };
    }

    // Find the GitHub Project source to get owner + projectNumber
    const projectSource = product.sources.find((s) => s.type === 'github_project');
    if (!projectSource || projectSource.type !== 'github_project') {
      return { success: true };
    }

    // Fetch project info to get field ID and option ID
    const projectInfo = await getProjectFieldInfo(
      projectSource.owner,
      projectSource.projectNumber,
    );
    if (!projectInfo) {
      return { success: false, error: 'Could not fetch project field info' };
    }

    const optionId = projectInfo.statusOptions.find(
      (opt) => opt.name === targetColumnName,
    )?.id;
    if (!optionId) {
      // Column name doesn't match any option — skip
      return { success: true };
    }

    // Execute the mutation
    await githubGraphQL(
      `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $optionId }
          }
        ) {
          projectV2Item { id }
        }
      }`,
      {
        projectId: projectInfo.projectId,
        itemId: task.githubProjectItemId,
        fieldId: projectInfo.statusFieldId,
        optionId,
      },
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: `Project sync: ${error.message}` };
  }
}

interface ProjectFieldInfo {
  projectId: string;
  statusFieldId: string;
  statusOptions: Array<{ id: string; name: string }>;
}

/**
 * Fetch the Project's ID, Status field ID, and option IDs.
 * Tries user query first, falls back to org query.
 */
async function getProjectFieldInfo(
  owner: string,
  projectNumber: number,
): Promise<ProjectFieldInfo | null> {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              __typename
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  `;

  const orgQuery = `
    query($owner: String!, $number: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              __typename
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  `;

  try {
    let data: any;
    try {
      const result = await githubGraphQL(query, { owner, number: projectNumber });
      data = result.user?.projectV2;
    } catch {
      const result = await githubGraphQL(orgQuery, { owner, number: projectNumber });
      data = result.organization?.projectV2;
    }

    if (!data) return null;

    const statusField = data.fields.nodes.find(
      (f: any) => f.__typename === 'ProjectV2SingleSelectField' && f.name === 'Status',
    );
    if (!statusField) return null;

    return {
      projectId: data.id,
      statusFieldId: statusField.id,
      statusOptions: statusField.options,
    };
  } catch {
    return null;
  }
}

const MAX_SYNC_RETRIES = 10;

/**
 * Retry all tasks with pending GitHub write-backs.
 * Called by the cron job after the pull sync.
 */
export async function retryPendingWritebacks(): Promise<{ succeeded: number; failed: number; skipped: number }> {
  const pendingTasks = await getTasksPendingSync();
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const task of pendingTasks) {
    // Skip tasks that have exceeded the retry limit
    const currentRetryCount = task.githubSyncState?.kind === 'retrying' || task.githubSyncState?.kind === 'failed'
      ? task.githubSyncState.retryCount
      : 0;
    if (currentRetryCount >= MAX_SYNC_RETRIES) {
      skipped++;
      continue;
    }

    // Sync the full current state of the task
    const changes: UpdateTaskInput = {
      title: task.title,
      description: task.description,
      status: task.status,
      labels: task.labels,
      assignees: task.assignees,
    };

    const result = await syncTaskToGitHub(task, changes);
    if (result.success) {
      await updateTaskSyncState(task.id, false, 0);
      succeeded++;
    } else {
      const nextRetryCount = currentRetryCount + 1;
      await updateTaskSyncState(task.id, true, nextRetryCount);
      console.log(`GitHub write-back retry failed for task ${task.id} (attempt ${nextRetryCount}/${MAX_SYNC_RETRIES}): ${result.error}`);
      failed++;
    }
  }

  return { succeeded, failed, skipped };
}
