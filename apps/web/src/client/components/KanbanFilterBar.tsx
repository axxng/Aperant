import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
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
import type { TaskPriority, TaskCategory } from '@shared/types/task';
import type { SortOption } from '../hooks/useKanbanFilters';

const ALL_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
const ALL_CATEGORIES: TaskCategory[] = [
  'feature', 'bug_fix', 'refactoring', 'documentation', 'security',
  'performance', 'ui_ux', 'infrastructure', 'testing',
];

interface KanbanFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  priorities: TaskPriority[];
  onTogglePriority: (priority: TaskPriority) => void;
  categories: TaskCategory[];
  onToggleCategory: (category: TaskCategory) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export const KanbanFilterBar = memo(function KanbanFilterBar({
  searchQuery,
  onSearchChange,
  priorities,
  onTogglePriority,
  categories,
  onToggleCategory,
  sortBy,
  onSortChange,
  hasActiveFilters,
  onResetFilters,
}: KanbanFilterBarProps) {
  const { t } = useTranslation('tasks');

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('filters.searchPlaceholder')}
          className={cn(
            'w-full h-8 pl-8 pr-8 rounded-md border border-input bg-background text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('filters.priority')}
            {priorities.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                {priorities.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>{t('filters.priority')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ALL_PRIORITIES.map(p => (
            <DropdownMenuCheckboxItem
              key={p}
              checked={priorities.includes(p)}
              onCheckedChange={() => onTogglePriority(p)}
              onSelect={e => e.preventDefault()}
            >
              {t(`priority.${p}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Category filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('filters.category')}
            {categories.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                {categories.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>{t('filters.category')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ALL_CATEGORIES.map(c => (
            <DropdownMenuCheckboxItem
              key={c}
              checked={categories.includes(c)}
              onCheckedChange={() => onToggleCategory(c)}
              onSelect={e => e.preventDefault()}
            >
              {t(`category.${c}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {t(`filters.sort.${sortBy}`)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>{t('filters.sortBy')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={sortBy} onValueChange={v => onSortChange(v as SortOption)}>
            <DropdownMenuRadioItem value="newest">{t('filters.sort.newest')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="oldest">{t('filters.sort.oldest')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="priority">{t('filters.sort.priority')}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onResetFilters}>
          <X className="h-3.5 w-3.5 mr-1" />
          {t('filters.reset')}
        </Button>
      )}
    </div>
  );
});
