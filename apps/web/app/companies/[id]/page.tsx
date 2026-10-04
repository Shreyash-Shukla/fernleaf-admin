'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatDate, formatMinutesToTime, minutesToTimeString, timeStringToMinutes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  EyeOff,
  ArrowRight,
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

  // Fetch Employees for this company
  const { data: employeesData } = useQuery<any>({
    queryKey: ['employees', 'company', id],
    queryFn: () => fetchApi(`/employees?companyId=${id}&limit=100`),
    enabled: !!id,
  });
  const companyEmployees = extractList(employeesData).length > 0
    ? extractList(employeesData)
    : (company?.employees || []);

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
        <div className="py-24 text-center text-muted text-xs">Loading company details…</div>
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell requiredPermission="companies:read">
        <div className="py-24 text-center text-muted">
          <p>Company not found.</p>
          <Button onClick={() => router.push('/companies')} className="mt-3">
            Back to companies
          </Button>
        </div>
      </AppShell>
    );
  }

  const hiddenCatIds = new Set((hiddenCatsData || []).map((h: any) => h.categoryId));

  return (
    <AppShell requiredPermission="companies:read">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/companies')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-text">{company.name}</h1>
                <Chip>{company.tier?.name || 'Default Tier'}</Chip>
              </div>
              <p className="text-xs text-muted mt-0.5 tabular-nums">
                Billing contact: {company.billingEmail} · {company.employeeCount ?? companyEmployees.length} employees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/billing?companyId=${company.id}`}>
              <Button variant="ghost" size="sm" className="text-xs text-brand-text">
                View unbilled orders <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">
              General & defaults
            </TabsTrigger>
            <TabsTrigger value="calendar">
              Calendar & holidays
            </TabsTrigger>
            <TabsTrigger value="addresses">
              Addresses ({company.addresses?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="employees">
              Employees ({company.employeeCount ?? companyEmployees.length})
            </TabsTrigger>
            <TabsTrigger value="menu">
              Menu visibility
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: General & Defaults */}
          <TabsContent value="general" className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-text">Company operations settings</div>
                  <p className="text-xs text-muted mt-0.5">
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
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save changes
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-medium text-text block mb-1">
                    Assigned price tier
                  </label>
                  <select
                    value={editTierId}
                    onChange={(e) => setEditTierId(e.target.value)}
                    className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                  >
                    <option value="">Default tier (Fallback)</option>
                    {tiersData?.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isDefault ? '(System Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-text block mb-1">
                    Default delivery time
                  </label>
                  <Input
                    type="time"
                    step={300}
                    value={minutesToTimeString(editDeliveryTimeMin)}
                    onChange={(e) => setEditDeliveryTimeMin(timeStringToMinutes(e.target.value))}
                  />
                </div>

                <div>
                  <label className="font-medium text-text block mb-1">
                    Dispatch lead time (minutes before delivery)
                  </label>
                  <Input
                    type="number"
                    min={15}
                    max={240}
                    value={editDispatchLeadMin}
                    onChange={(e) => setEditDispatchLeadMin(parseInt(e.target.value, 10) || 60)}
                  />
                </div>

                <div>
                  <label className="font-medium text-text block mb-1">
                    Default packaging
                  </label>
                  <select
                    value={editPackaging}
                    onChange={(e) => setEditPackaging(e.target.value)}
                    className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="INSULATED">Insulated</option>
                    <option value="ECO">Eco-friendly</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="font-medium text-text block mb-1">
                    Standing driver instructions
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Instructions for courier (e.g. Park in loading dock B, check in at security desk)"
                    value={editDriverNotes}
                    onChange={(e) => setEditDriverNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-app border border-border rounded-md text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-solid"
                  />
                </div>
              </div>

              {/* Registered Domains Card */}
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-text">Registered email domains</div>
                    <p className="text-[11px] text-muted">
                      Employees with matching email domains are assigned to this company.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDomainModalOpen(true)}
                    className="text-xs h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add domain
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {company.domains?.map((d: any) => (
                    <Chip key={d.domain}>
                      @{d.domain}
                    </Chip>
                  ))}
                  {(!company.domains || company.domains.length === 0) && (
                    <span className="text-muted text-xs">No email domains registered.</span>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Calendar & Holidays */}
          <TabsContent value="calendar" className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
              {/* Working Days Selector */}
              <div>
                <div className="font-semibold text-sm text-text mb-1">Working days schedule</div>
                <p className="text-xs text-muted mb-3">
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
                        className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-brand-soft border-brand-solid text-brand-text'
                            : 'bg-app border-border text-muted hover:text-text'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Company Holidays */}
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-text">Company holidays & closures</div>
                    <p className="text-[11px] text-muted">
                      Deliveries are blocked on configured company holidays.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setHolidayModalOpen(true)}
                    className="text-xs h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add holiday
                  </Button>
                </div>

                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {company.holidays?.length > 0 ? (
                    company.holidays.map((h: any) => (
                      <div
                        key={h.date}
                        className="h-11 px-4 bg-app flex items-center justify-between text-xs hover:bg-raised transition-colors"
                      >
                        <div>
                          <span className="font-medium text-text">{h.name}</span>
                          <span className="text-muted text-[11px] ml-3 tabular-nums">{formatDate(h.date)}</span>
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
                    <div className="p-6 text-center text-muted text-xs">
                      No custom company holidays configured.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Delivery Addresses */}
          <TabsContent value="addresses" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-text">Delivery addresses</div>
                <p className="text-xs text-muted mt-0.5">
                  Locations available for dispatch drops for this company.
                </p>
              </div>
              <Button size="sm" onClick={() => setAddrModalOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add address
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.addresses?.map((addr: any) => (
                <div key={addr.id} className="p-4 bg-surface border border-border rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-text">
                      {addr.label}
                    </span>
                    {addr.isDefault && (
                      <Chip>Default</Chip>
                    )}
                  </div>
                  <div className="text-text">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}
                  </div>
                  <div className="text-muted">
                    {addr.city} {addr.postcode}
                  </div>
                  <div className="pt-2 border-t border-border flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAddressMutation.mutate(addr.id)}
                      className="h-7 text-xs text-danger hover:text-danger"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TAB 4: Employees */}
          <TabsContent value="employees" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-text">Company employees</div>
                <p className="text-xs text-muted mt-0.5">
                  Staff members registered under {company.name}.
                </p>
              </div>
              <Link href="/employees">
                <Button size="sm" variant="secondary">
                  Manage in employee hub
                </Button>
              </Link>
            </div>

            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-40">Address customization</TableHead>
                    <TableHead className="w-32">Time change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyEmployees.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium text-text">{emp.name}</TableCell>
                      <TableCell className="text-muted font-mono text-xs">{emp.email}</TableCell>
                      <TableCell>
                        <Chip>{emp.canChooseAddress ? 'Allowed' : 'Locked'}</Chip>
                      </TableCell>
                      <TableCell>
                        <Chip>{emp.canChangeTime ? 'Allowed' : 'Locked'}</Chip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 5: Menu & Price Hiding */}
          <TabsContent value="menu" className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <div>
                <div className="font-semibold text-sm text-text">Hidden categories for {company.name}</div>
                <p className="text-xs text-muted mt-0.5">
                  Toggle categories to hide them specifically from this client&apos;s employees.
                </p>
              </div>

              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {categoriesData?.map((cat: any) => {
                  const isHidden = hiddenCatIds.has(cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="h-11 px-4 bg-app flex items-center justify-between text-xs hover:bg-raised transition-colors"
                    >
                      <div>
                        <span className="font-medium text-text">{cat.name}</span>
                        <span className="text-muted text-[11px] font-mono ml-2">/{cat.slug}</span>
                      </div>

                      <Button
                        size="sm"
                        variant={isHidden ? 'destructive' : 'secondary'}
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
                            <EyeOff className="w-3 h-3 mr-1" /> Hidden from company
                          </>
                        ) : (
                          'Visible'
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Address Modal */}
        <Dialog open={addrModalOpen} onOpenChange={setAddrModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add delivery address</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Label (e.g. Headquarters, Engineering Annex)
                </label>
                <Input
                  required
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Address line 1
                </label>
                <Input
                  required
                  value={addrLine1}
                  onChange={(e) => setAddrLine1(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text block mb-1">City</label>
                  <Input
                    required
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text block mb-1">Postal code</label>
                  <Input
                    required
                    value={addrPostcode}
                    onChange={(e) => setAddrPostcode(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddrModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!addrLabel.trim() || !addrLine1.trim() || !addrCity.trim()}
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
                Add address
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Holiday Modal */}
        <Dialog open={holidayModalOpen} onOpenChange={setHolidayModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add company holiday</DialogTitle>
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
                <label className="text-xs font-medium text-text block mb-1">Holiday name *</label>
                <Input
                  required
                  placeholder="e.g. Annual Company Offsite"
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

        {/* Add Domain Modal */}
        <Dialog open={domainModalOpen} onOpenChange={setDomainModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Register email domain</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Domain name (without @)
                </label>
                <Input
                  required
                  placeholder="e.g. acme-corp.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDomainModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!newDomain.trim()}
                onClick={() => addDomainMutation.mutate(newDomain.trim())}
                loading={addDomainMutation.isPending}
              >
                Register domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
