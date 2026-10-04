import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

export interface StateBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'error' | 'warning' | 'info';
  message: string;
  onRetry?: () => void;
  timestamp?: string;
}

export function StateBanner({
  variant = 'error',
  message,
  onRetry,
  timestamp,
  className,
  ...props
}: StateBannerProps) {
  const isError = variant === 'error';
  const isWarning = variant === 'warning';

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-between px-3.5 py-2.5 rounded-[6px] border text-[13px]',
        isError && 'bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border-[var(--status-danger-border)]',
        isWarning && 'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border-[var(--status-warning-border)]',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {isError ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-[var(--status-danger-fg)]" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--status-warning-fg)]" />
        )}
        <span>{message}</span>
        {timestamp && (
          <span className="text-[12px] opacity-80 font-mono">({timestamp})</span>
        )}
      </div>

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="h-[24px] px-2 text-[11px] shrink-0 ml-3"
        >
          <RefreshCw className="w-3 h-3 mr-1" /> Retry
        </Button>
      )}
    </div>
  );
}
