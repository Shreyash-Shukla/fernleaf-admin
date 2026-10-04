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
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building,
  User,
  Navigation,
  Send,
  Camera,
  FileText,
  RefreshCw,
} from 'lucide-react';

export default function DriverViewPage() {
  const queryClient = useQueryClient();

  // Meta context
  const { data: meta } = useQuery<{ today: string }>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  const [date, setDate] = useState<string>('');
  const activeDate = date || meta?.today || new Date().toISOString().slice(0, 10);

  // Deliver modal state
  const [activeDropForDeliver, setActiveDropForDeliver] = useState<any>(null);
  const [deliverNote, setDeliverNote] = useState('');
  const [deliverPhotoBase64, setDeliverPhotoBase64] = useState<string | null>(null);

  // Fetch Driver's own drops
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['driver', 'drops', activeDate],
    queryFn: () => fetchApi(`/driver/drops?date=${activeDate}`),
    enabled: !!activeDate,
    refetchInterval: 15000,
  });

  // Depart / Out for Delivery mutation (in case driver departs directly)
  const departMutation = useMutation({
    mutationFn: (dropId: string) => fetchApi(`/drops/${dropId}/out-for-delivery`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Route started: Drop is out for delivery');
      queryClient.invalidateQueries({ queryKey: ['driver', 'drops'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to start route');
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
      const onTimeMsg = res?.onTime ? 'Delivered on time!' : 'Delivered (late window)';
      toast.success(`Drop completed! ${onTimeMsg}`);
      setActiveDropForDeliver(null);
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

  const summary = data?.summary;
  const drops = data?.drops || [];

  return (
    <AppShell requiredPermission="deliveries:read_own">
      <div className="max-w-xl mx-auto space-y-5 pb-8">
        {/* Mobile Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              <span>Driver Deliveries</span>
            </h1>
            <p className="text-xs text-slate-400">
              Your assigned drops for {formatDate(activeDate)}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 px-2.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Driver Summary Progress Pill */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div className="text-slate-400 text-[11px] font-semibold uppercase">Today&apos;s Run</div>
            <div className="text-base font-bold text-white mt-0.5">
              {summary?.deliveredDrops || 0} / {summary?.totalDrops || 0}{' '}
              <span className="text-xs font-normal text-slate-400">Completed</span>
            </div>
          </div>

          <Badge variant={summary?.remainingDrops === 0 ? 'default' : 'warning'} className="text-xs px-3 py-1">
            {summary?.remainingDrops || 0} Drops Remaining
          </Badge>
        </div>

        {/* Drops List (Phone-Friendly Stack) */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            Loading your route...
          </div>
        ) : drops.length > 0 ? (
          <div className="space-y-4">
            {drops.map((drop: any, idx: number) => {
              const isDelivered = drop.stage === 'DELIVERED';
              const isOutForDelivery = drop.stage === 'OUT_FOR_DELIVERY';
              const isReadyForDeparture = drop.stage === 'DISPATCH_READY';

              return (
                <Card
                  key={drop.id}
                  className={`border transition-all overflow-hidden ${
                    isDelivered
                      ? 'bg-slate-950/60 border-slate-800/80 opacity-80'
                      : isOutForDelivery
                      ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  {/* Top Bar of Drop Card */}
                  <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-white">{drop.company?.name}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                        <Clock className="w-3.5 h-3.5" />
                        {formatMinutesToTime(drop.deliveryTimeMin)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {drop.orderCount} orders • {drop.mealsCount} meals
                      </div>
                    </div>
                  </div>

                  {/* Destination Address Card */}
                  <div className="p-4 space-y-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-200">{drop.address?.label}</div>
                        <div className="text-slate-400 text-[11px] leading-relaxed">
                          {drop.address?.line1}
                          {drop.address?.line2 ? `, ${drop.address.line2}` : ''}, {drop.address?.city}{' '}
                          {drop.address?.postcode}
                        </div>
                      </div>
                    </div>

                    {/* Standing Driver Instructions */}
                    {drop.company?.driverNotes && (
                      <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-200">
                        <strong>Standing Note:</strong> {drop.company.driverNotes}
                      </div>
                    )}

                    {/* Recipients Preview */}
                    {drop.recipientNames?.length > 0 && (
                      <div className="text-[11px] text-slate-400">
                        <strong>Meals for:</strong> {drop.recipientNames.join(', ')}
                      </div>
                    )}

                    {/* Delivered Details */}
                    {isDelivered && (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered at{' '}
                          {drop.deliveredAt ? new Date(drop.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {drop.onTime !== null && (
                          <Badge variant={drop.onTime ? 'default' : 'destructive'} className="text-[10px]">
                            {drop.onTime ? 'On Time' : 'Late'}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Action Buttons (Large Touch Targets for Mobile) */}
                    {!isDelivered && (
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        {isReadyForDeparture && (
                          <Button
                            size="lg"
                            onClick={() => departMutation.mutate(drop.id)}
                            loading={departMutation.isPending}
                            className="w-full h-11 text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950/40"
                          >
                            <Navigation className="w-4 h-4 mr-2" /> Start Route / Depart
                          </Button>
                        )}

                        {isOutForDelivery && (
                          <Button
                            size="lg"
                            onClick={() => {
                              setActiveDropForDeliver(drop);
                              setDeliverNote('');
                              setDeliverPhotoBase64(null);
                            }}
                            className="w-full h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50"
                          >
                            <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Delivery
                          </Button>
                        )}

                        {!isReadyForDeparture && !isOutForDelivery && (
                          <div className="text-center py-2 text-slate-500 text-xs italic">
                            Order is currently in kitchen preparation.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500 text-xs">
            No deliveries assigned to you for this date.
          </div>
        )}

        {/* Delivery Completion Modal */}
        <Dialog
          open={!!activeDropForDeliver}
          onOpenChange={(open) => {
            if (!open) setActiveDropForDeliver(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Confirm Delivery</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="font-semibold text-slate-200">
                  {activeDropForDeliver?.company?.name}
                </div>
                <div className="text-slate-400 text-[11px]">
                  {activeDropForDeliver?.address?.line1}, {activeDropForDeliver?.address?.city}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Delivery Note / Recipient Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Handed to security reception"
                  value={deliverNote}
                  onChange={(e) => setDeliverNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Proof of Delivery Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg text-xs text-slate-300 cursor-pointer">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>{deliverPhotoBase64 ? 'Change Photo' : 'Upload / Snap Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {deliverPhotoBase64 && (
                    <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setActiveDropForDeliver(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  deliverMutation.mutate({
                    dropId: activeDropForDeliver.id,
                    note: deliverNote,
                    photo: deliverPhotoBase64,
                  })
                }
                loading={deliverMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Mark as Delivered
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
