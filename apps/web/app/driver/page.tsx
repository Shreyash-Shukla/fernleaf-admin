'use client';

import React, { useState, useMemo } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatDate, formatMinutesToTime, cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Chip } from '@/components/ui/chip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StateBanner } from '@/components/ui/state-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import {
  RefreshCw,
  Phone,
  Copy,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  Navigation,
  FileText,
  Truck,
  Image as ImageIcon,
} from 'lucide-react';

export default function DriverDeliveriesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Meta context
  const { data: meta } = useQuery<{ today: string }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  const [date, setDate] = useState<string>('');
  const activeDate = date || meta?.today || new Date().toISOString().slice(0, 10);

  // Active selected drop for detailed view in right pane
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);

  // Active tab in right panel
  const [activeTab, setActiveTab] = useState<'stops' | 'map' | 'notes'>('stops');

  // Delivery submission modal state
  const [deliverModalDrop, setDeliverModalDrop] = useState<any>(null);
  const [deliverNote, setDeliverNote] = useState('');
  const [deliverPhotoBase64, setDeliverPhotoBase64] = useState<string | null>(null);

  // Lightbox modal for photo proof
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Fetch Driver's own drops
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['driver', 'drops', activeDate],
    queryFn: () => fetchApi(`/driver/drops?date=${activeDate}`),
    enabled: !!activeDate,
    refetchInterval: 15000,
  });

  // Depart mutation
  const departMutation = useMutation({
    mutationFn: (dropId: string) => fetchApi(`/drops/${dropId}/out-for-delivery`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Drop marked out for delivery');
      queryClient.invalidateQueries({ queryKey: ['driver', 'drops'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to start delivery');
    },
  });

  // Mark Delivered mutation
  const deliverMutation = useMutation({
    mutationFn: ({ dropId, note, photo }: { dropId: string; note: string; photo?: string | null }) =>
      fetchApi(`/drops/${dropId}/deliver`, {
        method: 'POST',
        body: JSON.stringify({
          note,
          photo: photo || undefined,
        }),
      }),
    onSuccess: (res) => {
      const onTimeMsg = res?.onTime ? 'Delivered on time' : 'Delivered';
      toast.success(`Drop completed! ${onTimeMsg}`);
      setDeliverModalDrop(null);
      setDeliverNote('');
      setDeliverPhotoBase64(null);
      queryClient.invalidateQueries({ queryKey: ['driver', 'drops'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to complete delivery');
    },
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setDeliverPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const drops = data?.drops || [];
  const summary = data?.summary;

  // Pin delayed drops on top, then sort by deliveryTimeMin
  const sortedDrops = useMemo(() => {
    const list = [...drops];
    return list.sort((a: any, b: any) => {
      const aBehind = a.isBehindSchedule || a.stage === 'DELAYED';
      const bBehind = b.isBehindSchedule || b.stage === 'DELAYED';
      if (aBehind && !bBehind) return -1;
      if (!aBehind && bBehind) return 1;
      return (a.deliveryTimeMin || 0) - (b.deliveryTimeMin || 0);
    });
  }, [drops]);

  // Selected drop or default to first
  const activeDrop = useMemo(() => {
    if (selectedDropId) {
      return drops.find((d: any) => d.id === selectedDropId) || drops[0];
    }
    return drops[0] || null;
  }, [drops, selectedDropId]);

  const totalStops = summary?.totalDrops ?? drops.length;
  const deliveredStops = summary?.deliveredDrops ?? drops.filter((d: any) => d.stage === 'DELIVERED').length;

  const handleCopyPhone = (phoneStr: string) => {
    navigator.clipboard?.writeText(phoneStr);
    toast.success('Phone copied to clipboard');
  };

  return (
    <AppShell requiredPermission="deliveries:read_own">
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title="My Deliveries"
          subtitle={`Driver field route management for ${formatDate(activeDate)}`}
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
                title="Refresh route"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          }
          contextBar={
            <div className="flex items-center justify-between w-full text-[13px] text-[var(--text-muted)]">
              <div>
                Driver:{' '}
                <strong className="text-[var(--text)]">
                  {user?.name || user?.email || 'Active Driver'}
                </strong>
                {' · '}
                Progress: <strong className="text-[var(--text)] font-mono">{deliveredStops} / {totalStops} stops</strong>
              </div>
              <div className="w-48">
                <ProgressBar value={deliveredStops} max={totalStops} showText />
              </div>
            </div>
          }
        />

        {isError && (
          <StateBanner
            variant="error"
            message="Unable to refresh delivery run"
            onRetry={() => refetch()}
          />
        )}

        {/* 2-Column Split: 40% Left / 60% Right */}
        <div className="grid grid-cols-12 gap-4 min-h-[580px]">
          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN (40% -> 5 cols)
          ───────────────────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="h-[44px] px-4 border-b border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-between shrink-0 select-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Assigned Stops ({sortedDrops.length})
              </span>
              <span className="text-[11px] text-[var(--text-faint)]">
                Delayed pinned first
              </span>
            </div>

            {/* Run Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {isLoading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[88px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-raised)] animate-pulse" />
                  ))}
                </div>
              ) : sortedDrops.length > 0 ? (
                sortedDrops.map((drop: any, idx: number) => {
                  const isSelected = activeDrop?.id === drop.id;
                  const isDelayed = drop.isBehindSchedule;
                  const isDelivered = drop.stage === 'DELIVERED';

                  return (
                    <div
                      key={drop.id}
                      onClick={() => setSelectedDropId(drop.id)}
                      className={cn(
                        'rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] p-3 cursor-pointer transition-colors duration-120 space-y-2 select-none',
                        isDelayed && 'border-l-4 border-l-[var(--status-danger-fg)]',
                        isSelected ? 'bg-[var(--brand-soft)] border-[var(--brand-solid)]' : 'hover:bg-[var(--bg-raised)]',
                        isDelivered && 'opacity-65'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center font-mono text-[11px] font-bold text-[var(--text)]">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-[12px] font-semibold text-[var(--text)]">
                            {(drop.id || '').slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <StatusBadge status={drop.stage} />
                      </div>

                      <div className="text-[14px] font-medium text-[var(--text)] truncate">
                        {drop.company?.name}
                      </div>

                      <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)] font-mono">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                          <span>ETA {formatMinutesToTime(drop.deliveryTimeMin)}</span>
                        </div>
                        <span>{drop.totalMeals} meals</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState message="No stops assigned for today." />
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN (60% -> 7 cols)
          ───────────────────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-7 rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col overflow-hidden">
            {activeDrop ? (
              <>
                {/* Header (Courier, vehicle, phone with click-to-copy) */}
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-raised)] flex flex-wrap items-center justify-between gap-4 select-none">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-[var(--text)]">
                        {user?.name || 'Driver Route Unit #1'}
                      </span>
                      <Chip label="Refrig Van #04" />
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                      Destination: <strong className="text-[var(--text)]">{activeDrop.company?.name}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPhone('+1 (555) 019-2834')}
                      className="h-[28px] px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-raised)] text-[12px] text-[var(--text)] flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                    >
                      <Phone className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span>+1 (555) 019-2834</span>
                      <Copy className="w-3 h-3 text-[var(--text-faint)] ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Tabs: Stops · Map · Notes & proof */}
                <div className="flex-1 flex flex-col p-4">
                  <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="flex-1 flex flex-col">
                    <TabsList>
                      <TabsTrigger value="stops">Stops Timeline</TabsTrigger>
                      <TabsTrigger value="map">Map Container</TabsTrigger>
                      <TabsTrigger value="notes">Notes & Proof</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: Stops Timeline */}
                    <TabsContent value="stops" className="flex-1 space-y-4 pt-2">
                      <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-[var(--border)]">
                        {sortedDrops.map((d: any, sIdx: number) => {
                          const isCurrent = d.id === activeDrop.id;
                          const isDelivered = d.stage === 'DELIVERED';
                          const canDepart = d.stage === 'DISPATCH_READY';
                          const canDeliver = d.stage === 'OUT_FOR_DELIVERY';

                          return (
                            <div key={d.id} className="relative space-y-1 text-[13px]">
                              {/* Numbered circle on timeline */}
                              <div
                                className={cn(
                                  'absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center font-mono text-[10px] font-bold',
                                  isDelivered
                                    ? 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border-[var(--status-success-border)]'
                                    : isCurrent
                                    ? 'bg-[var(--brand-solid)] text-[var(--brand-solid-text)] border-[var(--brand-solid)]'
                                    : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border)]'
                                )}
                              >
                                {sIdx + 1}
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[var(--text)]">
                                  {d.company?.name}
                                </span>
                                <StatusBadge status={d.stage} className="h-[20px] text-[11px]" />
                              </div>

                              <div className="text-[12px] text-[var(--text-muted)] flex items-start gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0 mt-0.5" />
                                <span>{d.address?.line1}, {d.address?.city} ({d.address?.postcode})</span>
                              </div>

                              <div className="flex items-center gap-4 text-[12px] font-mono text-[var(--text-muted)]">
                                <span>Planned: {formatMinutesToTime(d.deliveryTimeMin)}</span>
                                {d.deliveredAt && (
                                  <span className="text-[var(--status-success-fg)]">
                                    Delivered: {new Date(d.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              {/* Action button on active stop */}
                              {isCurrent && (
                                <div className="pt-2 flex items-center gap-2">
                                  {canDepart && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => departMutation.mutate(d.id)}
                                      loading={departMutation.isPending}
                                    >
                                      Start Route to this Stop
                                    </Button>
                                  )}

                                  {canDeliver && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => setDeliverModalDrop(d)}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete Delivery & Proof
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>

                    {/* TAB 2: Map Container (Restyle container, no map library added) */}
                    <TabsContent value="map" className="flex-1 pt-2">
                      <div className="h-[360px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-raised)] p-6 flex flex-col items-center justify-center text-center">
                        <Navigation className="w-8 h-8 text-[var(--text-faint)] mb-2 stroke-[1.5]" />
                        <span className="text-[14px] font-semibold text-[var(--text)] mb-1">
                          Route Navigation Map
                        </span>
                        <p className="text-[12px] text-[var(--text-muted)] max-w-sm mb-3">
                          {activeDrop.company?.name} · {activeDrop.address?.line1}, {activeDrop.address?.city}
                        </p>
                        <Chip label={`Window: ${formatMinutesToTime(activeDrop.deliveryTimeMin)}`} />
                      </div>
                    </TabsContent>

                    {/* TAB 3: Notes & Proof */}
                    <TabsContent value="notes" className="flex-1 space-y-4 pt-2">
                      {activeDrop.deliveredNote || activeDrop.proofPhoto ? (
                        <div className="space-y-3">
                          {activeDrop.proofPhoto && (
                            <div>
                              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1.5">
                                Delivery Photo Proof (Click for Lightbox)
                              </span>
                              <div
                                onClick={() => setLightboxPhoto(activeDrop.proofPhoto)}
                                className="w-[96px] h-[96px] rounded-[6px] border border-[var(--border)] overflow-hidden cursor-pointer hover:border-[var(--brand-solid)] transition-colors"
                              >
                                <img
                                  src={activeDrop.proofPhoto}
                                  alt="Proof thumbnail"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}

                          {activeDrop.deliveredNote && (
                            <div className="p-3 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] text-[12px] text-[var(--text)]">
                              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase block mb-1">
                                Delivery Receiver Note
                              </span>
                              <p>{activeDrop.deliveredNote}</p>
                              {activeDrop.deliveredAt && (
                                <div className="text-[11px] font-mono text-[var(--text-faint)] mt-2">
                                  Logged at {new Date(activeDrop.deliveredAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-[12px] text-[var(--text-muted)]">
                          No delivery note or photo logged for this stop yet.
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            ) : (
              <EmptyState message="Select a stop on the left to inspect run details." />
            )}
          </div>
        </div>

        {/* Deliver Proof Modal */}
        <Dialog open={!!deliverModalDrop} onOpenChange={(o) => !o && setDeliverModalDrop(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Delivery Stop</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-[13px]">
              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                  Receiver Signature / Note:
                </label>
                <textarea
                  rows={3}
                  value={deliverNote}
                  onChange={(e) => setDeliverNote(e.target.value)}
                  placeholder="e.g. Left with building reception / front desk..."
                  className="w-full px-3 py-2 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[13px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                  Proof Photo (Optional):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="text-[12px] text-[var(--text-muted)]"
                />
                {deliverPhotoBase64 && (
                  <div className="mt-2 w-[96px] h-[96px] rounded-[6px] border border-[var(--border)] overflow-hidden">
                    <img src={deliverPhotoBase64} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeliverModalDrop(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  deliverMutation.mutate({
                    dropId: deliverModalDrop.id,
                    note: deliverNote,
                    photo: deliverPhotoBase64,
                  })
                }
                loading={deliverMutation.isPending}
              >
                Confirm Delivery
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Photo Lightbox Dialog */}
        <Dialog open={!!lightboxPhoto} onOpenChange={(o) => !o && setLightboxPhoto(null)}>
          <DialogContent className="max-w-xl p-3">
            <DialogHeader>
              <DialogTitle>Proof Photo</DialogTitle>
            </DialogHeader>
            {lightboxPhoto && (
              <div className="rounded-[6px] overflow-hidden max-h-[70vh] flex items-center justify-center bg-black">
                <img src={lightboxPhoto} alt="Delivery Proof" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
