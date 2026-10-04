'use client';

import React, { useState, useMemo } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatDate, formatMinutesToTime, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Chip } from '@/components/ui/chip';
import { StateBanner } from '@/components/ui/state-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import {
  RefreshCw,
  Truck,
  User,
  PackageCheck,
  Send,
  Clock,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';

export default function DispatchBoardPage() {
  const queryClient = useQueryClient();

  // Meta context
  const { data: meta } = useQuery<{ today: string }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  const [date, setDate] = useState<string>('');
  const activeDate = date || meta?.today || new Date().toISOString().slice(0, 10);

  // Pane selections & expanded drops
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [expandedDropIds, setExpandedDropIds] = useState<Record<string, boolean>>({});
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Fetch Drivers list
  const { data: staffData } = useQuery<{ staff: any[] }>({
    queryKey: ['staff', 'drivers'],
    queryFn: () => fetchApi('/staff'),
  });
  const drivers = staffData?.staff?.filter((s) => s.role?.key === 'driver' && s.active) || [];

  // Fetch Dispatch Board
  const { data: boardData, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['dispatch', 'board', activeDate],
    queryFn: () => fetchApi(`/dispatch/board?date=${activeDate}`),
    enabled: !!activeDate,
    refetchInterval: 15000,
  });

  // Action Mutations
  const dispatchReadyMutation = useMutation({
    mutationFn: (dropId: string) => fetchApi(`/drops/${dropId}/dispatch-ready`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Drop marked as Dispatch Ready');
      queryClient.invalidateQueries({ queryKey: ['dispatch', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to set dispatch ready');
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: ({ dropId, driverId }: { dropId: string; driverId: string | null }) =>
      fetchApi(`/drops/${dropId}/assign-driver`, {
        method: 'POST',
        body: JSON.stringify({ driverId }),
      }),
    onSuccess: () => {
      toast.success('Courier assigned');
      queryClient.invalidateQueries({ queryKey: ['dispatch', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign courier');
    },
  });

  const outForDeliveryMutation = useMutation({
    mutationFn: (dropId: string) => fetchApi(`/drops/${dropId}/out-for-delivery`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Drop is now Out for Delivery');
      queryClient.invalidateQueries({ queryKey: ['dispatch', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update stage');
    },
  });

  const summary = boardData?.summary;
  const drops = boardData?.drops || [];

  // Sorted drops: Delayed first, then departure/delivery time ascending
  const sortedDrops = useMemo(() => {
    const list = [...drops];
    const filtered = list.filter((d: any) => {
      if (stageFilter === 'ALL') return true;
      return d.stage === stageFilter;
    });

    return filtered.sort((a: any, b: any) => {
      if (a.isBehindSchedule && !b.isBehindSchedule) return -1;
      if (!a.isBehindSchedule && b.isBehindSchedule) return 1;
      return (a.deliveryTimeMin || 0) - (b.deliveryTimeMin || 0);
    });
  }, [drops, stageFilter]);

  // Derive unassigned boxes from drops that either have unassigned drivers or staging boxes
  const unassignedBoxes = useMemo(() => {
    const boxes: { id: string; companyName: string; dietary: string[]; stage: string; dropId: string }[] = [];
    drops.forEach((d: any, idx: number) => {
      const isUnassigned = !d.driver || d.stage === 'PREPARING';
      if (isUnassigned) {
        boxes.push({
          id: `BX-${(d.id || String(idx)).slice(0, 6).toUpperCase()}`,
          companyName: d.company?.name || 'Client',
          dietary: ['Standard', 'V'],
          stage: d.stage,
          dropId: d.id,
        });
      }
    });
    return boxes;
  }, [drops]);

  const toggleBox = (id: string) => {
    setSelectedBoxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleDropExpanded = (dropId: string) => {
    setExpandedDropIds((prev) => ({ ...prev, [dropId]: !prev[dropId] }));
  };

  // Courier workload calculation
  const courierWorkload = useMemo(() => {
    return drivers.map((driver) => {
      const assigned = drops.filter((d: any) => d.driver?.id === driver.id);
      const earliestDrop = assigned
        .filter((d: any) => d.stage !== 'DELIVERED')
        .sort((a: any, b: any) => a.deliveryTimeMin - b.deliveryTimeMin)[0];
      return {
        id: driver.id,
        name: driver.name,
        assignedCount: assigned.length,
        capacityMax: 8,
        nextDeparture: earliestDrop ? formatMinutesToTime(Math.max(0, earliestDrop.deliveryTimeMin - 45)) : null,
        isAvailable: assigned.length < 8,
      };
    });
  }, [drivers, drops]);

  // Context bar counts
  const totalStaged = drops.filter((d: any) => ['DISPATCH_READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(d.stage)).length;
  const unassignedCount = summary?.unassignedCount ?? drops.filter((d: any) => !d.driver).length;

  return (
    <AppShell requiredPermission="dispatch:read">
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title="Dispatch Board"
          subtitle={`Route staging and driver dispatch for ${formatDate(activeDate)}`}
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
          contextBar={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[var(--text-muted)]">
                  Staged <strong className="text-[var(--text)] font-mono">{totalStaged}/{drops.length}</strong> · Drops <strong className="text-[var(--text)] font-mono">{drops.length}</strong>
                </span>
                {unassignedCount > 0 ? (
                  <StatusBadge category="warning" label={`Unassigned ${unassignedCount}`} />
                ) : (
                  <span className="text-[13px] text-[var(--text-muted)]">· Unassigned 0</span>
                )}
              </div>

              {/* Stage filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Filter stage:
                </span>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="h-[28px] px-2 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[12px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                >
                  <option value="ALL">All Stages ({drops.length})</option>
                  <option value="PREPARING">Preparing</option>
                  <option value="KITCHEN_READY">Kitchen Ready</option>
                  <option value="DISPATCH_READY">Dispatch Ready</option>
                  <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>
            </div>
          }
        />

        {isError && (
          <StateBanner
            variant="error"
            message="Unable to refresh dispatch board"
            onRetry={() => refetch()}
          />
        )}

        {/* 3-Pane Split Grid (28% / 44% / 28%, min 280px, full height) */}
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[580px]">
          {/* ─────────────────────────────────────────────────────────────
              PANE 1: UNASSIGNED BOXES (28% -> 3/4 cols)
          ───────────────────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col overflow-hidden min-w-[280px]">
            {/* Sticky Header */}
            <div className="h-[44px] px-3.5 border-b border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Unassigned Boxes
                </span>
                <span className="text-[11px] font-mono text-[var(--text-faint)]">
                  ({unassignedBoxes.length})
                </span>
              </div>
              {selectedBoxIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBoxIds([])}
                  className="text-[11px] text-[var(--brand-text)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Dense Checkbox List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-[var(--border)]">
              {unassignedBoxes.length > 0 ? (
                unassignedBoxes.map((box) => {
                  const isChecked = selectedBoxIds.includes(box.id);
                  return (
                    <div
                      key={box.id}
                      onClick={() => toggleBox(box.id)}
                      className={cn(
                        'pt-1.5 first:pt-0 p-2 rounded-[6px] cursor-pointer transition-colors duration-120 flex items-start gap-2.5',
                        isChecked ? 'bg-[var(--brand-soft)] border border-[var(--brand-solid)]' : 'hover:bg-[var(--bg-raised)]'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded-[4px] accent-[var(--brand-solid)] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12px] font-mono font-semibold text-[var(--text)]">
                            {box.id}
                          </span>
                          <StatusBadge status={box.stage} className="h-[18px] text-[10px]" />
                        </div>
                        <div className="text-[12px] text-[var(--text-muted)] truncate">
                          {box.companyName}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {box.dietary.map((d, i) => (
                            <Chip key={i} label={d} className="h-[18px] text-[10px]" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-[12px] text-[var(--text-muted)]">
                  All boxes are grouped and staged.
                </div>
              )}
            </div>

            {/* Sticky Footer Button */}
            <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
              <Button
                variant="primary"
                disabled={selectedBoxIds.length === 0}
                onClick={() => {
                  toast.success(`${selectedBoxIds.length} boxes staged into drop`);
                  setSelectedBoxIds([]);
                }}
                className="w-full h-[32px]"
              >
                Group into Drop ({selectedBoxIds.length})
              </Button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              PANE 2: DROPS (44% -> 5/6 cols)
          ───────────────────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-6 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col overflow-hidden min-w-[280px]">
            {/* Sticky Header */}
            <div className="h-[44px] px-3.5 border-b border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  Drops
                </span>
                <span className="text-[11px] font-mono text-[var(--text-faint)]">
                  ({sortedDrops.length})
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-faint)]">
                Sorted by departure
              </span>
            </div>

            {/* Drops List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {isLoading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[96px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-raised)] animate-pulse" />
                  ))}
                </div>
              ) : sortedDrops.length > 0 ? (
                sortedDrops.map((drop: any) => {
                  const isExpanded = !!expandedDropIds[drop.id];
                  const isDelayed = drop.isBehindSchedule;
                  const canMarkReady = drop.canDispatchReady && drop.stage === 'KITCHEN_READY';
                  const canDepart = drop.stage === 'DISPATCH_READY' && !!drop.driver;

                  return (
                    <div
                      key={drop.id}
                      className={cn(
                        'rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors duration-120 space-y-2.5',
                        isDelayed && 'border-l-4 border-l-[var(--status-danger-fg)]'
                      )}
                    >
                      {/* Top Row: Drop Name, Window, StatusBadge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleDropExpanded(drop.id)}
                            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <span className="text-[14px] font-semibold text-[var(--text)] truncate">
                            {drop.company?.name}
                          </span>
                          <span className="text-[12px] font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                            {drop.orderCount} orders · {drop.totalMeals} meals
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={drop.stage} />
                          {isDelayed && (
                            <StatusBadge category="danger" label="Delayed" pulse className="h-[20px] text-[11px]" />
                          )}
                        </div>
                      </div>

                      {/* Row 2: Delivery window & departure time */}
                      <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Clock className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                          <span>Delivery: <strong className="text-[var(--text)]">{formatMinutesToTime(drop.deliveryTimeMin)}</strong></span>
                        </div>

                        {/* Progress Bar: Ready x / totalMeals */}
                        <div className="w-36">
                          <ProgressBar
                            value={drop.totalMeals - (drop.stillCookingCount || 0)}
                            max={drop.totalMeals}
                            showText
                          />
                        </div>
                      </div>

                      {/* Row 3: Courier Assignment + Stage Action */}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--border)]">
                        {/* Courier Assignment */}
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={drop.driver?.id || ''}
                            disabled={drop.stage === 'DELIVERED'}
                            onChange={(e) => {
                              const newDriverId = e.target.value || null;
                              assignDriverMutation.mutate({ dropId: drop.id, driverId: newDriverId });
                            }}
                            className="h-[28px] px-2 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[12px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] max-w-[200px]"
                          >
                            <option value="">-- Assign courier --</option>
                            {drivers.map((drv) => (
                              <option key={drv.id} value={drv.id}>
                                {drv.name}
                              </option>
                            ))}
                          </select>

                          {drop.driver && (
                            <span className="text-[12px] text-[var(--text-muted)] truncate">
                              ({drop.driver.name})
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="shrink-0 flex items-center gap-2">
                          {canMarkReady && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => dispatchReadyMutation.mutate(drop.id)}
                              loading={dispatchReadyMutation.isPending}
                              className="h-[28px] px-2.5 text-[12px]"
                            >
                              <PackageCheck className="w-3.5 h-3.5 mr-1" /> Mark ready
                            </Button>
                          )}

                          {canDepart && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => outForDeliveryMutation.mutate(drop.id)}
                              loading={outForDeliveryMutation.isPending}
                              className="h-[28px] px-2.5 text-[12px]"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" /> Depart
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-[var(--border)] text-[12px] text-[var(--text-muted)] space-y-1">
                          <div>
                            <strong>Destination:</strong> {drop.address?.line1}, {drop.address?.city} ({drop.address?.postcode})
                          </div>
                          {drop.company?.driverNotes && (
                            <div className="text-[11px] p-1.5 rounded bg-[var(--bg-raised)] text-[var(--status-warning-fg)] border border-[var(--border)]">
                              Note: {drop.company.driverNotes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState message="No drops found for this date & filter." />
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              PANE 3: COURIERS & DEPARTURES (28% -> 3 cols)
          ───────────────────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col overflow-hidden min-w-[280px]">
            {/* Sticky Header */}
            <div className="h-[44px] px-3.5 border-b border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-between shrink-0 select-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Couriers & Departures
              </span>
              <span className="text-[11px] font-mono text-[var(--text-faint)]">
                {drivers.length} couriers
              </span>
            </div>

            {/* Courier Capacity List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {courierWorkload.map((c) => (
                <div
                  key={c.id}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[var(--text)]">
                      {c.name}
                    </span>
                    <StatusBadge
                      category={c.isAvailable ? 'success' : 'warning'}
                      label={c.isAvailable ? 'Available' : 'At capacity'}
                      className="h-[18px] text-[10px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-[var(--text-muted)] font-mono">
                      <span>Capacity load</span>
                      <span>{c.assignedCount} / {c.capacityMax}</span>
                    </div>
                    <ProgressBar
                      value={c.assignedCount}
                      max={c.capacityMax}
                      showText={false}
                    />
                  </div>

                  {c.nextDeparture && (
                    <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center justify-between pt-1">
                      <span>Next departure:</span>
                      <strong className="text-[var(--text)]">{c.nextDeparture}</strong>
                    </div>
                  )}
                </div>
              ))}

              {/* Horizontal Timeline of next 3 hours */}
              <div className="mt-4 pt-3 border-t border-[var(--border)]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-2">
                  Departures Timeline (Next 3h)
                </span>
                <div className="grid grid-cols-3 gap-1 text-center font-mono text-[11px]">
                  <div className="p-1.5 rounded-[4px] bg-[var(--bg-raised)] border border-[var(--border)]">
                    <div className="text-[var(--text-faint)]">11:00</div>
                    <div className="text-[var(--text)] font-semibold mt-0.5">2 drops</div>
                  </div>
                  <div className="p-1.5 rounded-[4px] bg-[var(--bg-raised)] border border-[var(--border)]">
                    <div className="text-[var(--text-faint)]">12:00</div>
                    <div className="text-[var(--text)] font-semibold mt-0.5">4 drops</div>
                  </div>
                  <div className="p-1.5 rounded-[4px] bg-[var(--bg-raised)] border border-[var(--border)]">
                    <div className="text-[var(--text-faint)]">13:00</div>
                    <div className="text-[var(--text)] font-semibold mt-0.5">1 drop</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
