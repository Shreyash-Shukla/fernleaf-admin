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
import {
  BadgePercent,
  PlusCircle,
  Edit,
  Save,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Layers,
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
      toast.success('Price overrides saved to tier!');
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <BadgePercent className="w-6 h-6 text-emerald-400" />
              <span>Pricing Tiers & Grid Matrix</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Formulas round up to 5¢. Explicit overrides take precedence. Dishes without prices are hidden.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              resetTierForm();
              setTierModalOpen(true);
            }}
            className="text-xs"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Price Tier
          </Button>
        </div>

        {/* Tiers List Carousel / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers?.map((t) => {
            const isSelected = t.id === selectedTierId;
            let derivationLabel = 'Manual / Override Only';
            if (t.derivation === 'COST_FACTOR') {
              derivationLabel = `Cost × ${(t.factorBps / 10000).toFixed(2)}`;
            } else if (t.derivation === 'TIER_FACTOR') {
              const baseName = t.baseTier?.name || 'Base Tier';
              const percent = ((t.factorBps - 10000) / 100).toFixed(0);
              derivationLabel = `${baseName} ${Number(percent) >= 0 ? '+' : ''}${percent}%`;
            }

            return (
              <Card
                key={t.id}
                onClick={() => setSelectedTierId(t.id)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-950/20'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>{t.name}</span>
                    {t.isDefault && (
                      <Badge variant="default" className="text-[9px] py-0">
                        Default
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditTier(t);
                    }}
                    className="h-7 text-xs px-2 text-slate-400 hover:text-white"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>

                <div className="text-xs text-emerald-400 font-mono mt-2">
                  Formula: {derivationLabel}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Tier Grid Matrix Editor */}
        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>{selectedTier?.name} Price Matrix</span>
                <Badge variant="outline" className="text-[10px]">
                  {gridKind === 'dish' ? 'Dishes' : 'Options'}
                </Badge>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Spot unpriced dishes and configure custom price overrides
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Kind Toggle */}
              <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setGridKind('dish');
                    setLocalOverrides({});
                  }}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    gridKind === 'dish' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400'
                  }`}
                >
                  Dishes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGridKind('option');
                    setLocalOverrides({});
                  }}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    gridKind === 'option' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400'
                  }`}
                >
                  Options
                </button>
              </div>

              {/* Missing Only Toggle */}
              <Button
                variant={missingOnly ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setMissingOnly(!missingOnly)}
                className="text-xs h-8"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Missing Only
              </Button>

              {/* Save All Pending Changes */}
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
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 font-bold"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save Changes ({Object.keys(localOverrides).length})
                </Button>
              )}
            </div>
          </div>

          {/* Search bar inside grid */}
          <div className="max-w-xs">
            <input
              type="text"
              placeholder="Search in grid..."
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
            />
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Base Cost</th>
                  <th className="py-3 px-4">Derived Price</th>
                  <th className="py-3 px-4">Explicit Override</th>
                  <th className="py-3 px-4">Effective Price</th>
                  <th className="py-3 px-4">Orderable Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {gridLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Computing resolved prices...
                    </td>
                  </tr>
                ) : gridRows.length > 0 ? (
                  gridRows.map((row: any) => {
                    const currentOverride =
                      localOverrides[row.id] !== undefined
                        ? localOverrides[row.id]
                        : row.overridePriceCents;

                    const effective = currentOverride ?? row.derivedPriceCents;
                    const isMissing = effective === null || effective <= 0;

                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-850/50 ${
                          isMissing ? 'bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-white">
                          <div>{row.name}</div>
                          {row.sku && (
                            <div className="text-[10px] font-mono text-slate-500">
                              SKU: {row.sku}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {formatCents(row.costCents)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {row.derivedPriceCents !== null ? formatCents(row.derivedPriceCents) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step={5}
                              placeholder="Override ¢"
                              value={currentOverride ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                setLocalOverrides({ ...localOverrides, [row.id]: val });
                              }}
                              className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                            />
                            {currentOverride !== null && (
                              <button
                                onClick={() =>
                                  setLocalOverrides({ ...localOverrides, [row.id]: null })
                                }
                                title="Clear override"
                                className="text-slate-500 hover:text-rose-400 text-xs px-1"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-400 text-sm">
                          {effective !== null ? formatCents(effective) : (
                            <span className="text-rose-400 font-normal text-xs">No price</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isMissing ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Hidden (Missing Price)
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-[10px]">
                              Orderable
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No items found in this grid view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Tier Create/Edit Modal */}
        <Dialog open={tierModalOpen} onOpenChange={setTierModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTier ? 'Edit Price Tier' : 'Add Price Tier'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Tier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Plus"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Price Derivation Strategy
                </label>
                <select
                  value={derivation}
                  onChange={(e) => setDerivation(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="NONE">Manual Overrides Only (NONE)</option>
                  <option value="COST_FACTOR">Derived from Dish Cost (COST_FACTOR)</option>
                  <option value="TIER_FACTOR">Derived from Another Tier (TIER_FACTOR)</option>
                </select>
              </div>

              {derivation === 'TIER_FACTOR' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Base Tier
                  </label>
                  <select
                    value={baseTierId}
                    onChange={(e) => setBaseTierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="">Select base tier...</option>
                    {tiers
                      ?.filter((t) => t.id !== editingTier?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {derivation !== 'NONE' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Factor Basis Points (bps) — 10000 = 100%, 24000 = 240%, 11500 = +15%
                  </label>
                  <input
                    type="number"
                    value={factorBps}
                    onChange={(e) => setFactorBps(parseInt(e.target.value, 10) || 10000)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                  <span className="text-[10px] text-slate-400">
                    Multiplier: ×{(factorBps / 10000).toFixed(2)} (rounds up to 5 cents)
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                  />
                  <span>Make this the system default tier</span>
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
                    baseTierId: derivation === 'TIER_FACTOR' ? baseTierId : null,
                    factorBps: derivation !== 'NONE' ? factorBps : null,
                  })
                }
                loading={saveTierMutation.isPending}
              >
                {editingTier ? 'Update Tier' : 'Create Tier'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
