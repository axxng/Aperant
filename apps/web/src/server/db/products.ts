import { v4 as uuid } from 'uuid';
import { getDb } from './schema.js';
import type { Product, CreateProductInput, UpdateProductInput, ProductSource, StatusMapping } from '../../shared/types/product.js';
import { PRODUCT_COLORS } from '../../shared/types/product.js';

export function getAllProducts(): Product[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at ASC').all() as any[];
  return rows.map(rowToProduct);
}

export function getProductById(id: string): Product | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  return row ? rowToProduct(row) : null;
}

export function createProduct(input: CreateProductInput): Product {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const color = input.color || PRODUCT_COLORS[getAllProducts().length % PRODUCT_COLORS.length];

  db.prepare(`
    INSERT INTO products (id, name, description, color, sources, status_mapping, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description || null,
    color,
    JSON.stringify(input.sources),
    input.statusMapping ? JSON.stringify(input.statusMapping) : null,
    now,
    now,
  );

  return getProductById(id)!;
}

export function updateProduct(id: string, input: UpdateProductInput): Product | null {
  const db = getDb();
  const existing = getProductById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
  if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
  if (input.color !== undefined) { updates.push('color = ?'); values.push(input.color); }
  if (input.sources !== undefined) { updates.push('sources = ?'); values.push(JSON.stringify(input.sources)); }
  if (input.statusMapping !== undefined) { updates.push('status_mapping = ?'); values.push(JSON.stringify(input.statusMapping)); }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getProductById(id)!;
}

export function deleteProduct(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return result.changes > 0;
}

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    color: row.color,
    sources: JSON.parse(row.sources) as ProductSource[],
    statusMapping: row.status_mapping ? JSON.parse(row.status_mapping) as StatusMapping : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
