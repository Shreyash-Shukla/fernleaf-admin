'use client';

import React, { useEffect, useState } from 'react';
import { subscribeToWakingState } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export function WakingIndicator() {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    return subscribeToWakingState((waking) => {
      setIsWaking(waking);
    });
  }, []);

  if (!isWaking) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 bg-[var(--bg-surface)] text-[var(--status-success-fg)] border border-[var(--status-success-border)] rounded-full shadow-[var(--shadow-elevation)] backdrop-blur-md text-xs font-medium animate-pulse">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--status-success-fg)]" />
      <span>Waking server… Initial response may take a moment</span>
    </div>
  );
}
