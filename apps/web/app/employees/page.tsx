'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users2,
  PlusCircle,
  Upload,
  Search,
  Building,
  AlertTriangle,
  Edit,
  Trash2,
  CheckCircle2,
  Filter,
} from 'lucide-react';

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Add / Edit Form State
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

  const { data: employeesData, isLoading } = useQuery<{ items: any[] }>({
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
      setAddModalOpen(false);
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
      setEditEmployee(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update employee'),
  });

  // Delete / Deactivate Employee Mutation
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
    onSuccess: (data) => {
      setImportResults(data);
      toast.success(`Import complete! ${data.imported} employee(s) added.`);
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
  }

  const employees = extractList(employeesData);
  const companies = extractList(companiesData);

  return (
    <AppShell requiredPermission="employees:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users2 className="w-6 h-6 text-emerald-400" />
              <span>Employees Hub</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Corporate customers roster, individual permission overrides, and allergies management
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportResults(null);
                setCsvContent('');
                setImportModalOpen(true);
              }}
              className="text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1" /> Bulk CSV Import
            </Button>

            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setAddModalOpen(true);
              }}
              className="text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Employee
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-slate-900/60 border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search by employee name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="min-w-[180px]">
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Companies</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-slate-400 text-xs">
            Showing <strong>{employees.length}</strong> employees
          </span>
        </Card>

        {/* Employees Table */}
        <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Permissions Flags</th>
                  <th className="py-3 px-4">Allergens & Preferences</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Loading employees...
                    </td>
                  </tr>
                ) : employees.length > 0 ? (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-850/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{emp.name}</div>
                        <div className="text-[11px] text-slate-400">{emp.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {emp.company?.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.canChooseAddress ? (
                            <Badge variant="default" className="text-[9px] py-0">
                              Address
                            </Badge>
                          ) : null}
                          {emp.canChangeTime ? (
                            <Badge variant="info" className="text-[9px] py-0">
                              Time
                            </Badge>
                          ) : null}
                          {emp.canChangePackaging ? (
                            <Badge variant="warning" className="text-[9px] py-0">
                              Packaging
                            </Badge>
                          ) : null}
                          {!emp.canChooseAddress && !emp.canChangeTime && !emp.canChangePackaging && (
                            <span className="text-slate-500 text-[10px]">Strict Defaults</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.allergens?.map((a: any) => (
                            <span
                              key={a.id || a.allergen?.id}
                              className="text-[10px] text-rose-300 bg-rose-950/40 border border-rose-900/40 px-1.5 py-0.5 rounded"
                            >
                              {a.name || a.allergen?.name}
                            </span>
                          ))}
                          {emp.dietaryTags?.map((t: any) => (
                            <span
                              key={t.id || t.tag?.id}
                              className="text-[10px] text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded"
                            >
                              {t.name || t.tag?.name}
                            </span>
                          ))}
                          {(!emp.allergens || emp.allergens.length === 0) &&
                            (!emp.dietaryTags || emp.dietaryTags.length === 0) && (
                              <span className="text-slate-500 text-[10px]">None specified</span>
                            )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(emp)}
                          className="h-7 text-xs px-2.5"
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(emp.id)}
                          className="h-7 text-xs text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add Employee Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Company *</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="">Select Company...</option>
                  {companies.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              </div>

              {/* Permission Checkboxes */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">Ordering Permission Flags</span>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChooseAddress}
                    onChange={(e) => setCanChooseAddress(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Can choose custom delivery address from company list</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChangeTime}
                    onChange={(e) => setCanChangeTime(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Can change delivery time from company default</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChangePackaging}
                    onChange={(e) => setCanChangePackaging(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Can change packaging type (e.g. Insulated, Eco)</span>
                </label>
              </div>

              {/* Allergens selection */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">Allergies (Causes ordering warnings)</span>
                <div className="flex flex-wrap gap-1.5">
                  {allergensData?.map((a: any) => {
                    const isChecked = selectedAllergens.includes(a.id);
                    return (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => {
                          setSelectedAllergens(
                            isChecked
                              ? selectedAllergens.filter((id) => id !== a.id)
                              : [...selectedAllergens, a.id]
                          );
                        }}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          isChecked
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    companyId,
                    name,
                    email,
                    phone: phone || undefined,
                    canChooseAddress,
                    canChangeTime,
                    canChangePackaging,
                    allergenIds: selectedAllergens,
                    dietaryTagIds: selectedTags,
                  })
                }
                loading={createMutation.isPending}
              >
                Create Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Employee Modal */}
        <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Employee Permissions</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded text-xs text-slate-400"
                  />
                </div>
              </div>

              {/* Permission Checkboxes */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">Ordering Permission Flags</span>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChooseAddress}
                    onChange={(e) => setCanChooseAddress(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Can choose custom delivery address from company list</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChangeTime}
                    onChange={(e) => setCanChangeTime(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Can change delivery time from company default</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canChangePackaging}
                    onChange={(e) => setCanChangePackaging(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Can change packaging type (e.g. Insulated, Eco)</span>
                </label>
              </div>

              {/* Allergens */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">Allergies</span>
                <div className="flex flex-wrap gap-1.5">
                  {allergensData?.map((a: any) => {
                    const isChecked = selectedAllergens.includes(a.id);
                    return (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => {
                          setSelectedAllergens(
                            isChecked
                              ? selectedAllergens.filter((id) => id !== a.id)
                              : [...selectedAllergens, a.id]
                          );
                        }}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          isChecked
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditEmployee(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateMutation.mutate({
                    id: editEmployee.id,
                    payload: {
                      name,
                      canChooseAddress,
                      canChangeTime,
                      canChangePackaging,
                      allergenIds: selectedAllergens,
                      dietaryTagIds: selectedTags,
                    },
                  })
                }
                loading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Import CSV Modal */}
        <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <span>Bulk Import Employees from CSV</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Target Company *
                </label>
                <select
                  value={importCompanyId}
                  onChange={(e) => setImportCompanyId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="">Select Company...</option>
                  {companies.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Paste CSV Data (or upload file below)
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    name,email,phone,canChooseAddress
                  </span>
                </div>
                <textarea
                  rows={6}
                  placeholder={`name,email,phone,canChooseAddress\nAlice Sharma,alice@acme.com,9876543210,true\nBob Verma,bob@acme.com,,false`}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full font-mono text-xs p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                />
              </div>

              {/* Row-level errors report if any */}
              {importResults && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-xs">
                    <span className="text-emerald-400">
                      Successfully Imported: {importResults.imported}
                    </span>
                    <span className="text-rose-400">
                      Errors: {importResults.errors?.length || 0}
                    </span>
                  </div>

                  {importResults.errors?.length > 0 && (
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-850 text-[11px]">
                      {importResults.errors.map((err: any, idx: number) => (
                        <div key={idx} className="py-1 text-rose-300 flex justify-between">
                          <span>Row #{err.row}: {err.email || ''}</span>
                          <span>{err.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setImportModalOpen(false)}>
                Close
              </Button>
              <Button
                disabled={!importCompanyId || !csvContent.trim()}
                onClick={() =>
                  importMutation.mutate({
                    companyId: importCompanyId,
                    csv: csvContent,
                  })
                }
                loading={importMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Run Bulk Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
