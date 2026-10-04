'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // e.g. 3
  max?: number; // e.g. 4
  showText?: boolean;
  statusOverride?: 'info' | 'success' | 'warning' | 'danger';
  isLate?: boolean;
  isAtRisk?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  showText = true,
  statusOverride,
  isLate,
  isAtRisk,
  className,
  ...props
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const percentage = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));

  // Color logic per spec:
  // info by default; success at 100%; warning if the item is at risk; danger if late
  let fillColor = 'bg-[var(--status-info-fg)]';
  if (statusOverride) {
    if (statusOverride === 'danger') fillColor = 'bg-[var(--status-danger-fg)]';
    else if (statusOverride === 'warning') fillColor = 'bg-[var(--status-warning-fg)]';
    else if (statusOverride === 'success') fillColor = 'bg-[var(--status-success-fg)]';
    else fillColor = 'bg-[var(--status-info-fg)]';
  } else if (isLate) {
    fillColor = 'bg-[var(--status-danger-fg)]';
  } else if (isAtRisk) {
    fillColor = 'bg-[var(--status-warning-fg)]';
  } else if (percentage >= 100) {
    fillColor = 'bg-[var(--status-success-fg)]';
  }

  return (
    <div className={cn('flex items-center gap-2.5 w-full select-none', className)} {...props}>
      <div className="relative flex-1 h-[6px] rounded-[3px] bg-[var(--bg-raised)] border border-[var(--border)] overflow-hidden">
        <div
          className={cn('h-full transition-all duration-120 ease-out rounded-[3px]', fillColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showText && (
        <span className="text-[12px] font-mono tabular-nums text-[var(--text-muted)] shrink-0 whitespace-nowrap">
          {value} / {max}
        </span>
      )}
    </div>
  );
}
