'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { ShieldX, Loader2 } from 'lucide-react';
import Link from 'next/link';

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
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">Checking authorization...</p>
      </div>
    );
  }

  if (!user) {
    // AuthProvider will push to /login, show fallback while navigating
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  // Check permissions
  const hasAccess =
    (!requiredPermission || can(requiredPermission)) &&
    (!requiredAnyPermissions || canAny(requiredAnyPermissions));

  if (!hasAccess) {
    return (
      <div className="flex h-screen bg-slate-950 overflow-hidden">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <Header onOpenMobile={() => setMobileOpen(true)} />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <ShieldX className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              Your current role ({role}) does not have permission to view this page.
            </p>
            <Link
              href={landingPath || '/home'}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Return to Your Hub
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 w-72 max-w-[85vw] h-full shadow-2xl">
            <Sidebar onCloseMobile={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
