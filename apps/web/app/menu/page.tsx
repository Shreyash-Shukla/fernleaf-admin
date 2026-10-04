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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  Lock,
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
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Menu & Catalogue"
          subtitle="Organize categories, assign dishes, and preview the live menu experienced by any employee"
          actions={
            <Button
              size="sm"
              onClick={() => {
                setCatName('');
                setCatSlug('');
                setCatIsSecret(false);
                setAddCatModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add category
            </Button>
          }
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="categories">
              Categories & dishes structure
            </TabsTrigger>
            <TabsTrigger value="preview">
              Preview as employee
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Categories Structure */}
          <TabsContent value="categories" className="space-y-4">
            {catsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : categories && categories.length > 0 ? (
              <div className="space-y-4">
                {categories.map((cat: any) => (
                  <div key={cat.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                    <div className="p-3.5 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-text">{cat.name}</span>
                        <span className="text-xs text-muted">/{cat.slug}</span>
                        {cat.isSecret && (
                          <Chip>Secret</Chip>
                        )}
                        {!cat.active && (
                          <StatusBadge status="Cancelled" label="Inactive" />
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedCatForAdd(cat);
                          setSelectedDishId('');
                        }}
                        className="h-7 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add dish
                      </Button>
                    </div>

                    {/* Items in Category */}
                    <div className="divide-y divide-border">
                      {cat.items?.map((item: any) => (
                        <div
                          key={item.id}
                          className="h-11 px-4 flex items-center justify-between text-xs hover:bg-raised transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-text">{item.dish?.name}</span>
                            <span className="font-mono text-muted text-[11px] tabular-nums">
                              SKU: {item.dish?.sku}
                            </span>
                            <span className="text-muted tabular-nums">
                              Cost: {formatCents(item.dish?.costCents)}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItemMutation.mutate(item.id)}
                            className="h-7 px-2 text-xs text-danger hover:text-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}

                      {(!cat.items || cat.items.length === 0) && (
                        <div className="p-6 text-center text-muted text-xs">
                          No dishes assigned to this category yet.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={UtensilsCrossed}
                title="No menu categories"
                description="Create categories to organize dishes into customer menus."
                actionLabel="Add category"
                onAction={() => setAddCatModalOpen(true)}
              />
            )}
          </TabsContent>

          {/* TAB 2: Live Employee Preview */}
          <TabsContent value="preview" className="space-y-4">
            <div className="h-12 px-3 bg-surface border border-border rounded-lg flex items-center gap-4 text-xs">
              <div className="flex-1 max-w-sm">
                <select
                  value={previewEmployeeId}
                  onChange={(e) => setPreviewEmployeeId(e.target.value)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                >
                  <option value="">Default preview (Default tier)</option>
                  {extractList(employeesData).map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.company?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-64">
                <Input
                  placeholder="Secret category slug (optional)"
                  value={previewSlug}
                  onChange={(e) => setPreviewSlug(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {previewData?.tier && (
                <div className="text-xs text-muted tabular-nums ml-auto">
                  Effective tier: <strong className="text-text font-medium">{previewData.tier.name}</strong>
                </div>
              )}
            </div>

            {/* Resolved Menu Grid */}
            {previewLoading ? (
              <div className="p-12 text-center text-muted text-xs">
                Resolving menu and tier prices…
              </div>
            ) : previewData?.categories?.length > 0 ? (
              <div className="space-y-6">
                {previewData.categories.map((category: any) => (
                  <div key={category.id} className="space-y-3">
                    <div className="border-b border-border pb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-text uppercase tracking-wider">
                        {category.name}
                      </span>
                      <span className="text-muted text-xs tabular-nums">
                        {category.dishes?.length || 0} dish(es)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.dishes?.map((dish: any) => (
                        <div key={dish.id} className="p-4 bg-surface border border-border rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-sm text-text">{dish.name}</div>
                              <span className="text-[11px] font-mono text-muted tabular-nums">
                                SKU: {dish.sku}
                              </span>
                            </div>
                            <span className="font-semibold text-sm tabular-nums text-text">
                              {formatCents(dish.priceCents)}
                            </span>
                          </div>

                          {dish.description && (
                            <p className="text-xs text-muted line-clamp-2">{dish.description}</p>
                          )}

                          {dish.optionGroups?.length > 0 && (
                            <div className="pt-2 border-t border-border text-[11px] space-y-1">
                              <span className="font-medium text-muted block uppercase tracking-wider text-[10px]">
                                Customizations:
                              </span>
                              {dish.optionGroups.map((group: any) => (
                                <div key={group.id} className="text-muted">
                                  <strong className="text-text font-normal">{group.name}:</strong>{' '}
                                  {group.options
                                    .map((o: any) => `${o.name} (${formatCents(o.priceCents)})`)
                                    .join(', ')}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted text-xs bg-surface border border-border rounded-lg">
                No dishes orderable for this employee on their effective tier.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Category Modal */}
        <Dialog open={addCatModalOpen} onOpenChange={setAddCatModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add menu category</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  Category name *
                </label>
                <Input
                  required
                  placeholder="e.g. Bowls & Curries"
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!catSlug) {
                      setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text block mb-1">
                  URL slug * (unique)
                </label>
                <Input
                  required
                  placeholder="e.g. bowls-and-curries"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                />
              </div>

              <div className="pt-2 border-t border-border">
                <label className="flex items-center gap-2 text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catIsSecret}
                    onChange={(e) => setCatIsSecret(e.target.checked)}
                    className="rounded bg-app border-border text-brand-solid focus:ring-brand-solid"
                  />
                  <span>Secret category (Hidden from standard listing; accessible via slug)</span>
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
                Create category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Dish to Category Modal */}
        <Dialog open={!!selectedCatForAdd} onOpenChange={(open) => !open && setSelectedCatForAdd(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add dish to {selectedCatForAdd?.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <label className="text-xs font-medium text-text block mb-1">Select dish</label>
              <select
                value={selectedDishId}
                onChange={(e) => setSelectedDishId(e.target.value)}
                className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
              >
                <option value="">Select a dish from catalogue…</option>
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
                Add dish to menu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
