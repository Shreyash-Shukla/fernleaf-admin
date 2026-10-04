'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Menu, Clock, Calendar, ShieldCheck, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

export function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { user, role, logout } = useAuth();
  const router = useRouter();

  // Fetch kitchen meta (today, timezone)
  const { data: meta } = useQuery<{
    today: string;
    nowIso: string;
    timezone: string;
  }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
    staleTime: 60000,
  });

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20 sticky top-0">
      {/* Left: Mobile Toggle & Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Server Context / Date info */}
        {meta && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Today: <strong className="text-slate-200">{formatDate(meta.today)}</strong></span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Zone: <strong className="text-slate-200">{meta.timezone}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Role info + Quick Role Switcher (for fast testing) + Logout */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 py-1 px-2.5 bg-slate-900 border-slate-700/80 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="capitalize">{role} access</span>
        </Badge>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-slate-200">{user?.name}</div>
            <div className="text-[11px] text-slate-400">{user?.email}</div>
          </div>

          <button
            onClick={() => logout()}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-800 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
