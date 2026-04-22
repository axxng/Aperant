import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-i18next — keys returned as-is so tests match by key or stub value
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'triage.markTriaged') return 'Mark as Triaged';
      if (key === 'triage.triaged') return 'Triaged';
      if (key === 'triage.priorityNone') return 'Priority: None';
      if (key === 'triage.prioritySet') return `Priority: ${opts?.priority}`;
      if (key === 'triage.closedWarning') return 'This issue is closed. Triage actions are still saved in Currents.';
      if (key === 'triage.saveError') return 'Could not save triage state. Changes have been reverted.';
      if (key === 'triage.priority.critical') return 'Critical';
      if (key === 'triage.priority.high') return 'High';
      if (key === 'triage.priority.medium') return 'Medium';
      if (key === 'triage.priority.low') return 'Low';
      if (key === 'triage.priorityClear') return 'Clear priority';
      if (key === 'triage.markTriagedAriaLabel') return 'Toggle triaged status';
      if (key === 'triage.priorityAriaLabel') return 'Set priority';
      return key;
    },
  }),
}));

// Mock TanStack Query — controls useQuery data and useMutation behaviour
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
}));

// Mock useToast — capture error calls
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

// Mock lucide-react icons used in TriageSection
vi.mock('lucide-react', () => ({
  ExternalLink: () => <svg data-testid="external-link" />,
  CheckCircle2: ({ 'aria-label': al }: { 'aria-label'?: string }) => <svg data-testid="check-circle-2" aria-label={al} />,
  Circle: () => <svg data-testid="circle" />,
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
}));

// Mock Radix DropdownMenu — render children directly for test assertions
vi.mock('./ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button onClick={onSelect}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// Mock react-markdown (used in IssueDetailPanel body)
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <p>{children}</p> }));
vi.mock('remark-gfm', () => ({ default: () => {} }));

// Mock other UI primitives not under test
vi.mock('./ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('./ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('./ui/button', () => ({
  Button: ({ children, onClick, 'aria-pressed': pressed, disabled, ...rest }: any) => (
    <button onClick={onClick} aria-pressed={pressed} disabled={disabled} {...rest}>{children}</button>
  ),
}));

import { IssueDetailPanel } from './IssueDetailPanel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const baseIssue = {
  id: 1, number: 42, title: 'Fix login bug', state: 'open' as const,
  labels: [], assignees: [], author: { login: 'alice' },
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z',
  commentsCount: 0, url: 'https://api.github.com/repos/org/repo/issues/42',
  htmlUrl: 'https://github.com/org/repo/issues/42', repoFullName: 'org/repo', body: null,
};
const closedIssue = { ...baseIssue, state: 'closed' as const };

function setupMocks(triageData: { isTriaged: boolean; priority: string | null } | null = null) {
  const mockQueryClient = {
    cancelQueries: vi.fn(),
    getQueryData: vi.fn().mockReturnValue(triageData),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  };
  vi.mocked(useQueryClient).mockReturnValue(mockQueryClient as any);
  vi.mocked(useQuery).mockReturnValue({ data: triageData, isLoading: false, isError: false } as any);
  const mutate = vi.fn();
  vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as any);
  return { mutate, mockQueryClient };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('IssueDetailPanel — TRIAGE-01: triaged toggle', () => {
  it('renders triage toggle button with aria-pressed=false when not triaged', () => {
    const { mutate } = setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    const btn = screen.getByLabelText('Toggle triaged status');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('circle')).toBeInTheDocument();
  });

  it('calls mutation with { isTriaged: true, owner, repo, number } when toggle clicked while untriaged', () => {
    const { mutate } = setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    fireEvent.click(screen.getByLabelText('Toggle triaged status'));
    expect(mutate).toHaveBeenCalledWith({ isTriaged: true, owner: 'org', repo: 'repo', number: 42 });
  });

  it('renders CheckCircle2 and aria-pressed=true when triaged', () => {
    setupMocks({ isTriaged: true, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    const btn = screen.getByLabelText('Toggle triaged status');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('check-circle-2')).toBeInTheDocument();
  });
});

describe('IssueDetailPanel — TRIAGE-02: priority selector', () => {
  it('shows "Priority: None" trigger when no priority set', () => {
    setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    expect(screen.getByText('Priority: None')).toBeInTheDocument();
  });

  it('calls mutation with { priority: "high", owner, repo, number } when High option selected', () => {
    const { mutate } = setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    fireEvent.click(screen.getByText('High'));
    expect(mutate).toHaveBeenCalledWith({ priority: 'high', owner: 'org', repo: 'repo', number: 42 });
  });

  it('shows Clear priority option only when priority is set', () => {
    setupMocks({ isTriaged: false, priority: 'high' });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    expect(screen.getByText('Clear priority')).toBeInTheDocument();
  });

  it('calls mutation with { priority: null, owner, repo, number } when Clear priority selected', () => {
    const { mutate } = setupMocks({ isTriaged: false, priority: 'high' });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    fireEvent.click(screen.getByText('Clear priority'));
    expect(mutate).toHaveBeenCalledWith({ priority: null, owner: 'org', repo: 'repo', number: 42 });
  });
});

describe('IssueDetailPanel — TRIAGE-03: optimistic updates', () => {
  it.todo('onMutate calls queryClient.setQueryData with merged update before server responds');
  it.todo('onError restores previous query data via queryClient.setQueryData');
  it.todo('onError calls toast error after rollback');
});

describe('IssueDetailPanel — TRIAGE-06: closed issue warning', () => {
  it('renders ClosedIssueWarning banner when issue.state === "closed"', () => {
    setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={closedIssue} isOpen={true} />);
    expect(screen.getByText('This issue is closed. Triage actions are still saved in Currents.')).toBeInTheDocument();
    expect(screen.getByTestId('alert-triangle')).toBeInTheDocument();
  });

  it('does not render ClosedIssueWarning when issue.state === "open"', () => {
    setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    expect(screen.queryByText('This issue is closed. Triage actions are still saved in Currents.')).toBeNull();
    expect(screen.queryByTestId('alert-triangle')).toBeNull();
  });
});
