import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../../_lib/auth/middleware.js';
import { getProductById, updateProduct, deleteProduct } from '../../_lib/db/products.js';
import { updateProductSchema } from '../../_lib/validation.js';
import { getClient } from '../../_lib/db/client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (!hasRole(user, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const id = req.query.id as string;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  switch (req.method) {
    case 'GET': {
      const product = await getProductById(id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      return res.json(product);
    }

    case 'PATCH': {
      const result = updateProductSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
      }
      const product = await updateProduct(id, result.data);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      return res.json(product);
    }

    case 'DELETE': {
      // Delete sync states for this product
      await getClient().execute({
        sql: 'DELETE FROM sync_state WHERE product_id = ?',
        args: [id],
      });
      const deleted = await deleteProduct(id);
      if (!deleted) return res.status(404).json({ error: 'Product not found' });
      return res.json({ success: true });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
