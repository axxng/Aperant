import { Router } from 'express';
import * as productsDb from '../db/products.js';
import { deleteSyncStatesForProduct } from '../db/sync-state.js';
import { createProductSchema, updateProductSchema } from '../validation.js';

export const productRoutes = Router();

// GET /api/products — list all products
productRoutes.get('/', (_req, res) => {
  const products = productsDb.getAllProducts();
  res.json(products);
});

// GET /api/products/:id — get single product
productRoutes.get('/:id', (req, res) => {
  const product = productsDb.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products — create product
productRoutes.post('/', (req, res) => {
  const result = createProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }
  const product = productsDb.createProduct(result.data);
  res.status(201).json(product);
});

// PATCH /api/products/:id — update product
productRoutes.patch('/:id', (req, res) => {
  const result = updateProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
  }
  const product = productsDb.updateProduct(req.params.id, result.data);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// DELETE /api/products/:id — delete product and its sync state
productRoutes.delete('/:id', (req, res) => {
  deleteSyncStatesForProduct(req.params.id);
  const deleted = productsDb.deleteProduct(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true });
});
