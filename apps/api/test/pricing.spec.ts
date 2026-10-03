import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PricingService } from '../src/pricing/pricing.service';
import { DomainError } from '../src/common/domain-error';
import { ERRORS } from '@repo/shared';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      priceTier: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      dish: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      option: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      dishTierPrice: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      optionTierPrice: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new PricingService(prisma);
  });

  it('rejects creating a tier deriving from itself', async () => {
    prisma.priceTier.findUnique.mockResolvedValueOnce(null); // name check

    await expect(
      service.createTier({
        name: 'Loop Tier',
        derivation: 'TIER_FACTOR',
        baseTierId: 'self-id',
        factorBps: 10000,
      }),
    ).rejects.toThrow();
  });

  it('detects cycles in tier derivations', async () => {
    prisma.priceTier.findUnique
      .mockResolvedValueOnce(null) // name check
      .mockResolvedValueOnce({ id: 'tier-b' }); // base tier exists

    // Existing tiers: A derives from B, and we try to make B derive from A
    prisma.priceTier.findMany.mockResolvedValue([
      { id: 'tier-a', name: 'A', derivation: 'TIER_FACTOR', baseTierId: 'tier-b', factorBps: 10000, isDefault: false },
      { id: 'tier-b', name: 'B', derivation: 'NONE', baseTierId: null, factorBps: null, isDefault: false },
    ]);

    await expect(
      service.updateTier('tier-b', {
        derivation: 'TIER_FACTOR',
        baseTierId: 'tier-a',
        factorBps: 10000,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('unsets previous default tier when creating a new default tier', async () => {
    prisma.priceTier.findUnique.mockResolvedValue(null);
    prisma.priceTier.create.mockResolvedValue({ id: 'tier-new', name: 'New Default', isDefault: true });

    await service.createTier({
      name: 'New Default',
      isDefault: true,
      derivation: 'NONE',
    });

    expect(prisma.priceTier.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.priceTier.create).toHaveBeenCalled();
  });

  it('computes grid effective prices with override taking precedence over derived', async () => {
    const tier = {
      id: 't-cost',
      name: 'Cost Plus',
      derivation: 'COST_FACTOR',
      factorBps: 20000, // 2.0x
      baseTierId: null,
      active: true,
    };
    prisma.priceTier.findUnique.mockResolvedValue(tier);
    prisma.priceTier.findMany.mockResolvedValue([tier]);

    // Dishes: d1 has cost 200 cents (derives to 400), d2 has cost 300 cents (derives to 600)
    prisma.dish.findMany.mockResolvedValue([
      { id: 'd1', name: 'Dish 1', sku: 'D1', costCents: 200, active: true },
      { id: 'd2', name: 'Dish 2', sku: 'D2', costCents: 300, active: true },
    ]);

    // d1 has override 500 cents
    prisma.dishTierPrice.findMany.mockResolvedValue([
      { dishId: 'd1', tierId: 't-cost', priceCents: 500 },
    ]);
    prisma.optionTierPrice.findMany.mockResolvedValue([]);

    const grid = await service.getTierGrid('t-cost', { kind: 'dish' });

    expect(grid.items).toHaveLength(2);
    // d1: override 500 wins
    expect(grid.items[0]).toEqual({
      id: 'd1',
      name: 'Dish 1',
      sku: 'D1',
      costCents: 200,
      overrideCents: 500,
      derivedCents: 400,
      effectiveCents: 500,
      source: 'OVERRIDE',
    });
    // d2: derived 600
    expect(grid.items[1]).toEqual({
      id: 'd2',
      name: 'Dish 2',
      sku: 'D2',
      costCents: 300,
      overrideCents: null,
      derivedCents: 600,
      effectiveCents: 600,
      source: 'DERIVED',
    });
  });

  it('filters missing prices correctly in grid', async () => {
    const tier = {
      id: 't-none',
      name: 'Manual Tier',
      derivation: 'NONE',
      factorBps: null,
      baseTierId: null,
      active: true,
    };
    prisma.priceTier.findUnique.mockResolvedValue(tier);
    prisma.priceTier.findMany.mockResolvedValue([tier]);

    prisma.dish.findMany.mockResolvedValue([
      { id: 'd1', name: 'Priced Dish', sku: 'D1', costCents: 200, active: true },
      { id: 'd2', name: 'Unpriced Dish', sku: 'D2', costCents: 300, active: true },
    ]);

    prisma.dishTierPrice.findMany.mockResolvedValue([
      { dishId: 'd1', tierId: 't-none', priceCents: 500 },
    ]);
    prisma.optionTierPrice.findMany.mockResolvedValue([]);

    const grid = await service.getTierGrid('t-none', { kind: 'dish', missing: 'true' });
    expect(grid.items).toHaveLength(1);
    expect(grid.items[0].id).toBe('d2');
    expect(grid.items[0].effectiveCents).toBeNull();
  });

  it('batch updates tier grid overrides and deletes when priceCents is null', async () => {
    prisma.priceTier.findUnique.mockResolvedValue({ id: 't1' });
    prisma.dish.findUnique.mockResolvedValue({ id: 'd1' });

    await service.updateTierGrid('t1', [
      { id: 'd1', priceCents: 750 },
      { id: 'd2', priceCents: null },
    ], 'dish');

    expect(prisma.dishTierPrice.upsert).toHaveBeenCalledWith({
      where: { dishId_tierId: { dishId: 'd1', tierId: 't1' } },
      create: { dishId: 'd1', tierId: 't1', priceCents: 750 },
      update: { priceCents: 750 },
    });
    expect(prisma.dishTierPrice.deleteMany).toHaveBeenCalledWith({
      where: { dishId: 'd2', tierId: 't1' },
    });
  });
});
