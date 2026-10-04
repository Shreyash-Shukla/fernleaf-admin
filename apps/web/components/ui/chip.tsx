import React from 'react';
import { cn } from '@/lib/utils';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'company' | 'dietary';
  label?: string;
}

export function Chip({
  children,
  label,
  className,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-[20px] px-1.5 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] text-[11px] font-semibold tracking-normal text-[var(--text-muted)] select-none whitespace-nowrap leading-none',
        className
      )}
      {...props}
    >
      {label || children}
    </span>
  );
}
