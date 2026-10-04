import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[6px] text-[13px] font-medium transition-colors duration-120 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed select-none',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--brand-solid)] text-[var(--brand-solid-text)] hover:bg-[var(--brand-hover)] border-0 font-semibold',
        primary:
          'bg-[var(--brand-solid)] text-[var(--brand-solid-text)] hover:bg-[var(--brand-hover)] border-0 font-semibold',
        secondary:
          'bg-[var(--bg-surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--bg-raised)]',
        outline:
          'bg-[var(--bg-surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--bg-raised)]',
        ghost:
          'bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-raised)] border-0',
        destructive:
          'bg-transparent text-[var(--status-danger-fg)] border border-[var(--status-danger-border)] hover:bg-[var(--status-danger-bg)]',
        destructiveSolid:
          'bg-[var(--status-danger-fg)] text-white hover:opacity-90 border-0',
        link:
          'text-[var(--brand-text)] hover:underline p-0 h-auto font-medium border-0',
      },
      size: {
        default: 'h-[32px] px-3 text-[13px]',
        sm: 'h-[28px] px-2.5 text-[12px]',
        lg: 'h-[36px] px-4 text-[14px]',
        icon: 'h-[32px] w-[32px] p-0',
        iconSm: 'h-[28px] w-[28px] p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <svg
              className="animate-spin h-3.5 w-3.5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
