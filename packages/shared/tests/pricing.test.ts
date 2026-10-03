import { describe, it, expect } from 'vitest';
import {
  resolveDish,
  resolveOption,
  effectiveTierId,
  createPricingContext,
  checkTierCycle,
  TierInfo,
} from '../src/pricing.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeTier(overrides: Partial<TierInfo> & { id: string }): TierInfo {
  return {
    name: 'Test',
    isDefault: false,
    derivation: 'NONE',
    baseTierId: null,
    factorBps: null,
    ...overrides,
  };
}

describe('pricing', () => {
  describe('explicit override wins', () => {
    it('uses override price, not derivation', () => {
      const tier = makeTier({ id: 't1', derivation: 'COST_FACTOR', factorBps: 24000 });
      const ctx = createPricingContext(
        [tier],
        [{ dishId: 'd1', tierId: 't1', priceCents: 999 }],
        [],
      );
      const result = resolveDish({ id: 'd1', costCents: 100 }, 't1', ctx);
      expect(result).toBe(999);
    });
  });

  describe('COST_FACTOR derivation', () => {
    it('derives from cost × factor', () => {
      const tier = makeTier({
        id: 't1',
        derivation: 'COST_FACTOR',
        factorBps: 24000, // ×2.4
      });
      const ctx = createPricingContext([tier], [], []);
      // derive(100, 24000) = ceil(100*24000/50000)*5 = ceil(48)*5 = 240
      expect(resolveDish({ id: 'd1', costCents: 100 }, 't1', ctx)).toBe(240);
    });

    it('returns null for zero-cost dish', () => {
      const tier = makeTier({
        id: 't1',
        derivation: 'COST_FACTOR',
        factorBps: 24000,
      });
      const ctx = createPricingContext([tier], [], []);
      expect(resolveDish({ id: 'd1', costCents: 0 }, 't1', ctx)).toBe(null);
    });
  });

  describe('TIER_FACTOR derivation (chaining)', () => {
    it('derives from base tier price × factor', () => {
      const standard = makeTier({ id: 't1', name: 'Standard', derivation: 'NONE' });
      const enterprise = makeTier({
        id: 't2',
        name: 'Enterprise',
        derivation: 'TIER_FACTOR',
        baseTierId: 't1',
        factorBps: 9000, // ×0.9 (90%)
      });
      const ctx = createPricingContext(
        [standard, enterprise],
        [{ dishId: 'd1', tierId: 't1', priceCents: 1000 }],
        [],
      );
      // Base: 1000. derive(1000, 9000) = ceil(1000*9000/50000)*5 = ceil(180)*5 = 900
      expect(resolveDish({ id: 'd1', costCents: 500 }, 't2', ctx)).toBe(900);
    });

    it('chains through multiple tiers', () => {
      const t1 = makeTier({ id: 't1', derivation: 'NONE' });
      const t2 = makeTier({
        id: 't2',
        derivation: 'TIER_FACTOR',
        baseTierId: 't1',
        factorBps: 11500, // Standard +15%
      });
      const t3 = makeTier({
        id: 't3',
        derivation: 'TIER_FACTOR',
        baseTierId: 't2',
        factorBps: 9000, // 90% of t2
      });
      const ctx = createPricingContext(
        [t1, t2, t3],
        [{ dishId: 'd1', tierId: 't1', priceCents: 1000 }],
        [],
      );
      // t2 price: derive(1000, 11500) = ceil(1000*11500/50000)*5 = ceil(230)*5 = 1150
      // t3 price: derive(1150, 9000) = ceil(1150*9000/50000)*5 = ceil(207)*5 = 1035
      expect(resolveDish({ id: 'd1', costCents: 500 }, 't2', ctx)).toBe(1150);
      expect(resolveDish({ id: 'd1', costCents: 500 }, 't3', ctx)).toBe(1035);
    });
  });

  describe('null propagation', () => {
    it('NONE derivation with no override → null', () => {
      const tier = makeTier({ id: 't1', derivation: 'NONE' });
      const ctx = createPricingContext([tier], [], []);
      expect(resolveDish({ id: 'd1', costCents: 100 }, 't1', ctx)).toBe(null);
    });

    it('TIER_FACTOR with null base → null', () => {
      const t1 = makeTier({ id: 't1', derivation: 'NONE' });
      const t2 = makeTier({
        id: 't2',
        derivation: 'TIER_FACTOR',
        baseTierId: 't1',
        factorBps: 10000,
      });
      const ctx = createPricingContext([t1, t2], [], []); // no overrides
      expect(resolveDish({ id: 'd1', costCents: 100 }, 't2', ctx)).toBe(null);
    });

    it('unknown tier → null', () => {
      const ctx = createPricingContext([], [], []);
      expect(resolveDish({ id: 'd1', costCents: 100 }, 'nonexistent', ctx)).toBe(null);
    });
  });

  describe('cycle detection', () => {
    it('throws on direct cycle (A → A)', () => {
      const t1 = makeTier({ id: 't1', derivation: 'TIER_FACTOR', baseTierId: 't1', factorBps: 10000 });
      const tiers = new Map([['t1', t1]]);
      expect(() => checkTierCycle('t1', tiers)).toThrow('TIER_CYCLE');
    });

    it('throws on indirect cycle (A → B → A)', () => {
      const t1 = makeTier({ id: 't1', derivation: 'TIER_FACTOR', baseTierId: 't2', factorBps: 10000 });
      const t2 = makeTier({ id: 't2', derivation: 'TIER_FACTOR', baseTierId: 't1', factorBps: 10000 });
      const tiers = new Map([['t1', t1], ['t2', t2]]);
      expect(() => checkTierCycle('t1', tiers)).toThrow('TIER_CYCLE');
    });

    it('does not throw on valid chain', () => {
      const t1 = makeTier({ id: 't1', derivation: 'NONE' });
      const t2 = makeTier({ id: 't2', derivation: 'TIER_FACTOR', baseTierId: 't1', factorBps: 10000 });
      const tiers = new Map([['t1', t1], ['t2', t2]]);
      expect(() => checkTierCycle('t2', tiers)).not.toThrow();
    });
  });

  describe('option resolution', () => {
    it('$0 option surcharge is valid', () => {
      const tier = makeTier({ id: 't1', derivation: 'NONE' });
      const ctx = createPricingContext(
        [tier],
        [],
        [{ optionId: 'o1', tierId: 't1', priceCents: 0 }],
      );
      expect(resolveOption({ id: 'o1', costCents: 0 }, 't1', ctx)).toBe(0);
    });

    it('positive option price works', () => {
      const tier = makeTier({ id: 't1', derivation: 'NONE' });
      const ctx = createPricingContext(
        [tier],
        [],
        [{ optionId: 'o1', tierId: 't1', priceCents: 150 }],
      );
      expect(resolveOption({ id: 'o1', costCents: 50 }, 't1', ctx)).toBe(150);
    });

    it('option COST_FACTOR with $0 cost → $0 (valid)', () => {
      const tier = makeTier({
        id: 't1',
        derivation: 'COST_FACTOR',
        factorBps: 24000,
      });
      const ctx = createPricingContext([tier], [], []);
      expect(resolveOption({ id: 'o1', costCents: 0 }, 't1', ctx)).toBe(0);
    });

    it('option with no price on NONE tier → null', () => {
      const tier = makeTier({ id: 't1', derivation: 'NONE' });
      const ctx = createPricingContext([tier], [], []);
      expect(resolveOption({ id: 'o1', costCents: 50 }, 't1', ctx)).toBe(null);
    });
  });

  describe('effectiveTierId', () => {
    it('returns company tier when set', () => {
      expect(effectiveTierId('company-tier', 'default-tier')).toBe('company-tier');
    });

    it('returns default tier when company has none', () => {
      expect(effectiveTierId(null, 'default-tier')).toBe('default-tier');
    });

    it('returns default tier for undefined', () => {
      expect(effectiveTierId(undefined, 'default-tier')).toBe('default-tier');
    });
  });

  describe('memoization', () => {
    it('returns same result on repeated calls', () => {
      const tier = makeTier({
        id: 't1',
        derivation: 'COST_FACTOR',
        factorBps: 24000,
      });
      const ctx = createPricingContext([tier], [], []);
      const dish = { id: 'd1', costCents: 100 };

      const r1 = resolveDish(dish, 't1', ctx);
      const r2 = resolveDish(dish, 't1', ctx);
      expect(r1).toBe(r2);
      expect(r1).toBe(240);
    });
  });
});
