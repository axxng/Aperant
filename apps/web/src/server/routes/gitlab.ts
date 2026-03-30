import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/schema.js';

export const gitlabRoutes = Router();

// Read GitLab config from settings table
function getGitLabConfig(): { token: string; instanceUrl: string } | null {
  const db = getDb();
  const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'gitlabToken'").get() as any;
  const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'gitlabInstanceUrl'").get() as any;
  if (!tokenRow?.value) return null;
  return {
    token: tokenRow.value,
    instanceUrl: urlRow?.value || 'https://gitlab.com',
  };
}

// GitLab API fetch helper
async function gitlabFetch(path: string, config: { token: string; instanceUrl: string }, options?: RequestInit) {
  const url = `${config.instanceUrl}/api/v4${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'PRIVATE-TOKEN': config.token,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }
  return {
    data: await response.json(),
    total: response.headers.get('x-total') ? parseInt(response.headers.get('x-total')!, 10) : undefined,
  };
}

function encodeProject(project: string): string {
  return encodeURIComponent(project);
}

function mapUser(u: any) {
  return u ? { id: u.id, name: u.name, username: u.username, avatarUrl: u.avatar_url || null } : null;
}

function mapIssue(i: any) {
  return {
    id: i.id,
    iid: i.iid,
    title: i.title,
    description: i.description,
    state: i.state,
    labels: i.labels || [],
    assignees: (i.assignees || []).map(mapUser),
    author: mapUser(i.author),
    milestone: i.milestone ? { id: i.milestone.id, title: i.milestone.title } : null,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    closedAt: i.closed_at,
    userNotesCount: i.user_notes_count || 0,
    webUrl: i.web_url,
  };
}

function mapMR(mr: any) {
  return {
    id: mr.id,
    iid: mr.iid,
    title: mr.title,
    description: mr.description,
    state: mr.state,
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    author: mapUser(mr.author),
    assignees: (mr.assignees || []).map(mapUser),
    labels: mr.labels || [],
    webUrl: mr.web_url,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    mergedAt: mr.merged_at,
    mergeStatus: mr.merge_status,
  };
}

/** GET /check — Check GitLab connection */
gitlabRoutes.get('/check', async (_req: Request, res: Response) => {
  const config = getGitLabConfig();
  if (!config) {
    res.json({ connected: false, error: 'No GitLab token configured' });
    return;
  }
  try {
    await gitlabFetch('/user', config);
    res.json({ connected: true });
  } catch (error: any) {
    res.json({ connected: false, error: error.message });
  }
});

/** GET /projects — List accessible projects */
gitlabRoutes.get('/projects', async (req: Request, res: Response) => {
  const config = getGitLabConfig();
  if (!config) { res.status(401).json({ error: 'No GitLab token configured' }); return; }
  try {
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const perPage = parseInt(req.query.per_page as string || '20', 10);
    let path = `/projects?membership=true&order_by=last_activity_at&page=${page}&per_page=${perPage}`;
    if (search) path += `&search=${encodeURIComponent(search)}`;
    const { data } = await gitlabFetch(path, config);
    res.json(data.map((p: any) => ({
      id: p.id,
      name: p.name,
      pathWithNamespace: p.path_with_namespace,
      description: p.description,
      webUrl: p.web_url,
      defaultBranch: p.default_branch,
      visibility: p.visibility,
      avatarUrl: p.avatar_url,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const projectQuerySchema = z.object({
  state: z.enum(['opened', 'closed', 'all']).default('opened'),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().optional(),
});

/** GET /:project/issues — List issues for a project */
gitlabRoutes.get('/:project/issues', async (req: Request, res: Response) => {
  const config = getGitLabConfig();
  if (!config) { res.status(401).json({ error: 'No GitLab token configured' }); return; }
  try {
    const project = req.params.project; // URL-encoded project path
    const query = projectQuerySchema.parse(req.query);
    let path = `/projects/${encodeProject(project)}/issues?state=${query.state}&page=${query.page}&per_page=${query.per_page}&order_by=updated_at&sort=desc`;
    if (query.search) path += `&search=${encodeURIComponent(query.search)}`;
    const { data, total } = await gitlabFetch(path, config);
    res.json({ items: data.map(mapIssue), total: total || data.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /:project/issues/:iid — Get single issue */
gitlabRoutes.get('/:project/issues/:iid', async (req: Request, res: Response) => {
  const config = getGitLabConfig();
  if (!config) { res.status(401).json({ error: 'No GitLab token configured' }); return; }
  try {
    const { project, iid } = req.params;
    const { data } = await gitlabFetch(`/projects/${encodeProject(project)}/issues/${iid}`, config);
    res.json(mapIssue(data));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /:project/merge_requests — List MRs */
gitlabRoutes.get('/:project/merge_requests', async (req: Request, res: Response) => {
  const config = getGitLabConfig();
  if (!config) { res.status(401).json({ error: 'No GitLab token configured' }); return; }
  try {
    const project = req.params.project;
    const query = projectQuerySchema.parse(req.query);
    let path = `/projects/${encodeProject(project)}/merge_requests?state=${query.state}&page=${query.page}&per_page=${query.per_page}&order_by=updated_at&sort=desc`;
    if (query.search) path += `&search=${encodeURIComponent(query.search)}`;
    const { data, total } = await gitlabFetch(path, config);
    res.json({ items: data.map(mapMR), total: total || data.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /:project/merge_requests/:iid — Get single MR */
gitlabRoutes.get('/:project/merge_requests/:iid', async (req: Request, res: Response) => {
  const config = getGitLabConfig();
  if (!config) { res.status(401).json({ error: 'No GitLab token configured' }); return; }
  try {
    const { project, iid } = req.params;
    const { data } = await gitlabFetch(`/projects/${encodeProject(project)}/merge_requests/${iid}`, config);
    res.json(mapMR(data));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
