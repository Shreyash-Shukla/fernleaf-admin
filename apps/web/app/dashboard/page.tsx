'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatCents, formatDate, formatMinutesToTime, pluralize } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ProgressBar } from '@/components/ui/progress-bar';
import { InlineLink } from '@/components/ui/inline-link';
import { Button } from '@/components/ui/button';
import { CalculationInfo } from '@/components/dashboard/calculation-info';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { user, role, can } = useAuth();
  const isSuperAdmin = role === 'admin';
  const [activeRoleView, setActiveRoleView] = useState<'admin' | 'kitchen' | 'dispatch' | 'driver'>('admin');

  // Strict role segregation: non-admins can ONLY view their own role's dashboard.
  // Superadmins can inspect any role's operational view.
  const currentView: 'admin' | 'kitchen' | 'dispatch' | 'driver' = isSuperAdmin
    ? activeRoleView
    : (role as 'kitchen' | 'dispatch' | 'driver') || 'admin';

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
  const timezone = meta?.timezone || 'Asia/Kolkata';

  // Format date for subtitle: "Sun, Oct 4, 2026 · Asia/Kolkata"
  const formattedSubtitleDate = React.useMemo(() => {
    try {
      const d = new Date(today + 'T12:00:00Z');
      const dateStr = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${dateStr} · ${timezone}`;
    } catch {
      return `${today} · ${timezone}`;
    }
  }, [today, timezone]);

  // 2. Today's orders
  const { data: todayOrders } = useQuery<{
    orders: any[];
    total: number;
  }>({
    queryKey: ['orders', 'today', today],
    queryFn: () =>
      fetchApi(`/orders?from=${today}&to=${today}&pageSize=100`).catch(() => ({
        orders: [],
        total: 0,
      })),
    enabled: currentView === 'admin' || can('orders:read'),
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
    enabled: !!nextWeekDate && currentView === 'admin',
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
    enabled: currentView === 'admin' || currentView === 'kitchen' || can('kitchen:read'),
  });

  // 5. Billing unbilled summary
  const { data: unbilledData } = useQuery<any>({
    queryKey: ['billing', 'unbilled'],
    queryFn: () =>
      fetchApi('/billing/unbilled').catch(() => ({
        summary: { totalUnbilledCents: 0 },
        companies: [],
      })),
    enabled: currentView === 'admin' && (can('*') || can('billing:read')),
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
    enabled: currentView === 'admin',
  });

  // 7. Live Next Cut-off Window
  const { data: nextCutoff } = useQuery<any>({
    queryKey: ['cutoff', 'next'],
    queryFn: () => fetchApi('/cutoff/next').catch(() => null),
    refetchInterval: 30000,
    enabled: currentView === 'admin',
  });

  // 8. Dispatch board for today
  const { data: dispatchData } = useQuery<any>({
    queryKey: ['dispatch', 'board', today],
    queryFn: () =>
      fetchApi(`/dispatch/board?date=${today}`).catch(() => ({
        drops: [],
        summary: { totalDrops: 0, stageCounts: {} },
      })),
    enabled: currentView === 'admin' || currentView === 'dispatch' || can('dispatch:read'),
  });

  // 9. Driver drops for today
  const { data: driverData } = useQuery<any>({
    queryKey: ['driver', 'drops', today],
    queryFn: () =>
      fetchApi(`/driver/drops?date=${today}`).catch(() => ({
        drops: [],
        summary: { totalDrops: 0, deliveredDrops: 0, remainingDrops: 0 },
      })),
    enabled: currentView === 'admin' || currentView === 'driver' || can('deliveries:read_own'),
  });

  // Dynamic live countdown string for next cut-off
  const [countdownText, setCountdownText] = useState<string>('19h 03m');

  useEffect(() => {
    if (!nextCutoff?.cutoffIso) return;

    const updateCountdown = () => {
      const diffMs = new Date(nextCutoff.cutoffIso).getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdownText('0h 00m');
        return;
      }
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        setCountdownText(`${days}d ${remHours}h`);
      } else {
        const hPad = String(hours).padStart(2, '0');
        const mPad = String(minutes).padStart(2, '0');
        setCountdownText(`${hPad}h ${mPad}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 15000);
    return () => clearInterval(interval);
  }, [nextCutoff?.cutoffIso]);

  // Reseed demo mutation (overflow tool)
  const reseedMutation = useMutation({
    mutationFn: () => fetchApi('/admin/reseed', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Demo data reseeded relative to today');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reseed demo data');
    },
  });

  // Admin Calculations
  const ordersList = extractList(todayOrders);
  const statusCounts = ordersList.reduce((acc: Record<string, number>, order: any) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const pipelineList = extractList(pipelineOrders);
  const activePipeline = pipelineList.filter((o) =>
    ['PLACED', 'CONFIRMED', 'DELIVERED'].includes(o.status)
  );
  const pipelineValueCents = activePipeline.reduce((sum, o) => sum + (o.totalCents || 0), 0);

  const kitchenUnits = kitchenData?.summary?.totalMeals ?? kitchenData?.totalUnits ?? 0;
  const kitchenDone = kitchenData?.summary?.doneMeals ?? kitchenData?.doneUnits ?? 0;
  const lateOrdersCount = kitchenData?.summary?.lateCount ?? kitchenData?.lateOrdersCount ?? 0;
  const atRiskCount = kitchenData?.summary?.atRiskCount ?? kitchenData?.atRiskOrdersCount ?? 0;

  const unbilledCompanies = extractList(unbilledData);
  const totalUnbilledCents =
    unbilledData?.summary?.totalUnbilledCents ??
    unbilledCompanies.reduce(
      (acc: number, c: any) => acc + (c.netUnbilledCents ?? c.unbilledCents ?? c.unbilledTotalCents ?? 0),
      0
    );

  // Kitchen Metrics
  const kitchenCookTotals = kitchenData?.cookTotals || [];
  const startedKitchenUnits = kitchenCookTotals.reduce((sum: number, c: any) => sum + (c.startedQty || 0), 0);
  const unstartedKitchenUnits = Math.max(0, kitchenUnits - (kitchenDone + startedKitchenUnits));

  const kitchenOrders = kitchenData?.orders || [];
  const incompleteKitchenOrders = kitchenOrders.filter((o: any) => !o.kitchenReadyAt && o.plannedKitchenReadyAt);
  const nextKitchenDeadline = incompleteKitchenOrders.length > 0
    ? [...incompleteKitchenOrders].sort((a: any, b: any) =>
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
        {/* Page Header (inside content, no card) */}
        <PageHeader
          title="Operations Hub"
          subtitle={formattedSubtitleDate}
          demoTools={
            isSuperAdmin
              ? [
                  {
                    label: 'Reseed Demo Data',
                    onClick: () => reseedMutation.mutate(),
                    loading: reseedMutation.isPending,
                  },
                ]
              : undefined
          }
          contextBar={
            isSuperAdmin ? (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  View as
                </span>
                <SegmentedControl
                  value={activeRoleView}
                  onChange={(val) => setActiveRoleView(val as any)}
                  options={[
                    { value: 'admin', label: 'Admin Executive' },
                    { value: 'kitchen', label: 'Kitchen Lead (6 AM)' },
                    { value: 'dispatch', label: 'Dispatch Coordinator' },
                    { value: 'driver', label: 'Driver Field Run' },
                  ]}
                />
              </div>
            ) : null
          }
        />

        {/* ─────────────────────────────────────────────────────────────
            1. ADMIN EXECUTIVE DASHBOARD
        ───────────────────────────────────────────────────────────── */}
        {currentView === 'admin' && (
          <div className="space-y-4">
            {/* KPI Strip: 5 equal columns, gap 16, identical structure for baseline alignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Card 1: Orders Today */}
              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between select-none">
                {/* Row 1: Label + Info icon */}
                <div className="h-[16px] flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] truncate">
                    Orders today
                  </span>
                  <CalculationInfo
                    title="Orders today"
                    role="Admin"
                    whyNeeded="Instant visibility into total daily demand and distribution across stages."
                    formula="COUNT(*) GROUP BY Order.status WHERE Order.deliveryDate = today"
                    whichOrdersCount="All orders booked for today regardless of source."
                    dateGrouping="deliveryDate = today in configured kitchen timezone."
                    exclusionsAndMissing="Cancelled orders separated from active counts."
                  />
                </div>

                {/* Row 2: Value + optional unit */}
                <div className="h-[36px] flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {ordersList.length}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">orders</span>
                </div>

                {/* Row 3: 6px stacked segmented bar with status dots legend */}
                <div className="space-y-1.5">
                  <div className="h-[6px] w-full rounded-[3px] bg-[var(--bg-raised)] border border-[var(--border)] overflow-hidden flex">
                    {ordersList.length > 0 ? (
                      <>
                        <div
                          className="h-full bg-[var(--status-info-fg)]"
                          style={{
                            width: `${((statusCounts['CONFIRMED'] || 0) / ordersList.length) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-[var(--status-success-fg)]"
                          style={{
                            width: `${((statusCounts['DELIVERED'] || 0) / ordersList.length) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-[var(--status-warning-fg)]"
                          style={{
                            width: `${((statusCounts['PLACED'] || 0) / ordersList.length) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-[var(--status-neutral-fg)]"
                          style={{
                            width: `${((statusCounts['CANCELLED'] || 0) / ordersList.length) * 100}%`,
                          }}
                        />
                      </>
                    ) : (
                      <div className="h-full w-full bg-[var(--bg-raised)]" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[12px] leading-[16px] text-[var(--text-muted)] truncate">
                    {statusCounts['CONFIRMED'] ? (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-info-fg)] shrink-0" />
                        <span>{statusCounts['CONFIRMED']} Confirmed</span>
                      </span>
                    ) : null}
                    {statusCounts['DELIVERED'] ? (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success-fg)] shrink-0" />
                        <span>{statusCounts['DELIVERED']} Delivered</span>
                      </span>
                    ) : null}
                    {!statusCounts['CONFIRMED'] && !statusCounts['DELIVERED'] && (
                      <span>No active orders</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Next Cut-off */}
              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between select-none">
                <div className="h-[16px] flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] truncate">
                    Next cut-off
                  </span>
                  <CalculationInfo
                    title="Next Cut-off Window"
                    role="Admin"
                    whyNeeded="Deadline for order finalization before kitchen lock begins."
                    formula="cutoffAt(deliveryDate, settings) = deliveryDate minus N kitchen working days."
                    whichOrdersCount="Draft and placed orders for next locked delivery date."
                    dateGrouping="Target delivery date locking next."
                    exclusionsAndMissing="Dates in cutoffHoldDates withheld from automated sweep."
                  />
                </div>

                <div className="h-[36px] flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold font-mono tabular-nums text-[var(--text)]">
                    {countdownText}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">remaining</span>
                </div>

                <div className="text-[12px] leading-[16px] text-[var(--text-muted)] truncate">
                  <div>
                    Locks {nextCutoff?.deliveryDate ? formatDate(nextCutoff.deliveryDate) : 'upcoming date'}
                  </div>
                  <div>
                    {pluralize(nextCutoff?.draftCount ?? 0, 'Draft')} · {pluralize(nextCutoff?.placedCount ?? 0, 'Placed')}
                  </div>
                </div>
              </div>

              {/* Card 3: 7-day Pipeline */}
              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between select-none">
                <div className="h-[16px] flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] truncate">
                    7-day pipeline
                  </span>
                  <CalculationInfo
                    title="7-Day Order Pipeline Value"
                    role="Admin"
                    whyNeeded="Measures forward commercial committed revenue."
                    formula="SUM(Order.totalCents) WHERE status IN ('PLACED', 'CONFIRMED', 'DELIVERED')"
                    whichOrdersCount="Only placed, confirmed, or delivered orders."
                    dateGrouping="deliveryDate between today and today + 7 days."
                    exclusionsAndMissing="Draft, Cancelled, and Rejected orders excluded."
                  />
                </div>

                <div className="h-[36px] flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {formatCents(pipelineValueCents)}
                  </span>
                </div>

                <div className="text-[12px] leading-[16px] text-[var(--text-muted)] truncate">
                  {activePipeline.length} active orders · next 7 days
                </div>
              </div>

              {/* Card 4: Kitchen prep today */}
              <div
                className={cn(
                  'h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between select-none',
                  lateOrdersCount > 0 && 'border-l-[3px] border-l-[var(--status-danger-fg)]'
                )}
              >
                <div className="h-[16px] flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] truncate">
                    Kitchen prep today
                  </span>
                  <CalculationInfo
                    title="Kitchen Prep Today"
                    role="Admin"
                    whyNeeded="Tracks actual production throughput and schedule slippage."
                    formula="totalUnits = COUNT(lines) for CONFIRMED orders. doneUnits = COUNT(doneAt IS NOT NULL)."
                    whichOrdersCount="Only CONFIRMED orders for today."
                    dateGrouping="deliveryDate = today in kitchen timezone."
                    exclusionsAndMissing="Draft/Cancelled orders excluded."
                  />
                </div>

                <div className="h-[36px] flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {kitchenDone} / {kitchenUnits}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">units</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {lateOrdersCount > 0 ? (
                    <StatusBadge category="danger" label={`${lateOrdersCount} Late`} pulse />
                  ) : atRiskCount > 0 ? (
                    <StatusBadge category="warning" label={`${atRiskCount} At Risk`} />
                  ) : (
                    <StatusBadge category="success" label="On Schedule" />
                  )}
                </div>
              </div>

              {/* Card 5: Unbilled receivables */}
              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between select-none">
                <div className="h-[16px] flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] truncate">
                    Unbilled receivables
                  </span>
                  <CalculationInfo
                    title="Unbilled Receivables"
                    role="Admin"
                    whyNeeded="Monitors accounts receivable exposure for corporate accounts."
                    formula="SUM(Order.totalCents) WHERE status IN ('CONFIRMED', 'DELIVERED') AND invoiceId IS NULL"
                    whichOrdersCount="Confirmed or delivered unbilled orders."
                    dateGrouping="Past and current delivery dates."
                    exclusionsAndMissing="Draft/Placed/Cancelled orders not billable."
                  />
                </div>

                <div className="h-[36px] flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {formatCents(totalUnbilledCents)}
                  </span>
                </div>

                <div className="text-[12px] leading-[16px] text-[var(--text-muted)] truncate">
                  {unbilledCompanies.length} companies awaiting invoice
                </div>
              </div>
            </div>

            {/* Second row: CSS grid 7 / 5 columns, gap 16 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Panel (7 cols): Kitchen Station Progress */}
              <div className="lg:col-span-7 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)]">
                {/* Panel Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-semibold leading-[20px] text-[var(--text)] tracking-tight">
                      Kitchen Station Progress
                    </h2>
                    <InlineLink href="/kitchen">Open board</InlineLink>
                  </div>
                  <p className="text-[12px] leading-[16px] text-[var(--text-muted)] mt-0.5">
                    Live prep unit status grouped by station for today
                  </p>
                </div>

                <div className="border-b border-[var(--border)]" />

                {/* Flat Rows, 44px high, 1px dividers */}
                <div className="p-[0_16px_8px] divide-y divide-[var(--border)]">
                  {kitchenData?.stations?.length > 0 ? (
                    kitchenData.stations.map((st: any) => {
                      const percent = st.totalMeals > 0 ? Math.round((st.doneMeals / st.totalMeals) * 100) : 0;
                      return (
                        <div
                          key={st.id || 'unassigned'}
                          className="h-[44px] flex items-center justify-between gap-4"
                        >
                          <span className="text-[14px] font-medium text-[var(--text)] w-[120px] shrink-0 truncate">
                            {st.name}
                          </span>
                          <ProgressBar
                            value={st.doneMeals}
                            max={st.totalMeals}
                            showText={false}
                            className="flex-1"
                          />
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <span className="text-[13px] font-mono tabular-nums text-[var(--text)]">
                              {st.doneMeals} / {st.totalMeals}
                            </span>
                            <span className="text-[12px] tabular-nums text-[var(--text-muted)] w-10 text-right">
                              {percent}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-[12px] text-[var(--text-muted)]">
                      No kitchen prep units scheduled for today.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel (5 cols): Top 5 Unbilled Companies */}
              <div className="lg:col-span-5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)]">
                {/* Panel Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-semibold leading-[20px] text-[var(--text)] tracking-tight">
                      Top 5 Unbilled Companies
                    </h2>
                    <InlineLink href="/billing">Billing hub</InlineLink>
                  </div>
                  <p className="text-[12px] leading-[16px] text-[var(--text-muted)] mt-0.5">
                    Corporate accounts awaiting batch invoice generation
                  </p>
                </div>

                <div className="border-b border-[var(--border)]" />

                {/* Compact Table, 40px rows */}
                <div className="p-[0_16px_8px] overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-[32px] border-b border-[var(--border)]">
                        <th className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                          COMPANY
                        </th>
                        <th className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                          AMOUNT
                        </th>
                        <th className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {unbilledCompanies.length > 0 ? (
                        unbilledCompanies.slice(0, 5).map((comp: any) => (
                          <tr key={comp.companyId} className="h-[40px] hover:bg-[var(--bg-raised)] transition-colors">
                            <td className="py-1">
                              <div className="text-[14px] font-medium text-[var(--text)] leading-tight truncate max-w-[150px]">
                                {comp.companyName}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)] leading-tight">
                                {comp.orderCount} orders
                              </div>
                            </td>
                            <td className="py-1 text-right text-[13px] font-mono tabular-nums text-[var(--text)]">
                              {/* Renders incoming amount as specified */}
                              {formatCents(comp.unbilledTotalCents ?? comp.netUnbilledCents ?? comp.unbilledCents)}
                            </td>
                            <td className="py-1 text-right">
                              <InlineLink href={`/billing?companyId=${comp.companyId}`}>
                                Invoice now
                              </InlineLink>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-[12px] text-[var(--text-muted)]">
                            All confirmed orders are currently invoiced.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            2. KITCHEN LEAD BRIEFING VIEW
        ───────────────────────────────────────────────────────────── */}
        {currentView === 'kitchen' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">
                  Kitchen Lead Morning Briefing (6:00 AM)
                </h2>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Production metrics for line cooks and prep station supervisors
                </p>
              </div>
              <InlineLink href="/kitchen">Open kitchen board</InlineLink>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Meals to Cook
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {kitchenUnits}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">meals</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge category="neutral" label={`${unstartedKitchenUnits} Queued`} />
                  <StatusBadge category="warning" label={`${startedKitchenUnits} Cooking`} />
                  <StatusBadge category="success" label={`${kitchenDone} Done`} />
                </div>
              </div>

              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  By Station (Remaining)
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {Math.max(0, kitchenUnits - kitchenDone)}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">to finish</span>
                </div>
                <div className="text-[12px] text-[var(--text-muted)] truncate">
                  {(kitchenData?.stations || []).slice(0, 2).map((st: any) => `${st.name}: ${st.remainingMeals ?? (st.totalMeals - st.doneMeals)}`).join(' · ') || 'All stations clear'}
                </div>
              </div>

              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Late & At Risk
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className={cn('text-[28px] leading-[32px] font-semibold tabular-nums', lateOrdersCount > 0 ? 'text-[var(--status-danger-fg)]' : 'text-[var(--text)]')}>
                    {lateOrdersCount}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">late</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {lateOrdersCount > 0 ? (
                    <StatusBadge category="danger" label={`${lateOrdersCount} Late`} pulse />
                  ) : (
                    <StatusBadge category="success" label="On Schedule" />
                  )}
                  {atRiskCount > 0 && (
                    <StatusBadge category="warning" label={`${atRiskCount} At Risk`} />
                  )}
                </div>
              </div>

              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Next Kitchen Deadline
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-mono font-semibold tabular-nums text-[var(--text)]">
                    {nextKitchenDeadline
                      ? formatMinutesToTime(nextKitchenDeadline.deliveryTimeMin - (nextKitchenDeadline.leadMinutes ?? 60) - 30)
                      : 'All Done'}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--text-muted)] truncate">
                  {nextKitchenDeadline
                    ? `Order #${nextKitchenDeadline.id?.slice(0, 6)} (${nextKitchenDeadline.company?.name})`
                    : 'No pending deadlines'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            3. DISPATCH COORDINATOR VIEW
        ───────────────────────────────────────────────────────────── */}
        {currentView === 'dispatch' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">
                  Dispatch Logistics Briefing
                </h2>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Staging, driver assignment, and route dispatch for delivery drops
                </p>
              </div>
              <InlineLink href="/dispatch">Open dispatch board</InlineLink>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Drops Today by Stage
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {dispatchDrops.length}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">drops</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge category="info" label={`${dispatchSummary?.stageCounts?.PREPARING ?? 0} Prep`} />
                  <StatusBadge category="warning" label={`${dispatchSummary?.stageCounts?.KITCHEN_READY ?? 0} Staged`} />
                  <StatusBadge category="success" label={`${dispatchSummary?.stageCounts?.DELIVERED ?? 0} Delivered`} />
                </div>
              </div>

              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Needs a Driver
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {unassignedDrops.length}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">unassigned</span>
                </div>
                <div className="text-[12px] text-[var(--text-muted)] truncate">
                  {unassignedDrops.length > 0 ? 'Requires driver assignment' : 'All drops assigned'}
                </div>
              </div>

              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Behind Schedule
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className={cn('text-[28px] leading-[32px] font-semibold tabular-nums', behindScheduleDrops.length > 0 ? 'text-[var(--status-danger-fg)]' : 'text-[var(--text)]')}>
                    {behindScheduleDrops.length}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">delayed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {behindScheduleDrops.length > 0 ? (
                    <StatusBadge category="danger" label={`${behindScheduleDrops.length} Delayed`} pulse />
                  ) : (
                    <StatusBadge category="success" label="On Schedule" />
                  )}
                </div>
              </div>

              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Next Drop
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-mono font-semibold tabular-nums text-[var(--text)]">
                    {nextThreeDrops[0] ? nextThreeDrops[0].deliveryTime : 'All Done'}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--text-muted)] truncate">
                  {nextThreeDrops[0] ? nextThreeDrops[0].company?.name : 'No remaining drops'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            4. DRIVER FIELD RUN VIEW
        ───────────────────────────────────────────────────────────── */}
        {currentView === 'driver' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">
                  Driver Field Run ({user?.name || 'Driver'})
                </h2>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Active stops assigned to your run for today
                </p>
              </div>
              <InlineLink href="/driver">Open deliveries</InlineLink>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  My Drops Today
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] leading-[32px] font-semibold tabular-nums text-[var(--text)]">
                    {driverSummary?.deliveredDrops ?? 0} / {driverSummary?.totalDrops ?? 0}
                  </span>
                  <span className="text-[13px] text-[var(--text-muted)]">completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge
                    category={driverSummary?.remainingDrops === 0 ? 'success' : 'warning'}
                    label={`${driverSummary?.remainingDrops ?? 0} Remaining`}
                  />
                </div>
              </div>

              <div className="h-[128px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Next Destination
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-semibold text-[var(--text)] truncate">
                    {nextDriverDrop ? nextDriverDrop.company?.name : 'All drops finished'}
                  </span>
                  {nextDriverDrop && (
                    <span className="text-[13px] font-mono text-[var(--text-muted)]">
                      ({nextDriverDrop.deliveryTime})
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[var(--text-muted)] truncate">
                  {nextDriverDrop ? `${nextDriverDrop.address?.line1}, ${nextDriverDrop.address?.city}` : 'No remaining stops today'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
