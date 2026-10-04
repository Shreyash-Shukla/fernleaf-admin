'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatDate, formatMinutesToTime } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ChefHat,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  RefreshCw,
  Zap,
  Building,
  User,
  Sparkles,
  Layers,
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

  const activeDate = date || meta?.today || new Date().toISOString().slice(0, 10);

  // 2. Fetch Kitchen Board
  const queryParams = new URLSearchParams();
  queryParams.set('date', activeDate);
  if (selectedStationId && selectedStationId !== 'ALL') {
    queryParams.set('stationId', selectedStationId);
  }

  const { data: boardData, isLoading, refetch } = useQuery<any>({
    queryKey: ['kitchen', 'board', queryParams.toString()],
    queryFn: () => fetchApi(`/kitchen/board?${queryParams.toString()}`),
    enabled: !!activeDate,
    refetchInterval: 15000, // Live poll every 15s for the kitchen line
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
        data?.orderReady ? 'Unit marked done! All order units completed (Order Ready).' : 'Unit marked done.'
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
      toast.success('Order force-completed by admin');
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to force-complete order');
    },
  });

  const orders = boardData?.orders || [];
  const stations = boardData?.stations || [];
  const cookTotals = boardData?.cookTotals || [];

  return (
    <AppShell requiredPermission="kitchen:read">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-emerald-400" />
              <span>Kitchen Prep Board</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live preparation units for confirmed orders. Concurrency protected.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Date:</label>
              <input
                type="date"
                value={activeDate}
                onChange={(e) => setDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs h-8"
              title="Refresh board"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Operational Status Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 bg-slate-900/60 border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Prep Units
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {boardData?.totalUnits || 0}
            </div>
          </Card>

          <Card className="p-3 bg-slate-900/60 border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Units Done
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {boardData?.doneUnits || 0}
            </div>
          </Card>

          <Card
            className={`p-3 bg-slate-900/60 ${
              boardData?.lateOrdersCount > 0 ? 'border-rose-500/50 bg-rose-950/20' : 'border-slate-800'
            }`}
          >
            <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Late Orders
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {boardData?.lateOrdersCount || 0}
            </div>
          </Card>

          <Card
            className={`p-3 bg-slate-900/60 ${
              boardData?.atRiskOrdersCount > 0 ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800'
            }`}
          >
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> At Risk (&lt;60m)
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {boardData?.atRiskOrdersCount || 0}
            </div>
          </Card>
        </div>

        {/* Station Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900/80 rounded-xl border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setSelectedStationId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedStationId === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Stations ({boardData?.totalUnits || 0})
          </button>

          {stations.map((st: any) => (
            <button
              key={st.id || 'unassigned'}
              onClick={() => setSelectedStationId(st.id || 'null')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedStationId === (st.id || 'null')
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{st.name}</span>
              <span className="text-[10px] opacity-80">
                ({st.doneUnits}/{st.totalUnits})
              </span>
            </button>
          ))}
        </div>

        {/* Batch Cook Totals Card (Aggregated prep list) */}
        {cookTotals.length > 0 && selectedStationId === 'ALL' && (
          <Card className="border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Aggregated Batch Cooking Targets
              </span>
              <span className="text-[11px] text-slate-500">
                Sum across all confirmed orders for {activeDate}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
              {cookTotals.map((ct: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="truncate mr-2">
                    <div className="font-semibold text-slate-200 truncate">{ct.dishName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{ct.label}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-emerald-400">{ct.totalQty}</span>
                    <span className="text-[10px] text-slate-500 block">units</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Live Orders with Prep Units */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            Loading kitchen prep board...
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const isLate = order.isLate;
              const isAtRisk = order.isAtRisk;

              return (
                <Card
                  key={order.id}
                  className={`overflow-hidden transition-all bg-slate-900/60 ${
                    isLate
                      ? 'border-rose-500/80 shadow-lg shadow-rose-950/20'
                      : isAtRisk
                      ? 'border-amber-500/80 shadow-lg shadow-amber-950/20'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Order Header Banner */}
                  <div
                    className={`p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 border-b ${
                      isLate
                        ? 'bg-rose-950/30 border-rose-900/50'
                        : isAtRisk
                        ? 'bg-amber-950/30 border-amber-900/50'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-mono font-bold text-white text-sm">
                        Order #{order.number}
                      </span>
                      <span className="text-slate-300 font-medium">
                        {order.company?.name}
                      </span>
                      <span className="text-slate-400">
                        • {order.employee?.name}
                      </span>

                      {/* Risk Badges */}
                      {isLate && (
                        <Badge variant="destructive" className="animate-pulse text-[10px]">
                          LATE (Ready time passed)
                        </Badge>
                      )}
                      {!isLate && isAtRisk && (
                        <Badge variant="warning" className="text-[10px]">
                          AT RISK (&lt;60 min remaining)
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-slate-400 text-right">
                        <div>
                          Delivery:{' '}
                          <strong className="text-slate-200">
                            {formatMinutesToTime(order.deliveryTimeMin)}
                          </strong>
                        </div>
                        <div className="text-[11px]">
                          Target Ready:{' '}
                          <span className={isLate ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                            {order.plannedKitchenReadyAt
                              ? new Date(order.plannedKitchenReadyAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Force Complete for Admin / Force perms */}
                      {can('kitchen:force') && !order.kitchenReadyAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => forceMutation.mutate(order.id)}
                          loading={forceMutation.isPending}
                          className="text-[11px] h-7 px-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                          title="Marks all units started & done in one transaction"
                        >
                          <Zap className="w-3 h-3 mr-1 text-emerald-400" />
                          Force Complete
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Units List */}
                  <div className="p-4 space-y-2.5">
                    {order.units?.map((unit: any) => {
                      const isDone = unit.state === 'DONE';
                      const isStarted = unit.state === 'STARTED';
                      const isNotStarted = unit.state === 'NOT_STARTED';

                      return (
                        <div
                          key={unit.id}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isDone
                              ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                              : isStarted
                              ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                              : 'bg-slate-950/80 border-slate-800'
                          }`}
                        >
                          {/* Unit Info */}
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {unit.quantity}x
                              </span>
                              <span className="font-semibold text-slate-100">
                                {unit.dishName}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0">
                                {unit.stationName || 'Unassigned'}
                              </Badge>
                              {isDone ? (
                                <Badge variant="default" className="text-[10px] py-0">
                                  Done
                                </Badge>
                              ) : isStarted ? (
                                <Badge variant="warning" className="text-[10px] py-0">
                                  Cooking
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] py-0">
                                  Queued
                                </Badge>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400">
                              {unit.label || 'Standard Combination'}
                            </div>

                            {unit.options?.length > 0 && (
                              <div className="text-[11px] text-emerald-400/90 font-medium">
                                {unit.options.map((o: any, idx: number) => (
                                  <span key={idx}>
                                    {idx > 0 && ' • '}
                                    {o.groupName}: {o.optionName}
                                    {o.portionName ? ` (${o.portionName})` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Unit Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isNotStarted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startMutation.mutate(unit.id)}
                                loading={startMutation.isPending}
                                className="h-8 text-xs px-3 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                              >
                                <Play className="w-3.5 h-3.5 mr-1 text-amber-400" /> Start
                              </Button>
                            )}

                            {!isDone && (
                              <Button
                                size="sm"
                                onClick={() => doneMutation.mutate(unit.id)}
                                loading={doneMutation.isPending}
                                className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                              </Button>
                            )}

                            {isDone && (
                              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium pr-2">
                                <CheckCircle2 className="w-4 h-4" /> Ready
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500 text-xs">
            No prep units scheduled for this date & station. Only CONFIRMED orders appear on the kitchen board.
          </div>
        )}
      </div>
    </AppShell>
  );
}
