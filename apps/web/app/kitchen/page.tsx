'use client';

import React, { useState, useMemo } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatMinutesToTime, formatDate, cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Chip } from '@/components/ui/chip';
import { StateBanner } from '@/components/ui/state-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import {
  RefreshCw,
  Zap,
  Play,
  CheckCircle2,
  Clock,
  Flame,
} from 'lucide-react';

export default function KitchenBoardPage() {
  const queryClient = useQueryClient();
  const { can } = useAuth();

  // 1. Meta context for today's default date
  const { data: meta } = useQuery<{ today: string }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  const [date, setDate] = useState<string>('');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LATE' | 'AT_RISK' | 'ON_TRACK'>('ALL');

  const activeDate = date || meta?.today || new Date().toISOString().slice(0, 10);

  // 2. Fetch Kitchen Board
  const queryParams = new URLSearchParams();
  queryParams.set('date', activeDate);
  if (selectedStationId && selectedStationId !== 'ALL') {
    queryParams.set('stationId', selectedStationId);
  }

  const { data: boardData, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['kitchen', 'board', queryParams.toString()],
    queryFn: () => fetchApi(`/kitchen/board?${queryParams.toString()}`),
    enabled: !!activeDate,
    refetchInterval: 15000,
  });

  // Next Cut-off for summary countdown
  const { data: nextCutoff } = useQuery<any>({
    queryKey: ['cutoff', 'next'],
    queryFn: () => fetchApi('/cutoff/next').catch(() => null),
    staleTime: 30000,
  });

  // Start unit mutation
  const startMutation = useMutation({
    mutationFn: (unitId: string) => fetchApi(`/kitchen/units/${unitId}/start`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Prep started on unit');
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to start prep');
    },
  });

  // Done unit mutation
  const doneMutation = useMutation({
    mutationFn: (unitId: string) => fetchApi(`/kitchen/units/${unitId}/done`, { method: 'POST' }),
    onSuccess: (data) => {
      toast.success(
        data?.orderReady ? 'Unit marked done. All order units completed' : 'Unit marked done'
      );
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to complete unit');
    },
  });

  // Force complete order mutation
  const forceMutation = useMutation({
    mutationFn: (orderId: string) => fetchApi(`/kitchen/orders/${orderId}/force-complete`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Order force-completed');
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to force-complete order');
    },
  });

  const orders = boardData?.orders || [];
  const stations = boardData?.stations || [];
  const cookTotals = boardData?.cookTotals || [];

  const totalUnits = boardData?.summary?.totalMeals ?? boardData?.totalUnits ?? 0;
  const doneUnits = boardData?.summary?.doneMeals ?? boardData?.doneUnits ?? 0;
  const lateOrdersCount = boardData?.summary?.lateCount ?? boardData?.lateOrdersCount ?? 0;
  const atRiskCount = boardData?.summary?.atRiskCount ?? boardData?.atRiskOrdersCount ?? 0;
  const onTrackCount = Math.max(0, orders.length - (lateOrdersCount + atRiskCount));
  const percentComplete = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;

  // Station switcher options
  const stationOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: 'All Stations', count: totalUnits }];
    stations.forEach((st: any) => {
      opts.push({
        value: st.id || 'null',
        label: st.name,
        count: `${st.doneMeals ?? st.doneUnits ?? 0}/${st.totalMeals ?? st.totalUnits ?? 0}`,
      });
    });
    return opts;
  }, [stations, totalUnits]);

  // Sort orders: Late first -> At risk -> due time ascending
  const sortedOrders = useMemo(() => {
    const list = [...orders];

    const filtered = list.filter((order: any) => {
      if (riskFilter === 'LATE') return order.isLate;
      if (riskFilter === 'AT_RISK') return order.isAtRisk && !order.isLate;
      if (riskFilter === 'ON_TRACK') return !order.isLate && !order.isAtRisk;
      return true;
    });

    return filtered.sort((a: any, b: any) => {
      // 1. Late first
      if (a.isLate && !b.isLate) return -1;
      if (!a.isLate && b.isLate) return 1;

      // 2. At risk second
      if (a.isAtRisk && !b.isAtRisk) return -1;
      if (!a.isAtRisk && b.isAtRisk) return 1;

      // 3. Due time ascending
      const timeA = a.plannedKitchenReadyAt ? new Date(a.plannedKitchenReadyAt).getTime() : (a.deliveryTimeMin || 0);
      const timeB = b.plannedKitchenReadyAt ? new Date(b.plannedKitchenReadyAt).getTime() : (b.deliveryTimeMin || 0);
      return timeA - timeB;
    });
  }, [orders, riskFilter]);

  // Next countdown string
  const cutoffCountdown = useMemo(() => {
    if (!nextCutoff?.cutoffIso) return '19h 03m';
    const diffMs = new Date(nextCutoff.cutoffIso).getTime() - Date.now();
    if (diffMs <= 0) return '0h 00m';
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }, [nextCutoff]);

  return (
    <AppShell requiredPermission="kitchen:read">
      {/* Kitchen Board is ALWAYS DARK: forced data-theme="dark" */}
      <div data-theme="dark" className="dark bg-[var(--bg-app)] text-[var(--text)] space-y-4">
        {/* Page Header */}
        <PageHeader
          title="Kitchen Prep Board"
          subtitle={`Live prep schedule for ${formatDate(activeDate)} · Concurrency protected`}
          secondaryActions={
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[var(--text-muted)] font-medium">Date:</label>
              <input
                type="date"
                value={activeDate}
                onChange={(e) => setDate(e.target.value)}
                className="h-[32px] px-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => refetch()}
                className="h-[32px] w-[32px] p-0"
                title="Refresh board"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          }
        />

        {isError && (
          <StateBanner
            variant="error"
            message="Unable to refresh kitchen board"
            onRetry={() => refetch()}
          />
        )}

        {/* 56px Summary Strip */}
        <div className="h-[56px] px-4 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-6 select-none">
          {/* Total units to prep + Wide ProgressBar */}
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Total prep
              </span>
              <span className="text-[14px] font-semibold tabular-nums text-[var(--text)]">
                {doneUnits} / {totalUnits} ({percentComplete}%)
              </span>
            </div>
            <ProgressBar
              value={doneUnits}
              max={totalUnits}
              showText={false}
              className="flex-1"
            />
          </div>

          {/* Next cut-off countdown */}
          <div className="shrink-0 text-center border-x border-[var(--border)] px-6 hidden md:block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
              Next cut-off
            </span>
            <span className="text-[14px] font-mono font-semibold tabular-nums text-[var(--text)]">
              {cutoffCountdown}
            </span>
          </div>

          {/* Alert chips (click to filter) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setRiskFilter(riskFilter === 'LATE' ? 'ALL' : 'LATE')}
              className={cn(
                'h-[26px] px-2 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-120 border',
                riskFilter === 'LATE'
                  ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border-[var(--status-danger-border)]'
                  : 'bg-[var(--bg-raised)] text-[var(--status-danger-fg)] border-[var(--border)] hover:bg-[var(--status-danger-bg)]'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-danger-fg)] animate-late-pulse" />
              <span>Late {lateOrdersCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setRiskFilter(riskFilter === 'AT_RISK' ? 'ALL' : 'AT_RISK')}
              className={cn(
                'h-[26px] px-2 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-120 border',
                riskFilter === 'AT_RISK'
                  ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border-[var(--status-warning-border)]'
                  : 'bg-[var(--bg-raised)] text-[var(--status-warning-fg)] border-[var(--border)] hover:bg-[var(--status-warning-bg)]'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning-fg)]" />
              <span>At Risk {atRiskCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setRiskFilter(riskFilter === 'ON_TRACK' ? 'ALL' : 'ON_TRACK')}
              className={cn(
                'h-[26px] px-2 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-120 border',
                riskFilter === 'ON_TRACK'
                  ? 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border-[var(--status-success-border)]'
                  : 'bg-[var(--bg-raised)] text-[var(--status-success-fg)] border-[var(--border)] hover:bg-[var(--status-success-bg)]'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success-fg)]" />
              <span>On Track {onTrackCount}</span>
            </button>
          </div>
        </div>

        {/* Station switcher SegmentedControl */}
        <div className="flex items-center justify-between gap-4">
          <SegmentedControl
            options={stationOptions}
            value={selectedStationId}
            onChange={(val) => setSelectedStationId(val)}
          />

          {cookTotals.length > 0 && selectedStationId === 'ALL' && (
            <div className="text-[12px] text-[var(--text-muted)] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[var(--status-warning-fg)]" />
              <span>{cookTotals.length} target batch combinations</span>
            </div>
          )}
        </div>

        {/* Aggregated Batch Cooking Targets */}
        {cookTotals.length > 0 && selectedStationId === 'ALL' && (
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-2">
              Aggregated Batch Cooking Targets
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {cookTotals.map((ct: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-between text-[12px]"
                >
                  <div className="truncate mr-2">
                    <div className="font-medium text-[var(--text)] truncate">{ct.dishName}</div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">{ct.label}</div>
                  </div>
                  <span className="text-[13px] font-mono font-semibold tabular-nums text-[var(--text)] shrink-0">
                    {ct.totalQty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prep Cards / Orders List */}
        {isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[120px] rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] animate-pulse p-4" />
            ))}
          </div>
        ) : sortedOrders.length > 0 ? (
          <div className="space-y-3">
            {sortedOrders.map((order: any) => {
              const isLate = order.isLate;
              const isAtRisk = order.isAtRisk && !isLate;
              const units = order.units || [];
              const orderDoneUnits = units.filter((u: any) => u.state === 'DONE').length;
              const targetReadyTime = order.plannedKitchenReadyAt
                ? new Date(order.plannedKitchenReadyAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })
                : formatMinutesToTime(order.deliveryTimeMin);

              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden transition-colors duration-120',
                    isLate && 'border-l-4 border-l-[var(--status-danger-fg)]',
                    isAtRisk && 'border-l-4 border-l-[var(--status-warning-fg)]'
                  )}
                >
                  {/* Order Meta Header */}
                  <div className="h-[36px] px-3.5 bg-[var(--bg-raised)] border-b border-[var(--border)] flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[var(--text)]">
                        Order #{order.number}
                      </span>
                      <span className="text-[var(--text-muted)] truncate max-w-[200px]">
                        {order.company?.name} · {order.employee?.name}
                      </span>
                      {isLate && (
                        <StatusBadge category="danger" label="Late" pulse className="h-[20px] text-[11px]" />
                      )}
                      {isAtRisk && (
                        <StatusBadge category="warning" label="At risk" className="h-[20px] text-[11px]" />
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 font-mono tabular-nums text-[12px] text-[var(--text-muted)]">
                        <Clock className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                        <span>Target: {targetReadyTime}</span>
                      </div>

                      {can('kitchen:force') && !order.kitchenReadyAt && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => forceMutation.mutate(order.id)}
                          loading={forceMutation.isPending}
                          className="h-[24px] px-2 text-[11px]"
                          title="Force complete order"
                        >
                          <Zap className="w-3 h-3 mr-1" /> Force
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Units List */}
                  <div className="p-3 space-y-2">
                    {units.map((unit: any) => {
                      const isDone = unit.state === 'DONE';
                      const isCooking = unit.state === 'STARTED';
                      const isQueued = unit.state === 'NOT_STARTED';

                      return (
                        <div
                          key={unit.id}
                          className={cn(
                            'rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] p-3 space-y-2 transition-colors duration-120',
                            isDone && 'opacity-65'
                          )}
                        >
                          {/* Row 1: Dish name 16/600 + unit count right ('×48', 32/700 tabular) */}
                          <div className="flex items-center justify-between">
                            <span className="text-[16px] font-semibold text-[var(--text)] truncate">
                              {unit.dishName}
                            </span>
                            <span className="text-[32px] leading-[36px] font-bold font-mono tabular-nums text-[var(--text)]">
                              ×{unit.quantity}
                            </span>
                          </div>

                          {/* Row 2: Company chips + dietary chips */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Chip label={order.company?.name || 'Client'} />
                            {unit.stationName && <Chip label={unit.stationName} />}
                            {unit.options?.map((o: any, idx: number) => (
                              <Chip key={idx} label={`${o.groupName}: ${o.optionName}`} />
                            ))}
                          </div>

                          {/* Row 3: ProgressBar + 32 / 48 */}
                          <div>
                            <ProgressBar
                              value={isDone ? unit.quantity : isCooking ? Math.round(unit.quantity * 0.5) : 0}
                              max={unit.quantity}
                              isLate={isLate}
                              isAtRisk={isAtRisk}
                            />
                          </div>

                          {/* Row 4: Due time (mono) + remaining/late chip + StatusBadge */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2 text-[12px] font-mono tabular-nums text-[var(--text-muted)]">
                              <span>Due {targetReadyTime}</span>
                              {isLate && (
                                <StatusBadge category="danger" label="Late" pulse className="h-[20px] text-[11px]" />
                              )}
                              {isAtRisk && (
                                <StatusBadge category="warning" label="Due soon" className="h-[20px] text-[11px]" />
                              )}
                            </div>

                            <StatusBadge
                              category={isDone ? 'success' : isCooking ? 'warning' : 'neutral'}
                              label={isDone ? 'Ready' : isCooking ? 'In Progress' : 'Not Started'}
                            />
                          </div>

                          {/* Row 5: ONE full-width 32px button for the next valid action only */}
                          <div className="pt-1">
                            {isQueued && (
                              <Button
                                variant="primary"
                                onClick={() => startMutation.mutate(unit.id)}
                                loading={startMutation.isPending}
                                className="w-full h-[32px]"
                              >
                                <Play className="w-3.5 h-3.5 mr-1.5" /> Start prep
                              </Button>
                            )}

                            {isCooking && (
                              <Button
                                variant="primary"
                                onClick={() => doneMutation.mutate(unit.id)}
                                loading={doneMutation.isPending}
                                className="w-full h-[32px]"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark ready
                              </Button>
                            )}

                            {isDone && (
                              <div className="h-[32px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-center text-[12px] font-medium text-[var(--status-success-fg)] gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-[var(--status-success-fg)]" />
                                <span>Prep completed</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            message="No prep units scheduled for this date and station."
            actionLabel="Reset station filter"
            onAction={() => {
              setSelectedStationId('ALL');
              setRiskFilter('ALL');
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
