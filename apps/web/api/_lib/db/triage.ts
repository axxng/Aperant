import { getClient } from './client.js';
import { triageDbRowSchema } from '../validation.js';

export interface TriageRecord {
  githubRepo: string;
  githubIssueNumber: number;
  isTriaged: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  githubCommentId: number | null;
  commentStatus: 'posted' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
}

export type TriageState =
  | { kind: 'untouched' }
  | { kind: 'prioritized'; priority: 'critical' | 'high' | 'medium' | 'low' }
  | { kind: 'complete' };

export function rowToTriage(row: unknown): TriageRecord & { triageState: TriageState } {
  const parsed = triageDbRowSchema.parse(row);
  const triageState: TriageState = parsed.is_triaged === 0
    ? { kind: 'untouched' }
    : parsed.priority !== null
      ? { kind: 'prioritized', priority: parsed.priority }
      : { kind: 'complete' };
  return {
    githubRepo: parsed.github_repo,
    githubIssueNumber: parsed.github_issue_number,
    isTriaged: parsed.is_triaged === 1,
    priority: parsed.priority,
    githubCommentId: parsed.github_comment_id,
    commentStatus: parsed.comment_status,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    triageState,
  };
}

export async function getTriageRecord(repo: string, issueNumber: number): Promise<(TriageRecord & { triageState: TriageState }) | null> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM issue_triage WHERE github_repo = ? AND github_issue_number = ?',
    args: [repo, issueNumber],
  });
  const row = result.rows[0];
  return row ? rowToTriage(row) : null;
}

export async function upsertTriageRecord(
  repo: string,
  issueNumber: number,
  updates: { isTriaged?: boolean; priority?: 'critical' | 'high' | 'medium' | 'low' | null }
): Promise<TriageRecord> {
  // COALESCE preserves existing value when field is not in the update payload
  await getClient().execute({
    sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET
            is_triaged = COALESCE(excluded.is_triaged, is_triaged),
            priority = COALESCE(excluded.priority, priority),
            updated_at = datetime('now')`,
    args: [
      repo,
      issueNumber,
      updates.isTriaged !== undefined ? (updates.isTriaged ? 1 : 0) : null,
      updates.priority !== undefined ? updates.priority : null,
    ],
  });

  // Fetch and return the updated record
  const record = await getTriageRecord(repo, issueNumber);
  // record will always exist after upsert
  return record!;
}
