import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import {
  ERRORS,
  createPricingContext,
  resolveDish,
  resolveOption,
  checkTierCycle,
  derive,
  TierInfo,
} from '@repo/shared';
import { TierDerivation } from '@prisma/client';

export interface CreateTierDto {
  name: string;
  isDefault?: boolean;
  derivation?: TierDerivation;
  baseTierId?: string | null;
  factorBps?: number | null;
  active?: boolean;
}

export interface UpdateTierDto {
  name?: string;
  isDefault?: boolean;
  derivation?: TierDerivation;
  baseTierId?: string | null;
  factorBps?: number | null;
  active?: boolean;
}

export interface GridItemUpdate {
  id?: string;
  dishId?: string;
  optionId?: string;
  priceCents: number | null;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Tiers CRUD ──────────────────────────────────────────

  async listTiers() {
    return this.prisma.priceTier.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        baseTier: {
          select: { id: true, name: true, derivation: true },
        },
      },
    });
  }

  async getTier(id: string) {
    const tier = await this.prisma.priceTier.findUnique({
      where: { id },
      include: {
        baseTier: {
          select: { id: true, name: true, derivation: true, factorBps: true },
        },
        derivedTiers: {
          select: { id: true, name: true, derivation: true, factorBps: true },
        },
      },
    });

    if (!tier) {
      throw DomainError.notFound(ERRORS.TIER_NOT_FOUND, `Price tier with id "${id}" not found`);
    }

    return tier;
  }

  private async validateDerivationAndCycle(
    tierId: string | null,
    derivation: TierDerivation,
    baseTierId: string | null | undefined,
    factorBps: number | null | undefined,
  ) {
    if (derivation === 'TIER_FACTOR') {
      if (!baseTierId) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'baseTierId is required for TIER_FACTOR derivation',
          { baseTierId: 'Base tier is required' },
        );
      }
      if (tierId && baseTierId === tierId) {
        throw DomainError.badRequest(
          ERRORS.TIER_CYCLE,
          'A tier cannot derive from itself',
          { baseTierId: 'Cannot derive from itself' },
        );
      }
      if (factorBps === undefined || factorBps === null || factorBps <= 0) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'factorBps must be a positive integer for TIER_FACTOR derivation',
          { factorBps: 'Invalid factor' },
        );
      }

      // Check base tier exists
      const base = await this.prisma.priceTier.findUnique({ where: { id: baseTierId } });
      if (!base) {
        throw DomainError.notFound(ERRORS.TIER_NOT_FOUND, `Base tier "${baseTierId}" not found`);
      }

      // Build map of all tiers for cycle detection
      const allTiers = await this.prisma.priceTier.findMany();
      const tierMap = new Map<string, TierInfo>();
      for (const t of allTiers) {
        tierMap.set(t.id, {
          id: t.id,
          name: t.name,
          isDefault: t.isDefault,
          derivation: t.derivation as any,
          baseTierId: t.baseTierId,
          factorBps: t.factorBps,
        });
      }

      const checkId = tierId || 'new-tier-temp-id';
      tierMap.set(checkId, {
        id: checkId,
        name: 'Check Tier',
        isDefault: false,
        derivation: 'TIER_FACTOR',
        baseTierId,
        factorBps,
      });

      try {
        checkTierCycle(checkId, tierMap);
        // Also check if any existing tier deriving from this tier would create a cycle
        for (const t of allTiers) {
          checkTierCycle(t.id, tierMap);
        }
      } catch (err: any) {
        if (err.message?.includes('TIER_CYCLE')) {
          throw DomainError.badRequest(ERRORS.TIER_CYCLE, 'Cycle detected in price tier hierarchy');
        }
        if (err.message?.includes('TIER_CHAIN_TOO_DEEP')) {
          throw DomainError.badRequest(ERRORS.TIER_CHAIN_TOO_DEEP, 'Tier derivation chain cannot exceed 5 levels');
        }
        throw err;
      }
    } else if (derivation === 'COST_FACTOR') {
      if (factorBps === undefined || factorBps === null || factorBps <= 0) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'factorBps must be a positive integer for COST_FACTOR derivation',
          { factorBps: 'Invalid factor' },
        );
      }
    }
  }

  async createTier(data: CreateTierDto) {
    const name = data.name?.trim();
    if (!name) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Tier name is required', { name: 'Name is required' });
    }

    const existingName = await this.prisma.priceTier.findUnique({ where: { name } });
    if (existingName) {
      throw DomainError.conflict(ERRORS.CONFLICT, `A price tier with name "${name}" already exists`);
    }

    const derivation = data.derivation || 'NONE';
    const baseTierId = derivation === 'TIER_FACTOR' ? (data.baseTierId ?? null) : null;
    const factorBps = derivation !== 'NONE' && data.factorBps ? Math.round(data.factorBps) : null;

    await this.validateDerivationAndCycle(null, derivation, baseTierId, factorBps);

    const isDefault = Boolean(data.isDefault);

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.priceTier.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.priceTier.create({
        data: {
          name,
          isDefault,
          derivation,
          baseTierId,
          factorBps,
          active: data.active ?? true,
        },
        include: {
          baseTier: { select: { id: true, name: true } },
        },
      });
    });
  }

  async updateTier(id: string, data: UpdateTierDto) {
    const existing = await this.prisma.priceTier.findUnique({ where: { id } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.TIER_NOT_FOUND, `Price tier with id "${id}" not found`);
    }

    const updateFields: any = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name cannot be empty');
      if (name !== existing.name) {
        const dup = await this.prisma.priceTier.findUnique({ where: { name } });
        if (dup) {
          throw DomainError.conflict(ERRORS.CONFLICT, `A price tier with name "${name}" already exists`);
        }
        updateFields.name = name;
      }
    }

    if (data.active !== undefined) {
      if (existing.isDefault && !data.active) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Cannot deactivate the default price tier');
      }
      updateFields.active = Boolean(data.active);
    }

    if (data.isDefault !== undefined) {
      if (existing.isDefault && !data.isDefault) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Cannot unset the default tier directly; set another tier as default instead');
      }
      updateFields.isDefault = Boolean(data.isDefault);
    }

    const effectiveDerivation = data.derivation !== undefined ? data.derivation : existing.derivation;
    const effectiveBaseTierId =
      effectiveDerivation === 'TIER_FACTOR'
        ? (data.baseTierId !== undefined ? data.baseTierId : existing.baseTierId)
        : null;
    const effectiveFactorBps =
      effectiveDerivation !== 'NONE'
        ? (data.factorBps !== undefined ? (data.factorBps ? Math.round(data.factorBps) : null) : existing.factorBps)
        : null;

    if (data.derivation !== undefined || data.baseTierId !== undefined || data.factorBps !== undefined) {
      await this.validateDerivationAndCycle(id, effectiveDerivation, effectiveBaseTierId, effectiveFactorBps);
      updateFields.derivation = effectiveDerivation;
      updateFields.baseTierId = effectiveBaseTierId;
      updateFields.factorBps = effectiveFactorBps;
    }

    return this.prisma.$transaction(async (tx) => {
      if (updateFields.isDefault) {
        await tx.priceTier.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.priceTier.update({
        where: { id },
        data: updateFields,
        include: {
          baseTier: { select: { id: true, name: true } },
        },
      });
    });
  }

  // ─── Tier Grid ───────────────────────────────────────────

  async getTierGrid(
    tierId: string,
    query: {
      kind?: 'dish' | 'option';
      missing?: boolean | string;
      q?: string;
      page?: number | string;
      limit?: number | string;
    },
  ) {
    const tier = await this.prisma.priceTier.findUnique({ where: { id: tierId } });
    if (!tier) {
      throw DomainError.notFound(ERRORS.TIER_NOT_FOUND, `Price tier with id "${tierId}" not found`);
    }

    const [allTiers, dishOverrides, optionOverrides] = await Promise.all([
      this.prisma.priceTier.findMany({ where: { active: true } }),
      this.prisma.dishTierPrice.findMany(),
      this.prisma.optionTierPrice.findMany(),
    ]);

    const ctx = createPricingContext(
      allTiers.map((t) => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
        derivation: t.derivation as any,
        baseTierId: t.baseTierId,
        factorBps: t.factorBps,
      })),
      dishOverrides.map((d) => ({ dishId: d.dishId, tierId: d.tierId, priceCents: d.priceCents })),
      optionOverrides.map((o) => ({ optionId: o.optionId, tierId: o.tierId, priceCents: o.priceCents })),
    );

    const kind = query.kind === 'option' ? 'option' : 'dish';
    const isMissingOnly = query.missing === true || query.missing === 'true';
    const search = query.q?.trim().toLowerCase();

    let rows: any[] = [];

    if (kind === 'dish') {
      const dishes = await this.prisma.dish.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      });

      for (const dish of dishes) {
        if (search && !dish.name.toLowerCase().includes(search) && !dish.sku.toLowerCase().includes(search)) {
          continue;
        }

        const overrideCents = ctx.dishOverrides.get(`${dish.id}:${tierId}`) ?? null;
        let derivedCents: number | null = null;

        if (tier.derivation === 'COST_FACTOR' && tier.factorBps != null) {
          derivedCents = derive(dish.costCents, tier.factorBps);
        } else if (tier.derivation === 'TIER_FACTOR' && tier.baseTierId && tier.factorBps != null) {
          const basePrice = resolveDish({ id: dish.id, costCents: dish.costCents }, tier.baseTierId, ctx);
          if (basePrice !== null && basePrice > 0) {
            derivedCents = derive(basePrice, tier.factorBps);
          }
        }

        const effectiveCents = resolveDish({ id: dish.id, costCents: dish.costCents }, tierId, ctx);

        let source: 'OVERRIDE' | 'DERIVED' | 'NONE' = 'NONE';
        if (overrideCents !== null) {
          source = 'OVERRIDE';
        } else if (derivedCents !== null && derivedCents > 0) {
          source = 'DERIVED';
        }

        if (isMissingOnly && effectiveCents !== null) {
          continue;
        }

        rows.push({
          id: dish.id,
          name: dish.name,
          sku: dish.sku,
          costCents: dish.costCents,
          overrideCents,
          derivedCents,
          effectiveCents,
          source,
        });
      }
    } else {
      const options = await this.prisma.option.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      });

      for (const option of options) {
        if (search && !option.name.toLowerCase().includes(search)) {
          continue;
        }

        const overrideCents = ctx.optionOverrides.get(`${option.id}:${tierId}`) ?? null;
        let derivedCents: number | null = null;

        if (tier.derivation === 'COST_FACTOR' && tier.factorBps != null) {
          derivedCents = option.costCents === 0 ? 0 : derive(option.costCents, tier.factorBps);
        } else if (tier.derivation === 'TIER_FACTOR' && tier.baseTierId && tier.factorBps != null) {
          const basePrice = resolveOption({ id: option.id, costCents: option.costCents }, tier.baseTierId, ctx);
          if (basePrice !== null) {
            derivedCents = basePrice === 0 ? 0 : derive(basePrice, tier.factorBps);
          }
        }

        const effectiveCents = resolveOption({ id: option.id, costCents: option.costCents }, tierId, ctx);

        let source: 'OVERRIDE' | 'DERIVED' | 'NONE' = 'NONE';
        if (overrideCents !== null) {
          source = 'OVERRIDE';
        } else if (derivedCents !== null && derivedCents >= 0) {
          source = 'DERIVED';
        }

        if (isMissingOnly && effectiveCents !== null) {
          continue;
        }

        rows.push({
          id: option.id,
          name: option.name,
          costCents: option.costCents,
          overrideCents,
          derivedCents,
          effectiveCents,
          source,
        });
      }
    }

    const total = rows.length;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;
    const items = rows.slice(skip, skip + limit);

    return {
      tier: { id: tier.id, name: tier.name, derivation: tier.derivation, factorBps: tier.factorBps },
      kind,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateTierGrid(
    tierId: string,
    updates: GridItemUpdate[] | GridItemUpdate,
    kindParam?: 'dish' | 'option',
  ) {
    const tier = await this.prisma.priceTier.findUnique({ where: { id: tierId } });
    if (!tier) {
      throw DomainError.notFound(ERRORS.TIER_NOT_FOUND, `Price tier with id "${tierId}" not found`);
    }

    const items = Array.isArray(updates) ? updates : [updates];

    return this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const item of items) {
        const targetId = item.id || item.dishId || item.optionId;
        if (!targetId) continue;

        let kind = kindParam;
        if (!kind) {
          if (item.dishId) kind = 'dish';
          else if (item.optionId) kind = 'option';
          else {
            const isDish = await tx.dish.findUnique({ where: { id: targetId }, select: { id: true } });
            kind = isDish ? 'dish' : 'option';
          }
        }

        if (item.priceCents === null || item.priceCents === undefined) {
          // Remove override
          if (kind === 'dish') {
            await tx.dishTierPrice.deleteMany({
              where: { dishId: targetId, tierId },
            });
          } else {
            await tx.optionTierPrice.deleteMany({
              where: { optionId: targetId, tierId },
            });
          }
        } else {
          // Set/upsert override
          const priceCents = Math.round(item.priceCents);
          if (kind === 'dish') {
            await tx.dishTierPrice.upsert({
              where: { dishId_tierId: { dishId: targetId, tierId } },
              create: { dishId: targetId, tierId, priceCents },
              update: { priceCents },
            });
          } else {
            await tx.optionTierPrice.upsert({
              where: { optionId_tierId: { optionId: targetId, tierId } },
              create: { optionId: targetId, tierId, priceCents },
              update: { priceCents },
            });
          }
        }
        count++;
      }

      return { ok: true, updated: count };
    });
  }
}
