'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { extractList, formatCents } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  UtensilsCrossed,
  PlusCircle,
  Eye,
  Plus,
  Trash2,
  Lock,
  Layers,
  Sparkles,
  User,
  Building,
} from 'lucide-react';

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('categories');

  // Preview State
  const [previewEmployeeId, setPreviewEmployeeId] = useState('');
  const [previewSlug, setPreviewSlug] = useState('');

  // Add Category Modal State
  const [addCatModalOpen, setAddCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catIsSecret, setCatIsSecret] = useState(false);

  // Add Item to Category Modal State
  const [selectedCatForAdd, setSelectedCatForAdd] = useState<any>(null);
  const [selectedDishId, setSelectedDishId] = useState('');

  // 1. Fetch Categories (including secret)
  const { data: categories, isLoading: catsLoading } = useQuery<any[]>({
    queryKey: ['menu-categories', 'all'],
    queryFn: () => fetchApi('/menu-categories?includeSecret=true'),
  });

  // 2. Fetch All Dishes for assigning to categories
  const { data: dishesData } = useQuery<{ dishes: any[] }>({
    queryKey: ['dishes', 'all-for-menu'],
    queryFn: () => fetchApi('/dishes?limit=100&active=true'),
  });

  // 3. Fetch Employees for Preview Tab
  const { data: employeesData } = useQuery<{ employees: any[] }>({
    queryKey: ['employees', 'for-preview'],
    queryFn: () => fetchApi('/employees?limit=100'),
  });

  // 4. Fetch Resolved Menu for Preview
  const previewParams = new URLSearchParams();
  if (previewEmployeeId) previewParams.set('employeeId', previewEmployeeId);
  if (previewSlug) previewParams.set('slug', previewSlug);

  const { data: previewData, isLoading: previewLoading } = useQuery<any>({
    queryKey: ['menu', 'preview', previewParams.toString()],
    queryFn: () => fetchApi(`/menu/preview?${previewParams.toString()}`),
    enabled: activeTab === 'preview',
  });

  // Create Category Mutation
  const createCategoryMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi('/menu-categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Menu category created');
      setAddCatModalOpen(false);
      setCatName('');
      setCatSlug('');
      setCatIsSecret(false);
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create category'),
  });

  // Add Item to Category Mutation
  const addItemMutation = useMutation({
    mutationFn: ({ categoryId, dishId }: { categoryId: string; dishId: string }) =>
      fetchApi(`/menu-categories/${categoryId}/items`, {
        method: 'POST',
        body: JSON.stringify({ dishId }),
      }),
    onSuccess: () => {
      toast.success('Dish assigned to category');
      setSelectedCatForAdd(null);
      setSelectedDishId('');
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add dish to category'),
  });

  // Remove Item Mutation
  const removeItemMutation = useMutation({
    mutationFn: (menuItemId: string) =>
      fetchApi(`/menu-items/${menuItemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Dish unlinked from category');
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to remove dish'),
  });

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-emerald-400" />
              <span>Menu Management</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Organize categories, assign dishes, and preview the live menu experienced by any employee
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setCatName('');
              setCatSlug('');
              setCatIsSecret(false);
              setAddCatModalOpen(true);
            }}
            className="text-xs"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Menu Category
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="categories" className="text-xs">
              Categories & Dishes Structure
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">
              Preview as Employee (Resolved Tier Pricing)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Categories Structure */}
          <TabsContent value="categories" className="space-y-4">
            {catsLoading ? (
              <div className="py-20 text-center text-slate-500 text-xs">Loading categories...</div>
            ) : categories && categories.length > 0 ? (
              <div className="space-y-6">
                {categories.map((cat: any) => (
                  <Card key={cat.id} className="p-5 bg-slate-900/60 border-slate-800 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-white">{cat.name}</span>
                        <span className="text-xs font-mono text-slate-400">/{cat.slug}</span>
                        {cat.isSecret && (
                          <Badge variant="warning" className="text-[10px] flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Secret Category
                          </Badge>
                        )}
                        {!cat.active && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCatForAdd(cat);
                          setSelectedDishId('');
                        }}
                        className="h-7 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Dish
                      </Button>
                    </div>

                    {/* Items in Category */}
                    <div className="space-y-2">
                      {cat.items?.map((item: any) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-200">{item.dish?.name}</span>
                            <span className="text-[11px] font-mono text-slate-500 ml-2">
                              SKU: {item.dish?.sku}
                            </span>
                            <span className="text-slate-400 ml-3">
                              Cost: {formatCents(item.dish?.costCents)}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItemMutation.mutate(item.id)}
                            className="h-6 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}

                      {(!cat.items || cat.items.length === 0) && (
                        <div className="text-slate-500 text-xs italic py-2">
                          No dishes assigned to this category yet.
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-slate-500 text-xs">
                No menu categories created yet.
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Live Employee Preview */}
          <TabsContent value="preview" className="space-y-4">
            <Card className="p-4 bg-slate-900/60 border-slate-800 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex-1 min-w-[240px]">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Preview as Specific Employee
                </label>
                <select
                  value={previewEmployeeId}
                  onChange={(e) => setPreviewEmployeeId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                >
                  <option value="">Default Preview (Default Tier)</option>
                  {extractList(employeesData).map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.company?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[200px]">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Secret Category Slug (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. executive-dining"
                  value={previewSlug}
                  onChange={(e) => setPreviewSlug(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>

              {previewData?.tier && (
                <div className="pt-4 text-right">
                  <span className="text-[11px] text-slate-400">Effective Tier:</span>
                  <div className="font-bold text-emerald-400 text-sm">
                    {previewData.tier.name}
                  </div>
                </div>
              )}
            </Card>

            {/* Resolved Menu Grid */}
            {previewLoading ? (
              <div className="py-20 text-center text-slate-500 text-xs">
                Resolving menu and tier prices...
              </div>
            ) : previewData?.categories?.length > 0 ? (
              <div className="space-y-6">
                {previewData.categories.map((category: any) => (
                  <div key={category.id} className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span>{category.name}</span>
                      <span className="text-slate-500 text-xs font-normal">
                        {category.dishes?.length || 0} orderable dish(es)
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.dishes?.map((dish: any) => (
                        <Card key={dish.id} className="p-4 bg-slate-900/60 border-slate-800 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-sm text-white">{dish.name}</h4>
                              <span className="text-[11px] font-mono text-slate-400">
                                SKU: {dish.sku}
                              </span>
                            </div>
                            <span className="font-bold text-sm text-emerald-400">
                              {formatCents(dish.priceCents)}
                            </span>
                          </div>

                          {dish.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">{dish.description}</p>
                          )}

                          {/* Options in groups */}
                          {dish.optionGroups?.length > 0 && (
                            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] space-y-1.5">
                              <span className="font-semibold text-slate-300 block">
                                Customization Options:
                              </span>
                              {dish.optionGroups.map((group: any) => (
                                <div key={group.id} className="text-slate-400">
                                  <strong className="text-slate-200">{group.name}:</strong>{' '}
                                  {group.options
                                    .map((o: any) => `${o.name} (${formatCents(o.priceCents)})`)
                                    .join(', ')}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-slate-500 text-xs">
                No dishes orderable for this employee on their effective tier.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Category Modal */}
        <Dialog open={addCatModalOpen} onOpenChange={setAddCatModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Menu Category</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bowls & Curries"
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!catSlug) {
                      setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  URL Slug * (Unique)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. bowls-and-curries"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catIsSecret}
                    onChange={(e) => setCatIsSecret(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Secret category (Hidden from standard listing; reachable by slug)</span>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddCatModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!catName.trim() || !catSlug.trim()}
                onClick={() =>
                  createCategoryMutation.mutate({
                    name: catName,
                    slug: catSlug,
                    isSecret: catIsSecret,
                  })
                }
                loading={createCategoryMutation.isPending}
              >
                Create Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Dish to Category Modal */}
        <Dialog open={!!selectedCatForAdd} onOpenChange={(open) => !open && setSelectedCatForAdd(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Dish to {selectedCatForAdd?.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Select Dish</label>
              <select
                value={selectedDishId}
                onChange={(e) => setSelectedDishId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
              >
                <option value="">Select a dish from catalogue...</option>
                {extractList(dishesData).map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.sku}) — Cost {formatCents(d.costCents)}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setSelectedCatForAdd(null)}>
                Cancel
              </Button>
              <Button
                disabled={!selectedDishId}
                onClick={() =>
                  addItemMutation.mutate({
                    categoryId: selectedCatForAdd.id,
                    dishId: selectedDishId,
                  })
                }
                loading={addItemMutation.isPending}
              >
                Add Dish to Menu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
