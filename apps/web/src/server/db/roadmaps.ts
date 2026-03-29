import { getDb } from './schema.js';
import { v4 as uuid } from 'uuid';

export interface DBRoadmap {
  id: string;
  product_id: string;
  vision: string;
  target_audience: string;
  phases: string;
  features: string;
  created_at: string;
  updated_at: string;
}

export function getRoadmap(productId: string): DBRoadmap | undefined {
  return getDb()
    .prepare('SELECT * FROM roadmaps WHERE product_id = ? ORDER BY updated_at DESC LIMIT 1')
    .get(productId) as DBRoadmap | undefined;
}

export function createRoadmap(productId: string, data: { vision: string; targetAudience: string; phases: string; features: string }): DBRoadmap {
  const id = uuid();
  const now = new Date().toISOString();
  getDb()
    .prepare('INSERT INTO roadmaps (id, product_id, vision, target_audience, phases, features, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, productId, data.vision, data.targetAudience, data.phases, data.features, now, now);
  return getRoadmapById(id)!;
}

export function getRoadmapById(id: string): DBRoadmap | undefined {
  return getDb().prepare('SELECT * FROM roadmaps WHERE id = ?').get(id) as DBRoadmap | undefined;
}

export function updateRoadmap(id: string, updates: { vision?: string; target_audience?: string; phases?: string; features?: string }): void {
  const sets: string[] = ["updated_at = datetime('now')"];
  const vals: any[] = [];
  if (updates.vision !== undefined) { sets.push('vision = ?'); vals.push(updates.vision); }
  if (updates.target_audience !== undefined) { sets.push('target_audience = ?'); vals.push(updates.target_audience); }
  if (updates.phases !== undefined) { sets.push('phases = ?'); vals.push(updates.phases); }
  if (updates.features !== undefined) { sets.push('features = ?'); vals.push(updates.features); }
  vals.push(id);
  getDb().prepare(`UPDATE roadmaps SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteRoadmap(id: string): void {
  getDb().prepare('DELETE FROM roadmaps WHERE id = ?').run(id);
}
