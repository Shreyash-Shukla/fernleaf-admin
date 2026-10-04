'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents, formatDate, formatMinutesToTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalculationInfo } from '@/components/dashboard/calculation-info';
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
  User,
  Layers,
  MapPin,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [activeRoleView, setActiveRoleView] = useState<'admin' | 'kitchen' | 'dispatch' | 'driver'>('admin');

  // 1. Meta context
  const { data: meta } = useQuery<{
    today: string;
    nowIso: string;
    timezone: string;
  }>({
    queryKey: ['meta'],
    queryFn: () =>
      fetchApi('/meta').catch(() => ({
        today: new Date().toISOString().slice(0, 10),
        nowIso: new Date().toISOString(),
        timezone: 'Asia/Kolkata',
      })),
  });

  const today = meta?.today || new Date().toISOString().slice(0, 10);

  // 2. Today's orders
  const { data: todayOrders, isLoading: ordersLoading } = useQuery<{
    orders: any[];
    total: number;
  }>({
    queryKey: ['orders', 'today', today],
    queryFn: () =>
      fetchApi(`/orders?from=${today}&to=${today}&pageSize=100`).catch(() => ({
        orders: [],
        total: 0,
      })),
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
    queryFn: () =>
      fetchApi(`/orders?from=${today}&to=${nextWeekDate}&pageSize=100`).catch(() => ({
        orders: [],
        total: 0,
      })),
    enabled: !!nextWeekDate,
  });

  // 4. Kitchen board for today
  const { data: kitchenData } = useQuery<any>({
    queryKey: ['kitchen', today],
    queryFn: () =>
      fetchApi(`/kitchen/board?date=${today}`).catch(() => ({
        totalUnits: 0,
        doneUnits: 0,
        lateOrdersCount: 0,
        atRiskOrdersCount: 0,
        stations: [],
        orders: [],
        cookTotals: [],
      })),
  });

  // 5. Billing unbilled summary
  const { data: unbilledData } = useQuery<any>({
    queryKey: ['billing', 'unbilled'],
    queryFn: () =>
      fetchApi('/billing/unbilled').catch(() => ({
        summary: { totalUnbilledCents: 0 },
        companies: [],
      })),
  });

  // 6. Settings for cut-off info
  const { data: settings } = useQuery<any>({
    queryKey: ['settings'],
    queryFn: () =>
      fetchApi('/settings').catch(() => ({
        cutoffDays: 2,
        cutoffTime: '16:00',
        cutoffHoldDates: [],
      })),
  });

  // 7. Live Next Cut-off Window
  const { data: nextCutoff } = useQuery<any>({
    queryKey: ['cutoff', 'next'],
    queryFn: () => fetchApi('/cutoff/next').catch(() => null),
    refetchInterval: 30000,
  });

  // 8. Dispatch board for today (for role switcher)
  const { data: dispatchData } = useQuery<any>({
    queryKey: ['dispatch', 'board', today],
    queryFn: () =>
      fetchApi(`/dispatch/board?date=${today}`).catch(() => ({
        drops: [],
        summary: { totalDrops: 0, stageCounts: {} },
      })),
  });

  // 9. Driver drops for today (driver@test.com preview)
  const { data: driverData } = useQuery<any>({
    queryKey: ['driver', 'drops', today],
    queryFn: () =>
      fetchApi(`/driver/drops?date=${today}`).catch(() => ({
        drops: [],
        summary: { totalDrops: 0, deliveredDrops: 0, remainingDrops: 0 },
      })),
  });

  // Dynamic live countdown string for next cut-off
  const [countdownText, setCountdownText] = useState<string>('');

  useEffect(() => {
    if (!nextCutoff?.cutoffIso) return;

    const updateCountdown = () => {
      const diffMs = new Date(nextCutoff.cutoffIso).getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdownText('Locking now / due');
        return;
      }
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        setCountdownText(`${days}d ${remHours}h remaining`);
      } else {
        setCountdownText(`${hours}h ${minutes}m remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 15000);
    return () => clearInterval(interval);
  }, [nextCutoff?.cutoffIso]);

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

  // Admin Calculations
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

  // Kitchen Metrics
  const kitchenCookTotals = kitchenData?.cookTotals || [];
  const startedKitchenUnits = kitchenCookTotals.reduce((sum: number, c: any) => sum + (c.startedQty || 0), 0);
  const unstartedKitchenUnits = Math.max(0, kitchenUnits - (kitchenDone + startedKitchenUnits));

  // Earliest deadline in kitchen
  const kitchenOrders = kitchenData?.orders || [];
  const incompleteKitchenOrders = kitchenOrders.filter((o: any) => !o.kitchenReadyAt && o.plannedKitchenReadyAt);
  const nextKitchenDeadline = incompleteKitchenOrders.length > 0
    ? incompleteKitchenOrders.sort((a: any, b: any) =>
        new Date(a.plannedKitchenReadyAt).getTime() - new Date(b.plannedKitchenReadyAt).getTime()
      )[0]
    : null;

  // Dispatch Metrics
  const dispatchDrops = dispatchData?.drops || [];
  const dispatchSummary = dispatchData?.summary;
  const unassignedDrops = dispatchDrops.filter((d: any) => !d.driver);
  const behindScheduleDrops = dispatchDrops.filter((d: any) => d.isBehindSchedule);
  const nextThreeDrops = dispatchDrops
    .filter((d: any) => d.stage !== 'DELIVERED')
    .sort((a: any, b: any) => a.deliveryTimeMin - b.deliveryTimeMin)
    .slice(0, 3);

  // Driver Metrics
  const driverDrops = driverData?.drops || [];
  const driverSummary = driverData?.summary;
  const nextDriverDrop = driverDrops.find((d: any) => d.stage !== 'DELIVERED');

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Operations Hub &amp; Role Dashboards</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live metrics for <span className="text-emerald-400 font-medium">{formatDate(today)}</span> in{' '}
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

        {/* Role Dashboard Selector */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 rounded-xl border border-slate-800 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
            View Role:
          </span>
          <button
            onClick={() => setActiveRoleView('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeRoleView === 'admin'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Admin Executive
          </button>
          <button
            onClick={() => setActiveRoleView('kitchen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeRoleView === 'kitchen'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Kitchen Lead (6 AM)
          </button>
          <button
            onClick={() => setActiveRoleView('dispatch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeRoleView === 'dispatch'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Dispatch Coordinator
          </button>
          <button
            onClick={() => setActiveRoleView('driver')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeRoleView === 'driver'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Driver Field Run
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            1. ADMIN EXECUTIVE DASHBOARD
        ───────────────────────────────────────────────────────────── */}
        {activeRoleView === 'admin' && (
          <div className="space-y-6">
            {/* 5 Core Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Card 1: Today's Orders */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Today&apos;s Orders by Status</span>
                  <div className="flex items-center gap-1">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    <CalculationInfo
                      title="Today's Orders by Status"
                      role="Admin"
                      whyNeeded="Gives the kitchen admin instant visibility into total daily demand and distribution across operational stages."
                      formula="COUNT(*) GROUP BY Order.status WHERE Order.deliveryDate = todayInKitchenTz"
                      whichOrdersCount="All orders booked for today regardless of source (STAFF and DEMO)."
                      dateGrouping="deliveryDate = today in configured kitchen timezone (Asia/Kolkata)."
                      exclusionsAndMissing="Cancelled and Rejected orders are tracked and badged for auditability, but separated from active fulfilment counts."
                    />
                  </div>
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
                  <span className="text-xs font-medium text-slate-400">Next Cut-off Window</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <CalculationInfo
                      title="Next Cut-off Window"
                      role="Admin"
                      whyNeeded="Crucial deadline for order finalization. When cut-off hits, drafts are auto-cancelled, placed orders confirm, and kitchen lock begins."
                      formula="cutoffAt(deliveryDate, settings) = deliveryDate minus N kitchen working days at cutoffTime. Window = earliest cutoffAt > now."
                      whichOrdersCount="Orders with deliveryDate = targetDate in status DRAFT (to be cancelled) and PLACED (to be confirmed)."
                      dateGrouping="Target delivery date locking next, strictly skipping kitchen holidays & weekends."
                      exclusionsAndMissing="Dates in cutoffHoldDates setting are withheld from automated sweep for reviewer manual demonstration."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-lg font-bold text-white">
                    {countdownText || `${settings?.cutoffDays ?? 2}d @ ${settings?.cutoffTime ?? '16:00'}`}
                  </div>
                  <p className="text-[11px] text-amber-300 font-medium mt-1">
                    Locks {nextCutoff?.deliveryDate ? formatDate(nextCutoff.deliveryDate) : 'upcoming date'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                      {nextCutoff?.draftCount ?? 0} Drafts
                    </Badge>
                    <Badge variant="default" className="text-[10px] py-0 px-1.5">
                      {nextCutoff?.placedCount ?? 0} Placed
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: 7-Day Order Pipeline Value */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">7-Day Order Pipeline</span>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <CalculationInfo
                      title="7-Day Order Pipeline Value"
                      role="Admin"
                      whyNeeded="Measures forward commercial committed revenue to forecast procurement and kitchen capacity."
                      formula="SUM(Order.totalCents) WHERE status IN ('PLACED', 'CONFIRMED', 'DELIVERED') AND deliveryDate BETWEEN today AND today + 7 days"
                      whichOrdersCount="Only placed, confirmed, or delivered orders count toward committed value."
                      dateGrouping="deliveryDate >= today AND deliveryDate <= today + 7 days."
                      exclusionsAndMissing="DRAFT, CANCELLED, and REJECTED orders are completely excluded ($0). Pre-tax integer cents."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-white">
                    {formatCents(pipelineValueCents)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {activePipeline.length} active orders over next 7 days
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Kitchen Today */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Kitchen Prep Today</span>
                  <div className="flex items-center gap-1">
                    <ChefHat className="w-4 h-4 text-sky-400" />
                    <CalculationInfo
                      title="Kitchen Prep Today"
                      role="Admin"
                      whyNeeded="Tracks actual production throughput and identifies immediate station bottlenecks or schedule slippage."
                      formula="totalUnits = COUNT(OrderLineCombination) for CONFIRMED orders. doneUnits = COUNT(doneAt IS NOT NULL). Late = now > plannedKitchenReadyAt."
                      whichOrdersCount="Only CONFIRMED orders for today count as kitchen prep units."
                      dateGrouping="deliveryDate = today in kitchen timezone."
                      exclusionsAndMissing="Draft/Cancelled orders have no prep units. If an order has 0 lines, it contributes 0 units."
                    />
                  </div>
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
                  <div className="flex items-center gap-1">
                    <Building className="w-4 h-4 text-purple-400" />
                    <CalculationInfo
                      title="Unbilled Receivables + Top 5 Companies"
                      role="Admin"
                      whyNeeded="Monitors accounts receivable exposure to ensure timely batch invoicing of corporate clients."
                      formula="SUM(Order.totalCents) + SUM(Adjustment.amountCents) WHERE Order.status IN ('CONFIRMED', 'DELIVERED') AND Order.invoiceId IS NULL"
                      whichOrdersCount="All confirmed or delivered orders that have not yet been attached to an issued invoice."
                      dateGrouping="All past and current delivery dates with unbilled fulfilled orders."
                      exclusionsAndMissing="Draft/Placed/Cancelled orders are not billable. Invoiced orders have invoiceId set and are excluded."
                    />
                  </div>
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

            {/* Split: Live Station Breakdown & Top Unbilled */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Station Breakdown */}
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
                      const percent = st.totalMeals > 0 ? Math.round((st.doneMeals / st.totalMeals) * 100) : 0;
                      return (
                        <div key={st.id || 'unassigned'} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-slate-200">{st.name}</span>
                            <span className="text-slate-400">
                              {st.doneMeals} / {st.totalMeals} done ({percent}%)
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

              {/* Right: Top 5 Unbilled Companies */}
              <Card className="border-slate-800">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building className="w-4 h-4 text-purple-400" />
                      Top 5 Unbilled Companies
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
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            2. KITCHEN LEAD DASHBOARD VIEW
        ───────────────────────────────────────────────────────────── */}
        {activeRoleView === 'kitchen' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-sky-400" />
                  Kitchen Lead Morning Briefing (6:00 AM)
                </h2>
                <p className="text-xs text-slate-400">
                  Targeted production metrics for kitchen supervisor and line cooks.
                </p>
              </div>
              <Link href="/kitchen">
                <Button size="sm" variant="outline" className="text-xs">
                  Open Interactive Kitchen Board <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Meals to cook */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Meals to Cook</span>
                  <div className="flex items-center gap-1">
                    <ChefHat className="w-4 h-4 text-sky-400" />
                    <CalculationInfo
                      title="Meals to Cook (Not Started / In Progress / Done)"
                      role="Kitchen"
                      whyNeeded="Informs the kitchen lead how many total meals must be produced today and the exact progress across prep states."
                      formula="Total = SUM(OrderLineCombination.quantity) on CONFIRMED orders. Done = doneAt != null. In Progress = startedAt != null AND doneAt == null. Not Started = startedAt == null."
                      whichOrdersCount="Only CONFIRMED orders scheduled for today."
                      dateGrouping="deliveryDate = today in kitchen timezone."
                      exclusionsAndMissing="Cancelled or draft orders are completely excluded from prep totals."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-white">{kitchenUnits} <span className="text-xs font-normal text-slate-400">meals</span></div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {unstartedKitchenUnits} Not Started
                    </Badge>
                    <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                      {startedKitchenUnits} In Progress
                    </Badge>
                    <Badge variant="default" className="text-[10px] py-0 px-1.5">
                      {kitchenDone} Done
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: By Station (Remaining) */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">By Station (Remaining)</span>
                  <div className="flex items-center gap-1">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <CalculationInfo
                      title="Meals Remaining by Station"
                      role="Kitchen"
                      whyNeeded="Allows station leads (Hot, Cold, Bakery) to immediately see their individual backlog and deploy staff to bottlenecks."
                      formula="Remaining per station = SUM(unit.quantity) WHERE Dish.stationId = station.id AND unit.doneAt IS NULL"
                      whichOrdersCount="Distinct dish prep units grouped by live dish station routing."
                      dateGrouping="deliveryDate = today."
                      exclusionsAndMissing="Dishes with no station are grouped as 'Unassigned Station' so no meal is ever lost."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-emerald-400">
                    {Math.max(0, kitchenUnits - kitchenDone)} <span className="text-xs font-normal text-slate-400">to finish</span>
                  </div>
                  <div className="space-y-1 mt-2 text-[11px] text-slate-300">
                    {(kitchenData?.stations || []).slice(0, 3).map((st: any) => (
                      <div key={st.id || 'none'} className="flex justify-between">
                        <span className="text-slate-400">{st.name}:</span>
                        <span className="font-semibold text-white">{st.remainingMeals ?? (st.totalMeals - st.doneMeals)} remaining</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Late / At-Risk Orders */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Late &amp; At-Risk Orders</span>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <CalculationInfo
                      title="Late and At-Risk Orders"
                      role="Kitchen"
                      whyNeeded="Identifies imminent service failures. Orders flagged here take highest priority in cooking queue."
                      formula="Late = now > plannedKitchenReadyAt AND kitchenReadyAt IS NULL. At-Risk = now within 60 min of deadline AND has unstarted units."
                      whichOrdersCount="Confirmed orders with uncompleted prep units."
                      dateGrouping="deliveryDate = today."
                      exclusionsAndMissing="Delivered or fully kitchen-ready orders are never marked late or at-risk."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-rose-400">
                    {lateOrdersCount} <span className="text-xs font-normal text-slate-400">late</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={lateOrdersCount > 0 ? 'destructive' : 'default'} className="text-[10px] py-0 px-1.5">
                      {lateOrdersCount} Late
                    </Badge>
                    <Badge variant={atRiskCount > 0 ? 'warning' : 'secondary'} className="text-[10px] py-0 px-1.5">
                      {atRiskCount} At Risk (&lt;60m)
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Next Deadline */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Next Kitchen Deadline</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <CalculationInfo
                      title="Next Cooking Deadline"
                      role="Kitchen"
                      whyNeeded="Tells the kitchen staff the earliest planned kitchen-ready time for an active order so they prioritize right now."
                      formula="MIN(Order.plannedKitchenReadyAt) WHERE Order.kitchenReadyAt IS NULL AND Order.deliveryDate = today"
                      whichOrdersCount="Confirmed orders for today that are not yet marked kitchen-ready."
                      dateGrouping="deliveryDate = today."
                      exclusionsAndMissing="Completed orders are excluded; if all orders are done, reports 'All orders complete'."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-xl font-bold text-white">
                    {nextKitchenDeadline
                      ? formatMinutesToTime(nextKitchenDeadline.deliveryTimeMin - (nextKitchenDeadline.leadMinutes ?? 60) - 30)
                      : 'All Done!'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {nextKitchenDeadline
                      ? `Order #${nextKitchenDeadline.id?.slice(0, 6)} (${nextKitchenDeadline.company?.name})`
                      : 'No remaining kitchen deadlines today'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            3. DISPATCH DASHBOARD VIEW
        ───────────────────────────────────────────────────────────── */}
        {activeRoleView === 'dispatch' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-purple-400" />
                  Dispatch Logistics Dashboard
                </h2>
                <p className="text-xs text-slate-400">
                  Staging, driver assignment, and route dispatch for delivery drops.
                </p>
              </div>
              <Link href="/dispatch">
                <Button size="sm" variant="outline" className="text-xs">
                  Open Interactive Dispatch Board <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Drops Today by Stage */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Drops Today by Stage</span>
                  <div className="flex items-center gap-1">
                    <Truck className="w-4 h-4 text-purple-400" />
                    <CalculationInfo
                      title="Drops Today by Stage"
                      role="Dispatch"
                      whyNeeded="Dispatcher needs complete visibility over the entire drop pipeline from kitchen preparation to final delivery."
                      formula="COUNT(Drop) GROUP BY Drop.stage WHERE deliveryDate = today. Drop = unique(deliveryDate, companyId, addressId, deliveryTimeMin)."
                      whichOrdersCount="All confirmed drops for today."
                      dateGrouping="deliveryDate = today in kitchen timezone."
                      exclusionsAndMissing="Drop stage is the minimum stage among all its active orders (all-or-nothing progression)."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-white">{dispatchDrops.length} <span className="text-xs font-normal text-slate-400">drops</span></div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {dispatchSummary?.stageCounts?.PREPARING ?? 0} Prep
                    </Badge>
                    <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                      {dispatchSummary?.stageCounts?.KITCHEN_READY ?? 0} Kitchen Ready
                    </Badge>
                    <Badge variant="info" className="text-[10px] py-0 px-1.5">
                      {dispatchSummary?.stageCounts?.DISPATCH_READY ?? 0} Ready
                    </Badge>
                    <Badge variant="default" className="text-[10px] py-0 px-1.5">
                      {dispatchSummary?.stageCounts?.DELIVERED ?? 0} Delivered
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Needs a Driver */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Needs a Driver (Unassigned)</span>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4 text-amber-400" />
                    <CalculationInfo
                      title="Needs a Driver (Unassigned Drops)"
                      role="Dispatch"
                      whyNeeded="Dispatcher must assign every drop to a courier before it can depart for delivery."
                      formula="COUNT(Drop) WHERE Drop.deliveryDate = today AND Drop.driverId IS NULL AND Drop.stage != 'DELIVERED'"
                      whichOrdersCount="Drops scheduled for today that lack a driver."
                      dateGrouping="deliveryDate = today."
                      exclusionsAndMissing="Delivered drops are excluded. Company default driver is pre-assigned where configured."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-amber-400">
                    {unassignedDrops.length} <span className="text-xs font-normal text-slate-400">unassigned</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {unassignedDrops.length > 0 ? 'Requires driver assignment before departure' : 'All drops assigned to drivers'}
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Behind Schedule */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Behind Schedule</span>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <CalculationInfo
                      title="Behind Schedule Drops"
                      role="Dispatch"
                      whyNeeded="Flags drops that have missed their planned dispatch departure window."
                      formula="COUNT(Drop) WHERE now > plannedDispatchReadyAt AND Drop.stage IN ('PREPARING', 'KITCHEN_READY')"
                      whichOrdersCount="Active drops today that should already have left the kitchen."
                      dateGrouping="deliveryDate = today."
                      exclusionsAndMissing="Once out for delivery or delivered, drops are evaluated against delivery deadline, not dispatch deadline."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-rose-400">
                    {behindScheduleDrops.length} <span className="text-xs font-normal text-slate-400">delayed</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {behindScheduleDrops.length > 0 ? 'Exceeded planned kitchen lead time' : 'All drops running on schedule'}
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Next 3 Drops */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Next 3 Drops</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <CalculationInfo
                      title="Next 3 Drops in Queue"
                      role="Dispatch"
                      whyNeeded="Gives the staging crew the exact sequence of upcoming drop deadlines to stage boxes and hand off to drivers."
                      formula="SELECT TOP 3 Drop ORDER BY deliveryTimeMin ASC WHERE deliveryDate = today AND stage != 'DELIVERED'"
                      whichOrdersCount="Next 3 upcoming undelivered drops."
                      dateGrouping="deliveryDate = today."
                      exclusionsAndMissing="Delivered drops are omitted."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  {nextThreeDrops.length > 0 ? (
                    <div className="space-y-1.5 text-[11px]">
                      {nextThreeDrops.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between">
                          <span className="font-medium text-slate-200 truncate max-w-[120px]">
                            {d.company?.name}
                          </span>
                          <span className="text-emerald-400 font-semibold">{d.deliveryTime}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-2">All drops completed!</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            4. DRIVER DASHBOARD VIEW
        ───────────────────────────────────────────────────────────── */}
        {activeRoleView === 'driver' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-400" />
                  Driver Field Run Dashboard (driver@test.com)
                </h2>
                <p className="text-xs text-slate-400">
                  Mobile-first delivery management scoped strictly to assigned drops for today.
                </p>
              </div>
              <Link href="/driver">
                <Button size="sm" variant="outline" className="text-xs">
                  Open Mobile Driver View <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: My drops today */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">My Drops Today</span>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <CalculationInfo
                      title="My Drops Today (Total / Delivered / Remaining)"
                      role="Driver"
                      whyNeeded="Driver needs an unambiguous progress counter of remaining deliveries on their daily shift."
                      formula="Total = COUNT(Drop) WHERE driverId = me AND deliveryDate = today. Delivered = stage == 'DELIVERED'. Remaining = Total - Delivered."
                      whichOrdersCount="Strictly drops where driverId matches current logged-in driver user ID."
                      dateGrouping="deliveryDate = today in kitchen timezone."
                      exclusionsAndMissing="Drops assigned to other drivers or unassigned drops are invisible to this driver."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-2xl font-bold text-white">
                    {driverSummary?.deliveredDrops ?? 0} / {driverSummary?.totalDrops ?? 0}{' '}
                    <span className="text-xs font-normal text-slate-400">completed</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant={driverSummary?.remainingDrops === 0 ? 'default' : 'warning'} className="text-xs px-2.5 py-0.5">
                      {driverSummary?.remainingDrops ?? 0} Drops Remaining
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Next Drop Details */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <span className="text-xs font-medium text-slate-400">Next Drop Details</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-sky-400" />
                    <CalculationInfo
                      title="Next Drop Details"
                      role="Driver"
                      whyNeeded="Shows the driver the immediate destination address, contact instructions, and deadline for the very next stop."
                      formula="FIRST(Drop) WHERE driverId = me AND deliveryDate = today AND stage != 'DELIVERED' ORDER BY deliveryTimeMin ASC"
                      whichOrdersCount="The single earliest upcoming undelivered drop assigned to this driver."
                      dateGrouping="deliveryDate = today."
                      exclusionsAndMissing="Delivered drops are excluded."
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  {nextDriverDrop ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{nextDriverDrop.company?.name}</span>
                        <Badge variant="warning">{nextDriverDrop.deliveryTime}</Badge>
                      </div>
                      <div className="text-slate-300 text-[11px] flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span>
                          {nextDriverDrop.address?.line1}, {nextDriverDrop.address?.city}
                        </span>
                      </div>
                      {nextDriverDrop.company?.driverNotes && (
                        <div className="text-[11px] text-amber-300/90 bg-amber-950/20 p-1.5 rounded border border-amber-900/40">
                          Note: {nextDriverDrop.company.driverNotes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 py-3">All assigned drops completed for today!</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Operational Shortcuts */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">System Ready</div>
              <div className="text-[11px] text-slate-400">
                All operational modules active: Orders, Kitchen, Dispatch, Driver, Billing, Menu &amp; Tiers.
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
                <Clock className="w-3.5 h-3.5 mr-1" /> Cut-off &amp; Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
