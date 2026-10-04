'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { Drawer } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StateBanner } from '@/components/ui/state-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Users2,
  Plus,
  Upload,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Drawers and Modals
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [canChooseAddress, setCanChooseAddress] = useState(false);
  const [canChangeTime, setCanChangeTime] = useState(false);
  const [canChangePackaging, setCanChangePackaging] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // CSV Import State
  const [importCompanyId, setImportCompanyId] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [importResults, setImportResults] = useState<any>(null);

  // 1. Fetch Companies for Filter & Creation
  const { data: companiesData } = useQuery<{ items: any[] }>({
    queryKey: ['companies', 'filter'],
    queryFn: () => fetchApi('/companies?limit=100'),
  });

  // 2. Fetch Reference Allergens & Tags
  const { data: allergensData } = useQuery<any[]>({
    queryKey: ['ref', 'allergens'],
    queryFn: () => fetchApi('/ref/allergens'),
  });
  const { data: dietaryTagsData } = useQuery<any[]>({
    queryKey: ['ref', 'dietary-tags'],
    queryFn: () => fetchApi('/ref/dietary-tags'),
  });

  // 3. Fetch Employees
  const queryParams = new URLSearchParams();
  queryParams.set('limit', '100');
  if (search) queryParams.set('q', search);
  if (selectedCompanyId) queryParams.set('companyId', selectedCompanyId);

  const { data: employeesData, isLoading, isError, refetch } = useQuery<{ items: any[] }>({
    queryKey: ['employees', 'list', queryParams.toString()],
    queryFn: () => fetchApi(`/employees?${queryParams.toString()}`),
  });

  // Create Employee Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Employee created successfully');
      setDrawerOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create employee'),
  });

  // Update Employee Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      fetchApi(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Employee updated successfully');
      setDrawerOpen(false);
      setEditEmployee(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update employee'),
  });

  // Deactivate Employee Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Employee deactivated');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to deactivate employee'),
  });

  // Bulk Import Mutation
  const importMutation = useMutation({
    mutationFn: (payload: { companyId: string; csv: string }) =>
      fetchApi('/employees/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      setImportResults(res);
      toast.success(`Import complete! ${res.imported} employee(s) added.`);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to import CSV'),
  });

  function resetForm() {
    setName('');
    setEmail('');
    setPhone('');
    setCompanyId('');
    setCanChooseAddress(false);
    setCanChangeTime(false);
    setCanChangePackaging(false);
    setSelectedAllergens([]);
    setSelectedTags([]);
  }

  function openEdit(emp: any) {
    setEditEmployee(emp);
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone || '');
    setCompanyId(emp.companyId);
    setCanChooseAddress(emp.canChooseAddress ?? false);
    setCanChangeTime(emp.canChangeTime ?? false);
    setCanChangePackaging(emp.canChangePackaging ?? false);
    setSelectedAllergens(emp.allergens?.map((a: any) => a.id || a.allergenId) || []);
    setSelectedTags(emp.dietaryTags?.map((t: any) => t.id || t.tagId) || []);
    setDrawerOpen(true);
  }

  function openAdd() {
    setEditEmployee(null);
    resetForm();
    if (companiesList.length > 0) {
      setCompanyId(companiesList[0].id);
    }
    setDrawerOpen(true);
  }

  const companiesList = extractList(companiesData);
  const employeesList = extractList(employeesData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !companyId) {
      toast.error('Please enter name, email, and company');
      return;
    }

    const payload = {
      name,
      email,
      phone: phone || undefined,
      companyId,
      canChooseAddress,
      canChangeTime,
      canChangePackaging,
      allergens: selectedAllergens,
      dietaryTags: selectedTags,
    };

    if (editEmployee) {
      updateMutation.mutate({ id: editEmployee.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <AppShell requiredPermission="employees:read">
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title="Employees Directory"
          subtitle="Corporate meal ordering members, dietary tags, and employee permissions"
          primaryAction={
            <Button variant="primary" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" /> Add employee
            </Button>
          }
          secondaryActions={
            <Button
              variant="secondary"
              onClick={() => {
                setImportModalOpen(true);
                setImportResults(null);
                setCsvContent('');
                if (companiesList.length > 0 && !importCompanyId) {
                  setImportCompanyId(companiesList[0].id);
                }
              }}
            >
              <Upload className="w-4 h-4 mr-1.5" /> Import CSV
            </Button>
          }
          contextBar={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--text-faint)]" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 h-[28px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                  />
                </div>

                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="h-[28px] px-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] max-w-[180px]"
                >
                  <option value="">All Companies</option>
                  {companiesList.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[12px] text-muted tabular-nums">
                {employeesList.length} employees
              </div>
            </div>
          }
        />

        {isError && (
          <StateBanner
            variant="error"
            message="Failed to load employee records"
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
                    NAME
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    EMAIL
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    COMPANY
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    DIETARY PREFERENCES
                  </th>
                  <th className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    PERMISSIONS
                  </th>
                  <th className="w-[44px] px-3 py-1.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {isLoading ? (
                  <TableSkeletonRows columns={6} rows={6} />
                ) : employeesList.length > 0 ? (
                  employeesList.map((emp: any) => (
                    <tr
                      key={emp.id}
                      onClick={() => openEdit(emp)}
                      className="h-[40px] hover:bg-[var(--bg-raised)] transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium text-[var(--text)]">
                        {emp.name}
                      </td>

                      <td className="px-3 py-2 text-[var(--text-muted)]">
                        {emp.email}
                      </td>

                      <td className="px-3 py-2 text-[var(--text)]">
                        {emp.company?.name || 'Client'}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {emp.dietaryTags?.map((t: any) => (
                            <Chip key={t.id || t.tag?.id} label={t.name || t.tag?.name} />
                          ))}
                          {emp.allergens?.map((a: any) => (
                            <Chip key={a.id || a.allergen?.id} label={`No ${a.name || a.allergen?.name}`} />
                          ))}
                          {(!emp.dietaryTags?.length && !emp.allergens?.length) && (
                            <span className="text-[var(--text-faint)] text-[12px]">None</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-[12px] text-[var(--text-muted)]">
                        {[
                          emp.canChooseAddress ? 'Address' : null,
                          emp.canChangeTime ? 'Time' : null,
                          emp.canChangePackaging ? 'Packaging' : null,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'Standard limits'}
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
                            <DropdownMenuItem onClick={() => openEdit(emp)}>
                              <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(emp.id)}
                              className="text-[var(--status-danger-fg)]"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState message="No employees found matching filter." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="h-[40px] px-4 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
            <span>Showing {employeesList.length} employees</span>
          </div>
        </div>

        {/* Add / Edit Employee Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={editEmployee ? `Edit Employee` : `Add Employee`}
          subtitle={editEmployee?.email || 'Set up corporate employee details'}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                Save employee
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-3.5 max-w-[720px]">
            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Full Name *
              </label>
              <Input
                type="text"
                required
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Corporate Email Address *
              </label>
              <Input
                type="email"
                required
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Company *
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full h-[32px] px-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[13px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
              >
                <option value="">-- Choose client company --</option>
                {companiesList.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                Phone Number
              </label>
              <Input
                type="text"
                placeholder="+1 555-0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* Self-service override permissions */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">
                Self-Service Overrides
              </span>
              <div className="space-y-1.5 text-[12px] text-[var(--text)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChooseAddress}
                    onChange={(e) => setCanChooseAddress(e.target.checked)}
                    className="rounded-[4px] accent-[var(--brand-solid)]"
                  />
                  <span>May select custom delivery address</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChangeTime}
                    onChange={(e) => setCanChangeTime(e.target.checked)}
                    className="rounded-[4px] accent-[var(--brand-solid)]"
                  />
                  <span>May select custom delivery time window</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChangePackaging}
                    onChange={(e) => setCanChangePackaging(e.target.checked)}
                    className="rounded-[4px] accent-[var(--brand-solid)]"
                  />
                  <span>May select custom packaging options</span>
                </label>
              </div>
            </div>
          </form>
        </Drawer>

        {/* CSV Import Modal */}
        <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Employees via CSV</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-[13px]">
              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                  Assign to Company *
                </label>
                <select
                  value={importCompanyId}
                  onChange={(e) => setImportCompanyId(e.target.value)}
                  className="w-full h-[32px] px-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[13px] text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                >
                  <option value="">-- Choose company --</option>
                  {companiesList.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] block mb-1">
                  CSV Content (Format: name,email,phone)
                </label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="John Smith,john@company.com,+15551234&#10;Alice Brown,alice@company.com,+15555678"
                  className="w-full p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border)] text-[12px] font-mono text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                />
              </div>

              {importResults && (
                <div className="p-3 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border)] text-[12px] text-[var(--text)]">
                  <div>Imported: <strong className="text-[var(--status-success-fg)]">{importResults.imported}</strong></div>
                  {importResults.skipped > 0 && (
                    <div>Skipped / Duplicate: <strong className="text-[var(--status-warning-fg)]">{importResults.skipped}</strong></div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setImportModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                disabled={!importCompanyId || !csvContent}
                loading={importMutation.isPending}
                onClick={() =>
                  importMutation.mutate({
                    companyId: importCompanyId,
                    csv: csvContent,
                  })
                }
              >
                Start CSV Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
