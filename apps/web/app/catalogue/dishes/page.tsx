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
import Link from 'next/link';
import {
  UtensilsCrossed,
  Plus,
  Search,
  ArrowRight,
  Filter,
  Layers,
} from 'lucide-react';

export default function DishesListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [stationId, setStationId] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [inspectDish, setInspectDish] = useState<any>(null);

  // Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costCents, setCostCents] = useState<number>(500);
  const [temperature, setTemperature] = useState<'HOT' | 'COLD'>('HOT');
  const [formStationId, setFormStationId] = useState('');
  const [minOrderQty, setMinOrderQty] = useState<number>(1);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 1. Fetch Stations & Reference Data
  const { data: stationsData } = useQuery<any[]>({
    queryKey: ['ref', 'stations'],
    queryFn: () => fetchApi('/ref/stations'),
  });
  const { data: allergensData } = useQuery<any[]>({
    queryKey: ['ref', 'allergens'],
    queryFn: () => fetchApi('/ref/allergens'),
  });
  const { data: dietaryTagsData } = useQuery<any[]>({
    queryKey: ['ref', 'dietary-tags'],
    queryFn: () => fetchApi('/ref/dietary-tags'),
  });

  // 2. Fetch Dishes List
  const queryParams = new URLSearchParams();
  queryParams.set('limit', '100');
  if (search) queryParams.set('q', search);
  if (stationId) queryParams.set('stationId', stationId);

  const { data: dishesData, isLoading } = useQuery<{ dishes: any[] }>({
    queryKey: ['dishes', 'list', queryParams.toString()],
    queryFn: () => fetchApi(`/dishes?${queryParams.toString()}`),
  });

  // Create Dish Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi('/dishes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (newDish) => {
      toast.success('Dish created. Configure option groups in detail view.');
      setCreateDrawerOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      if (newDish?.id) {
        window.location.href = `/catalogue/dishes/${newDish.id}`;
      }
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create dish'),
  });

  function resetForm() {
    setSku('');
    setName('');
    setDescription('');
    setCostCents(500);
    setTemperature('HOT');
    setFormStationId('');
    setMinOrderQty(1);
    setSelectedAllergens([]);
    setSelectedTags([]);
  }

  const dishes = extractList(dishesData);

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Dishes Catalogue"
          subtitle="Manage core meals, prep stations, allergen tagging, and option groups"
          actions={
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setCreateDrawerOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create dish
            </Button>
          }
        />

        {/* Context Bar */}
        <div className="h-10 px-3 bg-surface border border-border rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search dish or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 bg-app border border-border rounded-md text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-solid"
              />
            </div>

            <div className="w-48">
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
              >
                <option value="">All stations</option>
                {stationsData?.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
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
              Showing <strong className="text-text font-semibold">{dishes.length}</strong> dishes
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : dishes.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No dishes found"
              description="Try adjusting your search query or station filter."
              actionLabel="Create dish"
              onAction={() => setCreateDrawerOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table compact={isCompact}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">SKU</TableHead>
                    <TableHead>Dish name</TableHead>
                    <TableHead className="w-36">Station</TableHead>
                    <TableHead className="w-24">Temp</TableHead>
                    <TableHead className="w-48">Allergens</TableHead>
                    <TableHead className="w-28 text-right">Option groups</TableHead>
                    <TableHead className="w-28 text-right">Unit cost</TableHead>
                    <TableHead className="w-32 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dishes.map((dish) => (
                    <TableRow
                      key={dish.id}
                      onClick={() => setInspectDish(dish)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs text-muted">
                        {dish.sku}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-text">{dish.name}</div>
                        {dish.description && (
                          <div className="text-xs text-muted truncate max-w-md">
                            {dish.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {dish.station?.name ? (
                          <Chip>{dish.station.name}</Chip>
                        ) : (
                          <span className="text-muted text-xs">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip>{dish.temperature}</Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {dish.allergens && dish.allergens.length > 0 ? (
                            dish.allergens.map((a: any) => (
                              <Chip key={a.id || a.allergenId}>
                                {a.allergen?.name || a.name}
                              </Chip>
                            ))
                          ) : (
                            <span className="text-faint text-xs">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted">
                        {dish.optionGroups?.length || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-text">
                        {formatCents(dish.costCents)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/catalogue/dishes/${dish.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-brand-text">
                            Configure <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="h-10 px-4 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>Showing 1–{dishes.length} of {dishes.length}</span>
          </div>
        </div>

        {/* Create Dish Drawer */}
        <Drawer
          open={createDrawerOpen}
          onClose={() => setCreateDrawerOpen(false)}
          title="Create dish"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text block mb-1">SKU *</label>
                <Input
                  required
                  placeholder="e.g. BOWL-01"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text block mb-1">Dish name *</label>
                <Input
                  required
                  placeholder="e.g. Paneer Tikka Rice Bowl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Short description of ingredients and preparation…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-app border border-border rounded-md text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-solid"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-text block mb-1">Cost (cents) *</label>
                <Input
                  type="number"
                  min={1}
                  value={costCents}
                  onChange={(e) => setCostCents(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[11px] text-muted tabular-nums mt-0.5 block">{formatCents(costCents)}</span>
              </div>

              <div>
                <label className="text-xs font-medium text-text block mb-1">Temperature</label>
                <select
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value as any)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                >
                  <option value="HOT">Hot</option>
                  <option value="COLD">Cold</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text block mb-1">Station</label>
                <select
                  value={formStationId}
                  onChange={(e) => setFormStationId(e.target.value)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                >
                  <option value="">Unassigned</option>
                  {stationsData?.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text block mb-1">Min order quantity</label>
              <Input
                type="number"
                min={1}
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            {/* Sticky Drawer Footer */}
            <div className="pt-4 border-t border-border flex items-center justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setCreateDrawerOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    sku,
                    name,
                    description,
                    costCents,
                    temperature,
                    stationId: formStationId || undefined,
                    minOrderQty,
                    allergenIds: selectedAllergens,
                    dietaryTagIds: selectedTags,
                  })
                }
                loading={createMutation.isPending}
              >
                Create dish
              </Button>
            </div>
          </div>
        </Drawer>

        {/* Quick Inspection Drawer */}
        <Drawer
          open={!!inspectDish}
          onClose={() => setInspectDish(null)}
          title={inspectDish?.name || 'Dish details'}
        >
          {inspectDish && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 py-2 border-b border-border">
                <div>
                  <span className="text-muted block text-[11px] uppercase tracking-wider">SKU</span>
                  <span className="font-mono text-sm">{inspectDish.sku}</span>
                </div>
                <div>
                  <span className="text-muted block text-[11px] uppercase tracking-wider">Unit cost</span>
                  <span className="font-semibold text-sm tabular-nums">{formatCents(inspectDish.costCents)}</span>
                </div>
              </div>

              <div>
                <span className="text-muted block text-[11px] uppercase tracking-wider mb-1">Description</span>
                <p className="text-text leading-relaxed">
                  {inspectDish.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2 border-y border-border">
                <div>
                  <span className="text-muted block text-[11px] uppercase tracking-wider mb-1">Station</span>
                  <span>{inspectDish.station?.name || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-muted block text-[11px] uppercase tracking-wider mb-1">Temperature</span>
                  <Chip>{inspectDish.temperature}</Chip>
                </div>
              </div>

              <div>
                <span className="text-muted block text-[11px] uppercase tracking-wider mb-1">Allergens</span>
                <div className="flex flex-wrap gap-1">
                  {inspectDish.allergens && inspectDish.allergens.length > 0 ? (
                    inspectDish.allergens.map((a: any) => (
                      <Chip key={a.id || a.allergenId}>{a.allergen?.name || a.name}</Chip>
                    ))
                  ) : (
                    <span className="text-muted">None specified</span>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-border">
                <Button variant="ghost" onClick={() => setInspectDish(null)}>
                  Close
                </Button>
                <Link href={`/catalogue/dishes/${inspectDish.id}`}>
                  <Button size="sm">
                    Configure option groups <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}
