'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
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
  ChevronRight,
  PlusCircle,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  badge?: string;
  exact?: boolean;
}

export function Sidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const { user, role, can, logout } = useAuth();

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
        },
        {
          title: 'Dispatch Board',
          href: '/dispatch',
          icon: Truck,
          permission: 'dispatch:read',
        },
        {
          title: 'My Deliveries',
          href: '/driver',
          icon: MapPin,
          permission: 'deliveries:read_own',
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
    <aside className="w-64 bg-slate-950/90 border-r border-slate-800/80 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
        <Link
          href={role === 'driver' ? '/driver' : role === 'kitchen' ? '/kitchen' : role === 'dispatch' ? '/dispatch' : '/dashboard'}
          className="flex items-center gap-3 group"
          onClick={onCloseMobile}
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block leading-none">
              Fernleaf
            </span>
            <span className="text-[11px] text-emerald-400 font-medium tracking-wider uppercase block mt-0.5">
              Kitchen Admin
            </span>
          </div>
        </Link>
      </div>

      {/* Quick New Order Button for staff with orders:write */}
      {can('orders:write') && (
        <div className="p-3 pb-0">
          <Link
            href="/orders/new"
            onClick={onCloseMobile}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950/50 transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Order</span>
          </Link>
        </div>
      )}

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section, idx) => {
          // Filter items based on permission
          const visibleItems = section.items.filter((item) => {
            if (!item.permission) return true;
            return can(item.permission);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {section.label && (
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {section.label}
                </div>
              )}
              {visibleItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border border-transparent'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 transition-colors',
                        isActive
                          ? 'text-emerald-400'
                          : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    <span className="flex-1 truncate">{item.title}</span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 text-emerald-400/80 ml-auto" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Current User Card & Logout */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 border border-slate-700">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-slate-200 truncate">
                {user?.name || 'Staff User'}
              </div>
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                {role || 'Role'}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Log out"
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
