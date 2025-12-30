import { useState, useMemo, useCallback } from 'react';

type FilterFn<T> = (item: T) => boolean;
type FilterConfig<T, F> = {
  [K in keyof F]: (filterValue: NonNullable<F[K]>) => FilterFn<T>;
};

/**
 * Manages list filtering with multiple filter criteria.
 * Consolidates: multiple filter useState calls + filtering logic.
 *
 * @example
 * const { filters, setFilter, clearFilters, filtered } = useFilteredList(
 *   tasks,
 *   {
 *     category: (value) => (task) => task.category === value,
 *     priority: (value) => (task) => task.priority === value,
 *     assignedTo: (value) => (task) => task.assigned_to === value,
 *     search: (value) => (task) =>
 *       task.title.toLowerCase().includes(value.toLowerCase()),
 *   }
 * );
 *
 * // Set individual filter
 * <select
 *   value={filters.category || ''}
 *   onChange={(e) => setFilter('category', e.target.value || undefined)}
 * >
 *
 * // Clear all filters
 * <button onClick={clearFilters}>Clear All</button>
 *
 * // Use filtered list
 * {filtered.map(task => <TaskRow key={task.id} task={task} />)}
 */
export function useFilteredList<T, F extends Record<string, unknown>>(
  items: T[],
  filterConfig: FilterConfig<T, F>,
  initialFilters?: Partial<F>
) {
  const [filters, setFilters] = useState<Partial<F>>(initialFilters ?? {});

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K] | undefined) => {
    setFilters(prev => {
      if (value === undefined || value === '' || value === null) {
        const { [key]: _removed, ...rest } = prev;
        void _removed;
        return rest as Partial<F>;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const clearFilter = useCallback(<K extends keyof F>(key: K) => {
    setFilters(prev => {
      const { [key]: _removed, ...rest } = prev;
      void _removed;
      return rest as Partial<F>;
    });
  }, []);

  const filtered = useMemo(() => {
    return items.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === '' || value === null) {
          return true; // Empty filter = include all
        }
        const filterFn = filterConfig[key as keyof F];
        if (!filterFn) return true;
        return (filterFn as (v: NonNullable<F[keyof F]>) => FilterFn<T>)(value as NonNullable<F[keyof F]>)(item);
      });
    });
  }, [items, filters, filterConfig]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== undefined && v !== '' && v !== null).length;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    filters,
    setFilter,
    setFilters,
    clearFilter,
    clearFilters,
    filtered,
    activeFilterCount,
    hasActiveFilters,
  };
}

export default useFilteredList;
