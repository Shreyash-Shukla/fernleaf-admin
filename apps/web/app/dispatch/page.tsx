'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatDate, formatMinutesToTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  User,
  MapPin,
  ChevronRight,
  PackageCheck,
  Send,
  Camera,
  FileText,
} from 'lucide-react';

export default function DispatchBoardPage() {
  const queryClient = useQueryClient();

  // Meta context
  const { data: meta } = useQuery<{ today: string }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  const [date, setDate] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  const activeDate = date || meta?.today || new Date().toISOString().slice(0, 10);

  // Fetch Drivers list for assignment dropdown
  const { data: staffData } = useQuery<{ staff: any[] }>({
    queryKey: ['staff', 'drivers'],
    queryFn: () => fetchApi('/staff'),
  });
  const drivers = staffData?.staff?.filter((s) => s.role?.key === 'driver' && s.active) || [];

  // Fetch Dispatch Board
  const { data: boardData, isLoading, refetch } = useQuery<any>({
    queryKey: ['dispatch', 'board', activeDate],
    queryFn: () => fetchApi(`/dispatch/board?date=${activeDate}`),
    enabled: !!activeDate,
    refetchInterval: 15000,
  });

  // Action Mutations
  const dispatchReadyMutation = useMutation({
    mutationFn: (dropId: string) => fetchApi(`/drops/${dropId}/dispatch-ready`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Drop marked as Dispatch Ready!');
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
      toast.success('Driver assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['dispatch', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign driver');
    },
  });

  const outForDeliveryMutation = useMutation({
    mutationFn: (dropId: string) => fetchApi(`/drops/${dropId}/out-for-delivery`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Drop is now Out for Delivery!');
      queryClient.invalidateQueries({ queryKey: ['dispatch', 'board'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update stage');
    },
  });

  const summary = boardData?.summary;
  const drops = boardData?.drops || [];

  const filteredDrops = drops.filter((d: any) => {
    if (selectedStage === 'ALL') return true;
    return d.stage === selectedStage;
  });

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'PREPARING':
        return <Badge variant="secondary">In Kitchen</Badge>;
      case 'KITCHEN_READY':
        return <Badge variant="warning">Kitchen Done</Badge>;
      case 'DISPATCH_READY':
        return <Badge variant="info">Dispatch Ready</Badge>;
      case 'OUT_FOR_DELIVERY':
        return <Badge variant="default">Out for Delivery</Badge>;
      case 'DELIVERED':
        return <Badge variant="default" className="bg-emerald-600/30 text-emerald-300 border-emerald-500/50">Delivered</Badge>;
      default:
        return <Badge variant="outline">{stage}</Badge>;
    }
  };

  return (
    <AppShell requiredPermission="dispatch:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-emerald-400" />
              <span>Dispatch Board</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Staging, driver assignment, and route dispatch for delivery drops
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
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 bg-slate-900/60 border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Drops Today
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {summary?.totalDrops || 0}
            </div>
          </Card>

          <Card
            className={`p-3 bg-slate-900/60 ${
              summary?.unassignedCount > 0 ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800'
            }`}
          >
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3" /> Unassigned Drops
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {summary?.unassignedCount || 0}
            </div>
          </Card>

          <Card
            className={`p-3 bg-slate-900/60 ${
              summary?.behindScheduleCount > 0 ? 'border-rose-500/50 bg-rose-950/20' : 'border-slate-800'
            }`}
          >
            <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> Behind Schedule
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {summary?.behindScheduleCount || 0}
            </div>
          </Card>

          <Card className="p-3 bg-slate-900/60 border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Delivered Drops
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {summary?.stageCounts?.DELIVERED || 0}
            </div>
          </Card>
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'ALL', label: 'All Drops', count: summary?.totalDrops || 0 },
            { id: 'PREPARING', label: 'Preparing', count: summary?.stageCounts?.PREPARING || 0 },
            { id: 'KITCHEN_READY', label: 'Kitchen Done', count: summary?.stageCounts?.KITCHEN_READY || 0 },
            { id: 'DISPATCH_READY', label: 'Dispatch Ready', count: summary?.stageCounts?.DISPATCH_READY || 0 },
            { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', count: summary?.stageCounts?.OUT_FOR_DELIVERY || 0 },
            { id: 'DELIVERED', label: 'Delivered', count: summary?.stageCounts?.DELIVERED || 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStage(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedStage === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Drops List */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            Loading dispatch board...
          </div>
        ) : filteredDrops.length > 0 ? (
          <div className="space-y-4">
            {filteredDrops.map((drop: any) => {
              const canMarkReady = drop.canDispatchReady && drop.stage === 'KITCHEN_READY';
              const canDepart = drop.stage === 'DISPATCH_READY' && !!drop.driver;

              return (
                <Card
                  key={drop.id}
                  className={`bg-slate-900/60 overflow-hidden transition-all ${
                    drop.isBehindSchedule
                      ? 'border-rose-500/70 shadow-rose-950/20 shadow-lg'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Top Bar of Drop Card */}
                  <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-white text-sm">
                        {drop.company?.name}
                      </span>
                      {getStageBadge(drop.stage)}
                      {drop.isBehindSchedule && (
                        <Badge variant="destructive" className="text-[10px]">
                          Behind Schedule
                        </Badge>
                      )}
                      {drop.onTime !== null && drop.onTime !== undefined && (
                        <Badge variant={drop.onTime ? 'default' : 'destructive'} className="text-[10px]">
                          {drop.onTime ? 'On-Time Delivery' : 'Late Delivery'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                      <div>
                        Delivery Window:{' '}
                        <strong className="text-slate-200">
                          {formatMinutesToTime(drop.deliveryTimeMin)}
                        </strong>
                      </div>
                      <div className="text-[11px]">
                        {drop.orderCount} orders ({drop.totalMeals} meals)
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                    {/* Destination Address & Driver Notes */}
                    <div className="space-y-2">
                      <div className="text-slate-400 text-[11px] uppercase font-semibold flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Destination
                      </div>
                      <div className="font-semibold text-slate-200">
                        {drop.address?.label}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {drop.address?.line1}, {drop.address?.city} {drop.address?.postcode}
                      </div>
                      {drop.company?.driverNotes && (
                        <div className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-300">
                          <strong>Standing Driver Instructions:</strong> {drop.company.driverNotes}
                        </div>
                      )}
                    </div>

                    {/* Driver Assignment */}
                    <div className="space-y-2">
                      <div className="text-slate-400 text-[11px] uppercase font-semibold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-sky-400" /> Assigned Driver
                      </div>

                      <select
                        value={drop.driver?.id || ''}
                        disabled={drop.stage === 'DELIVERED'}
                        onChange={(e) => {
                          const newDriverId = e.target.value || null;
                          assignDriverMutation.mutate({ dropId: drop.id, driverId: newDriverId });
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                      >
                        <option value="">No Driver Assigned (Unassigned)</option>
                        {drivers.map((drv) => (
                          <option key={drv.id} value={drv.id}>
                            {drv.name} ({drv.email})
                          </option>
                        ))}
                      </select>

                      {drop.driver ? (
                        <p className="text-[11px] text-slate-400">
                          Driver assigned: <strong className="text-slate-200">{drop.driver.name}</strong>
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-400 font-medium">
                          Assign a driver before marking Out for Delivery.
                        </p>
                      )}
                    </div>

                    {/* Stage Actions */}
                    <div className="space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="text-slate-400 text-[11px] uppercase font-semibold">
                          Stage Progress & Actions
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {drop.stage === 'PREPARING' && (
                            <span>Kitchen is preparing {drop.stillCookingCount} items.</span>
                          )}
                          {drop.stage === 'KITCHEN_READY' && (
                            <span className="text-emerald-400">All kitchen prep completed. Ready to stage.</span>
                          )}
                          {drop.stage === 'DISPATCH_READY' && (
                            <span className="text-sky-300">Staged & packed. Ready for driver departure.</span>
                          )}
                          {drop.stage === 'OUT_FOR_DELIVERY' && (
                            <span className="text-amber-300 font-medium">On the road with driver.</span>
                          )}
                          {drop.stage === 'DELIVERED' && (
                            <span className="text-emerald-400 font-medium">Delivered at {drop.deliveredAt ? new Date(drop.deliveredAt).toLocaleTimeString() : ''}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {canMarkReady && (
                          <Button
                            size="sm"
                            onClick={() => dispatchReadyMutation.mutate(drop.id)}
                            loading={dispatchReadyMutation.isPending}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 w-full"
                          >
                            <PackageCheck className="w-3.5 h-3.5 mr-1.5" />
                            Mark Dispatch Ready
                          </Button>
                        )}

                        {canDepart && (
                          <Button
                            size="sm"
                            onClick={() => outForDeliveryMutation.mutate(drop.id)}
                            loading={outForDeliveryMutation.isPending}
                            className="text-xs bg-sky-600 hover:bg-sky-500 w-full"
                          >
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                            Mark Out for Delivery
                          </Button>
                        )}

                        {drop.deliveredNote && (
                          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 w-full">
                            <strong>Driver Note:</strong> {drop.deliveredNote}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500 text-xs">
            No drops found for this date & filter.
          </div>
        )}
      </div>
    </AppShell>
  );
}
