'use client';

import React from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ShoppingBag,
  ChefHat,
  Truck,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Building,
} from 'lucide-react';

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // 1. Meta context
  const { data: meta } = useQuery<{
    today: string;
    nowIso: string;
    timezone: string;
  }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  const today = meta?.today || new Date().toISOString().slice(0, 10);

  // 2. Today's orders
  const { data: todayOrders, isLoading: ordersLoading } = useQuery<{
    orders: any[];
    total: number;
  }>({
    queryKey: ['orders', 'today', today],
    queryFn: () => fetchApi(`/orders?from=${today}&to=${today}&pageSize=100`),
    enabled: !!meta,
  });

  // 3. Orders next 7 days for pipeline value
  const nextWeekDate = React.useMemo(() => {
    if (!today) return '';
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const { data: pipelineOrders } = useQuery<{
    orders: any[];
    total: number;
  }>({
    queryKey: ['orders', 'pipeline', today, nextWeekDate],
    queryFn: () => fetchApi(`/orders?from=${today}&to=${nextWeekDate}&pageSize=100`),
    enabled: !!nextWeekDate,
  });

  // 4. Kitchen board for today
  const { data: kitchenData } = useQuery<any>({
    queryKey: ['kitchen', today],
    queryFn: () => fetchApi(`/kitchen/board?date=${today}`),
    enabled: !!meta,
  });

  // 5. Billing unbilled summary
  const { data: unbilledData } = useQuery<any>({
    queryKey: ['billing', 'unbilled'],
    queryFn: () => fetchApi('/billing/unbilled'),
  });

  // 6. Settings for cut-off info
  const { data: settings } = useQuery<any>({
    queryKey: ['settings'],
    queryFn: () => fetchApi('/settings'),
  });

  // Reseed demo mutation
  const reseedMutation = useMutation({
    mutationFn: () => fetchApi('/admin/reseed', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Demo data reseeded relative to today!');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reseed demo data');
    },
  });

  // Calculations for Admin Dashboard
  const ordersList = todayOrders?.orders || [];
  const statusCounts = ordersList.reduce((acc: Record<string, number>, order: any) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const pipelineList = pipelineOrders?.orders || [];
  const activePipeline = pipelineList.filter((o) =>
    ['PLACED', 'CONFIRMED', 'DELIVERED'].includes(o.status)
  );
  const pipelineValueCents = activePipeline.reduce((sum, o) => sum + (o.totalCents || 0), 0);

  const kitchenUnits = kitchenData?.totalUnits || 0;
  const kitchenDone = kitchenData?.doneUnits || 0;
  const lateOrdersCount = kitchenData?.lateOrdersCount || 0;
  const atRiskCount = kitchenData?.atRiskOrdersCount || 0;

  const totalUnbilledCents = unbilledData?.summary?.totalUnbilledCents || 0;
  const unbilledCompanies = unbilledData?.companies || [];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Kitchen Operations Hub</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live operational metrics for <span className="text-emerald-400 font-medium">{formatDate(today)}</span> in{' '}
              <span className="text-slate-200">{meta?.timezone || 'Asia/Kolkata'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reseedMutation.mutate()}
              loading={reseedMutation.isPending}
              className="text-xs"
              title="Reseeds date-relative DEMO orders without touching staff data"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Reseed Demo
            </Button>

            <Link href="/orders/new">
              <Button size="sm" className="text-xs">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                New Order
              </Button>
            </Link>
          </div>
        </div>

        {/* 5 Core Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Card 1: Today's Orders */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-slate-400">Today&apos;s Orders</span>
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-white">{ordersList.length}</div>
              <div className="flex flex-wrap gap-1 mt-2.5">
                {statusCounts['CONFIRMED'] ? (
                  <Badge variant="default" className="text-[10px] py-0 px-1.5">
                    {statusCounts['CONFIRMED']} Confirmed
                  </Badge>
                ) : null}
                {statusCounts['DELIVERED'] ? (
                  <Badge variant="info" className="text-[10px] py-0 px-1.5">
                    {statusCounts['DELIVERED']} Delivered
                  </Badge>
                ) : null}
                {statusCounts['PLACED'] ? (
                  <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                    {statusCounts['PLACED']} Placed
                  </Badge>
                ) : null}
                {statusCounts['CANCELLED'] ? (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                    {statusCounts['CANCELLED']} Cancelled
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Next Cut-off Window */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-slate-400">Cut-off Configuration</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-lg font-bold text-white">
                {settings?.cutoffDays ?? 2} days @ {settings?.cutoffTime ?? '16:00'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Kitchen working days only (skips holidays)
              </p>
              <div className="mt-2 text-[11px] text-amber-300 font-medium">
                Locked dates held: {Array.isArray(settings?.cutoffHoldDates) ? settings.cutoffHoldDates.length : 0}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: 7-Day Order Pipeline Value */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-slate-400">7-Day Pipeline Value</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-white">
                {formatCents(pipelineValueCents)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {activePipeline.length} active orders across next 7 days
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Kitchen Today */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-slate-400">Kitchen Prep Today</span>
              <ChefHat className="w-4 h-4 text-sky-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-white">
                {kitchenDone} / {kitchenUnits} <span className="text-xs font-normal text-slate-400">units</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {lateOrdersCount > 0 ? (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                    {lateOrdersCount} Late
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-[10px] py-0 px-1.5">
                    On Schedule
                  </Badge>
                )}
                {atRiskCount > 0 && (
                  <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                    {atRiskCount} At Risk
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Unbilled Total */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-slate-400">Unbilled Receivables</span>
              <Building className="w-4 h-4 text-purple-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-white">
                {formatCents(totalUnbilledCents)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {unbilledCompanies.length} companies awaiting invoice
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Operational Split: Live Board Overviews */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Quick Actions & Live Kitchen Station Breakdown */}
          <Card className="border-slate-800">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-emerald-400" />
                  Kitchen Station Progress
                </CardTitle>
                <Link href="/kitchen" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                  Open Board <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <CardDescription className="text-xs">
                Live prep unit status grouped by kitchen station for {today}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3">
              {kitchenData?.stations?.length > 0 ? (
                kitchenData.stations.map((st: any) => {
                  const percent = st.totalUnits > 0 ? Math.round((st.doneUnits / st.totalUnits) * 100) : 0;
                  return (
                    <div key={st.id || 'unassigned'} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-200">{st.name}</span>
                        <span className="text-slate-400">
                          {st.doneUnits} / {st.totalUnits} done ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No kitchen prep units scheduled for today.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Top Unbilled Companies */}
          <Card className="border-slate-800">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building className="w-4 h-4 text-purple-400" />
                  Top Unbilled Companies
                </CardTitle>
                <Link href="/billing" className="text-xs text-purple-400 hover:underline flex items-center gap-1">
                  Billing Hub <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <CardDescription className="text-xs">
                Confirmed and delivered orders ready to be grouped into invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {unbilledCompanies.length > 0 ? (
                <div className="divide-y divide-slate-800/80">
                  {unbilledCompanies.slice(0, 5).map((comp: any) => (
                    <div key={comp.companyId} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-200">{comp.companyName}</div>
                        <div className="text-[11px] text-slate-400">
                          {comp.orderCount} orders awaiting invoice
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">{formatCents(comp.unbilledTotalCents)}</div>
                        <Link
                          href={`/billing?companyId=${comp.companyId}`}
                          className="text-[11px] text-emerald-400 hover:underline font-medium"
                        >
                          Invoice Now
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  All confirmed orders are currently invoiced.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Operational Shortcuts */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">System Ready</div>
              <div className="text-[11px] text-slate-400">
                All operational modules active: Orders, Kitchen, Dispatch, Driver, Billing, Menu & Tiers.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/kitchen">
              <Button variant="outline" size="sm" className="text-xs">
                <ChefHat className="w-3.5 h-3.5 mr-1" /> Kitchen Board
              </Button>
            </Link>
            <Link href="/dispatch">
              <Button variant="outline" size="sm" className="text-xs">
                <Truck className="w-3.5 h-3.5 mr-1" /> Dispatch Board
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" size="sm" className="text-xs">
                <Clock className="w-3.5 h-3.5 mr-1" /> Cut-off & Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
