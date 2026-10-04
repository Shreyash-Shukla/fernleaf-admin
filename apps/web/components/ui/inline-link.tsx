import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InlineLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

export function InlineLink({ href, children, className, ...props }: InlineLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 text-[13px] font-medium text-[var(--brand-text)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] rounded-[2px]',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ArrowRight className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
    </Link>
  );
}
