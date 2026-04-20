import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';
import { githubGraphQL, PROJECT_ITEMS_QUERY, PROJECT_ITEMS_QUERY_ORG } from '../../../../_lib/github.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;

  const owner = req.query.owner as string;
  const projectNumber = parseInt(req.query.number as string, 10);
  const cursor = (req.query.cursor as string) || null;

  try {
    // Try as user first, then as org
    let data: any;
    try {
      data = await githubGraphQL(PROJECT_ITEMS_QUERY, { owner, number: projectNumber, cursor });
      data = data.user?.projectV2;
    } catch {
      data = await githubGraphQL(PROJECT_ITEMS_QUERY_ORG, { owner, number: projectNumber, cursor });
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
}
