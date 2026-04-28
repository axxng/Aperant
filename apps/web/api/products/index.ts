import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';
import { getAllProducts, createProduct } from '../_lib/db/products.js';
import { createProductSchema } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  switch (req.method) {
    case 'GET': {
      // 1. Parse input — no query params to parse for GET
      // 2. Authorize
      const user = await authenticateRequest(req, res);
      if (!user) return;
      // 3. DB call
      const products = await getAllProducts();
      // 4. Respond
      return res.json(products);
    }

    case 'POST': {
      // 1. Parse input — user-submitted body → safeParse + 400
      const result = createProductSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
      }
      // 2. Authorize
      const user = await authenticateRequest(req, res);
      if (!user) return;
      if (!hasRole(user, 'admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      // 3. DB call
      const product = await createProduct(result.data);
      // 4. Respond
      return res.status(201).json(product);
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
