'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatCents, formatDate, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { StateBanner } from '@/components/ui/state-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Receipt,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Check,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'unbilled' | 'invoices' | 'adjustments'>('unbilled');

  // Batch Invoice Modal Stepper State (3-step stepper)
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [stepperStep, setStepperStep] = useState<1 | 2 | 3>(1);
  const [selectedBatchCompanyId, setSelectedBatchCompanyId] = useState<string>('');

  // View invoice detail drawer
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);

  // 1. Fetch Unbilled Summary
  const { data: unbilledData, isLoading: unbilledLoading, isError: unbilledError, refetch: refetchUnbilled } = useQuery<any>({
    queryKey: ['billing', 'unbilled-summary'],
    queryFn: () => fetchApi('/billing/unbilled'),
  });

  // 2. Fetch Selected Company Unbilled Orders Detail (for batch modal)
  const { data: companyUnbilledData, isLoading: compUnbilledLoading } = useQuery<any>({
    queryKey: ['billing', 'company-unbilled', selectedBatchCompanyId],
    queryFn: () => fetchApi(`/billing/companies/${selectedBatchCompanyId}/unbilled`),
    enabled: !!selectedBatchCompanyId && batchModalOpen,
  });

  // 3. Fetch Invoices List
  const { data: invoicesData, isLoading: invoicesLoading, isError: invoicesError, refetch: refetchInvoices } = useQuery<any>({
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
      toast.success(`Invoice ${data?.number || ''} issued successfully`);
      setBatchModalOpen(false);
      setStepperStep(1);
      setSelectedBatchCompanyId('');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setActiveTab('invoices');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to issue invoice');
    },
  });

  // Mark Invoice Paid Mutation
  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => fetchApi(`/billing/invoices/${invoiceId}/pay`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Invoice marked as Paid');
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      if (viewInvoiceId) {
        queryClient.invalidateQueries({ queryKey: ['billing', 'invoice-detail', viewInvoiceId] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to mark invoice as paid');
    },
  });

  const companiesList = extractList(unbilledData);
  const invoicesList = extractList(invoicesData);
  const adjustmentsList = extractList(adjustmentsData);
  const totalUnbilled =
    unbilledData?.summary?.totalUnbilledCents ??
    companiesList.reduce((acc, c: any) => acc + (c.netUnbilledCents ?? c.unbilledCents ?? 0), 0);

  const selectedCompanyObj = companiesList.find((c: any) => c.companyId === selectedBatchCompanyId);

  return (
    <AppShell requiredPermission="billing:read">
      <div className="space-y-4">
        {/* Page Header with Single Primary Action: Generate Invoices */}
        <PageHeader
          title="Billing & Invoices"
          subtitle="Corporate accounts receivable, batch invoice runs, and payment tracking"
          primaryAction={
            <Button
              variant="primary"
              onClick={() => {
                setBatchModalOpen(true);
                setStepperStep(1);
                if (companiesList.length > 0 && !selectedBatchCompanyId) {
                  setSelectedBatchCompanyId(companiesList[0].companyId);
                }
              }}
            >
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              Generate batch invoice
            </Button>
          }
          contextBar={
            <div className="flex items-center justify-between w-full text-[13px] text-[var(--text-muted)]">
              <div>
                Total Unbilled Exposure: <strong className="text-[var(--text)] font-mono font-semibold">{formatCents(totalUnbilled)}</strong> across {companiesList.length} client companies
              </div>
              <div className="font-mono text-[12px]">
                {invoicesList.length} issued invoices
              </div>
            </div>
          }
        />

        {unbilledError && (
          <StateBanner
            variant="error"
            message="Failed to load billing receivables"
            onRetry={() => refetchUnbilled()}
          />
        )}

        {/* Underline Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
          <TabsList>
            <TabsTrigger value="unbilled">
              Unbilled Receivables ({companiesList.length})
            </TabsTrigger>
            <TabsTrigger value="invoices">
              Invoices History ({invoicesList.length})
            </TabsTrigger>
            <TabsTrigger value="adjustments">
              Adjustments Register ({adjustmentsList.length})
            </TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: UNBILLED RECEIVABLES
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="unbilled" className="pt-2 space-y-4">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-[var(--bg-raised)] border-b border-[var(--border)] sticky top-0 select-none">
                    <tr className="h-[36px]">
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        COMPANY
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        UNBILLED ORDERS
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        OLDEST DELIVERY
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                        TOTAL AMOUNT
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {unbilledLoading ? (
                      <TableSkeletonRows columns={5} rows={5} />
                    ) : companiesList.length > 0 ? (
                      companiesList.map((comp: any) => (
                        <tr key={comp.companyId} className="h-[40px] hover:bg-[var(--bg-raised)] transition-colors">
                          <td className="px-3 py-2 font-medium text-[var(--text)]">
                            {comp.companyName}
                          </td>
                          <td className="px-3 py-2 text-[var(--text-muted)] font-mono">
                            {comp.orderCount} orders
                          </td>
                          <td className="px-3 py-2 text-[var(--text-muted)] font-mono text-[12px]">
                            {comp.oldestDeliveryDate ? formatDate(comp.oldestDeliveryDate) : '--'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-[var(--text)]">
                            {formatCents(comp.netUnbilledCents ?? comp.unbilledCents ?? comp.unbilledTotalCents ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedBatchCompanyId(comp.companyId);
                                setBatchModalOpen(true);
                                setStepperStep(2);
                              }}
                              className="h-[26px] px-2.5 text-[12px]"
                            >
                              Invoice now
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState message="All confirmed orders are currently invoiced." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: INVOICES HISTORY
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="invoices" className="pt-2 space-y-4">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-[var(--bg-raised)] border-b border-[var(--border)] sticky top-0 select-none">
                    <tr className="h-[36px]">
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        INVOICE #
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        COMPANY
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        ISSUED DATE
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                        TOTAL AMOUNT
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        STATUS
                      </th>
                      <th className="w-[80px] px-3 py-1.5 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {invoicesLoading ? (
                      <TableSkeletonRows columns={6} rows={6} />
                    ) : invoicesList.length > 0 ? (
                      invoicesList.map((inv: any) => (
                        <tr
                          key={inv.id}
                          onClick={() => setViewInvoiceId(inv.id)}
                          className="h-[40px] hover:bg-[var(--bg-raised)] transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-2 font-mono text-[12px] font-semibold text-[var(--text)]">
                            {inv.number}
                          </td>
                          <td className="px-3 py-2 text-[var(--text)]">
                            {inv.company?.name}
                          </td>
                          <td className="px-3 py-2 text-[var(--text-muted)] font-mono text-[12px]">
                            {formatDate(inv.issuedAt)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-[var(--text)]">
                            {formatCents(inv.totalCents)}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              category={inv.status === 'PAID' ? 'success' : 'info'}
                              label={inv.status === 'PAID' ? 'Paid' : 'Issued'}
                              className="h-[20px] text-[11px]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="h-[24px] w-[24px] rounded-[4px] hover:bg-[var(--bg-raised)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem onClick={() => setViewInvoiceId(inv.id)}>
                                  <Eye className="w-3.5 h-3.5 mr-2" /> Inspect
                                </DropdownMenuItem>
                                {inv.status !== 'PAID' && (
                                  <DropdownMenuItem onClick={() => markPaidMutation.mutate(inv.id)}>
                                    <Check className="w-3.5 h-3.5 mr-2" /> Mark paid
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState message="No issued invoices found." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: ADJUSTMENTS REGISTER
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="adjustments" className="pt-2 space-y-4">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-[var(--bg-raised)] border-b border-[var(--border)] sticky top-0 select-none">
                    <tr className="h-[36px]">
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        COMPANY
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        REASON
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                        AMOUNT
                      </th>
                      <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {adjustmentsLoading ? (
                      <TableSkeletonRows columns={4} rows={4} />
                    ) : adjustmentsList.length > 0 ? (
                      adjustmentsList.map((adj: any) => (
                        <tr key={adj.id} className="h-[40px] hover:bg-[var(--bg-raised)] transition-colors">
                          <td className="px-3 py-2 font-medium text-[var(--text)]">
                            {adj.company?.name || 'Client'}
                          </td>
                          <td className="px-3 py-2 text-[var(--text-muted)]">
                            {adj.reason}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-[var(--text)]">
                            {formatCents(adj.amountCents)}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              category={adj.status === 'APPLIED' ? 'success' : 'warning'}
                              label={adj.status === 'APPLIED' ? 'Applied' : 'Open'}
                              className="h-[20px] text-[11px]"
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>
                          <EmptyState message="No billing adjustments recorded." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 3-Step Stepper Batch Invoice Modal */}
        <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Generate Batch Invoice</DialogTitle>
            </DialogHeader>

            {/* Stepper Progress Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] text-[12px]">
              <div className={cn('flex items-center gap-1.5 font-medium', stepperStep === 1 ? 'text-[var(--brand-text)] font-semibold' : stepperStep > 1 ? 'text-[var(--text)]' : 'text-[var(--text-muted)]')}>
                <span className="w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-center font-mono text-[11px]">
                  1
                </span>
                <span>Select Company</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)]" />
              <div className={cn('flex items-center gap-1.5 font-medium', stepperStep === 2 ? 'text-[var(--brand-text)] font-semibold' : stepperStep > 2 ? 'text-[var(--text)]' : 'text-[var(--text-muted)]')}>
                <span className="w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-center font-mono text-[11px]">
                  2
                </span>
                <span>Review Totals</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)]" />
              <div className={cn('flex items-center gap-1.5 font-medium', stepperStep === 3 ? 'text-[var(--brand-text)] font-semibold' : 'text-[var(--text-muted)]')}>
                <span className="w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] flex items-center justify-center font-mono text-[11px]">
                  3
                </span>
                <span>Confirm & Issue</span>
              </div>
            </div>

            {/* STEP 1: Select Period & Company */}
            {stepperStep === 1 && (
              <div className="space-y-4 py-2 text-[13px]">
                <div>
                  <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1.5">
                    Target Corporate Account:
                  </label>
                  <select
                    value={selectedBatchCompanyId}
                    onChange={(e) => setSelectedBatchCompanyId(e.target.value)}
                    className="w-full h-[32px] px-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[13px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <option value="">-- Choose company with unbilled orders --</option>
                    {companiesList.map((comp: any) => (
                      <option key={comp.companyId} value={comp.companyId}>
                        {comp.companyName} ({comp.orderCount} orders · {formatCents(comp.netUnbilledCents ?? comp.unbilledCents)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] text-[12px] text-[var(--text-muted)] space-y-1">
                  <div>• Automatic grouping of all confirmed & delivered orders up to current cut-off</div>
                  <div>• Open credit/debit adjustments will be reconciled simultaneously</div>
                </div>
              </div>
            )}

            {/* STEP 2: Review Totals */}
            {stepperStep === 2 && (
              <div className="space-y-4 py-2 text-[13px]">
                <div className="p-3 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Company:</span>
                    <strong className="text-[var(--text)]">{selectedCompanyObj?.companyName || 'Client'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Unbilled orders to bundle:</span>
                    <span className="font-mono text-[var(--text)]">{companyUnbilledData?.orderCount ?? selectedCompanyObj?.orderCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--border)] pt-2 text-[15px]">
                    <span className="font-medium text-[var(--text)]">Net Invoice Total:</span>
                    <span className="font-mono font-bold text-[var(--text)]">
                      {formatCents(companyUnbilledData?.totalCents ?? selectedCompanyObj?.netUnbilledCents ?? selectedCompanyObj?.unbilledCents ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Confirm */}
            {stepperStep === 3 && (
              <div className="space-y-3 py-2 text-[13px] text-center">
                <CheckCircle2 className="w-10 h-10 text-[var(--status-success-fg)] mx-auto mb-1 stroke-[1.5]" />
                <h3 className="text-[16px] font-semibold text-[var(--text)]">
                  Ready to Issue Invoice
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] max-w-sm mx-auto">
                  Issuing will finalize billing records for {selectedCompanyObj?.companyName} and assign an official invoice number.
                </p>
              </div>
            )}

            <DialogFooter>
              {stepperStep > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setStepperStep((prev) => (prev - 1) as any)}
                >
                  Back
                </Button>
              )}
              {stepperStep < 3 ? (
                <Button
                  variant="primary"
                  disabled={!selectedBatchCompanyId}
                  onClick={() => setStepperStep((prev) => (prev + 1) as any)}
                >
                  Proceed to Step {stepperStep + 1}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  loading={createInvoiceMutation.isPending}
                  onClick={() =>
                    createInvoiceMutation.mutate({
                      companyId: selectedBatchCompanyId,
                    })
                  }
                >
                  Confirm & Issue Invoice
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invoice Detail Drawer */}
        <Drawer
          open={!!viewInvoiceId}
          onClose={() => setViewInvoiceId(null)}
          title={`Invoice ${singleInvoice?.number || ''}`}
          subtitle={`${singleInvoice?.company?.name || ''} · Issued ${formatDate(singleInvoice?.issuedAt)}`}
          footer={
            singleInvoice && singleInvoice.status !== 'PAID' ? (
              <Button
                variant="primary"
                onClick={() => markPaidMutation.mutate(singleInvoice.id)}
                loading={markPaidMutation.isPending}
              >
                Mark Invoice Paid
              </Button>
            ) : null
          }
        >
          {singleInvoice && (
            <div className="space-y-4 text-[13px]">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Payment Status:</span>
                <StatusBadge
                  category={singleInvoice.status === 'PAID' ? 'success' : 'info'}
                  label={singleInvoice.status === 'PAID' ? 'Paid' : 'Issued'}
                />
              </div>

              <div className="p-3 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Subtotal:</span>
                  <span className="font-mono text-[var(--text)]">{formatCents(singleInvoice.subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Tax / Adjustments:</span>
                  <span className="font-mono text-[var(--text)]">{formatCents(singleInvoice.taxCents || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border)] pt-2 text-[15px]">
                  <span className="font-medium text-[var(--text)]">Total Invoiced:</span>
                  <span className="font-mono font-bold text-[var(--text)]">{formatCents(singleInvoice.totalCents)}</span>
                </div>
              </div>

              {singleInvoice.orders?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                    Bundled Orders ({singleInvoice.orders.length})
                  </span>
                  <div className="rounded-[6px] border border-[var(--border)] divide-y divide-[var(--border)] max-h-48 overflow-y-auto">
                    {singleInvoice.orders.map((o: any) => (
                      <div key={o.id} className="p-2 flex items-center justify-between text-[12px]">
                        <span className="font-mono font-medium text-[var(--text)]">#{o.number}</span>
                        <span className="text-[var(--text-muted)]">{formatDate(o.deliveryDate)}</span>
                        <span className="font-mono text-[var(--text)]">{formatCents(o.totalCents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}
