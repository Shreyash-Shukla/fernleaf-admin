'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatCents, formatDate, formatMinutesToTime, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { StateBanner } from '@/components/ui/state-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  MoreHorizontal,
  ArrowUpDown,
  Download,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function OrdersListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [invoiced, setInvoiced] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Table options
  const [compact, setCompact] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [drawerOrder, setDrawerOrder] = useState<any>(null);

  // Fetch companies for filter dropdown
  const { data: companiesData } = useQuery<{ items: any[] }>({
    queryKey: ['companies', 'filter-list'],
    queryFn: () => fetchApi('/companies?limit=100'),
  });

  // Query parameters string
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));
  if (search) queryParams.set('q', search);
  if (status) queryParams.set('status', status);
  if (companyId) queryParams.set('companyId', companyId);
  if (invoiced) queryParams.set('invoiced', invoiced);
  if (fromDate) queryParams.set('from', fromDate);
  if (toDate) queryParams.set('to', toDate);

  const { data, isLoading, isError, refetch } = useQuery<{
    data: any[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }>({
    queryKey: ['orders', 'list', queryParams.toString()],
    queryFn: () => fetchApi(`/orders?${queryParams.toString()}`),
  });

  const orders = extractList(data);
  const pagination = data?.pagination || {
    page: (data as any)?.page || page,
    pageSize: (data as any)?.pageSize || pageSize,
    total: (data as any)?.total ?? orders.length,
    totalPages: (data as any)?.totalPages || Math.ceil(((data as any)?.total ?? orders.length) / pageSize) || 1,
  };

  const allSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o: any) => o.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <AppShell requiredPermission="orders:read">
      <div className="space-y-4">
        {/* Page Header (No primary button here, New order lives in sidebar) */}
        <PageHeader
          title="Orders Management"
          subtitle="Browse, track, and manage all corporate meal orders"
          contextBar={
            <div className="flex items-center justify-between w-full gap-4 text-[12px]">
              {/* Left Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--text-faint)]" />
                  <input
                    type="text"
                    placeholder="Search orders, clients..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-8 pr-2.5 h-[28px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="h-[28px] px-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PLACED">Placed</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                {/* Company Filter */}
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setPage(1);
                  }}
                  className="h-[28px] px-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] max-w-[160px]"
                >
                  <option value="">All Companies</option>
                  {extractList(companiesData).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Invoiced Filter */}
                <select
                  value={invoiced}
                  onChange={(e) => {
                    setInvoiced(e.target.value);
                    setPage(1);
                  }}
                  className="h-[28px] px-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                >
                  <option value="">All Billing</option>
                  <option value="true">Invoiced</option>
                  <option value="false">Unbilled</option>
                </select>

                {(search || status || companyId || invoiced) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatus('');
                      setCompanyId('');
                      setInvoiced('');
                      setPage(1);
                    }}
                    className="text-[11px] text-[var(--brand-text)] hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Right Controls: Compact Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCompact(!compact)}
                  className={cn(
                    'h-[26px] px-2 rounded-[6px] border text-[11px] font-medium transition-colors',
                    compact
                      ? 'bg-[var(--bg-raised)] text-[var(--text)] border-[var(--border-strong)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--bg-raised)]'
                  )}
                >
                  Compact {compact ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          }
        />

        {isError && (
          <StateBanner
            variant="error"
            message="Failed to load orders"
            onRetry={() => refetch()}
          />
        )}

        {/* Bulk Action Bar (when ≥ 1 selected) */}
        {selectedOrderIds.length > 0 && (
          <div className="h-[40px] px-4 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-between text-[12px] select-none">
            <span className="font-medium text-[var(--text)]">
              {selectedOrderIds.length} orders selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-[26px] text-[11px]"
                onClick={() => {
                  toast.success(`Exporting ${selectedOrderIds.length} orders to CSV...`);
                }}
              >
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] ml-2"
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        {/* DataTable Container */}
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead className="bg-[var(--bg-raised)] border-b border-[var(--border)] sticky top-0 select-none z-10">
                <tr className="h-[36px]">
                  <th className="w-[36px] px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded-[4px] accent-[var(--brand-solid)] cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    ORDER #
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    EMPLOYEE
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    COMPANY
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    DELIVERY
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                    TOTAL
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    STATUS
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    BILLING
                  </th>
                  <th className="w-[44px] px-3 py-1.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {isLoading ? (
                  <TableSkeletonRows columns={9} rows={8} compact={compact} />
                ) : orders.length > 0 ? (
                  orders.map((order: any) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setDrawerOrder(order)}
                        className={cn(
                          'cursor-pointer transition-colors duration-120 hover:bg-[var(--bg-raised)]',
                          compact ? 'h-[32px]' : 'h-[40px]',
                          isSelected && 'bg-[var(--brand-soft)] border-l-2 border-l-[var(--brand-solid)]'
                        )}
                      >
                        <td
                          className="px-3 py-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectOne(order.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded-[4px] accent-[var(--brand-solid)] cursor-pointer"
                          />
                        </td>

                        <td className="px-3 py-1.5 font-mono text-[12px] font-semibold text-[var(--text)]">
                          #{order.number}
                        </td>

                        <td className="px-3 py-1.5 text-[var(--text)] truncate max-w-[160px]">
                          {order.employee?.name || 'Guest'}
                        </td>

                        <td className="px-3 py-1.5 text-[var(--text-muted)] truncate max-w-[150px]">
                          {order.company?.name || 'N/A'}
                        </td>

                        <td className="px-3 py-1.5 text-[var(--text-muted)] whitespace-nowrap">
                          <span>{formatDate(order.deliveryDate)}</span>
                          <span className="text-[var(--text-faint)] font-mono ml-1.5">
                            {formatMinutesToTime(order.deliveryTimeMin)}
                          </span>
                        </td>

                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-[var(--text)] font-semibold">
                          {formatCents(order.totalCents)}
                        </td>

                        <td className="px-3 py-1.5">
                          <StatusBadge status={order.status} className="h-[20px] text-[11px]" />
                        </td>

                        <td className="px-3 py-1.5">
                          {order.invoiceId ? (
                            <StatusBadge category="neutral" label="Invoiced" className="h-[20px] text-[11px]" />
                          ) : ['CONFIRMED', 'DELIVERED'].includes(order.status) ? (
                            <StatusBadge category="warning" label="Unbilled" className="h-[20px] text-[11px]" />
                          ) : (
                            <span className="text-[var(--text-faint)] text-[12px] font-mono">--</span>
                          )}
                        </td>

                        <td
                          className="px-3 py-1.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="h-[24px] w-[24px] rounded-[4px] hover:bg-[var(--bg-raised)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={() => setDrawerOrder(order)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> View details
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/orders/${order.id}`}>
                                  Open full page
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState message="No orders found matching the filter criteria." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sticky Footer: Showing 1–15 of 312 + page-size + pagination */}
          <div className="h-[44px] px-4 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between text-[12px] text-[var(--text-muted)] select-none">
            <div>
              Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} orders
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-[24px] px-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[11px] text-[var(--text)]"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-[26px] px-2 text-[11px]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Prev
                </Button>
                <span className="px-2 font-mono text-[11px] text-[var(--text)]">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="h-[26px] px-2 text-[11px]"
                >
                  Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Drawer for Order Detail Inspection */}
        <Drawer
          open={!!drawerOrder}
          onClose={() => setDrawerOrder(null)}
          title={`Order #${drawerOrder?.number}`}
          subtitle={`${drawerOrder?.company?.name || 'Client'} · ${formatDate(drawerOrder?.deliveryDate)}`}
          footer={
            drawerOrder ? (
              <Link href={`/orders/${drawerOrder.id}`}>
                <Button variant="primary" size="sm">Open Full Order Record</Button>
              </Link>
            ) : null
          }
        >
          {drawerOrder && (
            <div className="space-y-4 text-[13px]">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Status:</span>
                <StatusBadge status={drawerOrder.status} />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                  Employee Details
                </span>
                <div className="p-2.5 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] space-y-1">
                  <div className="font-medium text-[var(--text)]">{drawerOrder.employee?.name || 'Guest'}</div>
                  <div className="text-[12px] text-[var(--text-muted)]">{drawerOrder.employee?.email}</div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                  Delivery Details
                </span>
                <div className="p-2.5 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] space-y-1">
                  <div className="text-[var(--text)]">
                    Date: <strong>{formatDate(drawerOrder.deliveryDate)}</strong>
                  </div>
                  <div className="text-[var(--text-muted)] font-mono text-[12px]">
                    Window: {formatMinutesToTime(drawerOrder.deliveryTimeMin)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                  Commercial Total
                </span>
                <div className="p-2.5 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] flex items-baseline justify-between">
                  <span className="text-[var(--text-muted)]">Subtotal (cents):</span>
                  <span className="text-[18px] font-mono font-semibold text-[var(--text)]">
                    {formatCents(drawerOrder.totalCents)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}
