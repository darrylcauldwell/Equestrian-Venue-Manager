import { useState, useCallback, useMemo } from 'react';

/**
 * Manages multiple named loading states for complex components with many async operations.
 *
 * @example
 * const { isLoading, startLoading, stopLoading, withLoading } = useLoadingStates(
 *   'initial',   // starts as loading
 *   'saving',
 *   'uploading',
 *   'deleting'
 * );
 *
 * // Check specific state
 * if (isLoading('saving')) { ... }
 *
 * // Check if any operation is loading
 * if (isLoading()) { ... }
 *
 * // Manual control
 * startLoading('saving');
 * await api.save();
 * stopLoading('saving');
 *
 * // Or use wrapper
 * await withLoading('saving', async () => {
 *   await api.save();
 * });
 */
export function useLoadingStates<K extends string>(...initialLoading: K[]) {
  const [loadingStates, setLoadingStates] = useState<Set<K>>(
    () => new Set(initialLoading)
  );

  const startLoading = useCallback((key: K) => {
    setLoadingStates(prev => new Set([...prev, key]));
  }, []);

  const stopLoading = useCallback((key: K) => {
    setLoadingStates(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const isLoading = useCallback((key?: K): boolean => {
    if (key === undefined) {
      return loadingStates.size > 0;
    }
    return loadingStates.has(key);
  }, [loadingStates]);

  const withLoading = useCallback(async <T>(
    key: K,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    startLoading(key);
    try {
      return await asyncFn();
    } finally {
      stopLoading(key);
    }
  }, [startLoading, stopLoading]);

  // For destructuring convenience: { saving, uploading, ... }
  const states = useMemo(() => {
    const obj = {} as Record<K, boolean>;
    loadingStates.forEach(key => {
      obj[key] = true;
    });
    return obj;
  }, [loadingStates]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    withLoading,
    states,
    anyLoading: loadingStates.size > 0,
  };
}

export default useLoadingStates;
