'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatCents } from '@/lib/utils';
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
  Tags,
  Plus,
  Search,
  Edit,
  Trash2,
} from 'lucide-react';

export default function OptionsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editOption, setEditOption] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [costCents, setCostCents] = useState(150);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Reference data
  const { data: allergensData } = useQuery<any[]>({
    queryKey: ['ref', 'allergens'],
    queryFn: () => fetchApi('/ref/allergens'),
  });
  const { data: dietaryTagsData } = useQuery<any[]>({
    queryKey: ['ref', 'dietary-tags'],
    queryFn: () => fetchApi('/ref/dietary-tags'),
  });

  // Fetch Options
  const { data: optionsData, isLoading } = useQuery<{ options: any[] }>({
    queryKey: ['options', 'list', search],
    queryFn: () => fetchApi(`/options?q=${search}&limit=100`),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi('/options', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Option created successfully');
      setDrawerOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['options'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create option'),
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      fetchApi(`/options/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Option updated');
      setDrawerOpen(false);
      setEditOption(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['options'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update option'),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/options/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Option removed from catalogue');
      queryClient.invalidateQueries({ queryKey: ['options'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to remove option'),
  });

  function resetForm() {
    setName('');
    setCostCents(150);
    setSelectedAllergens([]);
    setSelectedTags([]);
  }

  function openCreate() {
    setEditOption(null);
    resetForm();
    setDrawerOpen(true);
  }

  function openEdit(opt: any) {
    setEditOption(opt);
    setName(opt.name);
    setCostCents(opt.costCents);
    setSelectedAllergens(opt.allergens?.map((a: any) => a.id || a.allergenId) || []);
    setSelectedTags(opt.dietaryTags?.map((t: any) => t.id || t.tagId) || []);
    setDrawerOpen(true);
  }

  const options = extractList(optionsData);

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Reusable Options"
          subtitle="Individual recipe variations, add-ons, toppings, and sauces shared across option groups"
          actions={
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add option
            </Button>
          }
        />

        {/* Context Bar */}
        <div className="h-10 px-3 bg-surface border border-border rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search options…"
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
              Showing <strong className="text-text font-semibold">{options.length}</strong> options
            </span>
          </div>
        </div>

        {/* Options Table */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="No options found"
              description="Create reusable options that can be assigned to dishes."
              actionLabel="Add option"
              onAction={openCreate}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table compact={isCompact}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Option name</TableHead>
                    <TableHead className="w-32 text-right">Internal cost</TableHead>
                    <TableHead>Allergens & preferences</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {options.map((opt) => (
                    <TableRow key={opt.id}>
                      <TableCell className="font-medium text-text">
                        {opt.name}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-text">
                        {formatCents(opt.costCents)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {opt.allergens?.map((a: any) => (
                            <Chip key={a.id || a.allergenId}>
                              {a.name || a.allergen?.name}
                            </Chip>
                          ))}
                          {opt.dietaryTags?.map((t: any) => (
                            <Chip key={t.id || t.tagId}>
                              {t.name || t.tag?.name}
                            </Chip>
                          ))}
                          {(!opt.allergens || opt.allergens.length === 0) &&
                            (!opt.dietaryTags || opt.dietaryTags.length === 0) && (
                              <span className="text-faint text-xs">None</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={opt.active ? 'Ready' : 'Cancelled'}
                          label={opt.active ? 'Active' : 'Inactive'}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(opt)}
                            className="h-7 px-2 text-xs"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(opt.id)}
                            className="h-7 px-2 text-xs text-danger hover:text-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="h-10 px-4 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>Showing 1–{options.length} of {options.length}</span>
          </div>
        </div>

        {/* Add/Edit Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditOption(null);
          }}
          title={editOption ? 'Edit option' : 'Add reusable option'}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-xs font-medium text-text block mb-1">Option name *</label>
              <Input
                required
                placeholder="e.g. Sautéed Paneer Cubes"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">
                Base cost (cents) *
              </label>
              <Input
                type="number"
                min={0}
                value={costCents}
                onChange={(e) => setCostCents(parseInt(e.target.value, 10) || 0)}
              />
              <span className="text-[11px] text-muted tabular-nums mt-0.5 block">{formatCents(costCents)}</span>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setDrawerOpen(false);
                  setEditOption(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editOption) {
                    updateMutation.mutate({
                      id: editOption.id,
                      payload: { name, costCents },
                    });
                  } else {
                    createMutation.mutate({
                      name,
                      costCents,
                      allergenIds: selectedAllergens,
                      dietaryTagIds: selectedTags,
                    });
                  }
                }}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editOption ? 'Save changes' : 'Create option'}
              </Button>
            </div>
          </div>
        </Drawer>
      </div>
    </AppShell>
  );
}
