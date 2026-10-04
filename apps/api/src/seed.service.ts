// ─── Seed Service ─────────────────────────────────────────────────────

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { DateTime } from 'luxon';
import * as bcrypt from 'bcryptjs';
import {
  SEED_ROLES,
  SEED_USERS,
  DEFAULT_PASSWORD,
  ALLERGENS,
  DIETARY_TAGS,
  KITCHEN_STATIONS,
  PORTION_SIZES,
  MENU_CATEGORIES,
  SEED_OPTIONS,
  SEED_DISHES,
  SEED_COMPANIES,
} from './seed/seed-data';
import {
  SeedContext,
  generateDemoOrders,
} from './seed/seed-generator';
import { stringToDbDate, dbDateToString, addDays, cutoffAt, isLocked } from '@repo/shared';

export { SEED_ROLES, SEED_USERS, DEFAULT_PASSWORD };

export interface RunSeedOptions {
  force?: boolean;
  logger?: { log: (msg: string) => void; warn: (msg: string) => void; error?: (msg: string) => void };
}

/**
 * Safely cleans DEMO data without touching STAFF data
 */
export async function cleanDemoData(prisma: any) {
  const demoOrders = await prisma.order.findMany({
    where: { source: 'DEMO' },
    select: { id: true, invoiceId: true },
  });
  const demoOrderIds = demoOrders.map((o: any) => o.id);
  const demoInvoiceIds = Array.from(
    new Set(demoOrders.map((o: any) => o.invoiceId).filter((id: any): id is string => !!id)),
  );

  if (demoOrderIds.length > 0) {
    // 1. Delete adjustments for demo orders
    await prisma.adjustment.deleteMany({
      where: { orderId: { in: demoOrderIds } },
    });

    // 2. Delete invoice items related to demo orders or invoices
    await prisma.invoiceItem.deleteMany({
      where: {
        OR: [
          { orderId: { in: demoOrderIds } },
          { invoiceId: { in: demoInvoiceIds } },
        ],
      },
    });

    // 4. Detach orders from invoices
    await prisma.order.updateMany({
      where: { id: { in: demoOrderIds } },
      data: { invoiceId: null },
    });

    // 5. Delete demo invoices
    if (demoInvoiceIds.length > 0) {
      await prisma.invoice.deleteMany({
        where: { id: { in: demoInvoiceIds } },
      });
    }

    // 6. Delete combinations, options, and order lines
    const demoOrderLines = await prisma.orderLine.findMany({
      where: { orderId: { in: demoOrderIds } },
      select: { id: true },
    });
    const lineIds = demoOrderLines.map((l: any) => l.id);

    const demoCombinations = await prisma.orderLineCombination.findMany({
      where: { orderLineId: { in: lineIds } },
      select: { id: true },
    });
    const combIds = demoCombinations.map((c: any) => c.id);

    if (combIds.length > 0) {
      await prisma.combinationOption.deleteMany({
        where: { combinationId: { in: combIds } },
      });
      await prisma.orderLineCombination.deleteMany({
        where: { id: { in: combIds } },
      });
    }

    if (lineIds.length > 0) {
      await prisma.orderLine.deleteMany({
        where: { id: { in: lineIds } },
      });
    }

    // 7. Delete demo orders
    await prisma.order.deleteMany({
      where: { id: { in: demoOrderIds } },
    });

    // 8. Delete drops that have NO remaining orders (preserves any with STAFF orders)
    const emptyDrops = await prisma.drop.findMany({
      where: {
        orders: { none: {} },
      },
      select: { id: true },
    });
    if (emptyDrops.length > 0) {
      const dropIds = emptyDrops.map((d: any) => d.id);
      await prisma.deliveryPhoto.deleteMany({
        where: { dropId: { in: dropIds } },
      });
      await prisma.drop.deleteMany({
        where: { id: { in: dropIds } },
      });
    }
  }
}

/**
 * Fast loader for existing static seed context
 */
