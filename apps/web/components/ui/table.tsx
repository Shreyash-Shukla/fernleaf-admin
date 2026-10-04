import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { compact?: boolean }
>(({ className, compact, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn(
        'w-full caption-bottom text-[13px] border-collapse',
        compact && '[&_tr]:h-[32px]',
        className
      )}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-[var(--bg-raised)] border-b border-[var(--border)] sticky top-0 z-10 select-none',
      className
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0 divide-y divide-[var(--border)]', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-[var(--border)] bg-[var(--bg-raised)] font-medium [&>tr]:last:border-b-0 text-[12px] text-[var(--text-muted)]',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { compact?: boolean }
>(({ className, compact, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-[var(--border)] transition-colors duration-120 ease-out hover:bg-[var(--bg-raised)] data-[state=selected]:bg-[var(--brand-soft)] data-[state=selected]:border-l-2 data-[state=selected]:border-l-[var(--brand-solid)]',
      compact ? 'h-[32px]' : 'h-[40px]',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { alignRight?: boolean }
>(({ className, alignRight, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-[36px] px-3 py-1.5 align-middle text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] [&:has([role=checkbox])]:pr-0 select-none whitespace-nowrap',
      alignRight ? 'text-right' : 'text-left',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { alignRight?: boolean; mono?: boolean }
>(({ className, alignRight, mono, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-3 py-2 align-middle text-[13px] leading-[20px] text-[var(--text)] [&:has([role=checkbox])]:pr-0 whitespace-nowrap',
      alignRight && 'text-right tabular-nums',
      mono && 'font-mono text-[12px] text-[var(--text-muted)]',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-[12px] text-[var(--text-muted)]', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
