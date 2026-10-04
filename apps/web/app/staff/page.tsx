'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ShieldAlert,
  PlusCircle,
  Edit,
  UserCheck,
  Lock,
  Mail,
  Shield,
} from 'lucide-react';

export default function StaffPage() {
  const queryClient = useQueryClient();

  const [addModalOpen, setAddModalOpen] = useState(false);
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
      setAddModalOpen(false);
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

  function openEdit(user: any) {
    setEditingStaff(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRoleKey(user.role?.key || 'kitchen');
    setActive(user.active);
    setAddModalOpen(true);
  }

  const staffList = staffData?.staff || [];

  return (
    <AppShell requiredPermission="staff:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
              <span>Staff & Roles Management</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Internal kitchen, dispatch, driver, and administrator accounts
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setEditingStaff(null);
              setAddModalOpen(true);
            }}
            className="text-xs"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Staff User
          </Button>
        </div>

        {/* Staff Table */}
        <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role Key</th>
                  <th className="py-3 px-4">Landing Hub</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Loading staff users...
                    </td>
                  </tr>
                ) : staffList.length > 0 ? (
                  staffList.map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-850/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{user.name}</div>
                        <div className="text-[11px] text-slate-400">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            user.role?.key === 'admin'
                              ? 'destructive'
                              : user.role?.key === 'kitchen'
                              ? 'warning'
                              : user.role?.key === 'dispatch'
                              ? 'info'
                              : 'default'
                          }
                          className="capitalize text-[10px]"
                        >
                          {user.role?.name || user.role?.key}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                        {user.role?.landingPath || '/home'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.active ? 'default' : 'secondary'} className="text-[10px]">
                          {user.active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(user)}
                          className="h-7 text-xs px-2.5"
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No staff users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add/Edit Staff Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingStaff ? 'Edit Staff User' : 'Add Staff User'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Staff Email *</label>
                <input
                  type="email"
                  required
                  disabled={!!editingStaff}
                  placeholder="e.g. rahul@fernleaf.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {editingStaff ? 'New Password (Leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  placeholder={editingStaff ? '••••••••' : 'Minimum 8 characters'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Role *</label>
                <select
                  value={roleKey}
                  onChange={(e) => setRoleKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white capitalize"
                >
                  {rolesData?.map((r) => (
                    <option key={r.id} value={r.key}>
                      {r.name} ({r.key})
                    </option>
                  ))}
                </select>
              </div>

              {editingStaff && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                    />
                    <span>Account Active</span>
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || (!editingStaff && !password.trim())}
                onClick={() => {
                  if (editingStaff) {
                    updateMutation.mutate({
                      id: editingStaff.id,
                      payload: {
                        name,
                        roleKey,
                        active,
                        password: password || undefined,
                      },
                    });
                  } else {
                    createMutation.mutate({
                      name,
                      email,
                      password,
                      roleKey,
                    });
                  }
                }}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingStaff ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
