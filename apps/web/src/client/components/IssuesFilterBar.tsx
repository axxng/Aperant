import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Tag, User } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';
import type { IssuesFilters } from '../hooks/useIssuesFilters';

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

interface IssuesFilterBarProps {
  filters: IssuesFilters;
  search: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (updates: Partial<IssuesFilters>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  availableLabels: GitHubLabel[];
  labelsError: boolean;
  availableAssignees: string[];
}

export const IssuesFilterBar = memo(function IssuesFilterBar({
  filters,
  search,
  onSearchChange,
  onFilterChange,
  onReset,
  hasActiveFilters,
  availableLabels,
  labelsError,
  availableAssignees,
}: IssuesFilterBarProps) {
  const { t } = useTranslation('issues');

  const handleToggleLabel = (labelName: string) => {
    const next = filters.labels.includes(labelName)
      ? filters.labels.filter(l => l !== labelName)
      : [...filters.labels, labelName];
    onFilterChange({ labels: next });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('filters.searchPlaceholder')}
          className={cn(
            'w-full h-8 pl-8 pr-8 rounded-md border border-input bg-background text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* State toggle: Open / Closed */}
      <div className="flex items-center rounded-md border border-input overflow-hidden h-8">
        <button
          onClick={() => onFilterChange({ state: 'open' })}
          className={cn(
            'px-3 text-xs h-full transition-colors',
            filters.state === 'open'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          {t('filters.open')}
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={() => onFilterChange({ state: 'closed' })}
          className={cn(
            'px-3 text-xs h-full transition-colors',
            filters.state === 'closed'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          {t('filters.closed')}
        </button>
      </div>

      {/* Label multi-select dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {t('filters.labels')}
            {filters.labels.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                {filters.labels.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{t('filters.labels')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {labelsError ? (
            <p className="px-2 py-1.5 text-xs text-destructive">{t('error.labelsFetch')}</p>
          ) : availableLabels.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">—</p>
          ) : (
            availableLabels.map(label => (
              <DropdownMenuCheckboxItem
                key={label.name}
                checked={filters.labels.includes(label.name)}
                onCheckedChange={() => handleToggleLabel(label.name)}
                onSelect={e => e.preventDefault()}
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0 mr-1.5"
                  style={{ backgroundColor: `#${label.color}` }}
                />
                {label.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assignee single-select dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <User className="h-3.5 w-3.5" />
            {filters.assignee ? filters.assignee : t('filters.assignee')}
            {filters.assignee && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">1</Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>{t('filters.assignee')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={filters.assignee}
            onValueChange={v => onFilterChange({ assignee: v })}
          >
            <DropdownMenuRadioItem value="">
              {t('filters.allAssignees')}
            </DropdownMenuRadioItem>
            {availableAssignees.map(login => (
              <DropdownMenuRadioItem key={login} value={login}>
                {login}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset button — visible only when any filter is active */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={onReset}
          aria-label={t('filters.resetAriaLabel')}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          <span>{t('filters.reset')}</span>
        </Button>
      )}
    </div>
  );
});
