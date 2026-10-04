'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatCents } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Tags,
  PlusCircle,
  Search,
  Edit,
  Trash2,
} from 'lucide-react';

export default function OptionsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
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
      setAddModalOpen(false);
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

  function openEdit(opt: any) {
    setEditOption(opt);
    setName(opt.name);
    setCostCents(opt.costCents);
    setSelectedAllergens(opt.allergens?.map((a: any) => a.id || a.allergenId) || []);
    setSelectedTags(opt.dietaryTags?.map((t: any) => t.id || t.tagId) || []);
  }

  const options = extractList(optionsData);

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Tags className="w-6 h-6 text-emerald-400" />
              <span>Reusable Options</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Individual recipe variations, add-ons, toppings, and sauces shared across option groups
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setAddModalOpen(true);
            }}
            className="text-xs"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Option
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search option name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Options Table */}
        <Card className="border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Option Name</th>
                  <th className="py-3 px-4">Internal Cost</th>
                  <th className="py-3 px-4">Allergens & Preferences</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Loading options...
                    </td>
                  </tr>
                ) : options.length > 0 ? (
                  options.map((opt) => (
                    <tr key={opt.id} className="hover:bg-slate-850/50">
                      <td className="py-3 px-4 font-semibold text-white">{opt.name}</td>
                      <td className="py-3 px-4 font-mono text-emerald-400">
                        {formatCents(opt.costCents)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {opt.allergens?.map((a: any) => (
                            <span
                              key={a.id || a.allergenId}
                              className="text-[9px] text-amber-300 bg-amber-950/40 border border-amber-900/40 px-1 py-0.5 rounded"
                            >
                              {a.name || a.allergen?.name}
                            </span>
                          ))}
                          {opt.dietaryTags?.map((t: any) => (
                            <span
                              key={t.id || t.tagId}
                              className="text-[9px] text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 px-1 py-0.5 rounded"
                            >
                              {t.name || t.tag?.name}
                            </span>
                          ))}
                          {(!opt.allergens || opt.allergens.length === 0) &&
                            (!opt.dietaryTags || opt.dietaryTags.length === 0) && (
                              <span className="text-slate-500 text-[10px]">None</span>
                            )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={opt.active ? 'default' : 'secondary'} className="text-[9px]">
                          {opt.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(opt)}
                          className="h-7 text-xs px-2.5"
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(opt.id)}
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
                      No options found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add/Edit Modal */}
        <Dialog
          open={addModalOpen || !!editOption}
          onOpenChange={(open) => {
            if (!open) {
              setAddModalOpen(false);
              setEditOption(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editOption ? 'Edit Option' : 'Add Reusable Option'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Option Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sautéed Paneer Cubes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Base Cost (Cents) *
                </label>
                <input
                  type="number"
                  min={0}
                  value={costCents}
                  onChange={(e) => setCostCents(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
                <span className="text-[10px] text-slate-500">{formatCents(costCents)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setAddModalOpen(false);
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
                {editOption ? 'Save Changes' : 'Create Option'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
