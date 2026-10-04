'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
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
  BadgePercent,
  Sliders,
  ShieldAlert,
  LogOut,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Moon,
  Sun,
  Leaf,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  exact?: boolean;
  lateBadgeKey?: 'kitchen' | 'dispatch' | 'driver';
}

export function Sidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const { user, role, can, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Collapsible state (remembered in localStorage)
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fernleaf_sidebar_collapsed');
      if (stored === 'true') {
        setCollapsed(true);
      }
    } catch {
      // Ignore
    }
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('fernleaf_sidebar_collapsed', String(next));
    } catch {
      // Ignore
    }
  };

  // Fetch kitchen meta & alerts for badges if available
  const { data: meta } = useQuery<{ today: string }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
    staleTime: 60000,
  });

  const today = meta?.today || new Date().toISOString().slice(0, 10);

  const { data: kitchenData } = useQuery<any>({
    queryKey: ['kitchen', 'sidebar-badge', today],
    queryFn: () => fetchApi(`/kitchen/board?date=${today}`).catch(() => null),
    staleTime: 30000,
    enabled: can('kitchen:read'),
  });

  const { data: dispatchData } = useQuery<any>({
    queryKey: ['dispatch', 'sidebar-badge', today],
    queryFn: () => fetchApi(`/dispatch/board?date=${today}`).catch(() => null),
    staleTime: 30000,
    enabled: can('dispatch:read'),
  });

  const lateKitchenCount = kitchenData?.summary?.lateCount ?? kitchenData?.lateOrdersCount ?? 0;
  const delayedDispatchCount = dispatchData?.summary?.behindScheduleCount ?? 0;

  const navSections: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        {
          title: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      label: 'Operations',
      items: [
        {
          title: 'Orders',
          href: '/orders',
          icon: ShoppingBag,
          permission: 'orders:read',
        },
        {
          title: 'Kitchen Board',
          href: '/kitchen',
          icon: ChefHat,
          permission: 'kitchen:read',
          lateBadgeKey: 'kitchen',
        },
        {
          title: 'Dispatch Board',
          href: '/dispatch',
          icon: Truck,
          permission: 'dispatch:read',
          lateBadgeKey: 'dispatch',
        },
        {
          title: 'My Deliveries',
          href: '/driver',
          icon: MapPin,
          permission: 'deliveries:read_own',
          lateBadgeKey: 'driver',
        },
        {
          title: 'Billing & Invoices',
          href: '/billing',
          icon: Receipt,
          permission: 'billing:read',
        },
      ],
    },
    {
      label: 'Management',
      items: [
        {
          title: 'Companies',
          href: '/companies',
          icon: Building2,
          permission: 'companies:read',
        },
        {
          title: 'Employees',
          href: '/employees',
          icon: Users2,
          permission: 'employees:read',
        },
      ],
    },
    {
      label: 'Menu & Catalogue',
      items: [
        {
          title: 'Dishes',
          href: '/catalogue/dishes',
          icon: UtensilsCrossed,
          permission: 'catalogue:read',
        },
        {
          title: 'Options',
          href: '/catalogue/options',
          icon: Tags,
          permission: 'catalogue:read',
        },
        {
          title: 'Reference Data',
          href: '/catalogue/reference',
          icon: Sliders,
          permission: 'catalogue:read',
        },
        {
          title: 'Menu Setup',
          href: '/menu',
          icon: UtensilsCrossed,
          permission: 'catalogue:read',
        },
        {
          title: 'Pricing Tiers',
          href: '/pricing',
          icon: BadgePercent,
          permission: 'pricing:read',
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          title: 'Settings & Cut-off',
          href: '/settings',
          icon: Sliders,
          permission: 'settings:read',
        },
        {
          title: 'Staff Users',
          href: '/staff',
          icon: ShieldAlert,
          permission: 'staff:read',
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'bg-[var(--bg-surface)] border-r border-[var(--border)] flex flex-col h-full select-none shrink-0 transition-[width] duration-120 ease-out',
        collapsed ? 'w-[64px]' : 'w-[240px]'
      )}
    >
      {/* Top Header */}
      <div className="h-[52px] flex items-center justify-between px-3 border-b border-[var(--border)] shrink-0">
        <Link
          href={role === 'driver' ? '/driver' : role === 'kitchen' ? '/kitchen' : role === 'dispatch' ? '/dispatch' : '/dashboard'}
          className="flex items-center gap-2.5 overflow-hidden"
          onClick={onCloseMobile}
        >
          <div className="w-7 h-7 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--text)] shrink-0">
            <Leaf className="w-4 h-4 text-[var(--text)]" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <span className="font-semibold text-[15px] leading-tight text-[var(--text)] block truncate">
                Fernleaf
              </span>
              <span className="text-[11px] leading-none uppercase tracking-[0.04em] text-[var(--text-muted)] block mt-0.5">
                Kitchen Admin
              </span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-raised)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Action Button: "New order" (Full width 32px) */}
      {can('orders:write') && (
        <div className="p-3 pb-1 shrink-0">
          <Link
            href="/orders/new"
            onClick={onCloseMobile}
            className={cn(
              'h-[32px] rounded-[6px] bg-[var(--brand-solid)] text-[var(--brand-solid-text)] hover:bg-[var(--brand-hover)] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors duration-120 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
              collapsed ? 'w-full px-0' : 'w-full px-3'
            )}
            title="New order"
          >
            <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
            {!collapsed && <span>New order</span>}
          </Link>
        </div>
      )}

      {/* Nav List (Independently scrolling, hidden scrollbar, no item clipped) */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-2 px-2 space-y-4">
        {navSections.map((section, idx) => {
          const visibleItems = section.items.filter((item) => {
            if (!item.permission) return true;
            return can(item.permission);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-0.5">
              {section.label && !collapsed && (
                <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-faint)]">
                  {section.label}
                </div>
              )}
              {visibleItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                // Check late badge count
                let badgeCount = 0;
                if (item.lateBadgeKey === 'kitchen') badgeCount = lateKitchenCount;
                if (item.lateBadgeKey === 'dispatch') badgeCount = delayedDispatchCount;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      'flex items-center h-[36px] rounded-[6px] text-[14px] font-medium transition-colors duration-120 ease-out group',
                      collapsed ? 'justify-center px-0' : 'px-3 gap-2',
                      isActive
                        ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-l-2 border-[var(--brand-solid)] rounded-l-none'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-raised)]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-[var(--brand-text)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'
                      )}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate leading-none">
                        {item.title}
                      </span>
                    )}

                    {badgeCount > 0 && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold leading-none bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border border-[var(--status-danger-border)]',
                          collapsed ? 'absolute top-1 right-1' : 'ml-auto'
                        )}
                        title={`${badgeCount} delayed/late items`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Fixed Footer with User Menu & Theme Switcher */}
      <div className="p-2 border-t border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'w-full flex items-center rounded-[6px] hover:bg-[var(--bg-raised)] p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] text-left',
                collapsed ? 'justify-center' : 'gap-2.5'
              )}
            >
              <div className="w-7 h-7 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center text-[12px] font-semibold text-[var(--text)] shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text)] truncate leading-tight">
                    {user?.name || 'Staff User'}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] capitalize truncate leading-tight mt-0.5">
                    {role || 'Role'}
                  </div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align={collapsed ? 'start' : 'center'} className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center justify-between">
                <span>Account</span>
                <StatusBadge category="neutral" label={`${role} access`} className="h-[20px] text-[11px]" />
              </div>
            </DropdownMenuLabel>

            <div className="px-2.5 py-1 text-[12px] text-[var(--text-muted)]">
              {user?.email}
            </div>

            <DropdownMenuSeparator />

            {/* Theme Toggle option */}
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                  <span>Switch to Light Theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                  <span>Switch to Dark Theme</span>
                </>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Logout Option */}
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-[var(--status-danger-fg)] hover:text-[var(--status-danger-fg)] cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
