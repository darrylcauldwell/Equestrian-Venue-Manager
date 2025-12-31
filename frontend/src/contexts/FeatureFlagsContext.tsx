import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { FeatureKey, FeatureGroup, FeatureFlagInfo, FeatureGroupInfo } from '../types';
import { featureFlagsApi } from '../services/api';
import { useAuth } from './AuthContext';

interface FeatureFlagsContextType {
  flags: Record<string, FeatureFlagInfo>;
  groups: Record<string, FeatureGroupInfo>;
  isLoading: boolean;
  error: string | null;
  isFeatureEnabled: (key: FeatureKey) => boolean;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

// Default flags when not authenticated or loading
const defaultFlags: Record<string, FeatureFlagInfo> = {};
const defaultGroups: Record<string, FeatureGroupInfo> = {};

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, FeatureFlagInfo>>(defaultFlags);
  const [groups, setGroups] = useState<Record<string, FeatureGroupInfo>>(defaultGroups);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const loadFlags = useCallback(async () => {
    if (!isAuthenticated) {
      setFlags(defaultFlags);
      setGroups(defaultGroups);
      setIsLoading(false);
      return;
    }

    // Set loading state at start of authenticated fetch
    setIsLoading(true);

    try {
      setError(null);
      // Admin users get full flag info, others just get enabled list
      if (user?.role === 'admin') {
        const data = await featureFlagsApi.getAll();
        setFlags(data.flags);
        setGroups(data.groups);
      } else {
        // Non-admin users get a simplified view
        const data = await featureFlagsApi.getEnabled();
        // Convert to flags format
        const enabledFlags: Record<string, FeatureFlagInfo> = {};
        for (const feature of data.features) {
          enabledFlags[feature] = {
            enabled: true,
            group: 'core' as FeatureGroup,
            locked: false,
            dependencies: [],
            dependents: [],
          };
        }
        setFlags(enabledFlags);
      }
    } catch (err) {
      console.error('Failed to load feature flags:', err);
      setError('Failed to load feature configuration');
      // On error, assume all features enabled to avoid breaking the app
      setFlags(defaultFlags);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const isFeatureEnabled = useCallback((key: FeatureKey): boolean => {
    // If flags haven't loaded yet or user is not authenticated,
    // default to enabled to avoid blocking navigation during load
    if (isLoading || !isAuthenticated) {
      return true;
    }

    const flag = flags[key];
    // If flag doesn't exist in our data, assume enabled (safer default)
    if (!flag) {
      return true;
    }
    return flag.enabled;
  }, [flags, isLoading, isAuthenticated]);

  const refreshFlags = async () => {
    setIsLoading(true);
    await loadFlags();
  };

  return (
    <FeatureFlagsContext.Provider
      value={{
        flags,
        groups,
        isLoading,
        error,
        isFeatureEnabled,
        refreshFlags,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}

/**
 * Hook to check if a specific feature is enabled
 * Returns true during loading to avoid flickering
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlag(key: FeatureKey): boolean {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled(key);
}
