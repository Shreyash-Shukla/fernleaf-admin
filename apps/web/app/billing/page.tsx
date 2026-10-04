'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Receipt,
  Building,
  DollarSign,
  CheckCircle2,
  Clock,
  PlusCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Eye,
} from 'lucide-react';

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('unbilled');

  // Selected company for generating invoice
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // View invoice detail modal
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);

  // 1. Fetch Unbilled Summary
  const { data: unbilledData, isLoading: unbilledLoading } = useQuery<any>({
    queryKey: ['billing', 'unbilled-summary'],
    queryFn: () => fetchApi('/billing/unbilled'),
  });

  // 2. Fetch Selected Company Unbilled Orders Detail
  const { data: companyUnbilledData, isLoading: compUnbilledLoading } = useQuery<any>({
    queryKey: ['billing', 'company-unbilled', selectedCompanyId],
    queryFn: () => fetchApi(`/billing/companies/${selectedCompanyId}/unbilled`),
    enabled: !!selectedCompanyId && invoiceModalOpen,
  });

  // 3. Fetch Invoices List
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<any>({
    queryKey: ['billing', 'invoices-list'],
    queryFn: () => fetchApi('/billing/invoices?pageSize=50'),
  });

  // 4. Fetch Single Invoice Detail
  const { data: singleInvoice, isLoading: invoiceLoading } = useQuery<any>({
    queryKey: ['billing', 'invoice-detail', viewInvoiceId],
    queryFn: () => fetchApi(`/billing/invoices/${viewInvoiceId}`),
    enabled: !!viewInvoiceId,
  });

  // 5. Fetch Adjustments List
  const { data: adjustmentsData, isLoading: adjustmentsLoading } = useQuery<any>({
    queryKey: ['billing', 'adjustments-list'],
    queryFn: () => fetchApi('/billing/adjustments'),
  });

  // Create Invoice Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (payload: { companyId: string; orderIds?: string[]; adjustmentIds?: string[] }) =>
      fetchApi('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      toast.success(`Invoice ${data?.number || ''} created successfully!`);
      setInvoiceModalOpen(false);
      setSelectedCompanyId('');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setActiveTab('invoices');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create invoice');
    },
  });

  // Mark Invoice Paid Mutation
  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => fetchApi(`/billing/invoices/${invoiceId}/pay`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Invoice marked as PAID!');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      if (viewInvoiceId) {
        queryClient.invalidateQueries({ queryKey: ['billing', 'invoice-detail', viewInvoiceId] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to mark invoice as paid');
    },
  });

  const companiesList = unbilledData?.companies || [];
  const invoicesList = invoicesData?.invoices || [];
  const adjustmentsList = adjustmentsData?.adjustments || [];

  return (
    <AppShell requiredPermission="billing:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-400" />
              <span>Company Billing & Invoicing</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Review unbilled corporate receivables, issue batch invoices, and track payment status
            </p>
          </div>

          <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-right">
            <div className="text-[11px] font-semibold text-emerald-300 uppercase">
              Total Unbilled Across Companies
            </div>
            <div className="text-xl font-bold text-white">
              {formatCents(unbilledData?.summary?.totalUnbilledCents || 0)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="unbilled" className="text-xs">
              Unbilled Receivables ({companiesList.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs">
              Invoices History ({invoicesList.length})
            </TabsTrigger>
            <TabsTrigger value="adjustments" className="text-xs">
              Adjustments Register ({adjustmentsList.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Unbilled Orders */}
          <TabsContent value="unbilled" className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <h3 className="font-semibold text-slate-200">
                    Companies with Confirmed & Delivered Orders Pending Invoice
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    Confirmed meals are owed by company account. Group them to issue billing records.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Company Name</th>
                      <th className="py-3 px-4">Unbilled Orders</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {unbilledLoading ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-500">
                          Calculating unbilled balances...
                        </td>
                      </tr>
                    ) : companiesList.length > 0 ? (
                      companiesList.map((comp: any) => (
                        <tr key={comp.companyId} className="hover:bg-slate-850/50">
                          <td className="py-3 px-4 font-semibold text-white">
                            {comp.companyName}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {comp.orderCount} orders
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-400 text-sm">
                            {formatCents(comp.unbilledTotalCents)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedCompanyId(comp.companyId);
                                setInvoiceModalOpen(true);
                              }}
                              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500"
                            >
                              <PlusCircle className="w-3.5 h-3.5 mr-1" /> Create Invoice
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-500">
                          No unbilled orders found. All confirmed orders are invoiced!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: Invoices List */}
          <TabsContent value="invoices" className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Issued Date</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invoicesLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          Loading invoices...
                        </td>
                      </tr>
                    ) : invoicesList.length > 0 ? (
                      invoicesList.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-850/50">
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {inv.number}
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            {inv.company?.name}
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {formatDate(inv.issuedAt)}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-400 text-sm">
                            {formatCents(inv.totalCents)}
                          </td>
                          <td className="py-3 px-4">
                            {inv.status === 'PAID' ? (
                              <Badge variant="default" className="text-[10px]">
                                PAID
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="text-[10px]">
                                ISSUED
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewInvoiceId(inv.id)}
                              className="h-7 text-xs px-2.5"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                            {inv.status !== 'PAID' && (
                              <Button
                                size="sm"
                                onClick={() => markPaidMutation.mutate(inv.id)}
                                loading={markPaidMutation.isPending}
                                className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500"
                              >
                                Mark Paid
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          No invoices issued yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Adjustments Register */}
          <TabsContent value="adjustments" className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="p-4 border-b border-slate-800 text-xs">
                <h3 className="font-semibold text-slate-200">Billing Adjustments & Credits</h3>
                <p className="text-slate-400 text-[11px]">
                  Adjustments created when an order is cancelled or modified after having already been invoiced.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {adjustmentsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          Loading adjustments...
                        </td>
                      </tr>
                    ) : adjustmentsList.length > 0 ? (
                      adjustmentsList.map((adj: any) => (
                        <tr key={adj.id} className="hover:bg-slate-850/50">
                          <td className="py-3 px-4 font-semibold text-white">
                            {adj.company?.name || 'Company'}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {adj.reason}
                          </td>
                          <td className="py-3 px-4 font-bold text-rose-400">
                            {formatCents(adj.amountCents)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={adj.status === 'INVOICED' ? 'secondary' : 'warning'}
                              className="text-[10px]"
                            >
                              {adj.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {adj.note || 'Order cancelled after invoice'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          No adjustments recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Generate Invoice Modal */}
        <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Create Company Invoice</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="font-semibold text-slate-200">
                  {companyUnbilledData?.company?.name || 'Company'}
                </div>
                <div className="text-slate-400 text-[11px]">
                  Billing Contact: {companyUnbilledData?.company?.billingEmail}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Unbilled Confirmed Orders:</span>
                  <strong>{companyUnbilledData?.orders?.length || 0} orders</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Orders Subtotal:</span>
                  <span className="font-semibold">
                    {formatCents(companyUnbilledData?.totalCents || 0)}
                  </span>
                </div>

                {companyUnbilledData?.adjustments?.length > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Credit Adjustments Applied:</span>
                    <span>
                      {formatCents(
                        companyUnbilledData.adjustments.reduce(
                          (s: number, a: any) => s + a.amountCents,
                          0
                        )
                      )}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-white">
                  <span>Net Invoice Total:</span>
                  <span className="text-emerald-400 text-base">
                    {formatCents(
                      (companyUnbilledData?.totalCents || 0) +
                        (companyUnbilledData?.adjustments?.reduce(
                          (s: number, a: any) => s + a.amountCents,
                          0
                        ) || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setInvoiceModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createInvoiceMutation.mutate({
                    companyId: selectedCompanyId,
                  })
                }
                loading={createInvoiceMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Issue Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Invoice Detail Modal */}
        <Dialog open={!!viewInvoiceId} onOpenChange={(open) => !open && setViewInvoiceId(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Invoice #{singleInvoice?.number}</span>
                <Badge variant={singleInvoice?.status === 'PAID' ? 'default' : 'warning'}>
                  {singleInvoice?.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            {invoiceLoading ? (
              <div className="py-12 text-center text-slate-500 text-xs">Loading invoice...</div>
            ) : singleInvoice ? (
              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <div className="text-slate-400 text-[11px]">Billed Company</div>
                    <div className="font-semibold text-slate-200">{singleInvoice.company?.name}</div>
                    <div className="text-slate-400 text-[11px]">{singleInvoice.company?.billingEmail}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[11px]">Issued Date</div>
                    <div className="font-semibold text-slate-200">
                      {formatDate(singleInvoice.issuedAt)}
                    </div>
                    {singleInvoice.paidAt && (
                      <div className="text-emerald-400 text-[11px]">
                        Paid: {new Date(singleInvoice.paidAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-300">Invoice Items</h4>
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                    {singleInvoice.items?.map((item: any) => (
                      <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-medium text-slate-200">{item.description}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{item.kind}</div>
                        </div>
                        <div
                          className={`font-semibold ${
                            item.amountCents < 0 ? 'text-rose-400' : 'text-slate-200'
                          }`}
                        >
                          {formatCents(item.amountCents)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Total Invoice Amount:</span>
                  <span className="text-emerald-400 font-bold text-base">
                    {formatCents(singleInvoice.totalCents)}
                  </span>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewInvoiceId(null)}>
                Close
              </Button>
              {singleInvoice && singleInvoice.status !== 'PAID' && (
                <Button
                  onClick={() => markPaidMutation.mutate(singleInvoice.id)}
                  loading={markPaidMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 font-bold"
                >
                  Mark as Paid
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
