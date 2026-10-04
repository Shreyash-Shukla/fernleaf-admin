'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents, formatDate, formatMinutesToTime, minutesToTimeString, timeStringToMinutes } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ShoppingBag,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Package,
  Building,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Edit,
  Truck,
  ChefHat,
  Ban,
} from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params?.id as string;
  const { can } = useAuth();

  // Dialog States
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideTime, setOverrideTime] = useState(720);
  const [overrideAddressId, setOverrideAddressId] = useState('');
  const [overridePackaging, setOverridePackaging] = useState('STANDARD');

  // Fetch Order Details
  const { data: orderData, isLoading } = useQuery<{ order: any; locked?: boolean }>({
    queryKey: ['order', id],
    queryFn: () => fetchApi(`/orders/${id}`),
    enabled: !!id,
  });

  const order = orderData?.order;
  const locked = orderData?.locked;

  // Fetch Company addresses for override modal
  const { data: companyData } = useQuery<any>({
    queryKey: ['company', order?.companyId],
    queryFn: () => fetchApi(`/companies/${order.companyId}`),
    enabled: !!order?.companyId && overrideModalOpen,
  });

  // Action Mutations
  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      fetchApi(`/orders/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success('Order cancelled successfully.');
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel order.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) =>
      fetchApi(`/orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success('Order rejected.');
      setRejectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reject order.');
    },
  });

  const placeMutation = useMutation({
    mutationFn: () => fetchApi(`/orders/${id}/place`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success('Order successfully placed!');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to place order.');
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/orders/${id}/override`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Admin override applied.');
      setOverrideModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to apply admin override.');
    },
  });

  if (isLoading) {
    return (
      <AppShell requiredPermission="orders:read">
        <div className="py-24 text-center text-slate-500 text-sm">
          Loading order details...
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell requiredPermission="orders:read">
        <div className="py-24 text-center text-slate-400 space-y-3">
          <p>Order not found.</p>
          <Button onClick={() => router.push('/orders')}>Return to Orders</Button>
        </div>
      </AppShell>
    );
  }

  const getStatusBadge = (statusName: string) => {
    switch (statusName) {
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'PLACED':
        return <Badge variant="warning">Placed</Badge>;
      case 'CONFIRMED':
        return <Badge variant="default">Confirmed</Badge>;
      case 'DELIVERED':
        return <Badge variant="info">Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary" className="line-through">Cancelled</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{statusName}</Badge>;
    }
  };

  // Timeline events
  const timeline = [
    { label: 'Created / Placed', time: order.placedAt || order.createdAt, done: !!order.placedAt },
    { label: 'Cut-off Confirmed', time: order.confirmedAt, done: !!order.confirmedAt },
    { label: 'Kitchen Started', time: order.kitchenStartedAt, done: !!order.kitchenStartedAt },
    { label: 'Kitchen Ready', time: order.kitchenReadyAt, done: !!order.kitchenReadyAt },
    { label: 'Dispatch Ready', time: order.dispatchReadyAt, done: !!order.dispatchReadyAt },
    { label: 'Out for Delivery', time: order.outForDeliveryAt, done: !!order.outForDeliveryAt },
    { label: 'Delivered', time: order.deliveredAt, done: !!order.deliveredAt },
  ];

  return (
    <AppShell requiredPermission="orders:read">
      <div className="space-y-6">
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/orders')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white font-mono">
                  Order #{order.number}
                </h1>
                {getStatusBadge(order.status)}
                {locked && <Badge variant="secondary">Locked by Cut-off</Badge>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Delivery for {formatDate(order.deliveryDate)} at{' '}
                {formatMinutesToTime(order.deliveryTimeMin)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {order.status === 'DRAFT' && (
              <Button
                size="sm"
                onClick={() => placeMutation.mutate()}
                loading={placeMutation.isPending}
                className="text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Place Order
              </Button>
            )}

            {/* Cancel (before cut-off or admin anytime) */}
            {(order.status === 'DRAFT' || order.status === 'PLACED' || (order.status === 'CONFIRMED' && can('*'))) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                className="text-xs text-rose-400 border-rose-900/50 hover:bg-rose-950/40"
              >
                <Ban className="w-3.5 h-3.5 mr-1" /> Cancel Order
              </Button>
            )}

            {/* Reject (Admin only, non-billable refusal) */}
            {can('orders:override') && ['PLACED', 'CONFIRMED'].includes(order.status) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRejectModalOpen(true)}
                className="text-xs"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            )}

            {/* Admin Override (after confirmation) */}
            {can('orders:override') && ['CONFIRMED', 'PLACED'].includes(order.status) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOverrideTime(order.deliveryTimeMin);
                  setOverrideAddressId(order.addressId);
                  setOverridePackaging(order.packaging);
                  setOverrideModalOpen(true);
                }}
                className="text-xs"
              >
                <Edit className="w-3.5 h-3.5 mr-1" /> Admin Override
              </Button>
            )}
          </div>
        </div>

        {/* Cancellation Notice if cancelled */}
        {order.status === 'CANCELLED' && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
            <span className="font-semibold text-rose-400">Order Cancelled:</span>{' '}
            <span className="text-slate-300">{order.cancelReason || 'No reason specified'}</span>
            <div className="text-[11px] text-slate-500">
              Cancelled at {new Date(order.cancelledAt || order.updatedAt).toLocaleString()}
            </div>
          </div>
        )}

        {/* Rejection Notice if rejected */}
        {order.status === 'REJECTED' && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs space-y-1">
            <span className="font-semibold text-rose-300">Terminal Rejection by Admin:</span>{' '}
            <span className="text-slate-200">{order.rejectReason}</span>
          </div>
        )}

        {/* Main Grid: Details + Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Order Items & Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-slate-800">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Ordered Items</span>
                  <span className="text-emerald-400 font-bold text-lg">
                    Total: {formatCents(order.totalCents)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-800/80">
                {order.lines?.map((line: any) => (
                  <div key={line.id} className="p-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-white">{line.dishName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          SKU: {line.dishSku} • Tier: {line.tierName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-emerald-400">
                          {formatCents(line.lineTotalCents)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {line.quantity} units @ base {formatCents(line.dishPriceCents)}
                        </div>
                      </div>
                    </div>

                    {/* Combinations breakdown */}
                    <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500/40">
                      {line.combinations?.map((combo: any) => (
                        <div
                          key={combo.id}
                          className="p-2 rounded bg-slate-950/60 border border-slate-800/60 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium text-slate-200">
                              {combo.quantity}x {combo.label || 'Standard'}
                            </span>
                            <div className="text-[11px] text-slate-400">
                              {combo.options?.map((o: any, idx: number) => (
                                <span key={idx}>
                                  {idx > 0 && ' • '}
                                  {o.groupName}: <strong className="text-slate-300">{o.optionName}</strong>
                                  {o.portionName ? ` (${o.portionName})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="font-semibold text-slate-300">
                            {formatCents(combo.totalCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* If draft with raw payload */}
                {(!order.lines || order.lines.length === 0) && order.draftPayload?.lines && (
                  <div className="p-5 text-xs text-slate-400 space-y-2">
                    <div className="font-semibold text-amber-400">Draft Order Payload (Not yet validated/snapshotted):</div>
                    <pre className="p-3 bg-slate-950 rounded-lg overflow-x-auto text-[11px]">
                      {JSON.stringify(order.draftPayload, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery & Logistics Details */}
            <Card className="border-slate-800 bg-slate-900/40">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  Delivery & Logistics Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-slate-400 text-[11px] uppercase font-semibold">Address</div>
                    <div className="font-medium text-slate-200 mt-1">
                      {order.addressSnapshot?.label || 'Corporate Office'}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {order.addressSnapshot?.line1}, {order.addressSnapshot?.city}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-slate-400 text-[11px] uppercase font-semibold">Packaging & Timings</div>
                    <div className="font-medium text-slate-200 mt-1">
                      Packaging: <span className="text-emerald-400">{order.packaging}</span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      Planned Dispatch: {order.plannedDispatchReadyAt ? new Date(order.plannedDispatchReadyAt).toLocaleTimeString() : 'Pending'}
                    </div>
                  </div>
                </div>

                {order.notes && (
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300">
                    <span className="font-semibold text-slate-400">Notes:</span> {order.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Customer Info & Timeline */}
          <div className="space-y-6">
            {/* Customer Info Card */}
            <Card className="border-slate-800 bg-slate-900/40">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  Employee & Company
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3 text-xs">
                <div>
                  <div className="text-[11px] text-slate-400">Employee</div>
                  <div className="font-semibold text-slate-200">{order.employee?.name}</div>
                  <div className="text-[11px] text-slate-400">{order.employee?.email}</div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400">Billed Company</div>
                  <div className="font-semibold text-slate-200">{order.company?.name}</div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400">Invoice Status</div>
                  <div className="mt-1">
                    {order.invoiceId ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Invoiced #{order.invoice?.number || order.invoiceId.slice(0, 8)}
                      </Badge>
                    ) : ['CONFIRMED', 'DELIVERED'].includes(order.status) ? (
                      <Badge variant="warning" className="text-[10px]">
                        Unbilled (Ready to Invoice)
                      </Badge>
                    ) : (
                      <span className="text-slate-500 text-[11px]">N/A</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lifecycle Timeline Card */}
            <Card className="border-slate-800 bg-slate-900/40">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Order Progress Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                <div className="relative pl-6 border-l border-slate-800 space-y-4 text-xs">
                  {timeline.map((evt, idx) => (
                    <div key={idx} className="relative">
                      <div
                        className={`absolute -left-[31px] top-0.5 w-3 h-3 rounded-full border-2 ${
                          evt.done
                            ? 'bg-emerald-500 border-slate-950'
                            : 'bg-slate-800 border-slate-700'
                        }`}
                      />
                      <div className={`font-medium ${evt.done ? 'text-white' : 'text-slate-500'}`}>
                        {evt.label}
                      </div>
                      {evt.time && (
                        <div className="text-[11px] text-slate-400">
                          {new Date(evt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {new Date(evt.time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cancel Modal */}
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Order #{order.number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs py-2">
              <p className="text-slate-300">
                Are you sure you want to cancel this order? If this order has already been invoiced,
                an automatic credit adjustment will be recorded for the company.
              </p>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Employee requested cancellation"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate(cancelReason)}
                loading={cancelMutation.isPending}
              >
                Confirm Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Order #{order.number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs py-2">
              <p className="text-rose-300">
                Admin Rejection is a terminal state that refuses the order and makes it permanently non-billable.
              </p>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Rejection Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kitchen capacity exceeded for this timeslot"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejectModalOpen(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim()}
                onClick={() => rejectMutation.mutate(rejectReason)}
                loading={rejectMutation.isPending}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin Override Modal */}
        <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Admin Override: Post-Cutoff Modifications</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-xs py-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Delivery Time
                </label>
                <input
                  type="time"
                  step={300}
                  value={minutesToTimeString(overrideTime)}
                  onChange={(e) => setOverrideTime(timeStringToMinutes(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Delivery Address
                </label>
                <select
                  value={overrideAddressId}
                  onChange={(e) => setOverrideAddressId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                >
                  {companyData?.addresses?.map((addr: any) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label} — {addr.line1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Packaging
                </label>
                <select
                  value={overridePackaging}
                  onChange={(e) => setOverridePackaging(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="INSULATED">Insulated</option>
                  <option value="ECO">Eco-friendly</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOverrideModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  overrideMutation.mutate({
                    deliveryTimeMin: overrideTime,
                    addressId: overrideAddressId,
                    packaging: overridePackaging,
                  })
                }
                loading={overrideMutation.isPending}
              >
                Save Override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
