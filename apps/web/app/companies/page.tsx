'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatMinutesToTime, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { Drawer } from '@/components/ui/drawer';
import { StateBanner } from '@/components/ui/state-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Mail,
  ExternalLink,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [inspectCompany, setInspectCompany] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [tierId, setTierId] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  // Address for new company
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPostcode, setAddrPostcode] = useState('');

  // Fetch Companies
  const { data, isLoading, isError, refetch } = useQuery<{ items: any[] }>({
    queryKey: ['companies', 'list', search],
    queryFn: () => fetchApi(`/companies?q=${search}&limit=100`),
  });

  // Fetch Tiers for dropdown
  const { data: tiersData } = useQuery<any>({
    queryKey: ['pricing', 'tiers'],
    queryFn: () => fetchApi('/pricing/tiers'),
  });

  // Create Company Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi('/companies', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Company created successfully');
      setCreateDrawerOpen(false);
      setName('');
      setDomain('');
      setTierId('');
      setBillingName('');
      setBillingEmail('');
      setBillingAddress('');
      setAddrLine1('');
      setAddrCity('');
      setAddrPostcode('');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create company');
    },
  });

  const companies = extractList(data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !domain || !billingEmail) {
      toast.error('Please complete required fields');
      return;
    }
    createMutation.mutate({
      name,
      domain,
      tierId: tierId || undefined,
      billingName,
      billingEmail,
      billingAddress,
      address: addrLine1
        ? {
            line1: addrLine1,
            city: addrCity || 'San Francisco',
            postcode: addrPostcode || '94105',
          }
        : undefined,
    });
  };

  return (
    <AppShell requiredPermission="companies:read">
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title="Corporate Clients"
          subtitle="Client companies, verified email domains, and billing tier assignments"
          primaryAction={
            <Button variant="primary" onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" /> Add client
            </Button>
          }
          contextBar={
            <div className="flex items-center justify-between w-full">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--text-faint)]" />
                <input
                  type="text"
                  placeholder="Search clients or domains..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 h-[28px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                />
              </div>

              <div className="text-[12px] text-[var(--text-muted)] font-mono">
                {companies.length} active clients
              </div>
            </div>
          }
        />

        {isError && (
          <StateBanner
            variant="error"
            message="Failed to load corporate clients"
            onRetry={() => refetch()}
          />
        )}

        {/* DataTable Container */}
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead className="bg-[var(--bg-raised)] border-b border-[var(--border)] sticky top-0 select-none">
                <tr className="h-[36px]">
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    COMPANY
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    DOMAINS
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    TIER
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    BILLING EMAIL
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    DELIVERY WINDOW
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] text-right">
                    EMPLOYEES
                  </th>
                  <th className="w-[44px] px-3 py-1.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {isLoading ? (
                  <TableSkeletonRows columns={7} rows={6} />
                ) : companies.length > 0 ? (
                  companies.map((comp: any) => (
                    <tr
                      key={comp.id}
                      onClick={() => setInspectCompany(comp)}
                      className="h-[40px] hover:bg-[var(--bg-raised)] transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium text-[var(--text)]">
                        {comp.name}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {comp.domains?.map((d: any) => (
                            <Chip key={d.domain} label={`@${d.domain}`} className="font-mono text-[10px]" />
                          ))}
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        <Chip label={comp.tier?.name || 'Default Tier'} />
                      </td>

                      <td className="px-3 py-2 text-[var(--text-muted)]">
                        {comp.billingEmail}
                      </td>

                      <td className="px-3 py-2 font-mono text-[12px] text-[var(--text-muted)]">
                        {formatMinutesToTime(comp.defaultDeliveryTimeMin)} ({comp.defaultPackaging})
                      </td>

                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text)]">
                        {comp.employees?.length ?? 0}
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
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => setInspectCompany(comp)}>
                              <Eye className="w-3.5 h-3.5 mr-2" /> Inspect
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/companies/${comp.id}`}>
                                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Manage account
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState message="No corporate clients found matching your search." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="h-[40px] px-4 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
            <span>Showing {companies.length} clients</span>
          </div>
        </div>

        {/* Inspect Company Drawer */}
        <Drawer
          open={!!inspectCompany}
          onClose={() => setInspectCompany(null)}
          title={inspectCompany?.name}
          subtitle={`Billing Tier: ${inspectCompany?.tier?.name || 'Default'}`}
          footer={
            inspectCompany ? (
              <Link href={`/companies/${inspectCompany.id}`}>
                <Button variant="primary" size="sm">Manage Full Client Profile</Button>
              </Link>
            ) : null
          }
        >
          {inspectCompany && (
            <div className="space-y-4 text-[13px]">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                  Allowed Email Domains
                </span>
                <div className="flex flex-wrap gap-1">
                  {inspectCompany.domains?.map((d: any) => (
                    <Chip key={d.domain} label={`@${d.domain}`} className="font-mono" />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                  Billing Contact
                </span>
                <div className="p-2.5 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)]">
                  <div className="font-medium text-[var(--text)]">{inspectCompany.billingName || 'Accounts Payable'}</div>
                  <div className="text-[12px] text-[var(--text-muted)]">{inspectCompany.billingEmail}</div>
                  {inspectCompany.billingAddress && (
                    <div className="text-[12px] text-[var(--text-faint)] mt-1">{inspectCompany.billingAddress}</div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                  Delivery Logistics
                </span>
                <div className="p-2.5 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] space-y-1 text-[12px] text-[var(--text-muted)]">
                  <div>Default Window: <strong className="text-[var(--text)]">{formatMinutesToTime(inspectCompany.defaultDeliveryTimeMin)}</strong></div>
                  <div>Default Packaging: <strong className="text-[var(--text)]">{inspectCompany.defaultPackaging}</strong></div>
                  {inspectCompany.driverNotes && (
                    <div className="text-[11px] text-[var(--status-warning-fg)] pt-1 border-t border-[var(--border)]">
                      Driver Instructions: {inspectCompany.driverNotes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Drawer>

        {/* Add Company Drawer (Labels above inputs 12/500, inputs 32px, 2-col max 720px, Save + Cancel footer) */}
        <Drawer
          open={createDrawerOpen}
          onClose={() => setCreateDrawerOpen(false)}
          title="Add Corporate Client"
          subtitle="Register client organization, domain whitelist, and invoicing details"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setCreateDrawerOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                loading={createMutation.isPending}
              >
                Save client
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-3.5 max-w-[720px]">
            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Company Name *
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Acme Tech Labs"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Corporate Email Domain *
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. acmetech.io"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Price Tier
              </label>
              <select
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="w-full h-[32px] px-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[13px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
              >
                <option value="">Default Tier</option>
                {tiersData?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                  Billing Contact Name
                </label>
                <Input
                  type="text"
                  placeholder="Accounts Payable"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                  Billing Email *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="billing@company.com"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Billing Address
              </label>
              <Input
                type="text"
                placeholder="100 Market St, Suite 400"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
              />
            </div>

            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Primary Delivery Address (Optional)
              </span>
              <Input
                type="text"
                placeholder="Street Address"
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="text"
                  placeholder="City"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Postcode"
                  value={addrPostcode}
                  onChange={(e) => setAddrPostcode(e.target.value)}
                />
              </div>
            </div>
          </form>
        </Drawer>
      </div>
    </AppShell>
  );
}
