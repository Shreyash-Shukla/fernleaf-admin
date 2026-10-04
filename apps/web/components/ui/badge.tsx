import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border-[var(--status-success-border)]',
        secondary:
          'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)] border-[var(--status-neutral-border)]',
        destructive:
          'bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border-[var(--status-danger-border)]',
        warning:
          'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border-[var(--status-warning-border)]',
        info:
          'bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border-[var(--status-info-border)]',
        outline:
          'bg-transparent text-[var(--text-muted)] border-[var(--border-strong)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
