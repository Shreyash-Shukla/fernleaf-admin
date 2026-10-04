'use client';

import React, { useState } from 'react';
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
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  Plus,
  Edit,
  Save,
  Search,
} from 'lucide-react';

export default function PricingPage() {
  const queryClient = useQueryClient();

  // Selected tier for grid editor
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [gridKind, setGridKind] = useState<'dish' | 'option'>('dish');
  const [missingOnly, setMissingOnly] = useState(false);
  const [gridSearch, setGridSearch] = useState('');

  // Local grid edits: { [itemId]: number | null }
  const [localOverrides, setLocalOverrides] = useState<Record<string, number | null>>({});

  // Modals
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);

  // Tier form state
  const [tierName, setTierName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [derivation, setDerivation] = useState<'NONE' | 'COST_FACTOR' | 'TIER_FACTOR'>('NONE');
  const [baseTierId, setBaseTierId] = useState('');
  const [factorBps, setFactorBps] = useState<number>(10000);

  // 1. Fetch Tiers
  const { data: tiers, isLoading: tiersLoading } = useQuery<any[]>({
    queryKey: ['pricing', 'tiers'],
    queryFn: () => fetchApi('/pricing/tiers'),
  });

  // Select default or first tier once loaded
  React.useEffect(() => {
    if (tiers?.length && !selectedTierId) {
      const def = tiers.find((t) => t.isDefault) || tiers[0];
      setSelectedTierId(def.id);
    }
  }, [tiers, selectedTierId]);

  // 2. Fetch Tier Grid
  const gridParams = new URLSearchParams();
  gridParams.set('kind', gridKind);
  if (missingOnly) gridParams.set('missing', 'true');
  if (gridSearch) gridParams.set('q', gridSearch);

  const { data: gridData, isLoading: gridLoading } = useQuery<any>({
    queryKey: ['pricing', 'grid', selectedTierId, gridParams.toString()],
    queryFn: () => fetchApi(`/pricing/tiers/${selectedTierId}/grid?${gridParams.toString()}`),
    enabled: !!selectedTierId,
  });

  // Save Grid Overrides Mutation
  const saveGridMutation = useMutation({
    mutationFn: ({ tierId, updates, kind }: { tierId: string; updates: any[]; kind: string }) =>
      fetchApi(`/pricing/tiers/${tierId}/grid?kind=${kind}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      toast.success('Price overrides saved to tier');
      setLocalOverrides({});
      queryClient.invalidateQueries({ queryKey: ['pricing', 'grid'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save prices'),
  });

  // Create / Update Tier Mutation
  const saveTierMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editingTier) {
        return fetchApi(`/pricing/tiers/${editingTier.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        return fetchApi('/pricing/tiers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: () => {
      toast.success(editingTier ? 'Tier updated' : 'Tier created');
      setTierModalOpen(false);
      setEditingTier(null);
      queryClient.invalidateQueries({ queryKey: ['pricing', 'tiers'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save tier'),
  });

  function openEditTier(tier: any) {
    setEditingTier(tier);
    setTierName(tier.name);
    setIsDefault(tier.isDefault);
    setDerivation(tier.derivation);
    setBaseTierId(tier.baseTierId || '');
    setFactorBps(tier.factorBps || 10000);
    setTierModalOpen(true);
  }

  function resetTierForm() {
    setEditingTier(null);
    setTierName('');
    setIsDefault(false);
    setDerivation('NONE');
    setBaseTierId('');
    setFactorBps(10000);
  }

  const selectedTier = tiers?.find((t) => t.id === selectedTierId);
  const gridRows = gridData?.items || gridData?.rows || [];

  return (
    <AppShell requiredPermission="pricing:read">
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Pricing Tiers & Grid Matrix"
          subtitle="Formulas round up to 5¢. Explicit overrides take precedence. Dishes without prices are hidden."
          actions={
            <Button
              size="sm"
              onClick={() => {
                resetTierForm();
                setTierModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add price tier
            </Button>
          }
        />

        {/* Tiers Cards Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers?.map((t) => {
            const isSelected = t.id === selectedTierId;
            let derivationLabel = 'Manual / Override only';
            if (t.derivation === 'COST_FACTOR') {
              derivationLabel = `Cost × ${(t.factorBps / 10000).toFixed(2)}`;
            } else if (t.derivation === 'TIER_FACTOR') {
              const baseName = t.baseTier?.name || 'Base Tier';
              const percent = ((t.factorBps - 10000) / 100).toFixed(0);
              derivationLabel = `${baseName} ${Number(percent) >= 0 ? '+' : ''}${percent}%`;
            }

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTierId(t.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-brand-soft border-brand-solid'
                    : 'bg-surface border-border hover:bg-raised'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-text flex items-center gap-1.5">
                    <span>{t.name}</span>
                    {t.isDefault && (
                      <Chip>Default</Chip>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditTier(t);
                    }}
                    className="h-7 text-xs px-2 text-muted"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="text-xs text-muted font-mono mt-2 tabular-nums">
                  Formula: {derivationLabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tier Grid Matrix Editor */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden space-y-3 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <div className="font-semibold text-sm text-text flex items-center gap-2">
                <span>{selectedTier?.name || 'Tier'} price matrix</span>
                <Chip>{gridKind === 'dish' ? 'Dishes' : 'Options'}</Chip>
              </div>
              <div className="text-xs text-muted mt-0.5">
                Spot unpriced items and configure custom price overrides
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                value={gridKind}
                onChange={(val) => {
                  setGridKind(val as any);
                  setLocalOverrides({});
                }}
                options={[
                  { value: 'dish', label: 'Dishes' },
                  { value: 'option', label: 'Options' },
                ]}
              />

              <Button
                variant={missingOnly ? 'destructive' : 'secondary'}
                size="sm"
                onClick={() => setMissingOnly(!missingOnly)}
                className="h-7 text-xs"
              >
                Missing only
              </Button>

              {Object.keys(localOverrides).length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    const updates = Object.entries(localOverrides).map(([itemId, priceCents]) => ({
                      itemId,
                      priceCents,
                    }));
                    saveGridMutation.mutate({
                      tierId: selectedTierId,
                      updates,
                      kind: gridKind,
                    });
                  }}
                  loading={saveGridMutation.isPending}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save overrides ({Object.keys(localOverrides).length})
                </Button>
              )}
            </div>
          </div>

          {/* Search bar inside grid */}
          <div className="w-64">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search in grid…"
                value={gridSearch}
                onChange={(e) => setGridSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 bg-app border border-border rounded-md text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-solid"
              />
            </div>
          </div>

          {/* Grid Table */}
          <div className="border border-border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item name</TableHead>
                  <TableHead className="w-28 text-right">Base cost</TableHead>
                  <TableHead className="w-28 text-right">Derived price</TableHead>
                  <TableHead className="w-36 text-right">Explicit override</TableHead>
                  <TableHead className="w-28 text-right">Effective price</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gridLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted text-xs">
                      Computing resolved prices…
                    </TableCell>
                  </TableRow>
                ) : gridRows.length > 0 ? (
                  gridRows.map((row: any) => {
                    const currentOverride =
                      localOverrides[row.id] !== undefined
                        ? localOverrides[row.id]
                        : row.overridePriceCents;

                    const effective = currentOverride ?? row.derivedPriceCents;
                    const isMissing = effective === null || effective <= 0;

                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium text-text">{row.name}</div>
                          {row.sku && (
                            <div className="text-[11px] font-mono text-muted tabular-nums">
                              SKU: {row.sku}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted tabular-nums">
                          {formatCents(row.costCents)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted tabular-nums">
                          {row.derivedPriceCents !== null ? formatCents(row.derivedPriceCents) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step={5}
                              placeholder="Override ¢"
                              value={currentOverride ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                setLocalOverrides({ ...localOverrides, [row.id]: val });
                              }}
                              className="w-24 h-7 px-2 bg-app border border-border rounded text-xs text-text text-right font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-brand-solid"
                            />
                            {currentOverride !== null && (
                              <button
                                onClick={() =>
                                  setLocalOverrides({ ...localOverrides, [row.id]: null })
                                }
                                title="Clear override"
                                className="text-muted hover:text-danger text-xs px-1"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold font-mono text-text tabular-nums">
                          {effective !== null ? formatCents(effective) : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={isMissing ? 'Late' : 'Ready'}
                            label={isMissing ? 'Unpriced' : 'Orderable'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted text-xs">
                      No items found in this grid view.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Tier Modal */}
        <Dialog open={tierModalOpen} onOpenChange={setTierModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTier ? 'Edit price tier' : 'Add price tier'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-xs font-medium text-text block mb-1">Tier name *</label>
                <Input
                  required
                  placeholder="e.g. Corporate Standard / Startup Discount"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text block mb-1">Price derivation formula</label>
                <select
                  value={derivation}
                  onChange={(e) => setDerivation(e.target.value as any)}
                  className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                >
                  <option value="NONE">Manual overrides only (No formula)</option>
                  <option value="COST_FACTOR">Multiplier on internal dish cost</option>
                  <option value="TIER_FACTOR">Percentage markup on another tier</option>
                </select>
              </div>

              {derivation === 'COST_FACTOR' && (
                <div>
                  <label className="text-xs font-medium text-text block mb-1">
                    Cost multiplier (basis points: 10000 = 1.00x)
                  </label>
                  <Input
                    type="number"
                    value={factorBps}
                    onChange={(e) => setFactorBps(parseInt(e.target.value, 10) || 10000)}
                  />
                  <span className="text-[11px] text-muted block mt-0.5 tabular-nums">
                    Effective multiplier: {(factorBps / 10000).toFixed(2)}x
                  </span>
                </div>
              )}

              {derivation === 'TIER_FACTOR' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-text block mb-1">Base tier</label>
                    <select
                      value={baseTierId}
                      onChange={(e) => setBaseTierId(e.target.value)}
                      className="w-full h-8 px-2.5 bg-app border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand-solid"
                    >
                      <option value="">Select base tier…</option>
                      {tiers
                        ?.filter((t) => !editingTier || t.id !== editingTier.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text block mb-1">Factor (10000 = +0%)</label>
                    <Input
                      type="number"
                      value={factorBps}
                      onChange={(e) => setFactorBps(parseInt(e.target.value, 10) || 10000)}
                    />
                    <span className="text-[11px] text-muted block mt-0.5 tabular-nums">
                      Markup: {(((factorBps - 10000) / 100)).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <label className="flex items-center gap-2 text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded bg-app border-border text-brand-solid focus:ring-brand-solid"
                  />
                  <span>Default tier for newly created corporate clients</span>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setTierModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!tierName.trim()}
                onClick={() =>
                  saveTierMutation.mutate({
                    name: tierName,
                    isDefault,
                    derivation,
                    baseTierId: derivation === 'TIER_FACTOR' ? baseTierId : undefined,
                    factorBps: derivation !== 'NONE' ? factorBps : undefined,
                  })
                }
                loading={saveTierMutation.isPending}
              >
                {editingTier ? 'Save tier' : 'Create tier'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
