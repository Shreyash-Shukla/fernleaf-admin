'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatMinutesToTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Building2,
  PlusCircle,
  Search,
  MapPin,
  Clock,
  ArrowRight,
  Eye,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

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
  const { data, isLoading } = useQuery<{ companies: any[] }>({
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
    onSuccess: (newComp) => {
      toast.success('Company created successfully!');
      setCreateModalOpen(false);
      setName('');
      setDomain('');
      setTierId('');
      setBillingName('');
      setBillingEmail('');
      setBillingAddress('');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create company');
    },
  });

  const companies = data?.companies || [];

  return (
    <AppShell requiredPermission="companies:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-400" />
              <span>Corporate Clients</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage client companies, email domains, delivery calendars, and price tier mappings
            </p>
          </div>

          <Button size="sm" onClick={() => setCreateModalOpen(true)} className="text-xs">
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Company
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search company name, domain, or billing email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Companies Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading companies...</div>
        ) : companies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((comp: any) => (
              <Card
                key={comp.id}
                className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-white">{comp.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {comp.domains?.map((d: any) => (
                          <span
                            key={d.domain}
                            className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800"
                          >
                            @{d.domain}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {comp.tier?.name || 'Default Tier'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>{comp.billingEmail}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Default Delivery: {formatMinutesToTime(comp.defaultDeliveryTimeMin)} ({comp.defaultPackaging})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{comp.employees?.length || 0} active employees</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {comp.addresses?.length || 0} delivery address(es)
                  </span>
                  <Link href={`/companies/${comp.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Manage Company <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500 text-xs">
            No corporate clients found matching your query.
          </div>
        )}

        {/* Create Company Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Corporate Client</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Tech Labs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Corporate Email Domain * (Unique, no public domains like gmail)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acmetech.io"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Price Tier (Optional - inherits Default Tier if blank)
                </label>
                <select
                  value={tierId}
                  onChange={(e) => setTierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="">Default Tier</option>
                  {tiersData?.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Billing Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Accounts Payable"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Billing Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="billing@acmetech.io"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Primary Delivery Address Line 1 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="100 Innovation Blvd, Suite 400"
                  value={addrLine1}
                  onChange={(e) => setAddrLine1(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Bangalore"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="560100"
                    value={addrPostcode}
                    onChange={(e) => setAddrPostcode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name,
                    domain,
                    tierId: tierId || undefined,
                    billingName,
                    billingEmail,
                    billingAddress: `${addrLine1}, ${addrCity} ${addrPostcode}`,
                    address: {
                      label: 'Headquarters',
                      line1: addrLine1,
                      city: addrCity,
                      postcode: addrPostcode,
                      isDefault: true,
                    },
                  })
                }
                loading={createMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Create Company
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
