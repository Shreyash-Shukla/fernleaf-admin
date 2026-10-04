'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Play,
  RotateCcw,
  Plus,
  Trash2,
  RefreshCw,
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
  const { data: settings } = useQuery<any>({
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
      toast.success(`Cut-off processed for ${data.date}`);
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
      toast.success('Demo data reseeded relative to today');
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
      <div className="space-y-4">
        {/* Header with Reseed Demo in overflow menu */}
        <PageHeader
          title="Platform Settings & Cut-off"
          subtitle="Cut-off algorithm parameters, kitchen holidays calendar, and manual execution triggers"
          demoActions={[
            {
              label: 'Reseed demo data',
              onClick: () => reseedMutation.mutate(),
            },
          ]}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="platform">
              Platform configuration
            </TabsTrigger>
            <TabsTrigger value="cutoff">
              Manual cut-off trigger
            </TabsTrigger>
            <TabsTrigger value="holidays">
              Kitchen holidays ({holidays?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Platform Configuration */}
          <TabsContent value="platform" className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
              <div className="font-semibold text-sm text-text">Cut-off & operational parameters</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* Timezone */}
                <div>
                  <label className="font-medium text-text block mb-1">
                    Kitchen primary timezone
                  </label>
                  <Input
                    defaultValue={settings?.timezone || 'Asia/Kolkata'}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({ key: 'timezone', value: e.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Standard IANA timezone string. All working days and cut-offs calculate in this zone.
                  </p>
                </div>

                {/* Cut-off Time */}
                <div>
                  <label className="font-medium text-text block mb-1">
                    Cut-off time of day
                  </label>
                  <Input
                    type="time"
                    defaultValue={settings?.cutoffTime || '16:00'}
                    onBlur={(e) =>
                      updateSettingMutation.mutate({ key: 'cutoffTime', value: e.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Time when orders lock for delivery.
                  </p>
                </div>

                {/* Cut-off Days */}
                <div>
                  <label className="font-medium text-text block mb-1">
                    Cut-off days count (kitchen working days back)
                  </label>
                  <Input
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
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Counts back only kitchen working days and skips kitchen holidays.
                  </p>
                </div>

                {/* Kitchen Buffer Minutes */}
                <div>
                  <label className="font-medium text-text block mb-1">
                    Kitchen buffer (minutes before dispatch ready)
                  </label>
                  <Input
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
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Target kitchen completion buffer before dispatch packaging.
                  </p>
                </div>

                {/* At-Risk Window Minutes */}
                <div>
                  <label className="font-medium text-text block mb-1">
                    Kitchen at-risk window (minutes)
                  </label>
                  <Input
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
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Orders with unstarted units within this window show amber &quot;At Risk&quot; warning.
                  </p>
                </div>

                {/* On-Time Delivery Grace Minutes */}
                <div>
                  <label className="font-medium text-text block mb-1">
                    Delivery on-time grace window (minutes)
                  </label>
                  <Input
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
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Grace window past delivery time where delivery is still flagged on-time.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Manual Cut-off Trigger */}
          <TabsContent value="cutoff" className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <div>
                <div className="font-semibold text-sm text-text">Manual cut-off processing</div>
                <p className="text-xs text-muted mt-0.5">
                  Trigger cut-off processing for a delivery date on demand. Cancels draft orders, confirms placed orders, and creates dispatch drops.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-medium text-text block mb-1">
                    Target delivery date
                  </label>
                  <Input
                    type="date"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceCutoff}
                      onChange={(e) => setForceCutoff(e.target.checked)}
                      className="rounded bg-app border-border text-brand-solid focus:ring-brand-solid"
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
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Run cut-off for {cutoffDate}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => sweepCutoffMutation.mutate()}
                  loading={sweepCutoffMutation.isPending}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Run sweep
                </Button>
              </div>

              {/* Execution Results Banner */}
              {cutoffResult && (
                <div className="p-4 rounded-lg bg-raised border border-border text-xs space-y-2 mt-4">
                  <div className="font-semibold text-text flex items-center gap-1.5">
                    Cut-off execution output:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2.5 rounded bg-surface border border-border">
                      <div className="text-[10px] text-muted uppercase tracking-wider">Date processed</div>
                      <div className="font-semibold text-text tabular-nums">{cutoffResult.date}</div>
                    </div>
                    <div className="p-2.5 rounded bg-surface border border-border">
                      <div className="text-[10px] text-muted uppercase tracking-wider">Orders confirmed</div>
                      <div className="font-semibold text-text tabular-nums">
                        {cutoffResult.confirmedCount ?? cutoffResult.ordersConfirmed ?? 0}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-surface border border-border">
                      <div className="text-[10px] text-muted uppercase tracking-wider">Drafts cancelled</div>
                      <div className="font-semibold text-text tabular-nums">
                        {cutoffResult.cancelledCount ?? cutoffResult.draftsCancelled ?? 0}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-surface border border-border">
                      <div className="text-[10px] text-muted uppercase tracking-wider">Status</div>
                      <div className="font-semibold text-text">
                        {cutoffResult.skipped ? 'Skipped' : 'Success'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: Kitchen Holidays */}
          <TabsContent value="holidays" className="space-y-4">
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-text">Kitchen working holidays</div>
                  <div className="text-xs text-muted mt-0.5">
                    Commercial kitchen closures. These dates are skipped when counting back cut-off days.
                  </div>
                </div>
                <Button size="sm" onClick={() => setHolidayModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add holiday
                </Button>
              </div>

              <div className="divide-y divide-border">
                {holidaysLoading ? (
                  <div className="py-12 text-center text-muted text-xs">
                    Loading kitchen holidays…
                  </div>
                ) : holidays && holidays.length > 0 ? (
                  holidays.map((h) => (
                    <div
                      key={h.date}
                      className="h-11 px-4 flex items-center justify-between text-xs hover:bg-raised transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-text">{h.name}</span>
                        <span className="font-mono text-muted text-xs tabular-nums">
                          {formatDate(h.date)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHolidayMutation.mutate(h.date)}
                        className="h-7 px-2 text-xs text-danger hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted text-xs">
                    No kitchen holidays configured.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Kitchen Holiday Modal */}
        <Dialog open={holidayModalOpen} onOpenChange={setHolidayModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add kitchen holiday</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-text block mb-1">Date *</label>
                <Input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Holiday / closure name *
                </label>
                <Input
                  required
                  placeholder="e.g. Diwali Kitchen Closure"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
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
                Save holiday
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
