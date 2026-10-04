'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatDate, formatMinutesToTime, minutesToTimeString, timeStringToMinutes } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Building2,
  ArrowLeft,
  Calendar,
  MapPin,
  Users2,
  UtensilsCrossed,
  Plus,
  Trash2,
  Clock,
  ShieldCheck,
  Save,
  PlusCircle,
  EyeOff,
} from 'lucide-react';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  const [activeTab, setActiveTab] = useState('general');

  // Modals
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [domainModalOpen, setDomainModalOpen] = useState(false);

  // Address form
  const [addrLabel, setAddrLabel] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPostcode, setAddrPostcode] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);

  // Holiday form
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  // Domain form
  const [newDomain, setNewDomain] = useState('');

  // Fetch Company Detail
  const { data: company, isLoading } = useQuery<any>({
    queryKey: ['company', id],
    queryFn: () => fetchApi(`/companies/${id}`),
    enabled: !!id,
  });

  // Fetch Tiers for dropdown
  const { data: tiersData } = useQuery<any>({
    queryKey: ['pricing', 'tiers'],
    queryFn: () => fetchApi('/pricing/tiers'),
  });

  // Fetch Menu Categories for hidden category selection
  const { data: categoriesData } = useQuery<any>({
    queryKey: ['menu-categories', 'all'],
    queryFn: () => fetchApi('/menu-categories?includeSecret=true'),
  });

  // Fetch Hidden Categories
  const { data: hiddenCatsData } = useQuery<any>({
    queryKey: ['companies', id, 'hidden-categories'],
    queryFn: () => fetchApi(`/companies/${id}/hidden-categories`),
    enabled: !!id,
  });

  // General details form state
  const [editTierId, setEditTierId] = useState<string>('');
  const [editDeliveryTimeMin, setEditDeliveryTimeMin] = useState<number>(720);
  const [editDispatchLeadMin, setEditDispatchLeadMin] = useState<number>(60);
  const [editPackaging, setEditPackaging] = useState<string>('STANDARD');
  const [editDriverNotes, setEditDriverNotes] = useState<string>('');
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Sync state once company loads
  React.useEffect(() => {
    if (company) {
      setEditTierId(company.tierId || '');
      setEditDeliveryTimeMin(company.defaultDeliveryTimeMin ?? 720);
      setEditDispatchLeadMin(company.dispatchLeadMinutes ?? 60);
      setEditPackaging(company.defaultPackaging || 'STANDARD');
      setEditDriverNotes(company.driverNotes || '');
      setWorkingDays(company.workingDays || [1, 2, 3, 4, 5]);
    }
  }, [company]);

  // Mutations
  const updateGeneralMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/companies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Company settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save changes'),
  });

  const addAddressMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/companies/${id}/addresses`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Delivery address added');
      setAddrModalOpen(false);
      setAddrLabel('');
      setAddrLine1('');
      setAddrCity('');
      setAddrPostcode('');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add address'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (addressId: string) =>
      fetchApi(`/companies/${id}/addresses/${addressId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Address removed');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete address'),
  });

  const addHolidayMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/companies/${id}/holidays`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Holiday added to company calendar');
      setHolidayModalOpen(false);
      setHolidayDate('');
      setHolidayName('');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add holiday'),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (dateStr: string) =>
      fetchApi(`/companies/${id}/holidays/${dateStr}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Holiday removed');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to remove holiday'),
  });

  const addDomainMutation = useMutation({
    mutationFn: (domain: string) =>
      fetchApi(`/companies/${id}/domains`, {
        method: 'POST',
        body: JSON.stringify({ domain }),
      }),
    onSuccess: () => {
      toast.success('Domain registered');
      setDomainModalOpen(false);
      setNewDomain('');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add domain'),
  });

  const toggleHiddenCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, isHidden }: { categoryId: string; isHidden: boolean }) => {
      if (isHidden) {
        return fetchApi(`/companies/${id}/hidden-categories/${categoryId}`, { method: 'DELETE' });
      } else {
        return fetchApi(`/companies/${id}/hidden-categories`, {
          method: 'POST',
          body: JSON.stringify({ categoryId }),
        });
      }
    },
    onSuccess: () => {
      toast.success('Menu visibility updated');
      queryClient.invalidateQueries({ queryKey: ['companies', id, 'hidden-categories'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update visibility'),
  });

  if (isLoading) {
    return (
      <AppShell requiredPermission="companies:read">
        <div className="py-24 text-center text-slate-500 text-xs">Loading company details...</div>
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell requiredPermission="companies:read">
        <div className="py-24 text-center text-slate-400">
          <p>Company not found.</p>
          <Button onClick={() => router.push('/companies')} className="mt-3">
            Back to Companies
          </Button>
        </div>
      </AppShell>
    );
  }

  const hiddenCatIds = new Set((hiddenCatsData || []).map((h: any) => h.categoryId));

  return (
    <AppShell requiredPermission="companies:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/companies')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{company.name}</h1>
                <Badge variant="outline" className="text-[10px]">
                  {company.tier?.name || 'Default Tier'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Billing Contact: {company.billingEmail} • {company.employees?.length || 0} employees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/billing?companyId=${company.id}`}>
              <Button variant="outline" size="sm" className="text-xs">
                View Unbilled Orders
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="general" className="text-xs">
              General & Defaults
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs">
              Calendar & Holidays
            </TabsTrigger>
            <TabsTrigger value="addresses" className="text-xs">
              Addresses ({company.addresses?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="employees" className="text-xs">
              Employees ({company.employees?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="menu" className="text-xs">
              Menu & Price Hiding
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: General & Defaults */}
          <TabsContent value="general" className="space-y-4">
            <Card className="border-slate-800 p-6 space-y-6 bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white">Company Operations Settings</h3>
                  <p className="text-xs text-slate-400">
                    Default parameters for orders, price tier, and logistics instructions.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    updateGeneralMutation.mutate({
                      tierId: editTierId || null,
                      defaultDeliveryTimeMin: editDeliveryTimeMin,
                      dispatchLeadMinutes: editDispatchLeadMin,
                      defaultPackaging: editPackaging,
                      driverNotes: editDriverNotes,
                      workingDays,
                    })
                  }
                  loading={updateGeneralMutation.isPending}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500"
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> Save Changes
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Assigned Price Tier
                  </label>
                  <select
                    value={editTierId}
                    onChange={(e) => setEditTierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="">Default Tier (Fallback)</option>
                    {tiersData?.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isDefault ? '(System Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Default Delivery Time
                  </label>
                  <input
                    type="time"
                    step={300}
                    value={minutesToTimeString(editDeliveryTimeMin)}
                    onChange={(e) => setEditDeliveryTimeMin(timeStringToMinutes(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Dispatch Lead Time (Minutes before delivery)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={editDispatchLeadMin}
                    onChange={(e) => setEditDispatchLeadMin(parseInt(e.target.value, 10) || 60)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Default Packaging
                  </label>
                  <select
                    value={editPackaging}
                    onChange={(e) => setEditPackaging(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="INSULATED">Insulated</option>
                    <option value="ECO">Eco-friendly</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Standing Driver Instructions
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Instructions for courier (e.g. Park in loading dock B, check in at security desk)"
                    value={editDriverNotes}
                    onChange={(e) => setEditDriverNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              {/* Registered Domains Card */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-white">Registered Email Domains</h4>
                    <p className="text-[11px] text-slate-400">
                      Employees with matching email domains are assigned to this company.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDomainModalOpen(true)}
                    className="text-xs h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Domain
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {company.domains?.map((d: any) => (
                    <span
                      key={d.domain}
                      className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-400"
                    >
                      @{d.domain}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: Calendar & Holidays */}
          <TabsContent value="calendar" className="space-y-4">
            <Card className="border-slate-800 p-6 space-y-6 bg-slate-900/60">
              {/* Working Days Selector */}
              <div>
                <h3 className="font-semibold text-sm text-white mb-1">Working Days Schedule</h3>
                <p className="text-xs text-slate-400 mb-3">
                  Deliveries cannot be placed on company non-working days.
                </p>

                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { day: 1, label: 'Mon' },
                    { day: 2, label: 'Tue' },
                    { day: 3, label: 'Wed' },
                    { day: 4, label: 'Thu' },
                    { day: 5, label: 'Fri' },
                    { day: 6, label: 'Sat' },
                    { day: 7, label: 'Sun' },
                  ].map(({ day, label }) => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? workingDays.filter((d) => d !== day)
                            : [...workingDays, day].sort();
                          setWorkingDays(updated);
                          updateGeneralMutation.mutate({ workingDays: updated });
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Company Holidays */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-white">Company Holidays & Closures</h4>
                    <p className="text-[11px] text-slate-400">
                      Deliveries are blocked on configured company holidays.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHolidayModalOpen(true)}
                    className="text-xs h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Holiday
                  </Button>
                </div>

                <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                  {company.holidays?.length > 0 ? (
                    company.holidays.map((h: any) => (
                      <div
                        key={h.date}
                        className="p-3 bg-slate-950/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{h.name}</div>
                          <div className="text-[11px] text-slate-400">{formatDate(h.date)}</div>
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
                    <div className="py-6 text-center text-slate-500 text-xs">
                      No custom company holidays configured.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Delivery Addresses */}
          <TabsContent value="addresses" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-white">Delivery Addresses</h3>
                <p className="text-xs text-slate-400">
                  Locations available for dispatch drops for this company.
                </p>
              </div>
              <Button size="sm" onClick={() => setAddrModalOpen(true)} className="text-xs">
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Address
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.addresses?.map((addr: any) => (
                <Card key={addr.id} className="p-4 bg-slate-900/60 border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      {addr.label}
                    </span>
                    {addr.isDefault && (
                      <Badge variant="default" className="text-[10px]">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-300">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}
                  </div>
                  <div className="text-xs text-slate-400">
                    {addr.city} {addr.postcode}
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAddressMutation.mutate(addr.id)}
                      className="text-rose-400 hover:text-rose-300 h-7 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 4: Employees */}
          <TabsContent value="employees" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-white">Company Employees</h3>
                <p className="text-xs text-slate-400">
                  Staff members registered under {company.name}.
                </p>
              </div>
              <Link href="/employees">
                <Button size="sm" className="text-xs">
                  Manage in Employee Hub
                </Button>
              </Link>
            </div>

            <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Address Customization</th>
                      <th className="py-3 px-4">Time Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {company.employees?.map((emp: any) => (
                      <tr key={emp.id} className="hover:bg-slate-850/50">
                        <td className="py-3 px-4 font-semibold text-white">{emp.name}</td>
                        <td className="py-3 px-4 text-slate-300">{emp.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant={emp.canChooseAddress ? 'default' : 'secondary'} className="text-[10px]">
                            {emp.canChooseAddress ? 'Allowed' : 'Locked'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={emp.canChangeTime ? 'default' : 'secondary'} className="text-[10px]">
                            {emp.canChangeTime ? 'Allowed' : 'Locked'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 5: Menu & Price Hiding */}
          <TabsContent value="menu" className="space-y-4">
            <Card className="border-slate-800 p-6 space-y-4 bg-slate-900/60">
              <div>
                <h3 className="font-semibold text-sm text-white">Hidden Categories for {company.name}</h3>
                <p className="text-xs text-slate-400">
                  Toggle categories to hide them specifically from this client&apos;s employees.
                </p>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                {categoriesData?.map((cat: any) => {
                  const isHidden = hiddenCatIds.has(cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="p-3 bg-slate-950/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{cat.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">slug: {cat.slug}</div>
                      </div>

                      <Button
                        size="sm"
                        variant={isHidden ? 'destructive' : 'outline'}
                        onClick={() =>
                          toggleHiddenCategoryMutation.mutate({
                            categoryId: cat.id,
                            isHidden,
                          })
                        }
                        className="h-7 text-xs"
                      >
                        {isHidden ? (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" /> Hidden from Company
                          </>
                        ) : (
                          'Visible'
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Address Modal */}
        <Dialog open={addrModalOpen} onOpenChange={setAddrModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Delivery Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Label (e.g. Headquarters, Engineering Annex)
                </label>
                <input
                  type="text"
                  required
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  required
                  value={addrLine1}
                  onChange={(e) => setAddrLine1(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Postal Code</label>
                  <input
                    type="text"
                    required
                    value={addrPostcode}
                    onChange={(e) => setAddrPostcode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddrModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  addAddressMutation.mutate({
                    label: addrLabel,
                    line1: addrLine1,
                    city: addrCity,
                    postcode: addrPostcode,
                  })
                }
                loading={addAddressMutation.isPending}
              >
                Add Address
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Holiday Modal */}
        <Dialog open={holidayModalOpen} onOpenChange={setHolidayModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Company Holiday</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Company Retreat"
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
                onClick={() =>
                  addHolidayMutation.mutate({
                    date: holidayDate,
                    name: holidayName,
                  })
                }
                loading={addHolidayMutation.isPending}
              >
                Add Holiday
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Domain Modal */}
        <Dialog open={domainModalOpen} onOpenChange={setDomainModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Additional Email Domain</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. subsidiary.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDomainModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => addDomainMutation.mutate(newDomain)}
                loading={addDomainMutation.isPending}
              >
                Register Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
