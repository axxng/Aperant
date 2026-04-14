import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';
import { getAllProducts, createProduct } from '../_lib/db/products.js';
import { createProductSchema } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  switch (req.method) {
    case 'GET': {
      const products = await getAllProducts();
      return res.json(products);
    }

    case 'POST': {
      const result = createProductSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
      }
      const product = await createProduct(result.data);
      return res.status(201).json(product);
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
