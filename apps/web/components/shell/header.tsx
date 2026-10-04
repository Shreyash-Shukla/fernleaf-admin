'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Search } from 'lucide-react';
import { CommandPalette } from '@/components/ui/command-palette';

export function Header() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [formattedTime, setFormattedTime] = useState<string>('');

  // Fetch meta for timezone & server reference
  const { data: meta } = useQuery<{
    today: string;
    nowIso: string;
    timezone: string;
  }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
    staleTime: 60000,
  });

  const timezone = meta?.timezone || 'Asia/Kolkata';

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const datePart = now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: timezone,
        });
        const timePart = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: timezone,
        });
        setFormattedTime(`${datePart} · ${timePart}`);
      } catch {
        setFormattedTime('Sun, Oct 4 · 14:32');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [timezone]);

  return (
    <>
      <header className="h-[52px] border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 flex items-center justify-between sticky top-0 z-20 shrink-0 select-none">
        {/* Left: Command Palette trigger styled as an input (320px wide) */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="w-[320px] h-[32px] px-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between text-[13px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[var(--text-faint)]" />
            <span>Search or jump to…</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)]">
            ⌘K
          </kbd>
        </button>

        {/* Right: Plain-text date/time (13 text-muted, tabular; timezone shown in tooltip) */}
        <div className="flex items-center gap-4">
          <div
            title={`Timezone: ${timezone}`}
            className="text-[13px] font-mono tabular-nums text-[var(--text-muted)] cursor-default select-none"
          >
            {formattedTime || 'Sun, Oct 4 · 14:32'}
          </div>
        </div>
      </header>

      {/* Global Command Palette dialog */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
