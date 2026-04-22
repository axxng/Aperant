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
): Promise<TriageRecord & { triageState: TriageState }> {
  const client = getClient();

  // Ensure row exists with safe defaults — avoids NOT NULL constraint on is_triaged during INSERT
  await client.execute({
    sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, updated_at)
          VALUES (?, ?, 0, NULL, datetime('now'))
          ON CONFLICT(github_repo, github_issue_number) DO NOTHING`,
    args: [repo, issueNumber],
  });

  // Build dynamic UPDATE for only the fields present in the payload.
  // 'priority' in updates handles explicit null (clear) correctly — COALESCE cannot.
  const sets: string[] = ["updated_at = datetime('now')"];
  const args: (string | number | null)[] = [];
  if (updates.isTriaged !== undefined) {
    sets.push('is_triaged = ?');
    args.push(updates.isTriaged ? 1 : 0);
  }
  if ('priority' in updates) {
    sets.push('priority = ?');
    args.push(updates.priority ?? null);
  }
  await client.execute({
    sql: `UPDATE issue_triage SET ${sets.join(', ')} WHERE github_repo = ? AND github_issue_number = ?`,
    args: [...args, repo, issueNumber],
  });

  const record = await getTriageRecord(repo, issueNumber);
  return record!;
}
