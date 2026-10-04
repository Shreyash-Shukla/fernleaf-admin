import React from 'react';
import { cn, getStatusCategory, StatusCategory } from '@/lib/utils';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: string | null;
  category?: StatusCategory;
  label?: string;
  pulse?: boolean;
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusBadge({
  status,
  category: explicitCategory,
  label: explicitLabel,
  pulse: explicitPulse,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const resolvedCategory = explicitCategory || getStatusCategory(status || (typeof children === 'string' ? children : ''));
  const rawLabel = explicitLabel || (status ? toTitleCase(status) : (typeof children === 'string' ? children : ''));
  const isLate = rawLabel.toLowerCase().includes('late') || explicitPulse || (resolvedCategory === 'danger' && rawLabel.toLowerCase().includes('overdue'));

  const stylesByCategory: Record<StatusCategory, { bg: string; text: string; border: string; dot: string }> = {
    neutral: {
      bg: 'bg-status-neutral-bg',
      text: 'text-status-neutral',
      border: 'border-status-neutral-border',
      dot: 'bg-status-neutral',
    },
    info: {
      bg: 'bg-status-info-bg',
      text: 'text-status-info',
      border: 'border-status-info-border',
      dot: 'bg-status-info',
    },
    warning: {
      bg: 'bg-status-warning-bg',
      text: 'text-status-warning',
      border: 'border-status-warning-border',
      dot: 'bg-status-warning',
    },
    danger: {
      bg: 'bg-status-danger-bg',
      text: 'text-status-danger',
      border: 'border-status-danger-border',
      dot: 'bg-status-danger',
    },
    success: {
      bg: 'bg-status-success-bg',
      text: 'text-status-success',
      border: 'border-status-success-border',
      dot: 'bg-status-success',
    },
  };

  const style = stylesByCategory[resolvedCategory];

  return (
    <div
      className={cn(
        'inline-flex min-w-0 max-w-full shrink-0 items-center gap-1.5 h-[22px] px-2 rounded-[6px] border text-[12px] font-medium leading-none select-none tracking-normal',
        style.bg,
        style.text,
        style.border,
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          style.dot,
          isLate && 'animate-late-pulse'
        )}
      />
      <span className="truncate">{rawLabel || children}</span>
    </div>
  );
}
