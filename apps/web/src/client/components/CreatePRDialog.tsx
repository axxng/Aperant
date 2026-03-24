import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { GitPullRequest, ExternalLink, Loader2 } from 'lucide-react';
import type { Task } from '@shared/types/task';
import type { GitHubBranch, GitHubPullRequestResult } from '@shared/types/github';

interface CreatePRDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePRDialog({ task, open, onOpenChange }: CreatePRDialogProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [head, setHead] = useState('');
  const [base, setBase] = useState('');
  const [draft, setDraft] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GitHubPullRequestResult | null>(null);

  const repo = task?.githubRepo;
  const [owner, repoName] = repo ? repo.split('/') : ['', ''];

  // Load branches when dialog opens
  useEffect(() => {
    if (open && owner && repoName) {
      setIsLoadingBranches(true);
      api.github.getBranches(owner, repoName)
        .then(setBranches)
        .catch(() => setBranches([]))
        .finally(() => setIsLoadingBranches(false));
    }
  }, [open, owner, repoName]);

  // Reset form when task changes
  useEffect(() => {
    if (task && open) {
      setTitle(task.title);
      setBody(task.githubIssueNumber
        ? `Closes #${task.githubIssueNumber}\n\n${task.description}`
        : task.description
      );
      setHead('');
      setBase('');
      setDraft(false);
      setError(null);
      setResult(null);
    }
  }, [task, open]);

  // Set default base branch once branches load
  useEffect(() => {
    if (branches.length > 0 && !base) {
      const main = branches.find(b => b.name === 'main') || branches.find(b => b.name === 'master');
      if (main) setBase(main.name);
    }
  }, [branches, base]);

  const handleSubmit = useCallback(async () => {
    if (!owner || !repoName || !title.trim() || !head || !base) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const pr = await api.github.createPullRequest(owner, repoName, {
        title: title.trim(),
        body: body.trim() || undefined,
        head,
        base,
        draft: draft || undefined,
      });
      setResult(pr);
    } catch (err: any) {
      setError(err.message || 'Failed to create pull request');
    } finally {
      setIsSubmitting(false);
    }
  }, [owner, repoName, title, body, head, base, draft]);

  if (!task || !repo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-green-500" />
            <DialogTitle>{t('tasks:pr.createTitle')}</DialogTitle>
          </div>
        </DialogHeader>

        {result ? (
          // Success state
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <GitPullRequest className="h-5 w-5" />
              <span className="font-medium">{t('tasks:pr.created')}</span>
              <Badge variant="outline">#{result.number}</Badge>
              {result.draft && <Badge variant="secondary">{t('tasks:pr.draft')}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{result.title}</p>
            <a
              href={result.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('tasks:pr.viewOnGitHub')}
            </a>
          </div>
        ) : (
          // Form
          <div className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground">
              {repo}
              {task.githubIssueNumber && ` · Issue #${task.githubIssueNumber}`}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>{t('tasks:pr.prTitle')}</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('tasks:pr.titlePlaceholder')}
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label>{t('tasks:pr.body')}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={t('tasks:pr.bodyPlaceholder')}
              />
            </div>

            {/* Branches */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('tasks:pr.headBranch')}</Label>
                {isLoadingBranches ? (
                  <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('common:loading')}
                  </div>
                ) : (
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={head}
                    onChange={e => setHead(e.target.value)}
                  >
                    <option value="">{t('tasks:pr.selectBranch')}</option>
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('tasks:pr.baseBranch')}</Label>
                {isLoadingBranches ? (
                  <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('common:loading')}
                  </div>
                ) : (
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={base}
                    onChange={e => setBase(e.target.value)}
                  >
                    <option value="">{t('tasks:pr.selectBranch')}</option>
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Draft toggle */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft}
                onChange={e => setDraft(e.target.checked)}
                className="rounded border-input"
              />
              {t('tasks:pr.createAsDraft')}
            </label>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? t('common:close') : t('common:cancel')}
          </Button>
          {!result && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || !head || !base || head === base}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {t('common:loading')}
                </>
              ) : (
                <>
                  <GitPullRequest className="h-4 w-4 mr-1" />
                  {t('tasks:pr.create')}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
