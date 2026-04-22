import { getClient } from './client.js';
import { triageDbRowSchema, triageBatchRowSchema } from '../validation.js';

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
  updates: {
    isTriaged?: boolean;
    priority?: 'critical' | 'high' | 'medium' | 'low' | null;
    githubCommentId?: number | null;
    commentStatus?: 'posted' | 'failed' | null;
  }
): Promise<TriageRecord & { triageState: TriageState }> {
  const client = getClient();

  // Determine values to upsert — for partial updates we need the existing row or defaults.
  // Build a single atomic INSERT ... ON CONFLICT DO UPDATE to avoid race conditions between
  // a bare INSERT-then-UPDATE pattern where concurrent requests can interleave.
  const isTriagedVal = updates.isTriaged !== undefined ? (updates.isTriaged ? 1 : 0) : 0;
  const priorityVal = 'priority' in updates ? (updates.priority ?? null) : null;
  const commentIdVal = 'githubCommentId' in updates ? (updates.githubCommentId ?? null) : null;
  const commentStatusVal = 'commentStatus' in updates ? (updates.commentStatus ?? null) : null;

  // If only partial fields are supplied, we need to preserve the existing values.
  // Use COALESCE on individual fields when the update does not include them.
  const isTriagedExpr = updates.isTriaged !== undefined ? 'excluded.is_triaged' : 'issue_triage.is_triaged';
  const priorityExpr = 'priority' in updates ? 'excluded.priority' : 'issue_triage.priority';
  const commentIdExpr = 'githubCommentId' in updates ? 'excluded.github_comment_id' : 'issue_triage.github_comment_id';
  const commentStatusExpr = 'commentStatus' in updates ? 'excluded.comment_status' : 'issue_triage.comment_status';

  await client.execute({
    sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, github_comment_id, comment_status, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET
            is_triaged          = ${isTriagedExpr},
            priority            = ${priorityExpr},
            github_comment_id   = ${commentIdExpr},
            comment_status      = ${commentStatusExpr},
            updated_at          = datetime('now')`,
    args: [repo, issueNumber, isTriagedVal, priorityVal, commentIdVal, commentStatusVal],
  });

  const record = await getTriageRecord(repo, issueNumber);
  if (!record) {
    throw new Error(`Triage record for ${repo}#${issueNumber} not found after upsert`);
  }
  return record;
}

export async function getTriageRecordsBatch(
  repo: string,
  issueNumbers: number[]
): Promise<Array<{ issueNumber: number; isTriaged: boolean; priority: 'critical' | 'high' | 'medium' | 'low' | null }>> {
  if (issueNumbers.length === 0) return [];
  const placeholders = issueNumbers.map(() => '?').join(', ');
  const result = await getClient().execute({
    sql: `SELECT github_issue_number, is_triaged, priority FROM issue_triage
          WHERE github_repo = ? AND github_issue_number IN (${placeholders})`,
    args: [repo, ...issueNumbers],
  });
  return result.rows.map(row => {
    const r = triageBatchRowSchema.parse(row);
    return {
      issueNumber: r.github_issue_number,
      isTriaged: r.is_triaged === 1,
      priority: r.priority,
    };
  });
}
