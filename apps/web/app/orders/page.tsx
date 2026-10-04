'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents, formatDate, formatMinutesToTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  ShoppingBag,
  PlusCircle,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';

export default function OrdersListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [invoiced, setInvoiced] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Fetch companies for filter dropdown
  const { data: companiesData } = useQuery<{ companies: any[] }>({
    queryKey: ['companies', 'filter-list'],
    queryFn: () => fetchApi('/companies?limit=100'),
  });

  // Query parameters string
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '15');
  if (search) queryParams.set('q', search);
  if (status) queryParams.set('status', status);
  if (companyId) queryParams.set('companyId', companyId);
  if (invoiced) queryParams.set('invoiced', invoiced);
  if (fromDate) queryParams.set('from', fromDate);
  if (toDate) queryParams.set('to', toDate);

  const { data, isLoading } = useQuery<{
    orders: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['orders', 'list', queryParams.toString()],
    queryFn: () => fetchApi(`/orders?${queryParams.toString()}`),
  });

  const getStatusBadge = (statusName: string) => {
    switch (statusName) {
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'PLACED':
        return <Badge variant="warning">Placed</Badge>;
      case 'CONFIRMED':
        return <Badge variant="default">Confirmed</Badge>;
      case 'DELIVERED':
        return <Badge variant="info">Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary" className="line-through opacity-70">Cancelled</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{statusName}</Badge>;
    }
  };

  return (
    <AppShell requiredPermission="orders:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-emerald-400" />
              <span>Orders Management</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Browse, track, and manage all corporate meal orders
            </p>
          </div>

          <Link href="/orders/new">
            <Button size="sm" className="text-xs">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Create Order
            </Button>
          </Link>
        </div>

        {/* Filters Card */}
        <Card className="p-4 bg-slate-900/60 border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Order #, employee name or email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PLACED">Placed</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Company Filter */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Company
              </label>
              <select
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Companies</option>
                {companiesData?.companies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Invoiced Filter */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Invoiced
              </label>
              <select
                value={invoiced}
                onChange={(e) => {
                  setInvoiced(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Any</option>
                <option value="true">Invoiced</option>
                <option value="false">Unbilled</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setCompanyId('');
                  setInvoiced('');
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
                className="w-full text-xs text-slate-400 hover:text-white"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Orders Table */}
        <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Delivery</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Billing</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      Loading orders...
                    </td>
                  </tr>
                ) : data?.orders && data.orders.length > 0 ? (
                  data.orders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-850/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <Link
                          href={`/orders/${order.id}`}
                          className="hover:text-emerald-400 transition-colors"
                        >
                          #{order.number}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">
                          {order.employee?.name || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {order.employee?.email}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {order.company?.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">
                          {formatDate(order.deliveryDate)}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-400" />
                          {formatMinutesToTime(order.deliveryTimeMin)}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {formatCents(order.totalCents)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3 px-4">
                        {order.invoiceId ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Invoiced
                          </Badge>
                        ) : ['CONFIRMED', 'DELIVERED'].includes(order.status) ? (
                          <Badge variant="warning" className="text-[10px]">
                            Unbilled
                          </Badge>
                        ) : (
                          <span className="text-slate-500 text-[11px]">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No orders found matching the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {data && data.totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {(data.page - 1) * data.pageSize + 1} to{' '}
                {Math.min(data.page * data.pageSize, data.total)} of {data.total} orders
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <span className="px-2 text-slate-300 font-medium">
                  {data.page} / {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  className="h-8 px-2.5"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
