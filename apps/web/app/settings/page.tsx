'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Sliders,
  Calendar,
  Clock,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('platform');

  // Manual Cutoff Trigger State
  const [cutoffDate, setCutoffDate] = useState('');
  const [forceCutoff, setForceCutoff] = useState(false);
  const [cutoffResult, setCutoffResult] = useState<any>(null);

  // Kitchen Holiday Modal State
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  // 1. Fetch Settings
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ['settings'],
    queryFn: () => fetchApi('/settings'),
  });

  // 2. Fetch Kitchen Holidays
  const { data: holidays, isLoading: holidaysLoading } = useQuery<any[]>({
    queryKey: ['kitchen-holidays'],
    queryFn: () => fetchApi('/kitchen-holidays'),
  });

  // 3. Fetch Meta for Today
  const { data: meta } = useQuery<any>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  React.useEffect(() => {
    if (meta?.today && !cutoffDate) {
      setCutoffDate(meta.today);
    }
  }, [meta, cutoffDate]);

  // Update Setting Mutation
  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      fetchApi(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    onSuccess: (_, vars) => {
      toast.success(`Setting "${vars.key}" updated`);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update setting'),
  });

  // Cut-off Manual Run Mutation
  const runCutoffMutation = useMutation({
    mutationFn: (payload: { date: string; force?: boolean }) =>
      fetchApi('/cutoff/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setCutoffResult(data);
      toast.success(`Cut-off processed for ${data.date}!`);
      queryClient.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to execute cut-off'),
  });

  // Cut-off Sweep Mutation
  const sweepCutoffMutation = useMutation({
    mutationFn: () => fetchApi('/cutoff/sweep', { method: 'POST' }),
    onSuccess: (data) => {
      toast.success(`Sweep finished: ${data.processedCount || 0} dates processed.`);
      queryClient.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to run sweep'),
  });

  // Reseed Demo Mutation
  const reseedMutation = useMutation({
    mutationFn: () => fetchApi('/admin/reseed', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Demo data reseeded relative to today!');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reseed demo data'),
  });

  // Kitchen Holiday Mutations
  const addHolidayMutation = useMutation({
    mutationFn: (payload: { date: string; name: string }) =>
      fetchApi('/kitchen-holidays', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Kitchen holiday added');
      setHolidayModalOpen(false);
      setHolidayDate('');
      setHolidayName('');
      queryClient.invalidateQueries({ queryKey: ['kitchen-holidays'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add kitchen holiday'),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (dateStr: string) =>
      fetchApi(`/kitchen-holidays/${dateStr}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Kitchen holiday removed');
      queryClient.invalidateQueries({ queryKey: ['kitchen-holidays'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete kitchen holiday'),
  });

  return (
    <AppShell requiredPermission="settings:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-emerald-400" />
              <span>Platform Settings & Cut-off</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Cut-off algorithm parameters, kitchen holidays calendar, and manual execution triggers
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => reseedMutation.mutate()}
            loading={reseedMutation.isPending}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Reseed Demo Data
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="platform" className="text-xs">
              Platform Configuration
            </TabsTrigger>
            <TabsTrigger value="cutoff" className="text-xs">
              Manual Cut-off Trigger
            </TabsTrigger>
            <TabsTrigger value="holidays" className="text-xs">
              Kitchen Holidays ({holidays?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Platform Configuration */}
          <TabsContent value="platform" className="space-y-4">
            <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-6">
              <h3 className="font-semibold text-sm text-white">Cut-off & Operational Parameters</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Timezone */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Kitchen Primary Timezone
                  </label>
                  <input
                    type="text"
                    defaultValue={settings?.timezone || 'Asia/Kolkata'}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({ key: 'timezone', value: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Standard IANA timezone string. All working days and cut-offs calculate in this zone.
                  </p>
                </div>

                {/* Cut-off Time */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Cut-off Time of Day
                  </label>
                  <input
                    type="time"
                    defaultValue={settings?.cutoffTime || '16:00'}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({ key: 'cutoffTime', value: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Time when orders lock for delivery.
                  </p>
                </div>

                {/* Cut-off Days */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Cut-off Days Count (Kitchen Working Days Back)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={14}
                    defaultValue={settings?.cutoffDays ?? 2}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({
                        key: 'cutoffDays',
                        value: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Counts back ONLY kitchen working days and skips kitchen holidays.
                  </p>
                </div>

                {/* Kitchen Buffer Minutes */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Kitchen Buffer (Minutes before Dispatch Ready)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    defaultValue={settings?.kitchenBufferMinutes ?? 30}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({
                        key: 'kitchenBufferMinutes',
                        value: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Target kitchen completion buffer before dispatch packaging.
                  </p>
                </div>

                {/* At-Risk Window Minutes */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Kitchen At-Risk Window (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    defaultValue={settings?.atRiskWindowMinutes ?? 60}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({
                        key: 'atRiskWindowMinutes',
                        value: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Orders with unstarted units within this window show amber &quot;At Risk&quot; warning.
                  </p>
                </div>

                {/* On-Time Delivery Grace Minutes */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Delivery On-Time Grace Window (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    defaultValue={settings?.onTimeGraceMinutes ?? 10}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({
                        key: 'onTimeGraceMinutes',
                        value: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Grace window past delivery time where delivery is still flagged on-time.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: Manual Cut-off Trigger */}
          <TabsContent value="cutoff" className="space-y-4">
            <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-6">
              <div>
                <h3 className="font-semibold text-sm text-white">Manual Cut-off Processing</h3>
                <p className="text-xs text-slate-400">
                  Trigger cut-off processing for a delivery date on demand. Cancels draft orders, confirms placed orders, and creates dispatch drops.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Target Delivery Date
                  </label>
                  <input
                    type="date"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceCutoff}
                      onChange={(e) => setForceCutoff(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                    />
                    <span>Force execution (Process even if cut-off window has not naturally passed)</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={() =>
                    runCutoffMutation.mutate({
                      date: cutoffDate,
                      force: forceCutoff,
                    })
                  }
                  loading={runCutoffMutation.isPending}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500"
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Run Cut-off for {cutoffDate}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => sweepCutoffMutation.mutate()}
                  loading={sweepCutoffMutation.isPending}
                  className="text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Run Sweep (Find all unprocessed dates)
                </Button>
              </div>

              {/* Execution Results Banner */}
              {cutoffResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2 mt-4">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Cut-off Execution Output:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-300">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Date Processed</div>
                      <div className="font-bold text-white">{cutoffResult.date}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Orders Confirmed</div>
                      <div className="font-bold text-emerald-400">
                        {cutoffResult.confirmedCount ?? cutoffResult.ordersConfirmed ?? 0}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Drafts Cancelled</div>
                      <div className="font-bold text-rose-400">
                        {cutoffResult.cancelledCount ?? cutoffResult.draftsCancelled ?? 0}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Status</div>
                      <div className="font-bold text-white">
                        {cutoffResult.skipped ? 'Skipped (Already Processed)' : 'Success'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 3: Kitchen Holidays */}
          <TabsContent value="holidays" className="space-y-4">
            <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white">Kitchen Working Holidays</h3>
                  <p className="text-xs text-slate-400">
                    Commercial kitchen closures. These dates are skipped when counting back cut-off days.
                  </p>
                </div>
                <Button size="sm" onClick={() => setHolidayModalOpen(true)} className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Holiday
                </Button>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                {holidaysLoading ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Loading kitchen holidays...
                  </div>
                ) : holidays && holidays.length > 0 ? (
                  holidays.map((h) => (
                    <div
                      key={h.date}
                      className="p-3 bg-slate-950/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">{h.name}</span>
                        <span className="text-[11px] text-emerald-400 ml-3">
                          {formatDate(h.date)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHolidayMutation.mutate(h.date)}
                        className="h-7 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No kitchen holidays configured.
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Kitchen Holiday Modal */}
        <Dialog open={holidayModalOpen} onOpenChange={setHolidayModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Kitchen Holiday</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Holiday / Closure Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Kitchen Closure"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setHolidayModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!holidayDate || !holidayName.trim()}
                onClick={() =>
                  addHolidayMutation.mutate({
                    date: holidayDate,
                    name: holidayName,
                  })
                }
                loading={addHolidayMutation.isPending}
              >
                Save Holiday
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
