'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  UtensilsCrossed,
  ArrowLeft,
  Save,
  PlusCircle,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  ChefHat,
} from 'lucide-react';

export default function DishDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  // Add Group Modal State
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupRequired, setGroupRequired] = useState(true);
  const [groupUsesPortions, setGroupUsesPortions] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  // Fetch Dish Detail
  const { data: dish, isLoading } = useQuery<any>({
    queryKey: ['dish', id],
    queryFn: () => fetchApi(`/dishes/${id}`),
    enabled: !!id,
  });

  // Fetch Option Groups for this dish
  const { data: groups, isLoading: groupsLoading } = useQuery<any[]>({
    queryKey: ['dish', id, 'groups'],
    queryFn: () => fetchApi(`/dishes/${id}/groups`),
    enabled: !!id,
  });

  // Fetch Available Reusable Options
  const { data: optionsData } = useQuery<{ options: any[] }>({
    queryKey: ['options', 'catalogue-all'],
    queryFn: () => fetchApi('/options?limit=100'),
  });

  // Fetch Portion Sizes
  const { data: portionSizesData } = useQuery<any[]>({
    queryKey: ['ref', 'portion-sizes'],
    queryFn: () => fetchApi('/ref/portion-sizes'),
  });

  // Dish edit form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costCents, setCostCents] = useState(500);
  const [active, setActive] = useState(true);

  React.useEffect(() => {
    if (dish) {
      setName(dish.name);
      setDescription(dish.description || '');
      setCostCents(dish.costCents);
      setActive(dish.active);
    }
  }, [dish]);

  // Update Dish Mutation
  const updateDishMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/dishes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Dish details updated');
      queryClient.invalidateQueries({ queryKey: ['dish', id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update dish'),
  });

  // Create Group Mutation
  const createGroupMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/dishes/${id}/groups`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Option group created successfully');
      setGroupModalOpen(false);
      setGroupName('');
      setSelectedOptionIds([]);
      queryClient.invalidateQueries({ queryKey: ['dish', id, 'groups'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create group'),
  });

  // Delete Group Mutation
  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      fetchApi(`/dishes/${id}/groups/${groupId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast.success('Option group removed');
      queryClient.invalidateQueries({ queryKey: ['dish', id, 'groups'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete group'),
  });

  if (isLoading) {
    return (
      <AppShell requiredPermission="catalogue:read">
        <div className="py-24 text-center text-slate-500 text-xs">Loading dish details...</div>
      </AppShell>
    );
  }

  if (!dish) {
    return (
      <AppShell requiredPermission="catalogue:read">
        <div className="py-24 text-center text-slate-400">
          <p>Dish not found.</p>
          <Button onClick={() => router.push('/catalogue/dishes')} className="mt-3">
            Back to Dishes
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/catalogue/dishes')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{dish.name}</h1>
                <Badge variant={dish.active ? 'default' : 'secondary'} className="text-[10px]">
                  {dish.active ? 'Active in Catalogue' : 'Deactivated'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                SKU: {dish.sku} • Station: {dish.station?.name || 'Unassigned'}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() =>
              updateDishMutation.mutate({
                name,
                description,
                costCents,
                active,
              })
            }
            loading={updateDishMutation.isPending}
            className="text-xs bg-emerald-600 hover:bg-emerald-500"
          >
            <Save className="w-3.5 h-3.5 mr-1" /> Save Dish
          </Button>
        </div>

        {/* Dish Basic Settings */}
        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-4">
          <h3 className="font-semibold text-sm text-white">General Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Dish Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Internal Base Cost (Cents)
              </label>
              <input
                type="number"
                value={costCents}
                onChange={(e) => setCostCents(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
              />
              <span className="text-[10px] text-slate-500">{formatCents(costCents)}</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Catalogue Status</label>
              <select
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="true">Active (Available for menus)</option>
                <option value="false">Deactivated (Soft deleted)</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>
        </Card>

        {/* Option Groups Editor Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>Option Groups for this Dish</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure customizable groups (e.g. Choose your Protein, Choice of Rice, Extra Toppings)
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setGroupName('');
                setGroupRequired(true);
                setGroupUsesPortions(false);
                setSelectedOptionIds([]);
                setGroupModalOpen(true);
              }}
              className="text-xs"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Add Option Group
            </Button>
          </div>

          {groupsLoading ? (
            <div className="py-16 text-center text-slate-500 text-xs">Loading option groups...</div>
          ) : groups && groups.length > 0 ? (
            <div className="space-y-4">
              {groups.map((group: any) => (
                <Card key={group.id} className="p-5 bg-slate-900/60 border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{group.name}</span>
                      {group.required ? (
                        <Badge variant="default" className="text-[10px]">
                          Required Choice
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Optional Choice
                        </Badge>
                      )}
                      {group.usesPortions && (
                        <Badge variant="info" className="text-[10px]">
                          Uses Portions / Sizes
                        </Badge>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteGroupMutation.mutate(group.id)}
                      className="text-rose-400 hover:text-rose-300 h-7 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Group
                    </Button>
                  </div>

                  {/* Options included in this group */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase">
                      Available Options in this Group
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {group.options?.map((optRel: any) => {
                        const opt = optRel.option || optRel;
                        return (
                          <div
                            key={opt.id}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center gap-2"
                          >
                            <span className="font-medium text-slate-200">{opt.name}</span>
                            <span className="text-emerald-400 font-mono text-[11px]">
                              cost: {formatCents(opt.costCents)}
                            </span>
                          </div>
                        );
                      })}
                      {(!group.options || group.options.length === 0) && (
                        <span className="text-slate-500 text-xs italic">
                          No options linked to this group yet.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Portions if usesPortions */}
                  {group.usesPortions && group.portions?.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                      <strong>Supported Portion Sizes:</strong>{' '}
                      {group.portions
                        .map(
                          (p: any) =>
                            `${p.portionSize?.name} (+${formatCents(p.extraCents)})`
                        )
                        .join(', ')}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-slate-500 text-xs border-dashed border-slate-800">
              No option groups configured for this dish. Customers will order this dish as a standard single recipe.
            </Card>
          )}
        </div>

        {/* Add Group Modal */}
        <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Option Group to {dish.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Choose Your Protein"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupRequired}
                    onChange={(e) => setGroupRequired(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Required choice (Must pick one)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupUsesPortions}
                    onChange={(e) => setGroupUsesPortions(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Uses portion sizes (e.g. Regular, Large)</span>
                </label>
              </div>

              {/* Options multi-select */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">
                  Select Options to include in this group:
                </span>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-850 border border-slate-800 rounded-lg p-2 bg-slate-950">
                  {optionsData?.options?.map((opt: any) => {
                    const isSelected = selectedOptionIds.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className="py-1.5 px-2 flex items-center justify-between cursor-pointer hover:bg-slate-900 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedOptionIds(
                                isSelected
                                  ? selectedOptionIds.filter((id) => id !== opt.id)
                                  : [...selectedOptionIds, opt.id]
                              );
                            }}
                            className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                          />
                          <span className="text-slate-200">{opt.name}</span>
                        </div>
                        <span className="text-emerald-400 font-mono text-[11px]">
                          {formatCents(opt.costCents)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setGroupModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!groupName.trim() || selectedOptionIds.length === 0}
                onClick={() =>
                  createGroupMutation.mutate({
                    name: groupName,
                    required: groupRequired,
                    usesPortions: groupUsesPortions,
                    optionIds: selectedOptionIds,
                  })
                }
                loading={createGroupMutation.isPending}
              >
                Create Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