async function loadStaticContext(prisma: any): Promise<SeedContext> {
  const users = await prisma.user.findMany();
  const userMap: Record<string, { id: string; email: string; name: string }> = {};
  for (const u of users) {
    userMap[u.email] = { id: u.id, email: u.email, name: u.name };
  }

  const tiers = await prisma.priceTier.findMany();
  const tierMap: Record<string, { id: string; name: string }> = {};
  for (const t of tiers) {
    tierMap[t.name] = { id: t.id, name: t.name };
  }

  const portionSizes = await prisma.portionSize.findMany();
  const portionMap: Record<string, string> = {};
  for (const p of portionSizes) {
    portionMap[p.name] = p.id;
  }

  const dbCompanies = await prisma.company.findMany({
    where: { name: { in: SEED_COMPANIES.map((c) => c.name) } },
    include: { addresses: true, employees: true, tier: true },
  });

  const seededCompanies = dbCompanies.map((c: any) => ({
    id: c.id,
    name: c.name,
    tierId: c.tierId,
    tierName: c.tier?.name ?? 'Standard',
    workingDays: c.workingDays,
    defaultDeliveryTimeMin: c.defaultDeliveryTimeMin,
    dispatchLeadMinutes: c.dispatchLeadMinutes,
    defaultPackaging: c.defaultPackaging,
    defaultDriverId: c.defaultDriverId,
    addresses: c.addresses,
    employees: c.employees,
  }));

  const dbDishes = await prisma.dish.findMany({
    where: { sku: { in: SEED_DISHES.map((d) => d.sku) } },
    include: {
      tierPrices: true,
      optionGroups: {
        include: {
          options: { include: { option: { include: { tierPrices: true } } } },
          portions: { include: { portionSize: true } },
        },
      },
    },
  });

  const standardTierId = tierMap['Standard']?.id;
  const partnerTierId = tierMap['Partner']?.id;

  const seededDishes = dbDishes.map((d: any) => {
    const tierPrices: Record<string, number> = {};
    for (const tp of d.tierPrices) {
      tierPrices[tp.tierId] = tp.priceCents;
      if (standardTierId && tp.tierId === standardTierId) {
        tierPrices['Standard'] = tp.priceCents;
      }
      if (partnerTierId && tp.tierId === partnerTierId) {
        tierPrices['Partner'] = tp.priceCents;
      }
    }

    return {
      id: d.id,
      sku: d.sku,
      name: d.name,
      costCents: d.costCents,
      temperature: d.temperature,
      stationId: d.stationId,
      minOrderQty: d.minOrderQty,
      tierPrices,
      groups: d.optionGroups.map((g: any) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        usesPortions: g.usesPortions,
        options: g.options.map((go: any) => {
          const stdPrice =
            go.option.tierPrices?.find((tp: any) => tp.tierId === standardTierId)?.priceCents ?? 0;
          return {
            id: go.option.id,
            name: go.option.name,
            costCents: go.option.costCents,
            priceCents: stdPrice,
          };
        }),
        portions: g.portions.map((gp: any) => ({
          portionSizeId: gp.portionSizeId,
          portionName: gp.portionSize.name,
          extraCents: gp.extraCents,
        })),
      })),
    };
  });

  return {
    users: userMap,
    companies: seededCompanies,
    dishes: seededDishes,
    tiers: tierMap,
    portionSizes: portionMap,
  };
}

/**
 * Main idempotent seed runner
 */
