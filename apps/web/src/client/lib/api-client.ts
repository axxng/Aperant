import type { Product, CreateProductInput, UpdateProductInput } from '@shared/types/product';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskOrderState } from '@shared/types/task';
import type { SyncResult } from '@shared/types/github';

const API_BASE = '/api';

/** Retrieve the current auth token from persisted Zustand store */
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('aperant-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Authenticated fetch — injects JWT and returns the raw Response.
 * Use for polling or any request where you need the raw response.
 */
export async function authenticatedFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) ?? {}),
  };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
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
      request<Task[]>(productId ? `/tasks?${new URLSearchParams({ productId })}` : '/tasks'),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    create: (data: CreateTaskInput) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateTaskInput) =>
      request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: TaskStatus) =>
      request<Task>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
    getOrder: (scope: string) => request<TaskOrderState>(`/tasks/order/${encodeURIComponent(scope)}`),
    setOrder: (scope: string, status: TaskStatus, taskIds: string[]) =>
      request<{ success: boolean }>(`/tasks/order/${encodeURIComponent(scope)}/${encodeURIComponent(status)}`, {
        method: 'PUT',
        body: JSON.stringify({ taskIds }),
      }),
  },
  github: {
    getProjectInfo: (owner: string, number: number) =>
      request<{ id: string; title: string; number: number; owner: string; statusOptions: Array<{ id: string; name: string }> }>(
        `/github/projects/${owner}/${number}`
      ),
    getProjectItems: (owner: string, number: number, cursor?: string) =>
      request<{ items: any[]; hasMore: boolean; endCursor: string }>(
        `/github/projects/${encodeURIComponent(owner)}/${number}/items${cursor ? `?${new URLSearchParams({ cursor })}` : ''}`
      ),
  },
};
