import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';
import { githubGraphQL, PROJECT_INFO_QUERY, PROJECT_INFO_QUERY_ORG } from '../../../../_lib/github.js';
import { githubOwnerNumberSchema } from '../../../../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse input — path params (programmer bug if invalid → throws → 500)
  const { owner, number: numberStr } = githubOwnerNumberSchema.parse(req.query);
  const projectNumber = parseInt(numberStr, 10);

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const data = await githubGraphQL(PROJECT_INFO_QUERY, { owner, number: projectNumber });

    const project = data.user?.projectV2 || data.organization?.projectV2;
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const statusField = project.fields?.nodes?.find(
      (f: any) => f.name === 'Status' && f.__typename === 'ProjectV2SingleSelectField'
    );

    return res.json({
      id: project.id,
      title: project.title,
      number: projectNumber,
      owner,
      statusOptions: statusField?.options?.map((o: any) => ({ id: o.id, name: o.name })) || [],
    });
  } catch (error: any) {
    // Try as org if user fails
    try {
      const data = await githubGraphQL(PROJECT_INFO_QUERY_ORG, { owner, number: projectNumber });
      const project = data.organization?.projectV2;
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const statusField = project.fields?.nodes?.find(
        (f: any) => f.name === 'Status' && f.__typename === 'ProjectV2SingleSelectField'
      );

      return res.json({
        id: project.id,
        title: project.title,
        number: projectNumber,
        owner,
        statusOptions: statusField?.options?.map((o: any) => ({ id: o.id, name: o.name })) || [],
      });
    } catch (retryError: any) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
