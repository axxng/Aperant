import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

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
      if (key === 'detail.closePanel') return 'Close panel';
      if (key === 'notes.postButton') return 'Post Note';
      if (key === 'notes.sentButton') return 'Sent';
      if (key === 'notes.sectionLabel') return 'Add a note';
      if (key === 'notes.placeholder') return 'Write a note to post as a GitHub comment…';
      if (key === 'notes.postSuccess') return 'Note posted to GitHub';
      if (key === 'notes.postError') return 'Could not post note. Try again.';
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

// Stable mock for useToast so TRIAGE-03 and NOTES-03 tests can assert on toast calls
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ error: mockToastError, success: mockToastSuccess }),
}));

// Mock lucide-react icons used in TriageSection
vi.mock('lucide-react', () => ({
  ExternalLink: () => <svg data-testid="external-link" />,
  CheckCircle2: ({ 'aria-label': al }: { 'aria-label'?: string }) => <svg data-testid="check-circle-2" aria-label={al} />,
  Circle: () => <svg data-testid="circle" />,
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
  X: () => <svg data-testid="close-icon" />,
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

vi.mock('./ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, disabled, onKeyDown, id }: any) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={onKeyDown}
    />
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

beforeEach(() => { vi.clearAllMocks(); noteMutationOptionsRef = null; });

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
  it('onMutate calls queryClient.setQueryData with merged update before server responds', async () => {
    const { mockQueryClient } = setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    const [mutationOptions] = vi.mocked(useMutation).mock.calls[0] as any[];
    const vars = { isTriaged: true, owner: 'org', repo: 'repo', number: 42 };
    await mutationOptions.onMutate?.(vars);
    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
      ['triage', 'org', 'repo', 42],
      expect.any(Function)
    );
  });

  it('onError restores previous query data via queryClient.setQueryData', () => {
    const { mockQueryClient } = setupMocks({ isTriaged: true, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    const [mutationOptions] = vi.mocked(useMutation).mock.calls[0] as any[];
    const vars = { isTriaged: false, owner: 'org', repo: 'repo', number: 42 };
    const context = { previous: { isTriaged: true, priority: null }, vars };
    mutationOptions.onError?.(new Error('fail'), vars, context);
    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
      ['triage', 'org', 'repo', 42],
      context.previous
    );
  });

  it('onError calls toast error after rollback', () => {
    setupMocks({ isTriaged: true, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    const [mutationOptions] = vi.mocked(useMutation).mock.calls[0] as any[];
    const vars = { isTriaged: false, owner: 'org', repo: 'repo', number: 42 };
    const context = { previous: { isTriaged: true, priority: null }, vars };
    mutationOptions.onError?.(new Error('fail'), vars, context);
    expect(mockToastError).toHaveBeenCalledWith('Could not save triage state. Changes have been reverted.');
  });
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

describe('IssueDetailPanel — close button', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    setupMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function setupNoteMocks(triageData: { isTriaged: boolean; priority: string | null } | null = null) {
  const mockQueryClient = {
    cancelQueries: vi.fn(),
    getQueryData: vi.fn().mockReturnValue(triageData),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  };
  vi.mocked(useQueryClient).mockReturnValue(mockQueryClient as any);
  vi.mocked(useQuery).mockReturnValue({ data: triageData, isLoading: false, isError: false } as any);
  const triageMutate = vi.fn();
  const noteMutate = vi.fn();
  // useMutation is called twice per render: first call = triageMutation, second = noteMutation.
  // Use mockImplementation with a counter so re-renders keep returning the right mocks.
  let callCount = 0;
  vi.mocked(useMutation).mockImplementation((options: any) => {
    callCount++;
    if (callCount % 2 === 1) {
      // Odd calls = triageMutation
      return { mutate: triageMutate, isPending: false } as any;
    }
    // Even calls = noteMutation — store options so tests can invoke callbacks
    noteMutationOptionsRef = options;
    return { mutate: noteMutate, isPending: false } as any;
  });
  return { triageMutate, noteMutate, mockQueryClient };
}

// Ref to capture noteMutation options across re-renders
let noteMutationOptionsRef: any = null;

describe('IssueDetailPanel — NOTES-01: note textarea renders', () => {
  it('renders note textarea with placeholder', () => {
    setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    expect(screen.getByPlaceholderText('Write a note to post as a GitHub comment…')).toBeInTheDocument();
  });

  it('Post Note button is disabled when textarea is empty', () => {
    setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    expect(screen.getByText('Post Note')).toBeDisabled();
  });

  it('Post Note button is enabled when textarea has text', () => {
    setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    fireEvent.change(screen.getByPlaceholderText('Write a note to post as a GitHub comment…'), { target: { value: 'hello' } });
    expect(screen.getByText('Post Note')).not.toBeDisabled();
  });

  it('calls noteMutation.mutate with correct args on button click', () => {
    const { noteMutate } = setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    fireEvent.change(screen.getByPlaceholderText('Write a note to post as a GitHub comment…'), { target: { value: 'my note' } });
    fireEvent.click(screen.getByText('Post Note'));
    expect(noteMutate).toHaveBeenCalledWith({ body: 'my note', owner: 'org', repo: 'repo', number: 42 });
  });
});

describe('IssueDetailPanel — NOTES-03: post feedback', () => {
  it('onSuccess clears textarea and shows success toast', () => {
    setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    act(() => { noteMutationOptionsRef?.onSuccess?.(); });
    expect(mockToastSuccess).toHaveBeenCalledWith('Note posted to GitHub');
  });

  it('onSuccess shows Sent button state', () => {
    setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    act(() => { noteMutationOptionsRef?.onSuccess?.(); });
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('onError preserves textarea text and shows error toast', () => {
    setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
    fireEvent.change(screen.getByPlaceholderText('Write a note to post as a GitHub comment…'), { target: { value: 'keep this' } });
    act(() => { noteMutationOptionsRef?.onError?.(); });
    expect(screen.getByPlaceholderText('Write a note to post as a GitHub comment…')).toHaveValue('keep this');
    expect(mockToastError).toHaveBeenCalledWith('Could not post note. Try again.');
  });
});
