'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Sliders,
  Plus,
  AlertTriangle,
  Tag,
  ChefHat,
  Maximize2,
  CheckCircle2,
} from 'lucide-react';

export default function ReferenceDataPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('stations');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'station' | 'allergen' | 'tag' | 'portion'>('station');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState<number>(0);

  // Queries
  const { data: stations, isLoading: sLoading } = useQuery<any[]>({
    queryKey: ['ref', 'stations'],
    queryFn: () => fetchApi('/ref/stations'),
  });

  const { data: allergens, isLoading: aLoading } = useQuery<any[]>({
    queryKey: ['ref', 'allergens'],
    queryFn: () => fetchApi('/ref/allergens'),
  });

  const { data: dietaryTags, isLoading: tLoading } = useQuery<any[]>({
    queryKey: ['ref', 'dietary-tags'],
    queryFn: () => fetchApi('/ref/dietary-tags'),
  });

  const { data: portionSizes, isLoading: pLoading } = useQuery<any[]>({
    queryKey: ['ref', 'portion-sizes'],
    queryFn: () => fetchApi('/ref/portion-sizes'),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: { type: string; name: string; sortOrder?: number }) => {
      switch (payload.type) {
        case 'station':
          return fetchApi('/ref/stations', {
            method: 'POST',
            body: JSON.stringify({ name: payload.name, sortOrder: payload.sortOrder }),
          });
        case 'allergen':
          return fetchApi('/ref/allergens', {
            method: 'POST',
            body: JSON.stringify({ name: payload.name }),
          });
        case 'tag':
          return fetchApi('/ref/dietary-tags', {
            method: 'POST',
            body: JSON.stringify({ name: payload.name }),
          });
        case 'portion':
          return fetchApi('/ref/portion-sizes', {
            method: 'POST',
            body: JSON.stringify({ name: payload.name, sortOrder: payload.sortOrder }),
          });
        default:
          throw new Error('Unknown type');
      }
    },
    onSuccess: (_, vars) => {
      toast.success('Reference entry added successfully');
      setModalOpen(false);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['ref'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create reference entry'),
  });

  // Toggle active status
  const toggleMutation = useMutation({
    mutationFn: ({ type, id, active }: { type: string; id: string; active: boolean }) => {
      const endpoint =
        type === 'station'
          ? `/ref/stations/${id}`
          : type === 'allergen'
          ? `/ref/allergens/${id}`
          : type === 'tag'
          ? `/ref/dietary-tags/${id}`
          : `/ref/portion-sizes/${id}`;

      return fetchApi(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      });
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['ref'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update status'),
  });

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-emerald-400" />
              <span>Reference Data</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure platform kitchen stations, allergen definitions, dietary labels, and portion sizes
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="stations" className="text-xs">
              Kitchen Stations ({stations?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="allergens" className="text-xs">
              Allergens ({allergens?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="tags" className="text-xs">
              Dietary Tags ({dietaryTags?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="portions" className="text-xs">
              Portion Sizes ({portionSizes?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Kitchen Stations */}
          <TabsContent value="stations" className="space-y-4">
            <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white flex items-center gap-1.5">
                    <ChefHat className="w-4 h-4 text-emerald-400" /> Kitchen Stations
                  </h3>
                  <p className="text-xs text-slate-400">
                    Prep routing areas in the commercial kitchen (e.g. Grill, Salads, Packing, Curries)
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setModalType('station');
                    setName('');
                    setSortOrder(stations?.length ? stations.length + 1 : 1);
                    setModalOpen(true);
                  }}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Station
                </Button>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                {stations?.map((st) => (
                  <div key={st.id} className="p-3 bg-slate-950/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white">{st.name}</span>
                      <span className="text-[11px] text-slate-500 ml-2">Order: #{st.sortOrder}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={st.active ? 'secondary' : 'outline'}
                      onClick={() =>
                        toggleMutation.mutate({ type: 'station', id: st.id, active: !st.active })
                      }
                      className="h-7 text-[11px]"
                    >
                      {st.active ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: Allergens */}
          <TabsContent value="allergens" className="space-y-4">
            <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Standard Allergens
                  </h3>
                  <p className="text-xs text-slate-400">
                    Allergen tags matched against customer preferences during order placement
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setModalType('allergen');
                    setName('');
                    setModalOpen(true);
                  }}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Allergen
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {allergens?.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-200">{a.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toggleMutation.mutate({ type: 'allergen', id: a.id, active: !a.active })
                      }
                      className="h-6 text-[10px]"
                    >
                      {a.active ? 'Active' : 'Disabled'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Dietary Tags */}
          <TabsContent value="tags" className="space-y-4">
            <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-400" /> Dietary Preferences
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dietary tags (e.g. Vegan, Jain, Gluten-Free, Halal, High-Protein)
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setModalType('tag');
                    setName('');
                    setModalOpen(true);
                  }}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Tag
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {dietaryTags?.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-200">{t.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toggleMutation.mutate({ type: 'tag', id: t.id, active: !t.active })
                      }
                      className="h-6 text-[10px]"
                    >
                      {t.active ? 'Active' : 'Disabled'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 4: Portion Sizes */}
          <TabsContent value="portions" className="space-y-4">
            <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white flex items-center gap-1.5">
                    <Maximize2 className="w-4 h-4 text-sky-400" /> Portion Sizes
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sizes for dishes and option groups (e.g. Regular, Large, Double Protein)
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setModalType('portion');
                    setName('');
                    setSortOrder(portionSizes?.length ? portionSizes.length + 1 : 1);
                    setModalOpen(true);
                  }}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Portion Size
                </Button>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                {portionSizes?.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-950/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white">{p.name}</span>
                      <span className="text-[11px] text-slate-500 ml-2">Order: #{p.sortOrder}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={p.active ? 'secondary' : 'outline'}
                      onClick={() =>
                        toggleMutation.mutate({ type: 'portion', id: p.id, active: !p.active })
                      }
                      className="h-7 text-[11px]"
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Entry Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="capitalize">Add {modalType}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Name *</label>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${
                    modalType === 'station'
                      ? 'Grill & Roast'
                      : modalType === 'allergen'
                      ? 'Shellfish'
                      : modalType === 'tag'
                      ? 'High-Protein'
                      : 'Extra Large'
                  }`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              {(modalType === 'station' || modalType === 'portion') && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Display Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!name.trim()}
                onClick={() =>
                  createMutation.mutate({
                    type: modalType,
                    name,
                    sortOrder,
                  })
                }
                loading={createMutation.isPending}
              >
                Add Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
