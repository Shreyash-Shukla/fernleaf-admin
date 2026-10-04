'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Shield,
  Search,
} from 'lucide-react';

export default function StaffPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleKey, setRoleKey] = useState('kitchen');
  const [active, setActive] = useState(true);

  // 1. Fetch Staff
  const { data: staffData, isLoading } = useQuery<{ staff: any[] }>({
    queryKey: ['staff', 'list'],
    queryFn: () => fetchApi('/staff'),
  });

  // 2. Fetch Roles
  const { data: rolesData } = useQuery<any[]>({
    queryKey: ['roles'],
    queryFn: () => fetchApi('/roles'),
  });

  // Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi('/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Staff user created');
      setDrawerOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create staff'),
  });

  // Update Staff Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      fetchApi(`/staff/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Staff user updated');
      setDrawerOpen(false);
      setEditingStaff(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update staff'),
  });

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
    setRoleKey('kitchen');
    setActive(true);
  }

  function openCreate() {
    resetForm();
    setEditingStaff(null);
    setDrawerOpen(true);
  }

  function openEdit(user: any) {
    setEditingStaff(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRoleKey(user.role?.key || 'kitchen');
    setActive(user.active);
    setDrawerOpen(true);
  }

  const staffList = extractList(staffData).filter(
    (u) =>
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell requiredPermission="staff:read">
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Staff & Roles Management"
          subtitle="Internal kitchen, dispatch, driver, and administrator accounts"
          actions={
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add staff user
            </Button>
          }
        />

        {/* Context Bar */}
        <div className="h-10 px-3 bg-surface border border-border rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 bg-app border border-border rounded-md text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-solid"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCompact(!isCompact)}
              className="h-7 text-xs text-muted"
            >
              {isCompact ? 'Comfortable' : 'Compact'}
            </Button>
            <span className="text-muted text-xs tabular-nums">
              Showing <strong className="text-text font-semibold">{staffList.length}</strong> staff
            </span>
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : staffList.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No staff users found"
              description="Create user accounts for internal kitchen and dispatch personnel."
              actionLabel="Add staff user"
              onAction={openCreate}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table compact={isCompact}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff member</TableHead>
                    <TableHead className="w-32">Role</TableHead>
                    <TableHead className="w-40">Landing hub</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium text-text">{user.name}</div>
                        <div className="text-xs text-muted font-normal mt-0.5">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <Chip>{user.role?.name || user.role?.key}</Chip>
                      </TableCell>
                      <TableCell className="text-muted text-xs">
                        {user.role?.landingPath || '/home'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={user.active ? 'Ready' : 'Cancelled'}
                          label={user.active ? 'Active' : 'Disabled'}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(user)}
                          className="h-7 text-xs px-2 text-muted hover:text-text"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="h-10 px-4 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>Showing 1–{staffList.length} of {staffList.length}</span>
          </div>
        </div>

        {/* Add/Edit Staff Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditingStaff(null);
          }}
          title={editingStaff ? 'Edit staff user' : 'Add staff user'}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-xs font-medium text-text block mb-1">Full name *</label>
              <Input
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">Email address *</label>
              <Input
                type="email"
                required
                placeholder="e.g. rahul@fernleafkitchen.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">
                {editingStaff ? 'Password (leave blank to keep unchanged)' : 'Initial password *'}
              </label>
              <Input
                type="password"
                placeholder={editingStaff ? '••••••••' : 'Minimum 8 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">Operational role</label>
              <select
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
                className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
              >
                {rolesData?.map((r) => (
                  <option key={r.id || r.key} value={r.key}>
                    {r.name} ({r.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded bg-app border-border text-brand-solid focus:ring-brand-solid"
                />
                <span>Active account (permitted to log in)</span>
              </label>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setDrawerOpen(false);
                  setEditingStaff(null);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || !email.trim() || (!editingStaff && !password)}
                onClick={() => {
                  if (editingStaff) {
                    updateMutation.mutate({
                      id: editingStaff.id,
                      payload: {
                        name,
                        email,
                        password: password || undefined,
                        roleKey,
                        active,
                      },
                    });
                  } else {
                    createMutation.mutate({
                      name,
                      email,
                      password,
                      roleKey,
                      active,
                    });
                  }
                }}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingStaff ? 'Save changes' : 'Create user'}
              </Button>
            </div>
          </div>
        </Drawer>
      </div>
    </AppShell>
  );
}
