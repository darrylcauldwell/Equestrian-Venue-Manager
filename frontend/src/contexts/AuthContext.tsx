import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  mustChangePassword: boolean;
  isLivery: boolean;  // Specifically a livery client (livery role only)
  isMember: boolean;  // Has member-level access (livery, coach, or admin)
  isCoach: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      authApi.getCurrentUser()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const tokens = await authApi.login(username, password);
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    const userData = await authApi.getCurrentUser();
    setUser(userData);
  };

  const register = async (username: string, name: string, password: string) => {
    await authApi.register(username, name, password);
    await login(username, password);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const refreshUser = async () => {
    const userData = await authApi.getCurrentUser();
    setUser(userData);
  };

  const isLivery = user?.role === 'livery';
  const isMember = user?.role === 'livery' || user?.role === 'coach' || user?.role === 'admin';
  const isCoach = user?.role === 'coach' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const mustChangePassword = user?.must_change_password ?? false;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser, mustChangePassword, isLivery, isMember, isCoach, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
