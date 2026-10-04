'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { fetchApi } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  role: string | null;
  permissions: string[];
  landingPath: string;
  dashboardKey: string;
  isLoading: boolean;
  can: (required: string) => boolean;
  canAny: (required: string[]) => boolean;
  canAll: (required: string[]) => boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  permissions: [],
  landingPath: '/login',
  dashboardKey: '',
  isLoading: true,
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  logout: async () => {},
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [landingPath, setLandingPath] = useState<string>('/home');
  const [dashboardKey, setDashboardKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await fetchApi<any>('/auth/me');

      const resolvedUser: AuthUser | null =
        data?.user ||
        (data?.email
          ? {
              id: data.id || 'usr-default',
              email: data.email,
              name: data.name || data.email.split('@')[0],
            }
          : null);

      const resolvedRole: string =
        data?.role ||
        (typeof data?.role === 'object' ? data.role?.key : null) ||
        'admin';

      const resolvedPermissions: string[] =
        Array.isArray(data?.permissions) && data.permissions.length > 0
          ? data.permissions
          : resolvedRole === 'admin'
          ? ['*']
          : resolvedRole === 'kitchen'
          ? ['kitchen:read', 'kitchen:work', 'orders:read', 'catalogue:read']
          : resolvedRole === 'dispatch'
          ? ['dispatch:read', 'dispatch:work', 'kitchen:read', 'orders:read', 'companies:read', 'deliveries:read_any']
          : ['deliveries:read_own', 'deliveries:deliver'];

      const resolvedLandingPath: string =
        data?.landingPath ||
        (resolvedRole === 'kitchen'
          ? '/kitchen'
          : resolvedRole === 'dispatch'
          ? '/dispatch'
          : resolvedRole === 'driver'
          ? '/driver'
          : '/dashboard');

      setUser(resolvedUser);
      setRole(resolvedRole);
      setPermissions(resolvedPermissions);
      setLandingPath(resolvedLandingPath);
      setDashboardKey(data?.dashboardKey || resolvedRole);
    } catch {
      setUser(null);
      setRole(null);
      setPermissions([]);
      if (pathname !== '/login') {
        window.location.href = '/login';
      }
    } finally {
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const can = useCallback(
    (required: string) => {
      if (!permissions || permissions.length === 0) return false;
      return permissions.includes('*') || permissions.includes(required);
    },
    [permissions]
  );

  const canAny = useCallback(
    (required: string[]) => {
      return required.some((p) => can(p));
    },
    [can]
  );

  const canAll = useCallback(
    (required: string[]) => {
      return required.every((p) => can(p));
    },
    [can]
  );

  const logout = useCallback(async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setUser(null);
      setRole(null);
      setPermissions([]);
      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        landingPath,
        dashboardKey,
        isLoading,
        can,
        canAny,
        canAll,
        logout,
        refetch: fetchMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useCan(permission: string): boolean {
  const { can } = useAuth();
  return can(permission);
}
