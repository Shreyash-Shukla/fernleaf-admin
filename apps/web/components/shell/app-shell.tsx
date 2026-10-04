'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { ShieldX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AppShellProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredAnyPermissions?: string[];
}

export function AppShell({
  children,
  requiredPermission,
  requiredAnyPermissions,
}: AppShellProps) {
  const { user, isLoading, can, canAny, role, landingPath } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center text-[var(--text-muted)] gap-3 select-none">
        <div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--brand-solid)] rounded-full animate-spin" />
        <p className="text-[13px] font-medium text-[var(--text-muted)]">Loading workspace...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center text-[var(--text-muted)] select-none">
        <div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--brand-solid)] rounded-full animate-spin" />
      </div>
    );
  }

  // Check permissions
  const hasAccess =
    (!requiredPermission || can(requiredPermission)) &&
    (!requiredAnyPermissions || canAny(requiredAnyPermissions));

  if (!hasAccess) {
    return (
      <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text)] overflow-hidden min-w-[1280px]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-[8px] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-fg)] flex items-center justify-center mb-3">
              <ShieldX className="w-6 h-6" />
            </div>
            <h1 className="text-[20px] font-semibold text-[var(--text)] mb-1">Access Restricted</h1>
            <p className="text-[13px] text-[var(--text-muted)] max-w-md mb-5">
              Your current role ({role}) does not have permission to view this section.
            </p>
            <Link href={landingPath || '/home'}>
              <Button variant="primary">Return to Your Hub</Button>
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text)] overflow-hidden min-w-[1280px]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-app)]">
          <div className="max-w-[1720px] mx-auto w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
