import { useState, useMemo, useCallback } from 'react';
import type { Task, TaskPriority, TaskCategory } from '@shared/types/task';

export type SortOption = 'newest' | 'oldest' | 'priority';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function useKanbanFilters(tasks: Task[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const hasActiveFilters = searchQuery.length > 0 || priorities.length > 0 || categories.length > 0;

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setPriorities([]);
    setCategories([]);
    setSortBy('newest');
  }, []);

  const togglePriority = useCallback((priority: TaskPriority) => {
    setPriorities(prev =>
      prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]
    );
  }, []);

  const toggleCategory = useCallback((category: TaskCategory) => {
    setCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Text search (case-insensitive on title and description)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        t => t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
      );
    }

    // Priority filter (OR within)
    if (priorities.length > 0) {
      result = result.filter(t => t.priority && priorities.includes(t.priority));
    }

    // Category filter (OR within)
    if (categories.length > 0) {
      result = result.filter(t => t.category && categories.includes(t.category));
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority': {
          const pa = a.priority ? PRIORITY_ORDER[a.priority] ?? 99 : 99;
          const pb = b.priority ? PRIORITY_ORDER[b.priority] ?? 99 : 99;
          return pa - pb;
        }
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [tasks, searchQuery, priorities, categories, sortBy]);

  return {
    searchQuery,
    setSearchQuery,
    priorities,
    togglePriority,
    categories,
    toggleCategory,
    sortBy,
    setSortBy,
    hasActiveFilters,
    resetFilters,
    filteredTasks,
  };
}
