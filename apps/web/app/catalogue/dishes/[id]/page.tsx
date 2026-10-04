'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Layers,
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
        <div className="py-24 text-center text-muted text-xs">Loading dish details…</div>
      </AppShell>
    );
  }

  if (!dish) {
    return (
      <AppShell requiredPermission="catalogue:read">
        <div className="py-24 text-center text-muted">
          <p>Dish not found.</p>
          <Button onClick={() => router.push('/catalogue/dishes')} className="mt-3">
            Back to dishes
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/catalogue/dishes')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-text">{dish.name}</h1>
                <StatusBadge status={dish.active ? 'Ready' : 'Cancelled'} label={dish.active ? 'Active' : 'Deactivated'} />
              </div>
              <div className="text-xs text-muted mt-0.5 font-mono flex items-center gap-2">
                <span>SKU: {dish.sku}</span>
                <span>·</span>
                <span>Station: {dish.station?.name || 'Unassigned'}</span>
              </div>
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
          >
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save dish
          </Button>
        </div>

        {/* Dish Basic Settings */}
        <Card className="p-4 bg-surface border border-border space-y-4">
          <div className="text-sm font-semibold text-text">General information</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-xs font-medium text-text block mb-1">Dish name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">
                Internal base cost (cents)
              </label>
              <Input
                type="number"
                value={costCents}
                onChange={(e) => setCostCents(parseInt(e.target.value, 10) || 0)}
              />
              <span className="text-[11px] text-muted tabular-nums mt-0.5 block">{formatCents(costCents)}</span>
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">Catalogue status</label>
              <select
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
              >
                <option value="true">Active (Available for menus)</option>
                <option value="false">Deactivated (Soft deleted)</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs font-medium text-text block mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-app border border-border rounded-md text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-solid"
              />
            </div>
          </div>
        </Card>

        {/* Option Groups Editor Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-text">
                Option groups for this dish
              </h2>
              <p className="text-xs text-muted">
                Configure customizable groups (e.g. Choose protein, choice of rice, extra toppings)
              </p>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setGroupName('');
                setGroupRequired(true);
                setGroupUsesPortions(false);
                setSelectedOptionIds([]);
                setGroupModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add option group
            </Button>
          </div>

          {groupsLoading ? (
            <div className="py-12 text-center text-muted text-xs">Loading option groups…</div>
          ) : groups && groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group: any) => (
                <div key={group.id} className="p-4 bg-surface border border-border rounded-lg space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-text">{group.name}</span>
                      <Chip>{group.required ? 'Required choice' : 'Optional choice'}</Chip>
                      {group.usesPortions && (
                        <Chip>Portion sizes</Chip>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteGroupMutation.mutate(group.id)}
                      className="text-danger hover:text-danger h-7 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                  </div>

                  {/* Options included in this group */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                      Available options in this group
                    </div>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {group.options?.map((optRel: any) => {
                        const opt = optRel.option || optRel;
                        return (
                          <div
                            key={opt.id}
                            className="px-2.5 py-1 rounded-md bg-app border border-border text-xs flex items-center gap-2"
                          >
                            <span className="font-medium text-text">{opt.name}</span>
                            <span className="text-muted font-mono text-[11px] tabular-nums">
                              {formatCents(opt.costCents)}
                            </span>
                          </div>
                        );
                      })}
                      {(!group.options || group.options.length === 0) && (
                        <span className="text-muted text-xs italic">
                          No options linked to this group yet.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Portions if usesPortions */}
                  {group.usesPortions && group.portions?.length > 0 && (
                    <div className="pt-2 border-t border-border text-xs text-muted">
                      <strong className="text-text font-medium">Supported portion sizes:</strong>{' '}
                      {group.portions
                        .map(
                          (p: any) =>
                            `${p.portionSize?.name} (+${formatCents(p.extraCents)})`
                        )
                        .join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted text-xs border border-dashed border-border rounded-lg bg-surface">
              No option groups configured for this dish. Customers will order this dish as a standard single recipe.
            </div>
          )}
        </div>

        {/* Add Group Modal */}
        <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add option group to {dish.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Group name *
                </label>
                <Input
                  required
                  placeholder="e.g. Choose Your Protein"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupRequired}
                    onChange={(e) => setGroupRequired(e.target.checked)}
                    className="rounded bg-app border-border text-brand-solid focus:ring-brand-solid"
                  />
                  <span>Required choice (Must pick one)</span>
                </label>

                <label className="flex items-center gap-2 text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupUsesPortions}
                    onChange={(e) => setGroupUsesPortions(e.target.checked)}
                    className="rounded bg-app border-border text-brand-solid focus:ring-brand-solid"
                  />
                  <span>Uses portion sizes (e.g. Regular, Large)</span>
                </label>
              </div>

              {/* Options multi-select */}
              <div className="pt-2 border-t border-border space-y-2">
                <span className="font-medium text-text block">
                  Select options to include in this group:
                </span>
                <div className="max-h-48 overflow-y-auto divide-y divide-border border border-border rounded-md p-2 bg-app">
                  {optionsData?.options?.map((opt: any) => {
                    const isSelected = selectedOptionIds.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className="py-1.5 px-2 flex items-center justify-between cursor-pointer hover:bg-raised rounded"
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
                            className="rounded bg-surface border-border text-brand-solid focus:ring-brand-solid"
                          />
                          <span className="text-text">{opt.name}</span>
                        </div>
                        <span className="text-muted font-mono text-[11px] tabular-nums">
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
                Create group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
