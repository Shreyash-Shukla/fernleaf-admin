'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  UtensilsCrossed,
  PlusCircle,
  Search,
  ArrowRight,
  Flame,
  ChefHat,
  Filter,
} from 'lucide-react';

export default function DishesListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [stationId, setStationId] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

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
      toast.success('Dish created! Configure option groups in detail view.');
      setCreateModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      // Redirect to dish detail to edit groups
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

  const dishes = dishesData?.dishes || [];

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-emerald-400" />
              <span>Dishes Catalogue</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage core meals, prep stations, allergen tagging, and option groups
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateModalOpen(true);
            }}
            className="text-xs"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Create Dish
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-slate-900/60 border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search dish name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="min-w-[180px]">
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Kitchen Stations</option>
                {stationsData?.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-slate-400 text-xs">
            Showing <strong>{dishes.length}</strong> dishes
          </span>
        </Card>

        {/* Dishes Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading dishes catalogue...</div>
        ) : dishes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dishes.map((dish) => (
              <Card
                key={dish.id}
                className="p-5 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-white">{dish.name}</h3>
                      <div className="text-[11px] font-mono text-slate-400">SKU: {dish.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-400">
                        Cost: {formatCents(dish.costCents)}
                      </div>
                      <Badge variant="outline" className="text-[9px] py-0 mt-0.5">
                        {dish.temperature}
                      </Badge>
                    </div>
                  </div>

                  {dish.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{dish.description}</p>
                  )}

                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[9px] py-0">
                      Station: {dish.station?.name || 'Unassigned'}
                    </Badge>
                    {dish.minOrderQty && dish.minOrderQty > 1 && (
                      <Badge variant="outline" className="text-[9px] py-0">
                        Min Qty: {dish.minOrderQty}
                      </Badge>
                    )}
                    {dish.allergens?.map((a: any) => (
                      <span
                        key={a.id || a.allergenId}
                        className="text-[9px] text-amber-300 bg-amber-950/40 border border-amber-900/40 px-1 py-0.5 rounded"
                      >
                        {a.allergen?.name || a.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between mt-4">
                  <span className="text-[11px] text-slate-500">
                    {dish.optionGroups?.length || 0} option group(s)
                  </span>
                  <Link href={`/catalogue/dishes/${dish.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Edit Groups & Details <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500 text-xs">No dishes found.</div>
        )}

        {/* Create Dish Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Dish</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BOWL-01"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Dish Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paneer Tikka Rice Bowl"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Short description of the dish..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Cost (Cents) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={costCents}
                    onChange={(e) => setCostCents(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                  <span className="text-[10px] text-slate-500">{formatCents(costCents)}</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Temperature</label>
                  <select
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="HOT">Hot</option>
                    <option value="COLD">Cold</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Station</label>
                  <select
                    value={formStationId}
                    onChange={(e) => setFormStationId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
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
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
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
                Create Dish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
