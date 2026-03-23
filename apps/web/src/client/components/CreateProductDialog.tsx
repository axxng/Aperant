import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProductStore } from '../stores/product-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { PRODUCT_COLORS } from '../../../shared/types/product';
import type { ProductSource } from '../../../shared/types/product';
import { cn } from '../lib/utils';

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SourceType = 'repo' | 'repos' | 'github_project';

export function CreateProductDialog({ open, onOpenChange }: CreateProductDialogProps) {
  const { t } = useTranslation('common');
  const { createProduct, products } = useProductStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('repo');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [multiRepos, setMultiRepos] = useState('');
  const [projectOwner, setProjectOwner] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRODUCT_COLORS[products.length % PRODUCT_COLORS.length]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setSourceType('repo');
    setRepoOwner('');
    setRepoName('');
    setMultiRepos('');
    setProjectOwner('');
    setProjectNumber('');
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    let sources: ProductSource[];
    switch (sourceType) {
      case 'repo':
        if (!repoOwner || !repoName) return;
        sources = [{ type: 'repo', owner: repoOwner, repo: repoName }];
        break;
      case 'repos':
        const repos = multiRepos.split('\n').filter(Boolean).map((line) => {
          const [owner, repo] = line.trim().split('/');
          return { owner, repo };
        }).filter(r => r.owner && r.repo);
        if (repos.length === 0) return;
        sources = [{ type: 'repos', repos }];
        break;
      case 'github_project':
        if (!projectOwner || !projectNumber) return;
        sources = [{ type: 'github_project', owner: projectOwner, projectNumber: parseInt(projectNumber, 10) }];
        break;
    }

    setIsSubmitting(true);
    try {
      await createProduct({ name, description, color: selectedColor, sources });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addProduct')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Mobile App" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {PRODUCT_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-all',
                    selectedColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Source Type */}
          <div className="space-y-1.5">
            <Label>Source Type</Label>
            <div className="flex gap-2">
              {([
                { value: 'repo', label: 'Single Repo' },
                { value: 'repos', label: 'Multiple Repos' },
                { value: 'github_project', label: 'GitHub Project' },
              ] as const).map(({ value, label }) => (
                <Button
                  key={value}
                  variant={sourceType === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceType(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Source Details */}
          {sourceType === 'repo' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Input value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} placeholder="org-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Repository</Label>
                <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="repo-name" />
              </div>
            </div>
          )}

          {sourceType === 'repos' && (
            <div className="space-y-1.5">
              <Label>Repositories (one per line, owner/repo format)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={4}
                value={multiRepos}
                onChange={(e) => setMultiRepos(e.target.value)}
                placeholder="acme/frontend&#10;acme/backend&#10;acme/shared"
              />
            </div>
          )}

          {sourceType === 'github_project' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Input value={projectOwner} onChange={(e) => setProjectOwner(e.target.value)} placeholder="org-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Project Number</Label>
                <Input
                  type="number"
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  placeholder="42"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? t('loading') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
