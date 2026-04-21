import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AllIssuesView } from './AllIssuesView';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'allIssues.error.retry') return 'Retry load';
      if (key === 'allIssues.error.body') return 'Check your GitHub connection or try again.';
      if (key === 'allIssues.error.dismiss') return `Dismiss error for ${opts?.repoName}`;
      if (key === 'allIssues.error.rateLimit') return `${opts?.repoName} — rate limited, retry in ${opts?.retryAfter}s`;
      if (key === 'allIssues.empty.openHeading') return 'No open issues';
      if (key === 'allIssues.empty.body') return 'Issues from all connected repos will appear here.';
      if (key === 'allIssues.heading') return 'All Issues';
      return key;
    },
  }),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('state=open'), vi.fn()],
}));

// Mock product store
vi.mock('../stores/product-store', () => ({
  useProductStore: vi.fn(),
}));

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQueries: vi.fn(),
}));

import { useProductStore } from '../stores/product-store';
import { useQueries } from '@tanstack/react-query';

const makeProduct = (id: string, name: string, color: string) => ({
  id,
  name,
  color,
  sources: [{ type: 'repo' as const, owner: 'org', repo: id }],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const makeIssue = (id: number, title: string, updatedAt: string) => ({
  id,
  number: id,
  title,
  state: 'open' as const,
  labels: [],
  assignees: [],
  author: { login: 'alice' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt,
  commentsCount: 0,
  url: `https://api.github.com/repos/org/repo/issues/${id}`,
  htmlUrl: `https://github.com/org/repo/issues/${id}`,
  repoFullName: 'org/repo',
});

describe('AllIssuesView — CROSS-01: merged issues sorted by updatedAt desc', () => {
  it('renders issues from two repos merged and sorted by updatedAt desc', () => {
    const products = [
      makeProduct('p1', 'Alpha', '#3B82F6'),
      makeProduct('p2', 'Beta', '#10B981'),
    ];
    vi.mocked(useProductStore).mockReturnValue({ products } as any);
    vi.mocked(useQueries).mockReturnValue([
      {
        data: { issues: [makeIssue(1, 'Old issue', '2024-01-01T00:00:00Z')], hasMore: false },
        isLoading: false, isError: false, error: null, refetch: vi.fn(),
      },
      {
        data: { issues: [makeIssue(2, 'New issue', '2024-01-03T00:00:00Z')], hasMore: false },
        isLoading: false, isError: false, error: null, refetch: vi.fn(),
      },
    ] as any);

    render(<AllIssuesView />);

    const rows = screen.getAllByRole('listitem');
    // "New issue" (updatedAt 2024-01-03) must appear before "Old issue" (updatedAt 2024-01-01)
    const newIdx = rows.findIndex(r => r.textContent?.includes('New issue'));
    const oldIdx = rows.findIndex(r => r.textContent?.includes('Old issue'));
    expect(newIdx).toBeLessThan(oldIdx);
  });
});

describe('AllIssuesView — CROSS-03: partial failure', () => {
  it('shows error banner for failed repo while successful repos issues still display', () => {
    const products = [
      makeProduct('p1', 'Acme API', '#3B82F6'),
      makeProduct('p2', 'Beta', '#10B981'),
    ];
    vi.mocked(useProductStore).mockReturnValue({ products } as any);
    vi.mocked(useQueries).mockReturnValue([
      {
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('HTTP 500'),
        refetch: vi.fn(),
      },
      {
        data: { issues: [makeIssue(2, 'Beta issue', '2024-01-03T00:00:00Z')], hasMore: false },
        isLoading: false, isError: false, error: null, refetch: vi.fn(),
      },
    ] as any);

    render(<AllIssuesView />);

    // Error banner for failed repo
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Acme API')).toBeInTheDocument();
    expect(screen.getByText('Retry load')).toBeInTheDocument();

    // Successful repo's issues still display
    expect(screen.getByText('Beta issue')).toBeInTheDocument();
  });

  it('banner dismiss button hides the banner', () => {
    const products = [makeProduct('p1', 'Acme API', '#3B82F6')];
    vi.mocked(useProductStore).mockReturnValue({ products } as any);
    const refetch = vi.fn();
    vi.mocked(useQueries).mockReturnValue([
      {
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('HTTP 500'),
        refetch,
      },
    ] as any);

    render(<AllIssuesView />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    const dismissBtn = screen.getByLabelText('Dismiss error for Acme API');
    fireEvent.click(dismissBtn);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retry button calls refetch on the specific failed query', () => {
    const products = [makeProduct('p1', 'Acme API', '#3B82F6')];
    vi.mocked(useProductStore).mockReturnValue({ products } as any);
    const refetch = vi.fn();
    vi.mocked(useQueries).mockReturnValue([
      {
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('HTTP 500'),
        refetch,
      },
    ] as any);

    render(<AllIssuesView />);

    fireEvent.click(screen.getByText('Retry load'));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
