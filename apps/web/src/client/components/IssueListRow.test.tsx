import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IssueListRow } from './IssueListRow';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'list.issueNumber') return `#${opts?.number}`;
      if (key === 'state.open') return 'Open';
      if (key === 'state.closed') return 'Closed';
      return key;
    },
  }),
}));

// Mock UI primitives (not under test)
vi.mock('./ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('./ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const baseIssue = {
  id: 1,
  number: 42,
  title: 'Fix login bug',
  state: 'open' as const,
  labels: [],
  assignees: [],
  author: { login: 'alice' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  commentsCount: 0,
  url: 'https://api.github.com/repos/org/repo/issues/42',
  htmlUrl: 'https://github.com/org/repo/issues/42',
  repoFullName: 'org/repo',
};

describe('IssueListRow — CROSS-02: product badge', () => {
  it('renders product color dot and name when productBadge prop is provided', () => {
    render(
      <IssueListRow
        issue={baseIssue}
        isSelected={false}
        onClick={() => {}}
        productBadge={{ color: '#3B82F6', name: 'Acme API' }}
      />
    );
    expect(screen.getByText('Acme API')).toBeInTheDocument();
    const dot = document.querySelector('[aria-hidden="true"][style*="background-color"]');
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3B82F6
  });

  it('renders nothing for product badge when productBadge prop is absent (backward compat)', () => {
    render(
      <IssueListRow
        issue={baseIssue}
        isSelected={false}
        onClick={() => {}}
      />
    );
    expect(screen.queryByText('Acme API')).toBeNull();
    const dot = document.querySelector('[aria-hidden="true"]');
    expect(dot).toBeNull();
  });

  it('truncates long product names via max-w-[80px] CSS class', () => {
    render(
      <IssueListRow
        issue={baseIssue}
        isSelected={false}
        onClick={() => {}}
        productBadge={{ color: '#10B981', name: 'Very Long Product Name That Should Be Truncated' }}
      />
    );
    const nameEl = screen.getByText('Very Long Product Name That Should Be Truncated');
    expect(nameEl.className).toContain('truncate');
    expect(nameEl.className).toContain('max-w-[80px]');
  });
});
