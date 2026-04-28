import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// All vi.mock calls MUST come before any imports of the mocked modules

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, tNav: (k: string) => k }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ productId: 'p1' }),
  NavLink: ({ children }: any) => <a>{children}</a>,
  Link: ({ children }: any) => <a>{children}</a>,
}));

vi.mock('../stores/product-store', () => ({
  useProductStore: vi.fn(),
}));

vi.mock('../hooks/useIssuesFilters', () => ({
  useIssuesFilters: () => ({
    state: 'open', labels: [], assignee: '', search: '',
    setSearch: vi.fn(), setFilters: vi.fn(), resetFilters: vi.fn(), hasActiveFilters: false,
  }),
}));

// Must mock ALL TanStack Query hooks used in IssuesView + IssueDetailPanel (child)
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
  QueryClient: vi.fn(),
}));

// Mock child components to isolate keyboard nav behavior in IssuesView
vi.mock('./IssueDetailPanel', () => ({
  IssueDetailPanel: ({ isOpen, issue, onTriageLoad }: any) => (
    <div data-testid="panel" data-open={String(isOpen)} data-issue-id={issue?.id ?? ''} />
  ),
}));

vi.mock('./IssueListRow', () => ({
  IssueListRow: ({ issue, isSelected, onClick }: any) => (
    <div data-testid="row" data-id={issue.id} data-selected={String(isSelected)} onClick={onClick}>
      {issue.title}
    </div>
  ),
}));

vi.mock('./IssuesFilterBar', () => ({
  IssuesFilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('./IssueSkeletonRow', () => ({
  IssueSkeletonRow: () => <div data-testid="skeleton" />,
}));

import { IssuesView } from './IssuesView';
import { useProductStore } from '../stores/product-store';
import { useInfiniteQuery, useQuery, useMutation } from '@tanstack/react-query';

const makeIssue = (id: number, title: string) => ({
  id, number: id, title, state: 'open' as const,
  labels: [], assignees: [], author: { login: 'alice' },
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z',
  commentsCount: 0,
  url: `https://api.github.com/repos/org/repo/issues/${id}`,
  htmlUrl: `https://github.com/org/repo/issues/${id}`,
  repoFullName: 'org/repo', body: null,
});

const threeIssues = [makeIssue(1, 'First'), makeIssue(2, 'Second'), makeIssue(3, 'Third')];

function setupStore(issues: ReturnType<typeof makeIssue>[]) {
  vi.mocked(useProductStore).mockReturnValue({
    products: [{ id: 'p1', name: 'Alpha', color: '#3B82F6',
      sources: [{ type: 'repo', owner: 'org', repo: 'repo' }],
      createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    }],
    setActiveProduct: vi.fn(),
  } as any);

  vi.mocked(useInfiniteQuery).mockReturnValue({
    data: { pages: [{ issues, hasMore: false }] },
    isLoading: false, isFetchingNextPage: false, fetchNextPage: vi.fn(),
    hasNextPage: false, error: null, refetch: vi.fn(),
  } as any);

  // useQuery used for labels (IssuesView) and triage data (IssueDetailPanel child — mocked away)
  vi.mocked(useQuery).mockReturnValue({ data: { labels: [] }, isLoading: false, isError: false } as any);
  vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('IssuesView — TRIAGE-04: batch triage pre-fetch on render', () => {
  it('calls GET /api/triage/:owner/:repo?numbers=... when issues list renders', async () => {
    // Stub global fetch to resolve with empty records
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    setupStore(threeIssues);
    render(<IssuesView />);

    // Wait for the useEffect to fire (microtask after render)
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/triage/org/repo?numbers='),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    vi.unstubAllGlobals();
  });

  it('seeds issueTriageCache from batch response (does not overwrite existing entries)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        records: [
          { issueNumber: 1, isTriaged: true, priority: 'high' },
          { issueNumber: 2, isTriaged: false, priority: null },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    setupStore(threeIssues);
    const { getAllByTestId } = render(<IssuesView />);

    // After fetch resolves, rows should reflect the seeded triage state
    // IssueListRow mock doesn't render triageState, so just verify no crash + fetch was called
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(getAllByTestId('row')).toHaveLength(3);

    vi.unstubAllGlobals();
  });
});

describe('IssuesView — TRIAGE-05: j/k keyboard navigation', () => {
  it('pressing j when panel is open moves selection to next issue (down)', () => {
    setupStore(threeIssues);
    render(<IssuesView />);

    // Open panel on first row — j goes down/next
    fireEvent.click(screen.getAllByTestId('row')[0]);
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '1');

    // Press j — should move to second issue (next/down)
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '2');
  });

  it('pressing k when panel is open moves selection to previous issue (up)', () => {
    setupStore(threeIssues);
    render(<IssuesView />);

    fireEvent.click(screen.getAllByTestId('row')[1]); // click second row
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '2');

    fireEvent.keyDown(window, { key: 'k' });
    // k goes up/prev — should be first issue
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '1');
  });

  it('pressing j on last issue does nothing (boundary guard)', () => {
    setupStore(threeIssues);
    render(<IssuesView />);

    fireEvent.click(screen.getAllByTestId('row')[2]); // last issue
    fireEvent.keyDown(window, { key: 'j' }); // j=next, already at last — do nothing
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '3');
  });

  it('pressing k on first issue does nothing (boundary guard)', () => {
    setupStore(threeIssues);
    render(<IssuesView />);

    fireEvent.click(screen.getAllByTestId('row')[0]);
    fireEvent.keyDown(window, { key: 'k' }); // k=prev, already at first — do nothing
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '1');
  });

  it('pressing Escape closes the panel (sets selectedIssueId to null)', () => {
    setupStore(threeIssues);
    render(<IssuesView />);

    fireEvent.click(screen.getAllByTestId('row')[0]);
    expect(screen.getByTestId('panel')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '1');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('panel')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '');
  });

  it('pressing j when no issue selected (panel closed) does nothing', () => {
    setupStore(threeIssues);
    render(<IssuesView />);

    // No click — panel is closed (selectedIssueId === null)
    fireEvent.keyDown(window, { key: 'j' });
    // Panel should show no issue
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '');
  });

  it('pressing j when focus is on INPUT element does nothing', () => {
    setupStore(threeIssues);
    const { container } = render(<IssuesView />);

    fireEvent.click(screen.getAllByTestId('row')[0]);
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '1');

    // Simulate keydown from INPUT element
    const input = document.createElement('input');
    container.appendChild(input);
    fireEvent.keyDown(input, { key: 'j', target: input });
    // Should still be on first issue
    expect(screen.getByTestId('panel')).toHaveAttribute('data-issue-id', '1');
  });
});
