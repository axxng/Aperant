import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getClient before importing products module
const mockExecute = vi.fn();
vi.mock('./client.js', () => ({
  getClient: () => ({ execute: mockExecute }),
}));

import { rowToProduct } from './products.js';

describe('rowToProduct', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('throws ZodError when required field "id" is missing', () => {
    const row: Record<string, unknown> = {
      name: 'My Product',
      description: null,
      color: '#FF0000',
      sources: '[]',
      status_mapping: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
    };
    expect(() => rowToProduct(row)).toThrow();
  });

  it('correctly maps all fields from a valid DB row', () => {
    const row: Record<string, unknown> = {
      id: 'prod-1',
      name: 'My Product',
      description: null,
      color: '#FF0000',
      sources: '[]',
      status_mapping: null,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
    };
    const result = rowToProduct(row);
    expect(result.id).toBe('prod-1');
    expect(result.name).toBe('My Product');
    expect(result.color).toBe('#FF0000');
    expect(result.sources).toEqual([]);
  });
});
