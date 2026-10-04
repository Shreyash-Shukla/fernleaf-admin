// ─── Date-Relative Seed Generator ─────────────────────────────────────

import { DateTime } from 'luxon';
import {
  stringToDbDate,
  dbDateToString,
  addDays,
  planTimes,
  formatInvoiceNumber,
} from '@repo/shared';

async function getNextInvoiceNumber(prisma: any): Promise<string> {
  const count = await prisma.invoice.count();
  let seq = count + 1;
  let num = formatInvoiceNumber(seq);
  let existing = await prisma.invoice.findUnique({ where: { number: num } });
  while (existing) {
    seq++;
    num = formatInvoiceNumber(seq);
    existing = await prisma.invoice.findUnique({ where: { number: num } });
  }
  return num;
}

export interface SeedContext {
  users: Record<string, { id: string; email: string; name: string }>;
  companies: Array<{
    id: string;
    name: string;
    tierId: string | null;
    tierName: string;
    workingDays: number[];
    defaultDeliveryTimeMin: number;
    dispatchLeadMinutes: number;
    defaultPackaging: string;
    defaultDriverId: string | null;
    addresses: Array<{ id: string; label: string; line1: string; city: string; postcode: string }>;
    employees: Array<{ id: string; name: string; email: string }>;
  }>;
  dishes: Array<{
    id: string;
    sku: string;
    name: string;
    costCents: number;
    temperature: string;
    stationId: string | null;
    minOrderQty: number | null;
    tierPrices: Record<string, number>; // tierId -> priceCents
    groups: Array<{
      id: string;
      name: string;
      required: boolean;
      usesPortions: boolean;
      options: Array<{
        id: string;
        name: string;
        costCents: number;
        priceCents: number;
      }>;
      portions: Array<{
        portionSizeId: string;
        portionName: string;
        extraCents: number;
      }>;
    }>;
  }>;
  tiers: Record<string, { id: string; name: string }>;
  portionSizes: Record<string, string>; // name -> id
}

/**
 * Deterministically create order line combinations and option snapshots
 */
export function buildLineData(
  dish: SeedContext['dishes'][0],
  tierId: string,
  quantity: number = 1,
) {
  const dishPriceCents = dish.tierPrices[tierId] ?? dish.tierPrices['Standard'] ?? 1000;
  const dishCostCents = dish.costCents;

  const selectedOptions: Array<{
    groupName: string;
    optionName: string;
    portionName: string | null;
    optionCents: number;
    portionExtraCents: number;
    optionCostCents: number;
  }> = [];

  for (const group of dish.groups) {
    if (group.options.length > 0) {
      const opt = group.options[0];
      let portionName: string | null = null;
      let portionExtraCents = 0;

      if (group.usesPortions && group.portions.length > 0) {
        const portion = group.portions[0];
        portionName = portion.portionName;
        portionExtraCents = portion.extraCents;
      }

      selectedOptions.push({
        groupName: group.name,
        optionName: opt.name,
        portionName,
        optionCents: opt.priceCents,
        portionExtraCents,
        optionCostCents: opt.costCents,
      });
    }
  }

  const extraOptionsCents = selectedOptions.reduce(
    (sum, o) => sum + o.optionCents + o.portionExtraCents,
    0,
  );
  const extraCostCents = selectedOptions.reduce(
    (sum, o) => sum + o.optionCostCents,
    0,
  );

  const unitCents = dishPriceCents + extraOptionsCents;
  const unitCostCents = dishCostCents + extraCostCents;
  const totalCents = unitCents * quantity;

  // Build canonical signature and label
  const sortedParts = [...selectedOptions]
    .sort((a, b) => a.groupName.localeCompare(b.groupName))
    .map((o) => `${o.groupName}:${o.optionName}${o.portionName ? `:${o.portionName}` : ''}`);
  const signature = sortedParts.join('|');

  const optionLabels = selectedOptions.map((o) => o.optionName).join(', ');
  const label = `${dish.name}${optionLabels ? ` w/ ${optionLabels}` : ''}`;

  return {
    dishId: dish.id,
    dishName: dish.name,
    dishSku: dish.sku,
    quantity,
    dishPriceCents,
    dishCostCents,
    tierName: 'Standard',
    lineTotalCents: totalCents,
    sortOrder: 1,
    combinations: [
      {
        signature: signature || 'standard',
        label,
        quantity,
        unitCents,
        unitCostCents,
        totalCents,
        sortOrder: 1,
        options: selectedOptions,
      },
    ],
  };
}

/**
 * Generate all demo orders across [today-10, today+7]
 */
