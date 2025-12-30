import { useState, useCallback } from 'react';

/**
 * Manages async request state: loading, error, and success messages.
 * Consolidates the common pattern of useState for loading + error + success.
 *
 * @example
 * const { loading, error, success, setLoading, setError, setSuccess, reset, withRequest } = useRequestState();
 *
 * // Option 1: Manual control
 * setLoading(true);
 * try {
 *   await api.call();
 *   setSuccess('Saved successfully');
 * } catch (e) {
 *   setError(e.message);
 * } finally {
 *   setLoading(false);
 * }
 *
 * // Option 2: Using withRequest wrapper
 * await withRequest(async () => {
 *   await api.call();
 *   return 'Saved successfully'; // Optional success message
 * });
 */
export function useRequestState(initialLoading = false) {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  const clearError = useCallback(() => setError(''), []);
  const clearSuccess = useCallback(() => setSuccess(''), []);

  /**
   * Wraps an async function with automatic loading/error/success handling.
   * Returns the result of the async function, or undefined if it failed.
   */
  const withRequest = useCallback(async <T>(
    asyncFn: () => Promise<T | string | void>,
    options?: {
      successMessage?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<T | undefined> => {
    reset();
    setLoading(true);
    try {
      const result = await asyncFn();
      // If the function returns a string, treat it as a success message
      if (typeof result === 'string') {
        setSuccess(result);
      } else if (options?.successMessage) {
        setSuccess(options.successMessage);
      }
      options?.onSuccess?.(result as T);
      return result as T;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred';
      setError(errorMessage);
      options?.onError?.(e as Error);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [reset]);

  return {
    loading,
    error,
    success,
    setLoading,
    setError,
    setSuccess,
    reset,
    clearError,
    clearSuccess,
    withRequest,
  };
}

export default useRequestState;
