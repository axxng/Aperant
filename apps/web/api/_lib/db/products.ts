import { v4 as uuid } from 'uuid';
import { getClient } from './client.js';
import { productDbRowSchema } from '../validation.js';
import type { Product, CreateProductInput, UpdateProductInput, ProductSource, StatusMapping } from '../../../src/shared/types/product.js';
import { PRODUCT_COLORS } from '../../../src/shared/types/product.js';

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const result = await getClient().execute('SELECT * FROM products ORDER BY created_at ASC');
  return result.rows.map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM products WHERE id = ?',
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToProduct(row) : null;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const id = uuid();
  const now = new Date().toISOString();
  const allProducts = await getAllProducts();
  const color = input.color || PRODUCT_COLORS[allProducts.length % PRODUCT_COLORS.length];

  await getClient().execute({
    sql: `INSERT INTO products (id, name, description, color, sources, status_mapping, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.name,
      input.description || null,
      color,
      JSON.stringify(input.sources),
      input.statusMapping ? JSON.stringify(input.statusMapping) : null,
      now,
      now,
    ],
  });

  return (await getProductById(id))!;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product | null> {
  const existing = await getProductById(id);
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

  await getClient().execute({
    sql: `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
    args: values,
  });

  return (await getProductById(id))!;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const result = await getClient().execute({
    sql: 'DELETE FROM products WHERE id = ?',
    args: [id],
  });
  return result.rowsAffected > 0;
}

export function rowToProduct(row: unknown): Product {
  const parsed = productDbRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    description: parsed.description ?? undefined,
    color: parsed.color,
    sources: safeJsonParse(parsed.sources, []) as ProductSource[],
    statusMapping: parsed.status_mapping
      ? safeJsonParse<StatusMapping | undefined>(parsed.status_mapping, undefined)
      : undefined,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}
