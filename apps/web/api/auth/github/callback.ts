import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { createToken } from '../../_lib/auth/jwt.js';
import { upsertOAuthUser, userCount } from '../../_lib/db/users.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // CSRF: validate state param against HttpOnly cookie
  const cookieHeader = req.headers.cookie || '';
  const cookieState = cookieHeader
    .split('; ')
    .find((c) => c.startsWith('oauth_state='))
    ?.split('=')[1];
  const queryState = req.query.state as string | undefined;

  if (!cookieState || !queryState || cookieState !== queryState) {
    return res.status(400).json({ error: 'Invalid OAuth state' });
  }

  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).json({ error: 'Missing OAuth code' });

  try {
    await ensureDb();

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.OAUTH_CALLBACK_URL,
      }),
    });
    const tokenData = await tokenResponse.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.status(400).json({ error: 'OAuth token exchange failed' });
    }

    // Fetch GitHub user info with the new token
    const githubUserResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const githubUser = await githubUserResponse.json();

    // Determine role: first user in DB becomes admin (per D-06)
    const count = await userCount();
    const role = count === 0 ? 'admin' : 'member';

    // GitHub email can be null for private-email users — use synthetic fallback (per RESEARCH.md Pitfall 3)
    const email = githubUser.email || `${githubUser.login}@github.invalid`;

    // Upsert user — ON CONFLICT(email) DO UPDATE preserves existing role (per RESEARCH.md Pitfall 6)
    const user = await upsertOAuthUser({
      githubId: String(githubUser.id),
      email,
      name: githubUser.name || githubUser.login,
      githubLogin: githubUser.login,
      githubToken: tokenData.access_token,
      role,
    });

    // Issue JWT using existing createToken (userId, email, role) — structure unchanged
    const jwt = createToken(user.id, user.email, user.role);

    // Clear state cookie and redirect with JWT as query param (SPA picks it up on mount)
    res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Secure; Max-Age=0; Path=/');
    res.redirect(302, `/?token=${jwt}`);
  } catch (_error: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