export async function runSeed(prisma: any, options?: RunSeedOptions) {
  const log = (msg: string) => (options?.logger ? options.logger.log(msg) : console.log(`[Seed] ${msg}`));
  const warn = (msg: string) => (options?.logger ? options.logger.warn(msg) : console.warn(`[Seed Warning] ${msg}`));

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // ────────────────────────────────────────────────────────────────
    // 1. Upsert Roles & Users
    // ────────────────────────────────────────────────────────────────
    const roleMap: Record<string, string> = {};
    for (const roleDef of SEED_ROLES) {
      const role = await prisma.role.upsert({
        where: { key: roleDef.key },
        update: {
          name: roleDef.name,
          permissions: roleDef.permissions,
          landingPath: roleDef.landingPath,
          dashboardKey: roleDef.dashboardKey,
          isSystem: roleDef.isSystem,
        },
        create: {
          key: roleDef.key,
          name: roleDef.name,
          permissions: roleDef.permissions,
          landingPath: roleDef.landingPath,
          dashboardKey: roleDef.dashboardKey,
          isSystem: roleDef.isSystem,
        },
      });
      roleMap[roleDef.key] = role.id;
    }

    const userMap: Record<string, { id: string; email: string; name: string }> = {};
    for (const userDef of SEED_USERS) {
      const roleId = roleMap[userDef.roleKey];
      if (!roleId) continue;
      const user = await prisma.user.upsert({
        where: { email: userDef.email },
        update: {
          name: userDef.name,
          passwordHash,
          roleId,
          active: true,
        },
        create: {
          email: userDef.email,
          name: userDef.name,
          passwordHash,
          roleId,
          active: true,
        },
      });
      userMap[userDef.email] = { id: user.id, email: user.email, name: user.name };
    }

    // ────────────────────────────────────────────────────────────────
    // 2. Default Settings
    // ────────────────────────────────────────────────────────────────
    const defaultSettings: Array<{ key: string; value: any }> = [
      { key: 'timezone', value: 'Asia/Kolkata' },
      { key: 'kitchenWorkingDays', value: [1, 2, 3, 4, 5] },
      { key: 'cutoffTime', value: '16:00' },
      { key: 'cutoffDays', value: 2 },
      { key: 'kitchenBufferMinutes', value: 30 },
      { key: 'atRiskWindowMinutes', value: 60 },
      { key: 'onTimeGraceMinutes', value: 10 },
      { key: 'cutoffHoldDates', value: [] },
    ];

    for (const setting of defaultSettings) {
      await prisma.setting.upsert({
        where: { key: setting.key },
        update: {},
        create: {
          key: setting.key,
          value: setting.value,
        },
      });
    }

    const tzSetting = await prisma.setting.findUnique({ where: { key: 'timezone' } });
    const timezone: string = (tzSetting?.value as string) || 'Asia/Kolkata';
    const now = DateTime.now().setZone(timezone);
    const todayStr = now.toISODate()!;

    const existingCompanyCount = await prisma.company.count({
      where: { name: { in: SEED_COMPANIES.map((c) => c.name) } },
    });
    const existingDishCount = await prisma.dish.count({
      where: { sku: { in: SEED_DISHES.map((d) => d.sku) } },
    });

    let context: SeedContext;
    if (existingCompanyCount >= 5 && existingDishCount >= 25) {
      log('Static catalogue and companies already seeded. Loading existing context...');
      context = await loadStaticContext(prisma);
    } else {
      log('Seeding static reference data, catalogue, and companies...');
      // ────────────────────────────────────────────────────────────────
      // 3. Reference Data
      // ────────────────────────────────────────────────────────────────
      const allergenMap: Record<string, string> = {};
    for (const name of ALLERGENS) {
      const row = await prisma.allergen.upsert({
        where: { name },
        update: { active: true },
        create: { name, active: true },
      });
      allergenMap[name] = row.id;
    }

    const tagMap: Record<string, string> = {};
    for (const name of DIETARY_TAGS) {
      const row = await prisma.dietaryTag.upsert({
        where: { name },
        update: { active: true },
        create: { name, active: true },
      });
      tagMap[name] = row.id;
    }

    const stationMap: Record<string, string> = {};
    for (const st of KITCHEN_STATIONS) {
      const row = await prisma.kitchenStation.upsert({
        where: { name: st.name },
        update: { sortOrder: st.sortOrder, active: true },
        create: { name: st.name, sortOrder: st.sortOrder, active: true },
      });
      stationMap[st.name] = row.id;
    }

    const portionMap: Record<string, string> = {};
    for (const ps of PORTION_SIZES) {
      const row = await prisma.portionSize.upsert({
        where: { name: ps.name },
        update: { sortOrder: ps.sortOrder, active: true },
        create: { name: ps.name, sortOrder: ps.sortOrder, active: true },
      });
      portionMap[ps.name] = row.id;
    }

    // ────────────────────────────────────────────────────────────────
    // 4. Price Tiers (Standard, Enterprise 90%, Partner 240%)
    // ────────────────────────────────────────────────────────────────
    const standardTier = await prisma.priceTier.upsert({
      where: { name: 'Standard' },
      update: {
        isDefault: true,
        derivation: 'NONE',
        baseTierId: null,
        factorBps: null,
        active: true,
      },
      create: {
        name: 'Standard',
        isDefault: true,
        derivation: 'NONE',
        baseTierId: null,
        factorBps: null,
        active: true,
      },
    });

    const enterpriseTier = await prisma.priceTier.upsert({
      where: { name: 'Enterprise' },
      update: {
        isDefault: false,
        derivation: 'TIER_FACTOR',
        baseTierId: standardTier.id,
        factorBps: 9000, // 90%
        active: true,
      },
      create: {
        name: 'Enterprise',
        isDefault: false,
        derivation: 'TIER_FACTOR',
        baseTierId: standardTier.id,
        factorBps: 9000,
        active: true,
      },
    });

    const partnerTier = await prisma.priceTier.upsert({
      where: { name: 'Partner' },
      update: {
        isDefault: false,
        derivation: 'COST_FACTOR',
        baseTierId: null,
        factorBps: 24000, // 240%
        active: true,
      },
      create: {
        name: 'Partner',
        isDefault: false,
        derivation: 'COST_FACTOR',
        baseTierId: null,
        factorBps: 24000,
        active: true,
      },
    });

    const tierMap: Record<string, { id: string; name: string }> = {
      Standard: standardTier,
      Enterprise: enterpriseTier,
      Partner: partnerTier,
    };

    // ────────────────────────────────────────────────────────────────
    // 5. Menu Categories (Bowls, Breakfast, Wraps, Desserts, Chef's Table)
    // ────────────────────────────────────────────────────────────────
    const categoryMap: Record<string, string> = {};
    for (const cat of MENU_CATEGORIES) {
      const row = await prisma.menuCategory.upsert({
        where: { slug: cat.slug },
        update: {
          name: cat.name,
          sortOrder: cat.sortOrder,
          isSecret: cat.isSecret,
          active: true,
        },
        create: {
          name: cat.name,
          slug: cat.slug,
          sortOrder: cat.sortOrder,
          isSecret: cat.isSecret,
          active: true,
        },
      });
      categoryMap[cat.slug] = row.id;
    }

    // ────────────────────────────────────────────────────────────────
    // 6. Options (~35 options)
    // ────────────────────────────────────────────────────────────────
    const optionMap: Record<string, { id: string; name: string; costCents: number; priceCents: number }> = {};
    for (const optDef of SEED_OPTIONS) {
      let opt = await prisma.option.findFirst({ where: { name: optDef.name } });
      if (!opt) {
        opt = await prisma.option.create({
          data: {
            name: optDef.name,
            costCents: optDef.costCents,
            active: true,
          },
        });
      } else {
        opt = await prisma.option.update({
          where: { id: opt.id },
          data: {
            costCents: optDef.costCents,
            active: true,
          },
        });
      }

      // Option price in Standard tier
      await prisma.optionTierPrice.upsert({
        where: {
          optionId_tierId: {
            optionId: opt.id,
            tierId: standardTier.id,
          },
        },
        update: { priceCents: optDef.standardPriceCents },
        create: {
          optionId: opt.id,
          tierId: standardTier.id,
          priceCents: optDef.standardPriceCents,
        },
      });

      optionMap[optDef.name] = {
        id: opt.id,
        name: opt.name,
        costCents: opt.costCents,
        priceCents: optDef.standardPriceCents,
      };
    }

    // ────────────────────────────────────────────────────────────────
    // 7. Dishes (30 dishes across 5 categories)
    // ────────────────────────────────────────────────────────────────
    const seededDishes: SeedContext['dishes'] = [];

    for (const d of SEED_DISHES) {
      const stationId = d.stationName ? stationMap[d.stationName] ?? null : null;

      const dish = await prisma.dish.upsert({
        where: { sku: d.sku },
        update: {
          name: d.name,
          description: d.description,
          temperature: d.temperature,
          costCents: d.costCents,
          stationId,
          minOrderQty: d.minOrderQty ?? null,
          active: true,
        },
        create: {
          sku: d.sku,
          name: d.name,
          description: d.description,
          temperature: d.temperature,
          costCents: d.costCents,
          stationId,
          minOrderQty: d.minOrderQty ?? null,
          active: true,
        },
      });

      // Link to Category via MenuItem
      const catId = categoryMap[d.categorySlug];
      if (catId) {
        await prisma.menuItem.upsert({
          where: {
            categoryId_dishId: {
              categoryId: catId,
              dishId: dish.id,
            },
          },
          update: { active: true },
          create: {
            categoryId: catId,
            dishId: dish.id,
            sortOrder: 1,
            active: true,
          },
        });
      }

      // Link Allergens
      if (d.allergens && d.allergens.length > 0) {
        for (const algName of d.allergens) {
          const allergenId = allergenMap[algName];
          if (allergenId) {
            await prisma.dishAllergen.upsert({
              where: {
                dishId_allergenId: { dishId: dish.id, allergenId },
              },
              update: {},
              create: { dishId: dish.id, allergenId },
            });
          }
        }
      }

      // Link Dietary Tags
      if (d.dietaryTags && d.dietaryTags.length > 0) {
        for (const tagName of d.dietaryTags) {
          const tagId = tagMap[tagName];
          if (tagId) {
            await prisma.dishDietaryTag.upsert({
              where: {
                dishId_tagId: { dishId: dish.id, tagId },
              },
              update: {},
              create: { dishId: dish.id, tagId },
            });
          }
        }
      }

      // Explicit Standard Price (deliberately omitted for 2 dishes: BWL-008 and CHF-003)
      const tierPrices: Record<string, number> = {};
      if (d.standardPriceCents !== undefined) {
        await prisma.dishTierPrice.upsert({
          where: {
            dishId_tierId: {
              dishId: dish.id,
              tierId: standardTier.id,
            },
          },
          update: { priceCents: d.standardPriceCents },
          create: {
            dishId: dish.id,
            tierId: standardTier.id,
            priceCents: d.standardPriceCents,
          },
        });
        tierPrices['Standard'] = d.standardPriceCents;
        tierPrices[standardTier.id] = d.standardPriceCents;
      }

      // Partner Override if specified
      if (d.partnerOverrideCents !== undefined) {
        await prisma.dishTierPrice.upsert({
          where: {
            dishId_tierId: {
              dishId: dish.id,
              tierId: partnerTier.id,
            },
          },
          update: { priceCents: d.partnerOverrideCents },
          create: {
            dishId: dish.id,
            tierId: partnerTier.id,
            priceCents: d.partnerOverrideCents,
          },
        });
        tierPrices['Partner'] = d.partnerOverrideCents;
        tierPrices[partnerTier.id] = d.partnerOverrideCents;
      }

      // Option Groups for Dish
      const dishGroupData: SeedContext['dishes'][0]['groups'] = [];
      for (const grpDef of d.groups) {
        let grp = await prisma.optionGroup.findFirst({
          where: { dishId: dish.id, name: grpDef.name },
        });

        if (!grp) {
          grp = await prisma.optionGroup.create({
            data: {
              dishId: dish.id,
              name: grpDef.name,
              required: grpDef.required,
              sortOrder: grpDef.sortOrder,
              usesPortions: grpDef.usesPortions ?? false,
            },
          });
        } else {
          grp = await prisma.optionGroup.update({
            where: { id: grp.id },
            data: {
              required: grpDef.required,
              sortOrder: grpDef.sortOrder,
              usesPortions: grpDef.usesPortions ?? false,
            },
          });
        }

        // Link options
        const groupOptionsData: any[] = [];
        let sortIdx = 1;
        for (const optName of grpDef.options) {
          const opt = optionMap[optName];
          if (opt) {
            await prisma.optionGroupOption.upsert({
              where: {
                groupId_optionId: {
                  groupId: grp.id,
                  optionId: opt.id,
                },
              },
              update: { sortOrder: sortIdx },
              create: {
                groupId: grp.id,
                optionId: opt.id,
                sortOrder: sortIdx,
              },
            });
            groupOptionsData.push(opt);
            sortIdx++;
          }
        }

        // Link portions if usesPortions
        const groupPortionsData: any[] = [];
        if (grpDef.usesPortions) {
          const regId = portionMap['Regular'];
          const lrgId = portionMap['Large'];
          if (regId) {
            await prisma.optionGroupPortion.upsert({
              where: {
                groupId_portionSizeId: {
                  groupId: grp.id,
                  portionSizeId: regId,
                },
              },
              update: { extraCents: 0, sortOrder: 1 },
              create: {
                groupId: grp.id,
                portionSizeId: regId,
                extraCents: 0,
                sortOrder: 1,
              },
            });
            groupPortionsData.push({ portionSizeId: regId, portionName: 'Regular', extraCents: 0 });
          }
          if (lrgId) {
            await prisma.optionGroupPortion.upsert({
              where: {
                groupId_portionSizeId: {
                  groupId: grp.id,
                  portionSizeId: lrgId,
                },
              },
              update: { extraCents: 150, sortOrder: 2 },
              create: {
                groupId: grp.id,
                portionSizeId: lrgId,
                extraCents: 150,
                sortOrder: 2,
              },
            });
            groupPortionsData.push({ portionSizeId: lrgId, portionName: 'Large', extraCents: 150 });
          }
        }

        dishGroupData.push({
          id: grp.id,
          name: grp.name,
          required: grp.required,
          usesPortions: grp.usesPortions,
          options: groupOptionsData,
          portions: groupPortionsData,
        });
      }

      seededDishes.push({
        id: dish.id,
        sku: dish.sku,
        name: dish.name,
        costCents: dish.costCents,
        temperature: dish.temperature,
        stationId: dish.stationId,
        minOrderQty: dish.minOrderQty,
        tierPrices,
        groups: dishGroupData,
      });
    }

    // ────────────────────────────────────────────────────────────────
    // 8. Companies (5 fictional companies)
    // ────────────────────────────────────────────────────────────────
    const seededCompanies: SeedContext['companies'] = [];

    for (const compDef of SEED_COMPANIES) {
      const tier = tierMap[compDef.tierName] || standardTier;
      const defaultDriver = compDef.defaultDriverEmail
        ? userMap[compDef.defaultDriverEmail]?.id ?? null
        : null;

      const comp = await prisma.company.upsert({
        where: { name: compDef.name },
        update: {
          tierId: tier.id,
          workingDays: compDef.workingDays,
          defaultDeliveryTimeMin: compDef.defaultDeliveryTimeMin,
          dispatchLeadMinutes: compDef.dispatchLeadMinutes,
          defaultPackaging: compDef.defaultPackaging,
          defaultDriverId: defaultDriver,
          driverNotes: compDef.driverNotes ?? null,
          billingName: compDef.billingName,
          billingEmail: compDef.billingEmail,
          billingAddress: compDef.billingAddress,
          active: true,
        },
        create: {
          name: compDef.name,
          tierId: tier.id,
          workingDays: compDef.workingDays,
          defaultDeliveryTimeMin: compDef.defaultDeliveryTimeMin,
          dispatchLeadMinutes: compDef.dispatchLeadMinutes,
          defaultPackaging: compDef.defaultPackaging,
          defaultDriverId: defaultDriver,
          driverNotes: compDef.driverNotes ?? null,
          billingName: compDef.billingName,
          billingEmail: compDef.billingEmail,
          billingAddress: compDef.billingAddress,
          active: true,
        },
      });

      // Domains
      for (const dom of compDef.domains) {
        await prisma.companyDomain.upsert({
          where: { domain: dom },
          update: { companyId: comp.id },
          create: { domain: dom, companyId: comp.id },
        });
      }

      // Addresses
      const seededAddresses: any[] = [];
      for (const addrDef of compDef.addresses) {
        let addr = await prisma.companyAddress.findFirst({
          where: { companyId: comp.id, label: addrDef.label },
        });

        if (!addr) {
          addr = await prisma.companyAddress.create({
            data: {
              companyId: comp.id,
              label: addrDef.label,
              line1: addrDef.line1,
              line2: addrDef.line2 ?? null,
              city: addrDef.city,
              postcode: addrDef.postcode,
              isDefault: addrDef.isDefault,
              active: true,
            },
          });
        } else {
          addr = await prisma.companyAddress.update({
            where: { id: addr.id },
            data: {
              line1: addrDef.line1,
              line2: addrDef.line2 ?? null,
              city: addrDef.city,
              postcode: addrDef.postcode,
              isDefault: addrDef.isDefault,
            },
          });
        }
        seededAddresses.push(addr);
      }

      // Employees
      let ownerEmployeeId: string | null = null;
      const seededEmployees: any[] = [];

      for (const empDef of compDef.employees) {
        const emp = await prisma.employee.upsert({
          where: { email: empDef.email },
          update: {
            name: empDef.name,
            phone: empDef.phone ?? null,
            canChooseAddress: empDef.canChooseAddress ?? false,
            canChangeTime: empDef.canChangeTime ?? false,
            canChangePackaging: empDef.canChangePackaging ?? false,
            companyId: comp.id,
            active: true,
          },
          create: {
            name: empDef.name,
            email: empDef.email,
            phone: empDef.phone ?? null,
            canChooseAddress: empDef.canChooseAddress ?? false,
            canChangeTime: empDef.canChangeTime ?? false,
            canChangePackaging: empDef.canChangePackaging ?? false,
            companyId: comp.id,
            active: true,
          },
        });

        if (empDef.isOwner) {
          ownerEmployeeId = emp.id;
        }

        // Link Employee Allergens
        if (empDef.allergens) {
          for (const alg of empDef.allergens) {
            const algId = allergenMap[alg];
            if (algId) {
              await prisma.employeeAllergen.upsert({
                where: { employeeId_allergenId: { employeeId: emp.id, allergenId: algId } },
                update: {},
                create: { employeeId: emp.id, allergenId: algId },
              });
            }
          }
        }

        // Link Employee Dietary Tags
        if (empDef.dietaryTags) {
          for (const tag of empDef.dietaryTags) {
            const tagId = tagMap[tag];
            if (tagId) {
              await prisma.employeeDietaryTag.upsert({
                where: { employeeId_tagId: { employeeId: emp.id, tagId } },
                update: {},
                create: { employeeId: emp.id, tagId },
              });
            }
          }
        }

        seededEmployees.push(emp);
      }

      // Set owner on company
      if (ownerEmployeeId) {
        await prisma.company.update({
          where: { id: comp.id },
          data: { ownerEmployeeId },
        });
      }

      // Company Holiday if configured
      if (compDef.holidayNextWeek) {
        // Find next monday + dayOffset
        const daysUntilNextMon = ((1 + 7 - now.weekday) % 7) || 7;
        const holidayDateStr = addDays(todayStr, daysUntilNextMon + compDef.holidayNextWeek.dayOffset);
        const holidayDbDate = stringToDbDate(holidayDateStr);

        await prisma.companyHoliday.upsert({
          where: {
            companyId_date: {
              companyId: comp.id,
              date: holidayDbDate,
            },
          },
          update: { name: compDef.holidayNextWeek.name },
          create: {
            companyId: comp.id,
            date: holidayDbDate,
            name: compDef.holidayNextWeek.name,
          },
        });
      }

      // Hidden Categories
      if (compDef.hiddenCategories) {
        for (const catSlug of compDef.hiddenCategories) {
          const catId = categoryMap[catSlug];
          if (catId) {
            await prisma.companyHiddenCategory.upsert({
              where: {
                companyId_categoryId: {
                  companyId: comp.id,
                  categoryId: catId,
                },
              },
              update: {},
              create: { companyId: comp.id, categoryId: catId },
            });
          }
        }
      }

      // Hidden Items
      if (compDef.hiddenItemSkus) {
        for (const sku of compDef.hiddenItemSkus) {
          const targetDish = seededDishes.find((d) => d.sku === sku);
          if (targetDish) {
            const menuItem = await prisma.menuItem.findFirst({
              where: { dishId: targetDish.id },
            });
            if (menuItem) {
              await prisma.companyHiddenItem.upsert({
                where: {
                  companyId_menuItemId: {
                    companyId: comp.id,
                    menuItemId: menuItem.id,
                  },
                },
                update: {},
                create: {
                  companyId: comp.id,
                  menuItemId: menuItem.id,
                },
              });
            }
          }
        }
      }

      seededCompanies.push({
        id: comp.id,
        name: comp.name,
        tierId: comp.tierId,
        tierName: compDef.tierName,
        workingDays: comp.workingDays,
        defaultDeliveryTimeMin: comp.defaultDeliveryTimeMin,
        dispatchLeadMinutes: comp.dispatchLeadMinutes,
        defaultPackaging: comp.defaultPackaging,
        defaultDriverId: comp.defaultDriverId,
        addresses: seededAddresses,
        employees: seededEmployees,
      });
    }

      context = {
        users: userMap,
        companies: seededCompanies,
        dishes: seededDishes,
        tiers: tierMap,
        portionSizes: portionMap,
      };
    }

    // ────────────────────────────────────────────────────────────────
    // 9. Generate Date-Relative DEMO Orders across [today-10, today+7]
    // ────────────────────────────────────────────────────────────────

    const existingDemoOrdersCount = await prisma.order.count({
      where: { source: 'DEMO' },
    });

    const shouldGenerateOrders = options?.force || existingDemoOrdersCount === 0;

    if (shouldGenerateOrders) {
      log(`Cleaning existing DEMO data before generating date-relative orders for ${todayStr}...`);
      await cleanDemoData(prisma);

      log(`Generating DEMO orders across [${addDays(todayStr, -10)} .. ${addDays(todayStr, 7)}]...`);
      const { demoHoldDate } = await generateDemoOrders(prisma, context, todayStr, timezone);
      log(`DEMO orders generated. Cut-off demo date set to: ${demoHoldDate}`);
    } else {
      log(`Existing DEMO orders found (${existingDemoOrdersCount}). Ensuring demo data is fresh for ${todayStr}...`);
      await ensureDemoFresh(prisma, context, todayStr, timezone, log);
    }

    log('Idempotent seed completed successfully!');
    return { success: true, today: todayStr };
  } catch (err: any) {
    warn(`Seed skipped or failed: ${err.message}`);
    throw err;
  }
}

