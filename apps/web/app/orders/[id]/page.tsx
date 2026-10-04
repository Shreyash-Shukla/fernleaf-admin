'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents, formatDate, formatMinutesToTime, minutesToTimeString, timeStringToMinutes } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Edit,
  Ban,
  CheckCircle2,
  XCircle,
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
      toast.success('Order cancelled successfully');
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel order');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) =>
      fetchApi(`/orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success('Order rejected');
      setRejectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reject order');
    },
  });

  const placeMutation = useMutation({
    mutationFn: () => fetchApi(`/orders/${id}/place`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success('Order successfully placed');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to place order');
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/orders/${id}/override`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Admin override applied');
      setOverrideModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to apply admin override');
    },
  });

  if (isLoading) {
    return (
      <AppShell requiredPermission="orders:read">
        <div className="py-24 text-center text-muted text-xs">
          Loading order details…
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell requiredPermission="orders:read">
        <div className="py-24 text-center text-muted space-y-3">
          <p>Order not found.</p>
          <Button onClick={() => router.push('/orders')}>Return to orders</Button>
        </div>
      </AppShell>
    );
  }

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
      <div className="space-y-4">
        {/* Header Navigation */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/orders')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-text font-mono tabular-nums">
                  Order #{order.number}
                </h1>
                <StatusBadge status={order.status} />
                {locked && <Chip>Locked by Cut-off</Chip>}
              </div>
              <p className="text-xs text-muted mt-0.5 tabular-nums">
                Delivery for {formatDate(order.deliveryDate)} at{' '}
                {formatMinutesToTime(order.deliveryTimeMin)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {order.status === 'DRAFT' && (
              <Button
                size="sm"
                onClick={() => placeMutation.mutate()}
                loading={placeMutation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Place order
              </Button>
            )}

            {(order.status === 'DRAFT' || order.status === 'PLACED' || (order.status === 'CONFIRMED' && can('*'))) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                className="text-danger hover:text-danger"
              >
                <Ban className="w-3.5 h-3.5 mr-1.5" /> Cancel order
              </Button>
            )}

            {can('orders:override') && ['PLACED', 'CONFIRMED'].includes(order.status) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRejectModalOpen(true)}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
              </Button>
            )}

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
              >
                <Edit className="w-3.5 h-3.5 mr-1.5" /> Admin override
              </Button>
            )}
          </div>
        </div>

        {/* Cancellation Notice if cancelled */}
        {order.status === 'CANCELLED' && (
          <div className="p-3.5 rounded-lg bg-raised border border-border text-xs space-y-1">
            <span className="font-semibold text-danger">Order cancelled:</span>{' '}
            <span className="text-text">{order.cancelReason || 'No reason specified'}</span>
            <div className="text-[11px] text-muted tabular-nums">
              Cancelled at {new Date(order.cancelledAt || order.updatedAt).toLocaleString()}
            </div>
          </div>
        )}

        {/* Rejection Notice if rejected */}
        {order.status === 'REJECTED' && (
          <div className="p-3.5 rounded-lg bg-raised border border-border text-xs space-y-1">
            <span className="font-semibold text-danger">Terminal rejection by admin:</span>{' '}
            <span className="text-text">{order.rejectReason}</span>
          </div>
        )}

        {/* Main Grid: Details + Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left 2 Cols: Order Items & Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-sm text-text">Ordered items</span>
                <span className="font-semibold text-sm tabular-nums text-text">
                  Total: {formatCents(order.totalCents)}
                </span>
              </div>
              <div className="divide-y divide-border">
                {order.lines?.map((line: any) => (
                  <div key={line.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-text">{line.dishName}</div>
                        <div className="text-[11px] text-muted font-mono tabular-nums">
                          SKU: {line.dishSku} · Tier: {line.tierName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm text-text tabular-nums">
                          {formatCents(line.lineTotalCents)}
                        </div>
                        <div className="text-[11px] text-muted tabular-nums">
                          {line.quantity} units @ base {formatCents(line.dishPriceCents)}
                        </div>
                      </div>
                    </div>

                    {/* Combinations breakdown */}
                    <div className="space-y-1.5 pl-3 border-l-2 border-brand-solid">
                      {line.combinations?.map((combo: any) => (
                        <div
                          key={combo.id}
                          className="p-2 rounded bg-app border border-border flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium text-text tabular-nums">
                              {combo.quantity}x {combo.label || 'Standard'}
                            </span>
                            <div className="text-[11px] text-muted">
                              {combo.options?.map((o: any, idx: number) => (
                                <span key={idx}>
                                  {idx > 0 && ' · '}
                                  {o.groupName}: <strong className="text-text font-medium">{o.optionName}</strong>
                                  {o.portionName ? ` (${o.portionName})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="font-medium font-mono text-text tabular-nums">
                            {formatCents(combo.totalCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {(!order.lines || order.lines.length === 0) && order.draftPayload?.lines && (
                  <div className="p-4 text-xs text-muted space-y-2">
                    <div className="font-medium text-text">Draft order payload:</div>
                    <pre className="p-3 bg-app rounded-md border border-border overflow-x-auto text-[11px]">
                      {JSON.stringify(order.draftPayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery & Logistics Details */}
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3 text-xs">
              <div className="font-semibold text-sm text-text">
                Delivery & logistics details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-app border border-border">
                  <div className="text-muted text-[11px] uppercase tracking-wider font-semibold">Address</div>
                  <div className="font-medium text-text mt-1">
                    {order.addressSnapshot?.label || 'Corporate Office'}
                  </div>
                  <div className="text-muted text-[11px]">
                    {order.addressSnapshot?.line1}, {order.addressSnapshot?.city}
                  </div>
                </div>

                <div className="p-3 rounded-md bg-app border border-border">
                  <div className="text-muted text-[11px] uppercase tracking-wider font-semibold">Packaging & timings</div>
                  <div className="font-medium text-text mt-1">
                    Packaging: <Chip>{order.packaging}</Chip>
                  </div>
                  <div className="text-muted text-[11px] mt-1 tabular-nums">
                    Planned dispatch: {order.plannedDispatchReadyAt ? new Date(order.plannedDispatchReadyAt).toLocaleTimeString() : 'Pending'}
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="p-3 rounded-md bg-app border border-border text-[11px] text-muted">
                  <span className="font-medium text-text">Notes:</span> {order.notes}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Customer Info & Timeline */}
          <div className="space-y-4">
            {/* Customer Info Card */}
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3 text-xs">
              <div className="font-semibold text-sm text-text">
                Employee & company
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider">Employee</div>
                <div className="font-medium text-text">{order.employee?.name}</div>
                <div className="text-[12px] text-muted">{order.employee?.email}</div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="text-[11px] text-muted uppercase tracking-wider">Billed company</div>
                <div className="font-medium text-text">{order.company?.name}</div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="text-[11px] text-muted uppercase tracking-wider">Invoice status</div>
                <div className="mt-1">
                  {order.invoiceId ? (
                    <Chip>Invoiced #{order.invoice?.number || order.invoiceId.slice(0, 8)}</Chip>
                  ) : ['CONFIRMED', 'DELIVERED'].includes(order.status) ? (
                    <StatusBadge status="Due soon" label="Unbilled" />
                  ) : (
                    <span className="text-muted text-[11px]">N/A</span>
                  )}
                </div>
              </div>
            </div>

            {/* Lifecycle Timeline Card */}
            <div className="bg-surface border border-border rounded-lg p-4 space-y-4 text-xs">
              <div className="font-semibold text-sm text-text">
                Order progress timeline
              </div>
              <div className="relative pl-5 border-l border-border space-y-4">
                {timeline.map((evt, idx) => (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute -left-[24px] top-1 w-2.5 h-2.5 rounded-full ${
                        evt.done
                          ? 'bg-brand-solid'
                          : 'bg-border'
                      }`}
                    />
                    <div className={`font-medium ${evt.done ? 'text-text' : 'text-muted'}`}>
                      {evt.label}
                    </div>
                    {evt.time && (
                      <div className="text-[11px] text-muted font-mono tabular-nums">
                        {new Date(evt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                        {new Date(evt.time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Modal */}
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel order #{order.number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs py-2">
              <p className="text-muted">
                Are you sure you want to cancel this order? If this order has already been invoiced,
                an automatic credit adjustment will be recorded for the company.
              </p>
              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Cancellation reason
                </label>
                <Input
                  placeholder="e.g. Employee requested cancellation"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
                Return
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate(cancelReason)}
                loading={cancelMutation.isPending}
              >
                Confirm cancellation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject order #{order.number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs py-2">
              <p className="text-muted">
                Terminal admin refusal. The order will be marked REJECTED and excluded from billing and kitchen prep.
              </p>
              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Rejection reason *
                </label>
                <Input
                  required
                  placeholder="e.g. Operational capacity exceeded"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim()}
                onClick={() => rejectMutation.mutate(rejectReason)}
                loading={rejectMutation.isPending}
              >
                Confirm rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin Override Modal */}
        <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Admin override — Order #{order.number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs py-2">
              <p className="text-muted">
                Admin exception: modify delivery logistics for this order after cut-off has passed.
              </p>

              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Delivery time
                </label>
                <Input
                  type="time"
                  value={minutesToTimeString(overrideTime)}
                  onChange={(e) => setOverrideTime(timeStringToMinutes(e.target.value))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Delivery address
                </label>
                <select
                  value={overrideAddressId}
                  onChange={(e) => setOverrideAddressId(e.target.value)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                >
                  {companyData?.addresses?.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.line1}, {a.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Packaging format
                </label>
                <select
                  value={overridePackaging}
                  onChange={(e) => setOverridePackaging(e.target.value)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="INDIVIDUAL">Individual boxes</option>
                  <option value="ECO">Eco-friendly containers</option>
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
                Save override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
