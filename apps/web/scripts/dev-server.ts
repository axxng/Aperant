/**
 * Local dev server — serves Vercel serverless API routes via Express.
 * Scans api/ directory, maps [param] filename patterns to :param Express routes.
 * Usage: npx tsx scripts/dev-server.ts
 */
import express from 'express';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from 'dotenv';

config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '../api');
const PORT = process.env.API_PORT ?? 3001;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Parse cookies from Cookie header into an object (Vercel adds req.cookies) */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split('; ').map((c) => {
      const [k, ...v] = c.split('=');
      return [k.trim(), v.join('=')];
    })
  );
}

/** Recursively collect all .ts handler files under api/ */
function collectRoutes(dir: string, base = ''): { filePath: string; route: string }[] {
  const entries = readdirSync(dir);
  const routes: { filePath: string; route: string }[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      routes.push(...collectRoutes(full, `${base}/${entry}`));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      const name = entry.replace(/\.ts$/, '');
      const segment = name === 'index' ? '' : `/${name}`;
      routes.push({ filePath: full, route: `${base}${segment}` });
    }
  }
  return routes;
}

/** Convert Vercel-style [param] segments to Express :param */
function toExpressRoute(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, ':$1');
}

async function main() {
  const routes = collectRoutes(API_DIR);

  for (const { filePath, route } of routes) {
    const expressRoute = `/api${toExpressRoute(route)}`;
    const moduleUrl = pathToFileURL(filePath).href;

    const mod = await import(moduleUrl);
    const handler = mod.default;
    if (typeof handler !== 'function') continue;

    // Register for all HTTP methods
    app.all(expressRoute, async (req, res) => {
      // Inject dynamic path params into query (Vercel pattern)
      const vercelReq = Object.assign(req, {
        query: { ...req.params, ...req.query } as Record<string, string | string[]>,
        cookies: parseCookies(req.headers.cookie),
      });
      try {
        await handler(vercelReq, res);
      } catch (err) {
        console.error(`[${expressRoute}]`, err);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
      }
    });

    console.log(`  ${expressRoute}`);
  }

  app.listen(PORT, () => {
    console.log(`\nAPI dev server running at http://localhost:${PORT}`);
    console.log('Vite frontend: http://localhost:5173\n');
  });
}

main().catch(console.error);
