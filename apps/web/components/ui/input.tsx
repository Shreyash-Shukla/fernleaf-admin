import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-[32px] w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors duration-120 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 select-text',
            error && 'border-[var(--status-danger-fg)] focus-visible:ring-[var(--status-danger-fg)]',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-[11px] text-[var(--status-danger-fg)] font-medium">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
