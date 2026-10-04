'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PageHeader } from '@/components/shell/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

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
    onSuccess: () => {
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

  function renderList(
    items: any[] | undefined,
    loading: boolean,
    type: 'station' | 'allergen' | 'tag' | 'portion',
    title: string,
    description: string,
    hasSortOrder = false
  ) {
    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm text-text">{title}</div>
            <div className="text-xs text-muted mt-0.5">{description}</div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setModalType(type);
              setName('');
              setSortOrder(items?.length ? items.length + 1 : 1);
              setModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add entry
          </Button>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="p-8 text-center text-muted text-xs">No entries configured.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="h-11 px-4 flex items-center justify-between text-xs hover:bg-raised transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text">{item.name}</span>
                  {hasSortOrder && item.sortOrder !== undefined && (
                    <span className="font-mono text-faint text-[11px] tabular-nums">
                      Order: #{item.sortOrder}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge
                    status={item.active !== false ? 'Ready' : 'Cancelled'}
                    label={item.active !== false ? 'Active' : 'Inactive'}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleMutation.mutate({
                        type,
                        id: item.id,
                        active: item.active === false,
                      })
                    }
                    className="h-7 text-xs text-muted"
                  >
                    {item.active !== false ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <AppShell requiredPermission="catalogue:read">
      <div className="space-y-4">
        <PageHeader
          title="Reference Data"
          subtitle="Configure platform kitchen stations, allergen definitions, dietary labels, and portion sizes"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="stations">
              Kitchen stations ({stations?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="allergens">
              Allergens ({allergens?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="tags">
              Dietary tags ({dietaryTags?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="portions">
              Portion sizes ({portionSizes?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stations">
            {renderList(
              stations,
              sLoading,
              'station',
              'Kitchen stations',
              'Prep routing areas in the commercial kitchen (e.g. Hot Line, Cold Prep, Bakery)',
              true
            )}
          </TabsContent>

          <TabsContent value="allergens">
            {renderList(
              allergens,
              aLoading,
              'allergen',
              'Allergen definitions',
              'Regulatory allergen warnings tracked across dishes and ingredients'
            )}
          </TabsContent>

          <TabsContent value="tags">
            {renderList(
              dietaryTags,
              tLoading,
              'tag',
              'Dietary tags & preferences',
              'Special dietary and lifestyle flags (e.g. Vegan, Halal, Gluten-Free)'
            )}
          </TabsContent>

          <TabsContent value="portions">
            {renderList(
              portionSizes,
              pLoading,
              'portion',
              'Portion sizes',
              'Standard serving size multipliers and naming',
              true
            )}
          </TabsContent>
        </Tabs>

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Add{' '}
                {modalType === 'station'
                  ? 'kitchen station'
                  : modalType === 'allergen'
                  ? 'allergen'
                  : modalType === 'tag'
                  ? 'dietary tag'
                  : 'portion size'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-text block mb-1">Name *</label>
                <Input
                  required
                  placeholder="e.g. Bakery / Dairy Free / Large"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {(modalType === 'station' || modalType === 'portion') && (
                <div>
                  <label className="text-xs font-medium text-text block mb-1">Sort order</label>
                  <Input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
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
                Add entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
