'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  count?: number | string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[] | { value: T; label: React.ReactNode; count?: number | string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'default' | 'sm';
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center p-[2px] rounded-[8px] bg-[var(--bg-raised)] border border-[var(--border)] select-none',
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'h-[28px] px-3 rounded-[6px] text-[12px] font-medium transition-colors duration-120 ease-out flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]',
              isSelected
                ? 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] font-semibold shadow-none'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface)]/40 border border-transparent'
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  'text-[11px] tabular-nums font-mono',
                  isSelected ? 'text-[var(--text-muted)]' : 'text-[var(--text-faint)]'
                )}
              >
                ({opt.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
