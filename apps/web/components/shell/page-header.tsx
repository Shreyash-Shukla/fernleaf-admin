'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export interface DemoToolItem {
  label: string;
  onClick: () => void;
  loading?: boolean;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  actions?: React.ReactNode;
  demoTools?: DemoToolItem[];
  demoActions?: DemoToolItem[];
  contextBar?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  actions,
  demoTools,
  demoActions,
  contextBar,
  className,
}: PageHeaderProps) {
  const tools = demoActions || demoTools;

  return (
    <div className={cn('space-y-3 select-none', className)}>
      {/* Top Header Row (no card) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-[28px] text-[var(--text)] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] leading-[18px] text-[var(--text-muted)] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {secondaryActions}
          {primaryAction}
          {actions}

          {/* Demo tools overflow menu */}
          {tools && tools.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-solid)] transition-colors">
                <MoreHorizontal className="w-4 h-4" />
                <span className="sr-only">Demo tools</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                  Demo tools
                </DropdownMenuLabel>
                {tools.map((tool, idx) => (
                  <DropdownMenuItem
                    key={idx}
                    onClick={tool.onClick}
                    disabled={tool.loading}
                    className="text-[13px] cursor-pointer"
                  >
                    {tool.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Context Bar (40px high) if provided */}
      {contextBar && (
        <div className="h-10 px-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[8px] flex items-center justify-between gap-3 text-[13px]">
          {contextBar}
        </div>
      )}
    </div>
  );
}
