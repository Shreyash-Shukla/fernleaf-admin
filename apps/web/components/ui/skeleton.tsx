import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-[6px] bg-[var(--bg-raised)]', className)}
      {...props}
    />
  );
}

export function TableSkeletonRows({
  columns = 5,
  rows = 5,
  compact = false,
}: {
  columns?: number;
  rows?: number;
  compact?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className={cn('border-b border-[var(--border)]', compact ? 'h-[32px]' : 'h-[40px]')}>
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="px-3 py-2">
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