/**
 * Ensures demo data is fresh if date rolled over without a full reseed
 */
export async function ensureDemoFresh(
  prisma: any,
  ctx: SeedContext,
  todayStr: string,
  timezone: string,
  log?: (msg: string) => void,
) {
  const driverUser = ctx.users['driver@test.com'];
  const todayDb = stringToDbDate(todayStr);

  // 1. Check if driver has ≥4 drops today
  const todayDriverDrops = await prisma.drop.count({
    where: {
      deliveryDate: todayDb,
      driverId: driverUser.id,
    },
  });

  if (todayDriverDrops < 4) {
    if (log) log(`Driver has only ${todayDriverDrops} drops for today. Re-generating fresh demo orders for ${todayStr}...`);
    await cleanDemoData(prisma);
    await generateDemoOrders(prisma, ctx, todayStr, timezone);
    return;
  }

  // 2. Close out stale demo work: DEMO orders with deliveryDate < today still CONFIRMED
  await prisma.order.updateMany({
    where: {
      source: 'DEMO',
      deliveryDate: { lt: todayDb },
      status: 'CONFIRMED',
    },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    },
  });

  // 3. Ensure cutoffHoldDates has a future date
  const setting = await prisma.setting.findUnique({ where: { key: 'cutoffHoldDates' } });
  const holdDates: string[] = (setting?.value as string[]) || [];
  const validFutureHoldDates = holdDates.filter((d) => d > todayStr);

  if (validFutureHoldDates.length === 0) {
    const demoHoldDate = addDays(todayStr, 1);
    await prisma.setting.upsert({
      where: { key: 'cutoffHoldDates' },
      update: { value: [demoHoldDate] },
      create: { key: 'cutoffHoldDates', value: [demoHoldDate] },
    });
  }
}