export async function generateDemoOrders(prisma: any, ctx: SeedContext, todayStr: string, timezone: string) {
  const adminUser = ctx.users['admin@test.com'];
  const kitchenUser = ctx.users['kitchen@test.com'];
  const driverUser = ctx.users['driver@test.com'];

  const now = DateTime.now().setZone(timezone);

  // Helper to pick dishes that have pricing in company's tier
  const getPricedDishes = (tierId: string) =>
    ctx.dishes.filter((d) => d.tierPrices[tierId] !== undefined || d.tierPrices['Standard'] !== undefined);

  // Track created orders and drops for invoicing & stage setup
  const createdOrders: any[] = [];
  const createdDrops: any[] = [];

  // ══════════════════════════════════════════════════════════════════
  // PART 1: Past Dates [today-10 to today-1]
  // Mostly DELIVERED, some CANCELLED / REJECTED
  // ══════════════════════════════════════════════════════════════════
  for (let offset = -10; offset <= -1; offset++) {
    const dateStr = addDays(todayStr, offset);
    const dt = DateTime.fromISO(dateStr, { zone: timezone });
    const weekday = dt.weekday; // 1=Mon .. 7=Sun

    // Pick companies working on this day
    const activeCompanies = ctx.companies.filter((c) => c.workingDays.includes(weekday));
    if (activeCompanies.length === 0) continue;

    // Pick 2 companies per past day
    const comp1 = activeCompanies[Math.abs(offset) % activeCompanies.length];
    const comp2 = activeCompanies[(Math.abs(offset) + 1) % activeCompanies.length];

    for (const comp of [comp1, comp2]) {
      const address = comp.addresses[0];
      const employee = comp.employees[Math.abs(offset) % comp.employees.length];
      const pricedDishes = getPricedDishes(comp.tierId || '');
      const dish = pricedDishes[Math.abs(offset) % pricedDishes.length] || ctx.dishes[0];

      const deliveryTimeMin = comp.defaultDeliveryTimeMin;
      const plannedTimes = planTimes(
        dateStr,
        deliveryTimeMin,
        comp.dispatchLeadMinutes,
        30,
        timezone,
      );

      const lineData = buildLineData(dish, comp.tierId || '', dish.minOrderQty || 1);

      // Determine status: mostly DELIVERED, couple CANCELLED, one REJECTED
      let status = 'DELIVERED';
      let cancelReason: string | null = null;
      let rejectReason: string | null = null;

      if (offset === -6) {
        status = 'CANCELLED';
        cancelReason = 'Employee requested cancellation due to travel';
      } else if (offset === -2 && comp.name === comp2.name) {
        status = 'CANCELLED';
        cancelReason = 'Internal team event rescheduled';
      } else if (offset === -4 && comp.name === comp2.name) {
        status = 'REJECTED';
        rejectReason = 'Kitchen capacity threshold reached for that slot';
      }

      // If delivered, ensure Drop exists
      let dropId: string | null = null;
      if (status === 'DELIVERED') {
        const drop = await prisma.drop.upsert({
          where: {
            deliveryDate_companyId_addressId_deliveryTimeMin: {
              deliveryDate: stringToDbDate(dateStr),
              companyId: comp.id,
              addressId: address.id,
              deliveryTimeMin,
            },
          },
          create: {
            deliveryDate: stringToDbDate(dateStr),
            companyId: comp.id,
            addressId: address.id,
            deliveryTimeMin,
            driverId: comp.defaultDriverId ?? driverUser.id,
            outForDeliveryAt: new Date(`${dateStr}T11:30:00Z`),
            deliveredAt: new Date(`${dateStr}T12:15:00Z`),
            deliveredNote: 'Delivered to reception.',
            deliveredById: driverUser.id,
            onTime: true,
          },
          update: {
            driverId: comp.defaultDriverId ?? driverUser.id,
            outForDeliveryAt: new Date(`${dateStr}T11:30:00Z`),
            deliveredAt: new Date(`${dateStr}T12:15:00Z`),
            deliveredNote: 'Delivered to reception.',
            deliveredById: driverUser.id,
            onTime: true,
          },
        });
        dropId = drop.id;
        createdDrops.push(drop);
      }

      const order = await prisma.order.create({
        data: {
          employeeId: employee.id,
          companyId: comp.id,
          deliveryDate: stringToDbDate(dateStr),
          deliveryTimeMin,
          addressId: address.id,
          addressSnapshot: address,
          packaging: comp.defaultPackaging as any,
          status: status as any,
          source: 'DEMO',
          totalCents: lineData.lineTotalCents,
          leadMinutes: comp.dispatchLeadMinutes,
          notes: `Demo order for ${dateStr}`,
          cancelReason,
          rejectReason,
          placedAt: new Date(`${dateStr}T07:30:00Z`),
          confirmedAt: new Date(`${dateStr}T08:00:00Z`),
          kitchenStartedAt: status === 'DELIVERED' ? new Date(`${dateStr}T09:30:00Z`) : null,
          kitchenReadyAt: status === 'DELIVERED' ? new Date(`${dateStr}T10:45:00Z`) : null,
          dispatchReadyAt: status === 'DELIVERED' ? new Date(`${dateStr}T11:00:00Z`) : null,
          outForDeliveryAt: status === 'DELIVERED' ? new Date(`${dateStr}T11:30:00Z`) : null,
          deliveredAt: status === 'DELIVERED' ? new Date(`${dateStr}T12:15:00Z`) : null,
          cancelledAt: status === 'CANCELLED' ? new Date(`${dateStr}T08:15:00Z`) : null,
          rejectedAt: status === 'REJECTED' ? new Date(`${dateStr}T08:30:00Z`) : null,
          plannedKitchenReadyAt: new Date(plannedTimes.plannedKitchenReadyAt),
          plannedDispatchReadyAt: new Date(plannedTimes.plannedDispatchReadyAt),
          dropId,
          createdById: adminUser.id,
        },
      });

      // Create line & combination
      const orderLine = await prisma.orderLine.create({
        data: {
          orderId: order.id,
          dishId: lineData.dishId,
          dishName: lineData.dishName,
          dishSku: lineData.dishSku,
          quantity: lineData.quantity,
          dishPriceCents: lineData.dishPriceCents,
          dishCostCents: lineData.dishCostCents,
          tierName: lineData.tierName,
          lineTotalCents: lineData.lineTotalCents,
          sortOrder: 1,
        },
      });

      for (const comb of lineData.combinations) {
        const olc = await prisma.orderLineCombination.create({
          data: {
            orderLineId: orderLine.id,
            signature: comb.signature,
            label: comb.label,
            quantity: comb.quantity,
            unitCents: comb.unitCents,
            unitCostCents: comb.unitCostCents,
            totalCents: comb.totalCents,
            sortOrder: 1,
            startedAt: status === 'DELIVERED' ? new Date(`${dateStr}T09:40:00Z`) : null,
            doneAt: status === 'DELIVERED' ? new Date(`${dateStr}T10:30:00Z`) : null,
            startedById: status === 'DELIVERED' ? kitchenUser.id : null,
            doneById: status === 'DELIVERED' ? kitchenUser.id : null,
          },
        });

        if (comb.options.length > 0) {
          await prisma.combinationOption.createMany({
            data: comb.options.map((opt) => ({
              combinationId: olc.id,
              groupName: opt.groupName,
              optionName: opt.optionName,
              portionName: opt.portionName,
              optionCents: opt.optionCents,
              portionExtraCents: opt.portionExtraCents,
              optionCostCents: opt.optionCostCents,
            })),
          });
        }
      }

      createdOrders.push(order);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Invoicing & Adjustment setup for past delivered orders (~60% invoiced)
  // ══════════════════════════════════════════════════════════════════
  const pastDeliveredNexus = createdOrders.filter(
    (o) => o.status === 'DELIVERED' && o.companyId === ctx.companies.find((c) => c.name === 'Nexus Tech Solutions')?.id,
  );
  const pastDeliveredMeridian = createdOrders.filter(
    (o) => o.status === 'DELIVERED' && o.companyId === ctx.companies.find((c) => c.name === 'Meridian BioLabs')?.id,
  );

  // 1. Invoice 1: PAID (for Nexus Tech Solutions)
  if (pastDeliveredNexus.length >= 2) {
    const ordersToInvoice = pastDeliveredNexus.slice(0, 3);
    const invoiceTotal = ordersToInvoice.reduce((sum, o) => sum + o.totalCents, 0);

    const invoiceNumber1 = await getNextInvoiceNumber(prisma);
    const inv1 = await prisma.invoice.create({
      data: {
        number: invoiceNumber1,
        companyId: ordersToInvoice[0].companyId,
        status: 'PAID',
        totalCents: invoiceTotal,
        issuedAt: new Date(addDays(todayStr, -7)),
        paidAt: new Date(addDays(todayStr, -6)),
        createdById: adminUser.id,
        items: {
          create: ordersToInvoice.map((o) => ({
            kind: 'ORDER',
            orderId: o.id,
            description: `Order #${o.number} catering services`,
            amountCents: o.totalCents,
          })),
        },
      },
    });

    await prisma.order.updateMany({
      where: { id: { in: ordersToInvoice.map((o) => o.id) } },
      data: { invoiceId: inv1.id },
    });
  }

  // 2. Invoice 2: ISSUED (for Meridian BioLabs)
  if (pastDeliveredMeridian.length >= 2) {
    const ordersToInvoice = pastDeliveredMeridian.slice(0, 2);
    const invoiceTotal = ordersToInvoice.reduce((sum, o) => sum + o.totalCents, 0);

    const invoiceNumber2 = await getNextInvoiceNumber(prisma);
    const inv2 = await prisma.invoice.create({
      data: {
        number: invoiceNumber2,
        companyId: ordersToInvoice[0].companyId,
        status: 'ISSUED',
        totalCents: invoiceTotal,
        issuedAt: new Date(addDays(todayStr, -3)),
        paidAt: null,
        createdById: adminUser.id,
        items: {
          create: ordersToInvoice.map((o) => ({
            kind: 'ORDER',
            orderId: o.id,
            description: `Order #${o.number} catering services`,
            amountCents: o.totalCents,
          })),
        },
      },
    });

    await prisma.order.updateMany({
      where: { id: { in: ordersToInvoice.map((o) => o.id) } },
      data: { invoiceId: inv2.id },
    });
  }

  // 3. One Open Adjustment (e.g. short delivery credit on an order)
  const orderForAdj = createdOrders.find((o) => o.status === 'DELIVERED' && o.invoiceId === null);
  if (orderForAdj) {
    await prisma.adjustment.create({
      data: {
        companyId: orderForAdj.companyId,
        orderId: orderForAdj.id,
        reason: 'SHORT_DELIVERY',
        amountCents: -500, // credit
        status: 'OPEN',
        note: 'One side dish portion was missing from delivery batch',
        createdById: adminUser.id,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // PART 2: Today
  // CONFIRMED orders in varied kitchen progress + ≥4 drops for driver@test.com
  // ══════════════════════════════════════════════════════════════════
  const compNexus = ctx.companies.find((c) => c.name === 'Nexus Tech Solutions')!;
  const compApex = ctx.companies.find((c) => c.name === 'Apex Global Capital')!;
  const compStarlight = ctx.companies.find((c) => c.name === 'Starlight Media Group')!;
  const compMeridian = ctx.companies.find((c) => c.name === 'Meridian BioLabs')!;
  const compVanguard = ctx.companies.find((c) => c.name === 'Vanguard Creative Studio')!;

  // ── Drop 1 Today: DELIVERED (assigned to driver@test.com) ──
  const drop1 = await prisma.drop.upsert({
    where: {
      deliveryDate_companyId_addressId_deliveryTimeMin: {
        deliveryDate: stringToDbDate(todayStr),
        companyId: compNexus.id,
        addressId: compNexus.addresses[0].id,
        deliveryTimeMin: 660, // 11:00 AM
      },
    },
    create: {
      deliveryDate: stringToDbDate(todayStr),
      companyId: compNexus.id,
      addressId: compNexus.addresses[0].id,
      deliveryTimeMin: 660,
      driverId: driverUser.id,
      outForDeliveryAt: new Date(now.minus({ hours: 1, minutes: 30 }).toISO()!),
      deliveredAt: new Date(now.minus({ minutes: 45 }).toISO()!),
      deliveredNote: 'Delivered to reception desk on 4th floor. Signed by Sarah.',
      deliveredById: driverUser.id,
      onTime: true,
    },
    update: {
      driverId: driverUser.id,
      outForDeliveryAt: new Date(now.minus({ hours: 1, minutes: 30 }).toISO()!),
      deliveredAt: new Date(now.minus({ minutes: 45 }).toISO()!),
      deliveredNote: 'Delivered to reception desk on 4th floor. Signed by Sarah.',
      deliveredById: driverUser.id,
      onTime: true,
    },
  });

  for (let i = 0; i < 2; i++) {
    const emp = compNexus.employees[i];
    const dish = ctx.dishes[i % ctx.dishes.length];
    const lineData = buildLineData(dish, compNexus.tierId || '');

    const order = await prisma.order.create({
      data: {
        employeeId: emp.id,
        companyId: compNexus.id,
        deliveryDate: stringToDbDate(todayStr),
        deliveryTimeMin: 660,
        addressId: compNexus.addresses[0].id,
        addressSnapshot: compNexus.addresses[0],
        packaging: 'STANDARD',
        status: 'DELIVERED',
        source: 'DEMO',
        totalCents: lineData.lineTotalCents,
        leadMinutes: 60,
        notes: 'Priority drop today',
        placedAt: new Date(now.minus({ hours: 6 }).toISO()!),
        confirmedAt: new Date(now.minus({ hours: 5 }).toISO()!),
        kitchenStartedAt: new Date(now.minus({ hours: 3 }).toISO()!),
        kitchenReadyAt: new Date(now.minus({ hours: 2 }).toISO()!),
        dispatchReadyAt: new Date(now.minus({ hours: 1, minutes: 45 }).toISO()!),
        outForDeliveryAt: new Date(now.minus({ hours: 1, minutes: 30 }).toISO()!),
        deliveredAt: new Date(now.minus({ minutes: 45 }).toISO()!),
        dropId: drop1.id,
        createdById: adminUser.id,
      },
    });

    const ol = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        dishId: lineData.dishId,
        dishName: lineData.dishName,
        dishSku: lineData.dishSku,
        quantity: lineData.quantity,
        dishPriceCents: lineData.dishPriceCents,
        dishCostCents: lineData.dishCostCents,
        tierName: 'Standard',
        lineTotalCents: lineData.lineTotalCents,
        sortOrder: 1,
      },
    });

    const olc = await prisma.orderLineCombination.create({
      data: {
        orderLineId: ol.id,
        signature: lineData.combinations[0].signature,
        label: lineData.combinations[0].label,
        quantity: 1,
        unitCents: lineData.combinations[0].unitCents,
        unitCostCents: lineData.combinations[0].unitCostCents,
        totalCents: lineData.combinations[0].totalCents,
        sortOrder: 1,
        startedAt: new Date(now.minus({ hours: 2, minutes: 45 }).toISO()!),
        doneAt: new Date(now.minus({ hours: 2, minutes: 5 }).toISO()!),
        startedById: kitchenUser.id,
        doneById: kitchenUser.id,
      },
    });

    if (lineData.combinations[0].options.length > 0) {
      await prisma.combinationOption.createMany({
        data: lineData.combinations[0].options.map((opt) => ({
          combinationId: olc.id,
          groupName: opt.groupName,
          optionName: opt.optionName,
          portionName: opt.portionName,
          optionCents: opt.optionCents,
          portionExtraCents: opt.portionExtraCents,
          optionCostCents: opt.optionCostCents,
        })),
      });
    }
  }

  // ── Drop 2 Today: OUT_FOR_DELIVERY (assigned to driver@test.com) ──
  const drop2 = await prisma.drop.upsert({
    where: {
      deliveryDate_companyId_addressId_deliveryTimeMin: {
        deliveryDate: stringToDbDate(todayStr),
        companyId: compApex.id,
        addressId: compApex.addresses[0].id,
        deliveryTimeMin: 720, // 12:00 PM
      },
    },
    create: {
      deliveryDate: stringToDbDate(todayStr),
      companyId: compApex.id,
      addressId: compApex.addresses[0].id,
      deliveryTimeMin: 720,
      driverId: driverUser.id,
      outForDeliveryAt: new Date(now.minus({ minutes: 20 }).toISO()!),
      deliveredAt: null,
      onTime: null,
    },
    update: {
      driverId: driverUser.id,
      outForDeliveryAt: new Date(now.minus({ minutes: 20 }).toISO()!),
      deliveredAt: null,
    },
  });

  for (let i = 0; i < 2; i++) {
    const emp = compApex.employees[i];
    const dish = ctx.dishes[(i + 2) % ctx.dishes.length];
    const lineData = buildLineData(dish, compApex.tierId || '');

    const order = await prisma.order.create({
      data: {
        employeeId: emp.id,
        companyId: compApex.id,
        deliveryDate: stringToDbDate(todayStr),
        deliveryTimeMin: 720,
        addressId: compApex.addresses[0].id,
        addressSnapshot: compApex.addresses[0],
        packaging: 'INSULATED',
        status: 'CONFIRMED',
        source: 'DEMO',
        totalCents: lineData.lineTotalCents,
        leadMinutes: 45,
        placedAt: new Date(now.minus({ hours: 5 }).toISO()!),
        confirmedAt: new Date(now.minus({ hours: 4 }).toISO()!),
        kitchenStartedAt: new Date(now.minus({ hours: 2 }).toISO()!),
        kitchenReadyAt: new Date(now.minus({ minutes: 40 }).toISO()!),
        dispatchReadyAt: new Date(now.minus({ minutes: 30 }).toISO()!),
        outForDeliveryAt: new Date(now.minus({ minutes: 20 }).toISO()!),
        dropId: drop2.id,
        createdById: adminUser.id,
      },
    });

    const ol = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        dishId: lineData.dishId,
        dishName: lineData.dishName,
        dishSku: lineData.dishSku,
        quantity: lineData.quantity,
        dishPriceCents: lineData.dishPriceCents,
        dishCostCents: lineData.dishCostCents,
        tierName: 'Standard',
        lineTotalCents: lineData.lineTotalCents,
        sortOrder: 1,
      },
    });

    const olc = await prisma.orderLineCombination.create({
      data: {
        orderLineId: ol.id,
        signature: lineData.combinations[0].signature,
        label: lineData.combinations[0].label,
        quantity: 1,
        unitCents: lineData.combinations[0].unitCents,
        unitCostCents: lineData.combinations[0].unitCostCents,
        totalCents: lineData.combinations[0].totalCents,
        sortOrder: 1,
        startedAt: new Date(now.minus({ hours: 1, minutes: 45 }).toISO()!),
        doneAt: new Date(now.minus({ minutes: 42 }).toISO()!),
        startedById: kitchenUser.id,
        doneById: kitchenUser.id,
      },
    });

    if (lineData.combinations[0].options.length > 0) {
      await prisma.combinationOption.createMany({
        data: lineData.combinations[0].options.map((opt) => ({
          combinationId: olc.id,
          groupName: opt.groupName,
          optionName: opt.optionName,
          portionName: opt.portionName,
          optionCents: opt.optionCents,
          portionExtraCents: opt.portionExtraCents,
          optionCostCents: opt.optionCostCents,
        })),
      });
    }
  }

  // ── Drop 3 Today: DISPATCH_READY (assigned to driver@test.com) ──
  const drop3 = await prisma.drop.upsert({
    where: {
      deliveryDate_companyId_addressId_deliveryTimeMin: {
        deliveryDate: stringToDbDate(todayStr),
        companyId: compStarlight.id,
        addressId: compStarlight.addresses[0].id,
        deliveryTimeMin: 750, // 12:30 PM
      },
    },
    create: {
      deliveryDate: stringToDbDate(todayStr),
      companyId: compStarlight.id,
      addressId: compStarlight.addresses[0].id,
      deliveryTimeMin: 750,
      driverId: driverUser.id,
      outForDeliveryAt: null,
      deliveredAt: null,
    },
    update: {
      driverId: driverUser.id,
      outForDeliveryAt: null,
      deliveredAt: null,
    },
  });

  for (let i = 0; i < 2; i++) {
    const emp = compStarlight.employees[i];
    const dish = ctx.dishes[(i + 4) % ctx.dishes.length];
    const lineData = buildLineData(dish, compStarlight.tierId || '');

    const order = await prisma.order.create({
      data: {
        employeeId: emp.id,
        companyId: compStarlight.id,
        deliveryDate: stringToDbDate(todayStr),
        deliveryTimeMin: 750,
        addressId: compStarlight.addresses[0].id,
        addressSnapshot: compStarlight.addresses[0],
        packaging: 'STANDARD',
        status: 'CONFIRMED',
        source: 'DEMO',
        totalCents: lineData.lineTotalCents,
        leadMinutes: 60,
        placedAt: new Date(now.minus({ hours: 4 }).toISO()!),
        confirmedAt: new Date(now.minus({ hours: 3 }).toISO()!),
        kitchenStartedAt: new Date(now.minus({ hours: 1 }).toISO()!),
        kitchenReadyAt: new Date(now.minus({ minutes: 15 }).toISO()!),
        dispatchReadyAt: new Date(now.minus({ minutes: 5 }).toISO()!),
        dropId: drop3.id,
        createdById: adminUser.id,
      },
    });

    const ol = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        dishId: lineData.dishId,
        dishName: lineData.dishName,
        dishSku: lineData.dishSku,
        quantity: lineData.quantity,
        dishPriceCents: lineData.dishPriceCents,
        dishCostCents: lineData.dishCostCents,
        tierName: 'Standard',
        lineTotalCents: lineData.lineTotalCents,
        sortOrder: 1,
      },
    });

    const olc = await prisma.orderLineCombination.create({
      data: {
        orderLineId: ol.id,
        signature: lineData.combinations[0].signature,
        label: lineData.combinations[0].label,
        quantity: 1,
        unitCents: lineData.combinations[0].unitCents,
        unitCostCents: lineData.combinations[0].unitCostCents,
        totalCents: lineData.combinations[0].totalCents,
        sortOrder: 1,
        startedAt: new Date(now.minus({ minutes: 45 }).toISO()!),
        doneAt: new Date(now.minus({ minutes: 15 }).toISO()!),
        startedById: kitchenUser.id,
        doneById: kitchenUser.id,
      },
    });

    if (lineData.combinations[0].options.length > 0) {
      await prisma.combinationOption.createMany({
        data: lineData.combinations[0].options.map((opt) => ({
          combinationId: olc.id,
          groupName: opt.groupName,
          optionName: opt.optionName,
          portionName: opt.portionName,
          optionCents: opt.optionCents,
          portionExtraCents: opt.portionExtraCents,
          optionCostCents: opt.optionCostCents,
        })),
      });
    }
  }

  // ── Drop 4 Today: PREPARING (assigned to driver@test.com, AT_RISK in kitchen) ──
  const drop4 = await prisma.drop.upsert({
    where: {
      deliveryDate_companyId_addressId_deliveryTimeMin: {
        deliveryDate: stringToDbDate(todayStr),
        companyId: compMeridian.id,
        addressId: compMeridian.addresses[0].id,
        deliveryTimeMin: 780, // 1:00 PM
      },
    },
    create: {
      deliveryDate: stringToDbDate(todayStr),
      companyId: compMeridian.id,
      addressId: compMeridian.addresses[0].id,
      deliveryTimeMin: 780,
      driverId: driverUser.id,
      outForDeliveryAt: null,
      deliveredAt: null,
    },
    update: {
      driverId: driverUser.id,
      outForDeliveryAt: null,
      deliveredAt: null,
    },
  });

  for (let i = 0; i < 2; i++) {
    const emp = compMeridian.employees[i];
    const dish = ctx.dishes[(i + 6) % ctx.dishes.length];
    const lineData = buildLineData(dish, compMeridian.tierId || '');

    // Set plannedKitchenReadyAt to now + 25 minutes (within 60m at-risk window!)
    const plannedKitchenReadyAt = now.plus({ minutes: 25 }).toJSDate();
    const plannedDispatchReadyAt = now.plus({ minutes: 55 }).toJSDate();

    const order = await prisma.order.create({
      data: {
        employeeId: emp.id,
        companyId: compMeridian.id,
        deliveryDate: stringToDbDate(todayStr),
        deliveryTimeMin: 780,
        addressId: compMeridian.addresses[0].id,
        addressSnapshot: compMeridian.addresses[0],
        packaging: 'ECO',
        status: 'CONFIRMED',
        source: 'DEMO',
        totalCents: lineData.lineTotalCents,
        leadMinutes: 60,
        placedAt: new Date(now.minus({ hours: 3 }).toISO()!),
        confirmedAt: new Date(now.minus({ hours: 2 }).toISO()!),
        kitchenStartedAt: new Date(now.minus({ minutes: 15 }).toISO()!),
        kitchenReadyAt: null,
        plannedKitchenReadyAt,
        plannedDispatchReadyAt,
        dropId: drop4.id,
        createdById: adminUser.id,
      },
    });

    const ol = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        dishId: lineData.dishId,
        dishName: lineData.dishName,
        dishSku: lineData.dishSku,
        quantity: lineData.quantity,
        dishPriceCents: lineData.dishPriceCents,
        dishCostCents: lineData.dishCostCents,
        tierName: 'Standard',
        lineTotalCents: lineData.lineTotalCents,
        sortOrder: 1,
      },
    });

    // One unit started, one unit not started
    const isStarted = i === 0;
    const olc = await prisma.orderLineCombination.create({
      data: {
        orderLineId: ol.id,
        signature: lineData.combinations[0].signature,
        label: lineData.combinations[0].label,
        quantity: 1,
        unitCents: lineData.combinations[0].unitCents,
        unitCostCents: lineData.combinations[0].unitCostCents,
        totalCents: lineData.combinations[0].totalCents,
        sortOrder: 1,
        startedAt: isStarted ? new Date(now.minus({ minutes: 10 }).toISO()!) : null,
        doneAt: null,
        startedById: isStarted ? kitchenUser.id : null,
      },
    });

    if (lineData.combinations[0].options.length > 0) {
      await prisma.combinationOption.createMany({
        data: lineData.combinations[0].options.map((opt) => ({
          combinationId: olc.id,
          groupName: opt.groupName,
          optionName: opt.optionName,
          portionName: opt.portionName,
          optionCents: opt.optionCents,
          portionExtraCents: opt.portionExtraCents,
          optionCostCents: opt.optionCostCents,
        })),
      });
    }
  }

  // ── Drop 5 Today: PREPARING (LATE in kitchen, UNASSIGNED driver) ──
  const drop5 = await prisma.drop.upsert({
    where: {
      deliveryDate_companyId_addressId_deliveryTimeMin: {
        deliveryDate: stringToDbDate(todayStr),
        companyId: compVanguard.id,
        addressId: compVanguard.addresses[0].id,
        deliveryTimeMin: 810, // 1:30 PM
      },
    },
    create: {
      deliveryDate: stringToDbDate(todayStr),
      companyId: compVanguard.id,
      addressId: compVanguard.addresses[0].id,
      deliveryTimeMin: 810,
      driverId: null, // Unassigned drop!
      outForDeliveryAt: null,
      deliveredAt: null,
    },
    update: {
      driverId: null,
      outForDeliveryAt: null,
      deliveredAt: null,
    },
  });

  for (let i = 0; i < 2; i++) {
    const emp = compVanguard.employees[i];
    const dish = ctx.dishes[(i + 8) % ctx.dishes.length];
    const lineData = buildLineData(dish, compVanguard.tierId || '');

    // Set plannedKitchenReadyAt to now - 15 minutes (in past -> LATE!)
    const plannedKitchenReadyAt = now.minus({ minutes: 15 }).toJSDate();
    const plannedDispatchReadyAt = now.plus({ minutes: 15 }).toJSDate();

    const order = await prisma.order.create({
      data: {
        employeeId: emp.id,
        companyId: compVanguard.id,
        deliveryDate: stringToDbDate(todayStr),
        deliveryTimeMin: 810,
        addressId: compVanguard.addresses[0].id,
        addressSnapshot: compVanguard.addresses[0],
        packaging: 'STANDARD',
        status: 'CONFIRMED',
        source: 'DEMO',
        totalCents: lineData.lineTotalCents,
        leadMinutes: 60,
        placedAt: new Date(now.minus({ hours: 3 }).toISO()!),
        confirmedAt: new Date(now.minus({ hours: 2 }).toISO()!),
        kitchenStartedAt: null,
        kitchenReadyAt: null,
        plannedKitchenReadyAt,
        plannedDispatchReadyAt,
        dropId: drop5.id,
        createdById: adminUser.id,
      },
    });

    const ol = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        dishId: lineData.dishId,
        dishName: lineData.dishName,
        dishSku: lineData.dishSku,
        quantity: lineData.quantity,
        dishPriceCents: lineData.dishPriceCents,
        dishCostCents: lineData.dishCostCents,
        tierName: 'Standard',
        lineTotalCents: lineData.lineTotalCents,
        sortOrder: 1,
      },
    });

    const olc = await prisma.orderLineCombination.create({
      data: {
        orderLineId: ol.id,
        signature: lineData.combinations[0].signature,
        label: lineData.combinations[0].label,
        quantity: 1,
        unitCents: lineData.combinations[0].unitCents,
        unitCostCents: lineData.combinations[0].unitCostCents,
        totalCents: lineData.combinations[0].totalCents,
        sortOrder: 1,
        startedAt: null,
        doneAt: null,
      },
    });

    if (lineData.combinations[0].options.length > 0) {
      await prisma.combinationOption.createMany({
        data: lineData.combinations[0].options.map((opt) => ({
          combinationId: olc.id,
          groupName: opt.groupName,
          optionName: opt.optionName,
          portionName: opt.portionName,
          optionCents: opt.optionCents,
          portionExtraCents: opt.portionExtraCents,
          optionCostCents: opt.optionCostCents,
        })),
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PART 3: Future Dates [today+1 to today+7]
  // Earliest locked future date in cutoffHoldDates with DRAFT + PLACED
  // ══════════════════════════════════════════════════════════════════
  const demoHoldDate = addDays(todayStr, 1); // Tomorrow: cut-off was 2 working days ago, so locked!

  // Update Setting cutoffHoldDates to [demoHoldDate]
  await prisma.setting.upsert({
    where: { key: 'cutoffHoldDates' },
    update: { value: [demoHoldDate] },
    create: { key: 'cutoffHoldDates', value: [demoHoldDate] },
  });

  // For demoHoldDate: generate 3 DRAFT orders and 4 PLACED orders
  for (let i = 0; i < 7; i++) {
    const isDraft = i < 3;
    const comp = ctx.companies[i % ctx.companies.length];
    const emp = comp.employees[(i + 3) % comp.employees.length];
    const pricedDishes = getPricedDishes(comp.tierId || '');
    const dish = pricedDishes[i % pricedDishes.length] || ctx.dishes[0];
    const lineData = buildLineData(dish, comp.tierId || '', dish.minOrderQty || 1);

    const plannedTimes = planTimes(
      demoHoldDate,
      comp.defaultDeliveryTimeMin,
      comp.dispatchLeadMinutes,
      30,
      timezone,
    );

    const order = await prisma.order.create({
      data: {
        employeeId: emp.id,
        companyId: comp.id,
        deliveryDate: stringToDbDate(demoHoldDate),
        deliveryTimeMin: comp.defaultDeliveryTimeMin,
        addressId: comp.addresses[0].id,
        addressSnapshot: comp.addresses[0],
        packaging: comp.defaultPackaging as any,
        status: isDraft ? 'DRAFT' : 'PLACED',
        source: 'DEMO',
        totalCents: lineData.lineTotalCents,
        leadMinutes: comp.dispatchLeadMinutes,
        notes: isDraft ? 'Draft catering plan' : 'Placed order ready for cut-off demo',
        placedAt: isDraft ? null : new Date(),
        plannedKitchenReadyAt: new Date(plannedTimes.plannedKitchenReadyAt),
        plannedDispatchReadyAt: new Date(plannedTimes.plannedDispatchReadyAt),
        createdById: adminUser.id,
        draftPayload: isDraft ? { notes: 'Draft notes' } : undefined,
      },
    });

    const ol = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        dishId: lineData.dishId,
        dishName: lineData.dishName,
        dishSku: lineData.dishSku,
        quantity: lineData.quantity,
        dishPriceCents: lineData.dishPriceCents,
        dishCostCents: lineData.dishCostCents,
        tierName: 'Standard',
        lineTotalCents: lineData.lineTotalCents,
        sortOrder: 1,
      },
    });

    const olc = await prisma.orderLineCombination.create({
      data: {
        orderLineId: ol.id,
        signature: lineData.combinations[0].signature,
        label: lineData.combinations[0].label,
        quantity: 1,
        unitCents: lineData.combinations[0].unitCents,
        unitCostCents: lineData.combinations[0].unitCostCents,
        totalCents: lineData.combinations[0].totalCents,
        sortOrder: 1,
      },
    });

    if (lineData.combinations[0].options.length > 0) {
      await prisma.combinationOption.createMany({
        data: lineData.combinations[0].options.map((opt) => ({
          combinationId: olc.id,
          groupName: opt.groupName,
          optionName: opt.optionName,
          portionName: opt.portionName,
          optionCents: opt.optionCents,
          portionExtraCents: opt.portionExtraCents,
          optionCostCents: opt.optionCostCents,
        })),
      });
    }
  }

  // For further future dates [today+2 to today+7]: create PLACED & DRAFT orders
  for (let offset = 2; offset <= 7; offset++) {
    const futureDate = addDays(todayStr, offset);
    const dt = DateTime.fromISO(futureDate, { zone: timezone });
    const weekday = dt.weekday;

    const activeCompanies = ctx.companies.filter((c) => c.workingDays.includes(weekday));
    if (activeCompanies.length === 0) continue;

    for (let j = 0; j < Math.min(2, activeCompanies.length); j++) {
      const comp = activeCompanies[j];
      const emp = comp.employees[(offset + j) % comp.employees.length];
      const pricedDishes = getPricedDishes(comp.tierId || '');
      const dish = pricedDishes[(offset + j) % pricedDishes.length] || ctx.dishes[0];
      const isDraft = (offset + j) % 2 === 0;

      const lineData = buildLineData(dish, comp.tierId || '', dish.minOrderQty || 1);

      const plannedTimes = planTimes(
        futureDate,
        comp.defaultDeliveryTimeMin,
        comp.dispatchLeadMinutes,
        30,
        timezone,
      );

      const order = await prisma.order.create({
        data: {
          employeeId: emp.id,
          companyId: comp.id,
          deliveryDate: stringToDbDate(futureDate),
          deliveryTimeMin: comp.defaultDeliveryTimeMin,
          addressId: comp.addresses[0].id,
          addressSnapshot: comp.addresses[0],
          packaging: comp.defaultPackaging as any,
          status: isDraft ? 'DRAFT' : 'PLACED',
          source: 'DEMO',
          totalCents: lineData.lineTotalCents,
          leadMinutes: comp.dispatchLeadMinutes,
          placedAt: isDraft ? null : new Date(),
          plannedKitchenReadyAt: new Date(plannedTimes.plannedKitchenReadyAt),
          plannedDispatchReadyAt: new Date(plannedTimes.plannedDispatchReadyAt),
          createdById: adminUser.id,
          draftPayload: isDraft ? { notes: 'Future draft' } : undefined,
        },
      });

      const ol = await prisma.orderLine.create({
        data: {
          orderId: order.id,
          dishId: lineData.dishId,
          dishName: lineData.dishName,
          dishSku: lineData.dishSku,
          quantity: lineData.quantity,
          dishPriceCents: lineData.dishPriceCents,
          dishCostCents: lineData.dishCostCents,
          tierName: 'Standard',
          lineTotalCents: lineData.lineTotalCents,
          sortOrder: 1,
        },
      });

      const olc = await prisma.orderLineCombination.create({
        data: {
          orderLineId: ol.id,
          signature: lineData.combinations[0].signature,
          label: lineData.combinations[0].label,
          quantity: 1,
          unitCents: lineData.combinations[0].unitCents,
          unitCostCents: lineData.combinations[0].unitCostCents,
          totalCents: lineData.combinations[0].totalCents,
          sortOrder: 1,
        },
      });

      if (lineData.combinations[0].options.length > 0) {
        await prisma.combinationOption.createMany({
          data: lineData.combinations[0].options.map((opt) => ({
            combinationId: olc.id,
            groupName: opt.groupName,
            optionName: opt.optionName,
            portionName: opt.portionName,
            optionCents: opt.optionCents,
            portionExtraCents: opt.portionExtraCents,
            optionCostCents: opt.optionCostCents,
          })),
        });
      }
    }
  }

  return { demoHoldDate };
}
