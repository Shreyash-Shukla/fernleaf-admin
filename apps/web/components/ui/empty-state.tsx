import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType;
  message?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = Inbox,
  message,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
  ...props
}: EmptyStateProps) {
  const displayTitle = title || message || 'No data available';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center select-none',
        className
      )}
      {...props}
    >
      <Icon className="w-8 h-8 text-[var(--text-faint)] mb-2.5 stroke-[1.5]" />
      <p className="text-[13px] font-medium text-[var(--text-muted)] max-w-sm">
        {displayTitle}
      </p>
      {description && (
        <p className="text-[12px] text-[var(--text-faint)] max-w-sm mt-0.5 mb-3">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className={description ? '' : 'mt-3'}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