@Injectable()
export class SeedService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SeedService.name);
  private dailyCronInterval: NodeJS.Timeout | null = null;
  private lastCronDate: string = '';

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const shouldSeed = process.env.SEED_ON_BOOT !== 'false';
    if (shouldSeed) {
      this.logger.log('Running automatic idempotent seed on API boot...');
      try {
        await runSeed(this.prisma, { force: false, logger: this.logger });
      } catch (err: any) {
        this.logger.error(`Boot seed error: ${err.message}`);
      }
    } else {
      this.logger.log('SEED_ON_BOOT is set to false, skipping boot seed');
    }

    this.startDailyCron();
  }

  onApplicationShutdown() {
    if (this.dailyCronInterval) {
      clearInterval(this.dailyCronInterval);
      this.dailyCronInterval = null;
    }
  }

  /**
   * Reseeds DEMO data (admin triggered or manual). Leaves STAFF data untouched.
   */
  async reseed(force: boolean = true) {
    const result = await runSeed(this.prisma, { force, logger: this.logger });
    return {
      message: 'Demo seed data has been successfully refreshed.',
      ...result,
    };
  }

  /**
   * Daily check at 00:05 kitchen timezone
   */
  private startDailyCron() {
    this.dailyCronInterval = setInterval(async () => {
      try {
        const tzSetting = await this.prisma.setting.findUnique({ where: { key: 'timezone' } });
        const timezone = (tzSetting?.value as string) || 'Asia/Kolkata';
        const now = DateTime.now().setZone(timezone);

        // Check if 00:05
        if (now.hour === 0 && now.minute === 5) {
          const todayStr = now.toISODate()!;
          if (this.lastCronDate !== todayStr) {
            this.lastCronDate = todayStr;
            this.logger.log(`Daily cron at 00:05 (${timezone}): ensuring demo freshness for ${todayStr}...`);
            await runSeed(this.prisma, { force: true, logger: this.logger });
          }
        }
      } catch (err: any) {
        this.logger.error(`Daily cron check failed: ${err.message}`);
      }
    }, 60_000);
  }
}
