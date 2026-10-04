'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Search,
  LayoutDashboard,
  ShoppingBag,
  ChefHat,
  Truck,
  MapPin,
  Receipt,
  Building2,
  Users2,
  UtensilsCrossed,
  Tags,
  Sliders,
  BadgePercent,
  ShieldAlert,
  PlusCircle,
} from 'lucide-react';

interface RouteItem {
  title: string;
  href: string;
  section: string;
  icon: React.ElementType;
}

const ALL_ROUTES: RouteItem[] = [
  { title: 'Dashboard / Operations Hub', href: '/dashboard', section: 'Overview', icon: LayoutDashboard },
  { title: 'Orders', href: '/orders', section: 'Operations', icon: ShoppingBag },
  { title: 'Create Order', href: '/orders/new', section: 'Operations', icon: PlusCircle },
  { title: 'Kitchen Prep Board', href: '/kitchen', section: 'Operations', icon: ChefHat },
  { title: 'Dispatch Board', href: '/dispatch', section: 'Operations', icon: Truck },
  { title: 'My Deliveries (Driver Run)', href: '/driver', section: 'Operations', icon: MapPin },
  { title: 'Billing & Invoices', href: '/billing', section: 'Operations', icon: Receipt },
  { title: 'Companies (Clients)', href: '/companies', section: 'Management', icon: Building2 },
  { title: 'Employees', href: '/employees', section: 'Management', icon: Users2 },
  { title: 'Dishes Catalogue', href: '/catalogue/dishes', section: 'Menu & Catalogue', icon: UtensilsCrossed },
  { title: 'Option Groups & Choices', href: '/catalogue/options', section: 'Menu & Catalogue', icon: Tags },
  { title: 'Catalogue Reference Data', href: '/catalogue/reference', section: 'Menu & Catalogue', icon: Sliders },
  { title: 'Menu Schedule Setup', href: '/menu', section: 'Menu & Catalogue', icon: UtensilsCrossed },
  { title: 'Pricing Tiers', href: '/pricing', section: 'Menu & Catalogue', icon: BadgePercent },
  { title: 'Cut-off & Settings', href: '/settings', section: 'System', icon: Sliders },
  { title: 'Staff Users & Permissions', href: '/staff', section: 'System', icon: ShieldAlert },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = ALL_ROUTES.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase()) ||
    r.section.toLowerCase().includes(query.toLowerCase()) ||
    r.href.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
      }
      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          router.push(filtered[selectedIndex].href);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, filtered, selectedIndex, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-elevation)] overflow-hidden"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 border-b border-[var(--border)] h-[44px]">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0 mr-2.5" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or jump to route..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-raised)] border border-[var(--border)] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.href}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-[6px] text-[13px] cursor-pointer transition-colors duration-120',
                    isSelected
                      ? 'bg-[var(--bg-raised)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] font-mono">
                    {item.section}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-[12px] text-[var(--text-muted)]">
              No matching routes found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
