/**
 * Product — a logical grouping of work items from one or more GitHub sources.
 * Replaces the desktop app's "Project" concept for the web platform.
 */

export interface Product {
  id: string;
  name: string;
  description?: string;
  /** Color for UI badges in consolidated backlog view */
  color: string;
  /** GitHub sources that feed issues into this product's backlog */
  sources: ProductSource[];
  /** Status column mapping from GitHub to kanban */
  statusMapping?: StatusMapping;
  createdAt: string;
  updatedAt: string;
}

/** A GitHub source that feeds issues into a product */
export type ProductSource =
  | RepoSource
  | MultiRepoSource
  | GitHubProjectSource;

export interface RepoSource {
  type: 'repo';
  owner: string;
  repo: string;
}

export interface MultiRepoSource {
  type: 'repos';
  repos: Array<{ owner: string; repo: string }>;
}

export interface GitHubProjectSource {
  type: 'github_project';
  /** GitHub user or org that owns the project */
  owner: string;
  /** GitHub Project board number */
  projectNumber: number;
}

/** Maps GitHub Project board column names to kanban statuses */
export interface StatusMapping {
  [githubColumnName: string]: import('./task.js').TaskStatus;
}

/** Product creation input */
export interface CreateProductInput {
  name: string;
  description?: string;
  color?: string;
  sources: ProductSource[];
  statusMapping?: StatusMapping;
}

/** Product update input */
export interface UpdateProductInput {
  name?: string;
  description?: string;
  color?: string;
  sources?: ProductSource[];
  statusMapping?: StatusMapping;
}

/** Default colors for products */
export const PRODUCT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
] as const;
