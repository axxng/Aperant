import type { Product, CreateProductInput, UpdateProductInput } from '@shared/types/product';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskOrderState } from '@shared/types/task';
import type { SyncResult, PaginatedIssuesResult } from '@shared/types/github';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  products: {
    list: () => request<Product[]>('/products'),
    get: (id: string) => request<Product>(`/products/${id}`),
    create: (data: CreateProductInput) =>
      request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateProductInput) =>
      request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/products/${id}`, { method: 'DELETE' }),
    sync: (id: string) =>
      request<SyncResult>(`/products/${id}/sync`, { method: 'POST' }),
  },
  tasks: {
    list: (productId?: string) =>
      request<Task[]>(productId ? `/tasks?productId=${productId}` : '/tasks'),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    create: (data: CreateTaskInput) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateTaskInput) =>
      request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: TaskStatus) =>
      request<Task>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
    getOrder: (scope: string) => request<TaskOrderState>(`/tasks/order/${scope}`),
    setOrder: (scope: string, status: TaskStatus, taskIds: string[]) =>
      request<{ success: boolean }>(`/tasks/order/${scope}/${status}`, {
        method: 'PUT',
        body: JSON.stringify({ taskIds }),
      }),
  },
  github: {
    getIssues: (owner: string, repo: string, params?: { state?: string; page?: string }) => {
      const searchParams = new URLSearchParams(params as Record<string, string>);
      return request<PaginatedIssuesResult>(`/github/repos/${owner}/${repo}/issues?${searchParams}`);
    },
    getProjectInfo: (owner: string, number: number) =>
      request<{ id: string; title: string; number: number; owner: string; statusOptions: Array<{ id: string; name: string }> }>(
        `/github/projects/${owner}/${number}`
      ),
    getProjectItems: (owner: string, number: number, cursor?: string) =>
      request<{ items: any[]; hasMore: boolean; endCursor: string }>(
        `/github/projects/${owner}/${number}/items${cursor ? `?cursor=${cursor}` : ''}`
      ),
  },
  events: {
    subscribe: (): EventSource => new EventSource(`${API_BASE}/events`),
  },
};
