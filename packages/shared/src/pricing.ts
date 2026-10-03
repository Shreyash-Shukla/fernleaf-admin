// ─── Pricing Engine ─────────────────────────────────────────────
// Pure functions. No DB calls. Resolution uses a context object
// loaded from DB in 3 queries (bulk resolution pattern).
//
// derive formula: ceil(baseCents * factorBps / 50000) * 5
// factorBps: 10000 = ×1.00. "cost × 2.4" → 24000. "Standard +15%" → 11500.

import { derive } from './money.js';
import type { TierDerivation } from './enums.js';

// ── Types ───────────────────────────────────────────────────────

export interface TierInfo {
  id: string;
  name: string;
  isDefault: boolean;
  derivation: TierDerivation;
  baseTierId: string | null;
  factorBps: number | null;
}

export interface DishInfo {
  id: string;
  costCents: number;
}

export interface OptionInfo {
  id: string;
  costCents: number;
}

/**
 * Pre-loaded context for pricing resolution.
 * Built from 3 queries: tiers, dish overrides, option overrides.
 */
export interface PricingContext {
  tiers: Map<string, TierInfo>;
  /** dishId:tierId → priceCents */
  dishOverrides: Map<string, number>;
  /** optionId:tierId → priceCents */
  optionOverrides: Map<string, number>;
  /** Memoization cache: dishId:tierId → resolved price or null */
  dishCache: Map<string, number | null>;
  /** Memoization cache: optionId:tierId → resolved price or null */
  optionCache: Map<string, number | null>;
}

export function createPricingContext(
  tiers: TierInfo[],
  dishOverrides: Array<{ dishId: string; tierId: string; priceCents: number }>,
  optionOverrides: Array<{ optionId: string; tierId: string; priceCents: number }>,
): PricingContext {
  const tierMap = new Map<string, TierInfo>();
  for (const t of tiers) tierMap.set(t.id, t);

  const dishMap = new Map<string, number>();
  for (const d of dishOverrides) dishMap.set(`${d.dishId}:${d.tierId}`, d.priceCents);

  const optMap = new Map<string, number>();
  for (const o of optionOverrides) optMap.set(`${o.optionId}:${o.tierId}`, o.priceCents);

  return {
    tiers: tierMap,
    dishOverrides: dishMap,
    optionOverrides: optMap,
    dishCache: new Map(),
    optionCache: new Map(),
  };
}

// ── Cycle Detection ─────────────────────────────────────────────

const MAX_TIER_DEPTH = 5;

/**
 * Walk the baseTierId chain. Throws if a cycle is found or depth exceeds 5.
 */
export function checkTierCycle(
  tierId: string,
  tiers: Map<string, TierInfo>,
): void {
  const visited = new Set<string>();
  let current: string | null = tierId;
  let depth = 0;

  while (current) {
    if (visited.has(current)) {
      throw new Error(`TIER_CYCLE: cycle detected involving tier ${current}`);
    }
    if (depth > MAX_TIER_DEPTH) {
      throw new Error(`TIER_CHAIN_TOO_DEEP: chain exceeds ${MAX_TIER_DEPTH} tiers`);
    }
    visited.add(current);
    const tier = tiers.get(current);
    if (!tier) break;
    current = tier.baseTierId;
    depth++;
  }
}

// ── Dish Resolution ─────────────────────────────────────────────

/**
 * Resolve the effective price of a dish on a given tier.
 *
 * 1. Check memo cache
 * 2. Check explicit override (DishTierPrice) → return as-is (no rounding)
 * 3. Match tier.derivation:
 *    NONE → null
 *    COST_FACTOR → derive(dish.costCents, tier.factorBps)
 *    TIER_FACTOR → derive(resolveDish(dish, tier.baseTierId, ctx), tier.factorBps)
 * 4. Result > 0 → return; else null (not orderable, hidden)
 */
export function resolveDish(
  dish: DishInfo,
  tierId: string,
  ctx: PricingContext,
): number | null {
  const cacheKey = `${dish.id}:${tierId}`;

  // 1. Memo cache
  if (ctx.dishCache.has(cacheKey)) {
    return ctx.dishCache.get(cacheKey)!;
  }

  // Guard against infinite recursion
  ctx.dishCache.set(cacheKey, null);

  let result: number | null = null;

  // 2. Explicit override
  const override = ctx.dishOverrides.get(cacheKey);
  if (override !== undefined) {
    result = override > 0 ? override : null;
    ctx.dishCache.set(cacheKey, result);
    return result;
  }

  // 3. Derivation
  const tier = ctx.tiers.get(tierId);
  if (!tier) {
    ctx.dishCache.set(cacheKey, null);
    return null;
  }

  switch (tier.derivation) {
    case 'NONE':
      result = null;
      break;

    case 'COST_FACTOR':
      if (tier.factorBps != null) {
        result = derive(dish.costCents, tier.factorBps);
      }
      break;

    case 'TIER_FACTOR':
      if (tier.baseTierId && tier.factorBps != null) {
        const basePrice = resolveDish(dish, tier.baseTierId, ctx);
        if (basePrice != null && basePrice > 0) {
          result = derive(basePrice, tier.factorBps);
        }
      }
      break;
  }

  // 4. Must be > 0 for dishes
  if (result !== null && result <= 0) result = null;

  ctx.dishCache.set(cacheKey, result);
  return result;
}

// ── Option Resolution ───────────────────────────────────────────

/**
 * Resolve the effective price of an option on a given tier.
 * Same as resolveDish, but >= 0 is valid ($0 option surcharge is legitimate).
 */
export function resolveOption(
  option: OptionInfo,
  tierId: string,
  ctx: PricingContext,
): number | null {
  const cacheKey = `${option.id}:${tierId}`;

  if (ctx.optionCache.has(cacheKey)) {
    return ctx.optionCache.get(cacheKey)!;
  }

  ctx.optionCache.set(cacheKey, null);

  let result: number | null = null;

  const override = ctx.optionOverrides.get(cacheKey);
  if (override !== undefined) {
    // $0 surcharge is valid for options
    result = override >= 0 ? override : null;
    ctx.optionCache.set(cacheKey, result);
    return result;
  }

  const tier = ctx.tiers.get(tierId);
  if (!tier) {
    ctx.optionCache.set(cacheKey, null);
    return null;
  }

  switch (tier.derivation) {
    case 'NONE':
      result = null;
      break;

    case 'COST_FACTOR':
      if (tier.factorBps != null) {
        result = derive(option.costCents, tier.factorBps);
        // For options, $0 is valid; derive returns null for 0 cost, so handle separately
        if (option.costCents === 0) {
          result = 0;
        }
      }
      break;

    case 'TIER_FACTOR':
      if (tier.baseTierId && tier.factorBps != null) {
        const basePrice = resolveOption(option, tier.baseTierId, ctx);
        if (basePrice != null) {
          if (basePrice === 0) {
            result = 0;
          } else {
            result = derive(basePrice, tier.factorBps);
          }
        }
      }
      break;
  }

  // >= 0 is valid for options
  if (result !== null && result < 0) result = null;

  ctx.optionCache.set(cacheKey, result);
  return result;
}

// ── Tier Selection ──────────────────────────────────────────────

/**
 * Get the effective tier ID for a company.
 * company.tierId ?? defaultTier.id
 */
export function effectiveTierId(
  companyTierId: string | null | undefined,
  defaultTierId: string,
): string {
  return companyTierId ?? defaultTierId;
}
