// ─── Kitchen Service ────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DomainError } from '../common/domain-error';
import {
  ERRORS,
  stringToDbDate,
  dbDateToString,
  isValidDateString,
  can,
  PERMISSIONS,
} from '@repo/shared';
import { DateTime } from 'luxon';

export interface BoardQueryDto {
  date?: string;
  stationId?: string;
}

export type UnitState = 'NOT_STARTED' | 'STARTED' | 'DONE';
export type OrderRisk = 'LATE' | 'AT_RISK' | 'NORMAL';

export interface KitchenBoardUnit {
  id: string;
  orderLineId: string;
  dishId: string;
  dishName: string;
  dishSku: string;
  signature: string;
  label: string;
  quantity: number;
  state: UnitState;
  stationId: string | null;
  stationName: string;
  startedAt: string | null;
  doneAt: string | null;
  startedById: string | null;
  doneById: string | null;
  risk: OrderRisk;
  options: {
    groupName: string;
    optionName: string;
    portionName: string | null;
  }[];
}

export interface KitchenBoardOrder {
  id: string;
  company: { id: string; name: string };
  employee: { id: string; name: string; email: string };
  deliveryTimeMin: number;
  plannedKitchenReadyAt: string | null;
  kitchenStartedAt: string | null;
  kitchenReadyAt: string | null;
  isLate: boolean;
  isAtRisk: boolean;
  risk: OrderRisk;
  units: KitchenBoardUnit[];
}

export interface StationSummary {
  id: string | null;
  name: string;
  sortOrder: number;
  totalMeals: number;
  doneMeals: number;
  remainingMeals: number;
}

export interface CookTotal {
  dishId: string;
  dishName: string;
  dishSku: string;
  signature: string;
  label: string;
  stationId: string | null;
  stationName: string;
  totalQty: number;
  startedQty: number;
  doneQty: number;
  remainingQty: number;
}

export interface KitchenBoardResponse {
  date: string;
  summary: {
    totalOrders: number;
    readyOrders: number;
    lateCount: number;
    atRiskCount: number;
    totalMeals: number;
    doneMeals: number;
    remainingMeals: number;
  };
  stations: StationSummary[];
  orders: KitchenBoardOrder[];
  cookTotals: CookTotal[];
}

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * GET /kitchen/board?date&stationId
   * Only CONFIRMED orders for the date.
   * Live station routing via Dish.stationId.
   * Late and at-risk computation based on plannedKitchenReadyAt and unstarted units.
   */
  async getBoard(query: BoardQueryDto): Promise<KitchenBoardResponse> {
    const appSettings = await this.settings.getAll();
    const tz = appSettings.timezone || 'Asia/Kolkata';
    const atRiskWindowMs = (appSettings.atRiskWindowMinutes ?? 60) * 60 * 1000;

    let dateStr = query.date;
    if (dateStr) {
      if (!isValidDateString(dateStr)) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Invalid date format. Expected YYYY-MM-DD',
        );
      }
    } else {
      dateStr = DateTime.now().setZone(tz).toISODate()!;
    }

    const dbDate = stringToDbDate(dateStr);

    // 1. Fetch stations and all dishes for live routing
    const [stations, dishes] = await Promise.all([
      this.prisma.kitchenStation.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.dish.findMany({
        select: {
          id: true,
          name: true,
          sku: true,
          stationId: true,
          station: {
            select: { id: true, name: true, sortOrder: true },
          },
        },
      }),
    ]);

    const dishMap = new Map(dishes.map((d) => [d.id, d]));
    const stationMap = new Map(stations.map((s) => [s.id, s]));

    // 2. Fetch all CONFIRMED orders for this delivery date
    const orders = await this.prisma.order.findMany({
      where: {
        deliveryDate: dbDate,
        status: 'CONFIRMED',
      },
      include: {
        company: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true, email: true } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            combinations: {
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  orderBy: { groupName: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { deliveryTimeMin: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const nowInstant = DateTime.now().setZone(tz);

    // Initialize station aggregators
    // stationId ('unassigned' or UUID) -> StationSummary
    const stationStatsMap = new Map<string, StationSummary>();
    for (const st of stations) {
      stationStatsMap.set(st.id, {
        id: st.id,
        name: st.name,
        sortOrder: st.sortOrder,
        totalMeals: 0,
        doneMeals: 0,
        remainingMeals: 0,
      });
    }
    const unassignedSummary: StationSummary = {
      id: null,
      name: 'Unassigned',
      sortOrder: 9999,
      totalMeals: 0,
      doneMeals: 0,
      remainingMeals: 0,
    };
    stationStatsMap.set('unassigned', unassignedSummary);

    // Cook totals map: key = `${dishId}:${signature}`
    const cookTotalsMap = new Map<string, CookTotal>();

    let totalMeals = 0;
    let doneMeals = 0;
    let lateCount = 0;
    let atRiskCount = 0;
    let readyOrdersCount = 0;

    const boardOrders: KitchenBoardOrder[] = [];

    for (const order of orders) {
      const isReady = order.kitchenReadyAt !== null;
      if (isReady) {
        readyOrdersCount++;
      }

      // Collect all units for this order first
      const orderUnits: KitchenBoardUnit[] = [];

      for (const line of order.lines) {
        const dish = dishMap.get(line.dishId);
        const station = dish?.stationId ? stationMap.get(dish.stationId) : null;
        const stationId = station?.id ?? null;
        const stationName = station?.name ?? 'Unassigned';

        for (const combo of line.combinations) {
          let state: UnitState = 'NOT_STARTED';
          if (combo.doneAt) {
            state = 'DONE';
          } else if (combo.startedAt) {
            state = 'STARTED';
          }

          // Aggregates across all confirmed orders
          totalMeals += combo.quantity;
          if (state === 'DONE') {
            doneMeals += combo.quantity;
          }

          // Station summary aggregation
          const stKey = stationId ?? 'unassigned';
          const stStats = stationStatsMap.get(stKey);
          if (stStats) {
            stStats.totalMeals += combo.quantity;
            if (state === 'DONE') {
              stStats.doneMeals += combo.quantity;
            }
            stStats.remainingMeals = stStats.totalMeals - stStats.doneMeals;
          }

          // Cook totals aggregation
          const cookKey = `${line.dishId}:${combo.signature}`;
          let ct = cookTotalsMap.get(cookKey);
          if (!ct) {
            ct = {
              dishId: line.dishId,
              dishName: line.dishName,
              dishSku: line.dishSku,
              signature: combo.signature,
              label: combo.label,
              stationId,
              stationName,
              totalQty: 0,
              startedQty: 0,
              doneQty: 0,
              remainingQty: 0,
            };
            cookTotalsMap.set(cookKey, ct);
          }
          ct.totalQty += combo.quantity;
          if (state === 'STARTED') {
            ct.startedQty += combo.quantity;
          } else if (state === 'DONE') {
            ct.doneQty += combo.quantity;
          }
          ct.remainingQty = ct.totalQty - ct.doneQty;

          orderUnits.push({
            id: combo.id,
            orderLineId: combo.orderLineId,
            dishId: line.dishId,
            dishName: line.dishName,
            dishSku: line.dishSku,
            signature: combo.signature,
            label: combo.label,
            quantity: combo.quantity,
            state,
            stationId,
            stationName,
            startedAt: combo.startedAt ? combo.startedAt.toISOString() : null,
            doneAt: combo.doneAt ? combo.doneAt.toISOString() : null,
            startedById: combo.startedById,
            doneById: combo.doneById,
            risk: 'NORMAL', // will be set from order risk below
            options: combo.options.map((opt) => ({
              groupName: opt.groupName,
              optionName: opt.optionName,
              portionName: opt.portionName,
            })),
          });
        }
      }

      // Compute order risk
      let isLate = false;
      let isAtRisk = false;
      let risk: OrderRisk = 'NORMAL';

      if (!isReady && order.plannedKitchenReadyAt) {
        const plannedInstant = DateTime.fromJSDate(order.plannedKitchenReadyAt).setZone(tz);
        const diffMs = plannedInstant.toMillis() - nowInstant.toMillis();

        if (diffMs < 0) {
          isLate = true;
          risk = 'LATE';
          lateCount++;
        } else if (diffMs <= atRiskWindowMs) {
          const hasUnstarted = orderUnits.some((u) => u.state === 'NOT_STARTED');
          if (hasUnstarted) {
            isAtRisk = true;
            risk = 'AT_RISK';
            atRiskCount++;
          }
        }
      }

      // Propagate risk to units
      for (const unit of orderUnits) {
        unit.risk = risk;
      }

      boardOrders.push({
        id: order.id,
        company: order.company,
        employee: order.employee,
        deliveryTimeMin: order.deliveryTimeMin,
        plannedKitchenReadyAt: order.plannedKitchenReadyAt
          ? order.plannedKitchenReadyAt.toISOString()
          : null,
        kitchenStartedAt: order.kitchenStartedAt
          ? order.kitchenStartedAt.toISOString()
          : null,
        kitchenReadyAt: order.kitchenReadyAt
          ? order.kitchenReadyAt.toISOString()
          : null,
        isLate,
        isAtRisk,
        risk,
        units: orderUnits,
      });
    }

    // Sort orders: Late first, then At-Risk, then Normal; then by planned time asc, deliveryTimeMin asc
    const riskRank = (r: OrderRisk) => (r === 'LATE' ? 0 : r === 'AT_RISK' ? 1 : 2);
    boardOrders.sort((a, b) => {
      const diff = riskRank(a.risk) - riskRank(b.risk);
      if (diff !== 0) return diff;
      const aTime = a.plannedKitchenReadyAt ? new Date(a.plannedKitchenReadyAt).getTime() : Infinity;
      const bTime = b.plannedKitchenReadyAt ? new Date(b.plannedKitchenReadyAt).getTime() : Infinity;
      if (aTime !== bTime) return aTime - bTime;
      return a.deliveryTimeMin - b.deliveryTimeMin;
    });

    // Format all stations for response
    const stationList: StationSummary[] = [];
    for (const st of stations) {
      const stat = stationStatsMap.get(st.id);
      if (stat) stationList.push(stat);
    }
    if (unassignedSummary.totalMeals > 0) {
      stationList.push(unassignedSummary);
    }

    let filteredOrders = boardOrders;
    let filteredCookTotals = Array.from(cookTotalsMap.values());

    // Apply station filter if specified
    if (query.stationId && query.stationId.toLowerCase() !== 'all') {
      const filterId = query.stationId;
      const isFilterUnassigned = filterId.toLowerCase() === 'unassigned' || filterId === 'null';

      filteredOrders = boardOrders
        .map((ord) => ({
          ...ord,
          units: ord.units.filter((u) =>
            isFilterUnassigned ? u.stationId === null : u.stationId === filterId,
          ),
        }))
        .filter((ord) => ord.units.length > 0);

      filteredCookTotals = filteredCookTotals.filter((ct) =>
        isFilterUnassigned ? ct.stationId === null : ct.stationId === filterId,
      );
    }

    return {
      date: dateStr,
      summary: {
        totalOrders: orders.length,
        readyOrders: readyOrdersCount,
        lateCount,
        atRiskCount,
        totalMeals,
        doneMeals,
        remainingMeals: totalMeals - doneMeals,
      },
      stations: stationList,
      orders: filteredOrders,
      cookTotals: filteredCookTotals,
    };
  }

  /**
   * POST /kitchen/units/:id/start
   * Marks prep unit as STARTED.
   * Takes `SELECT ... FOR UPDATE` on Order row first to serialize concurrent operations.
   * Sets startedAt on unit.
   * If first unit started, sets order.kitchenStartedAt.
   * Throws 409 if already started or already done.
   */
  async startUnit(
    unitId: string,
    actor: { id: string; permissions: string[] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Locate unit and find orderId
      const unit = await tx.orderLineCombination.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          startedAt: true,
          doneAt: true,
          orderLine: {
            select: {
              orderId: true,
            },
          },
        },
      });

      if (!unit) {
        throw DomainError.notFound(
          ERRORS.UNIT_NOT_FOUND,
          `Prep unit "${unitId}" not found`,
        );
      }

      const orderId = unit.orderLine.orderId;

      // 2. CRITICAL: Row-level lock on Order row first
      const orderRows: any[] = await tx.$queryRaw`
        SELECT id, status, "kitchenStartedAt", "kitchenReadyAt"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `;

      if (!orderRows || orderRows.length === 0) {
        throw DomainError.notFound(
          ERRORS.ORDER_NOT_FOUND,
          `Order "${orderId}" not found`,
        );
      }

      const order = orderRows[0];
      if (order.status !== 'CONFIRMED') {
        throw DomainError.conflict(
          ERRORS.ORDER_NOT_CONFIRMED,
          `Order is in status ${order.status}. Only CONFIRMED orders can be prepared in the kitchen.`,
        );
      }

      // 3. Atomically update unit: startedAt = now if startedAt IS NULL and doneAt IS NULL
      const now = new Date();
      const updateCount = await tx.$executeRaw`
        UPDATE "OrderLineCombination"
        SET "startedAt" = ${now}, "startedById" = ${actor.id}, "updatedAt" = ${now}
        WHERE id = ${unitId} AND "startedAt" IS NULL AND "doneAt" IS NULL
      `;

      if (updateCount === 0) {
        const freshUnit = await tx.orderLineCombination.findUnique({
          where: { id: unitId },
          select: { startedAt: true, doneAt: true },
        });

        if (freshUnit?.doneAt) {
          throw DomainError.conflict(
            ERRORS.UNIT_ALREADY_DONE,
            `Prep unit "${unitId}" is already done`,
          );
        }
        throw DomainError.conflict(
          ERRORS.UNIT_ALREADY_STARTED,
          `Prep unit "${unitId}" is already started`,
        );
      }

      // 4. Update order.kitchenStartedAt if this is the first unit started
      await tx.$executeRaw`
        UPDATE "Order"
        SET "kitchenStartedAt" = COALESCE("kitchenStartedAt", ${now}), "updatedAt" = ${now}
        WHERE id = ${orderId}
      `;

      // 5. Fetch updated unit and order
      const [updatedUnit, updatedOrder] = await Promise.all([
        tx.orderLineCombination.findUnique({
          where: { id: unitId },
          include: {
            orderLine: {
              select: {
                id: true,
                orderId: true,
                dishName: true,
                dishSku: true,
              },
            },
          },
        }),
        tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            status: true,
            kitchenStartedAt: true,
            kitchenReadyAt: true,
          },
        }),
      ]);

      return {
        unit: updatedUnit,
        order: updatedOrder,
      };
    });
  }

  /**
   * POST /kitchen/units/:id/done
   * Marks prep unit as DONE.
   * Finishing an unstarted unit is allowed and records start = done time.
   * Takes `SELECT ... FOR UPDATE` on Order row first.
   * Sets startedAt (COALESCE) and doneAt.
   * Checks if all units for order are done -> sets order.kitchenReadyAt.
   * Throws 409 if already done.
   */
  async doneUnit(
    unitId: string,
    actor: { id: string; permissions: string[] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Locate unit and find orderId
      const unit = await tx.orderLineCombination.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          startedAt: true,
          doneAt: true,
          orderLine: {
            select: {
              orderId: true,
            },
          },
        },
      });

      if (!unit) {
        throw DomainError.notFound(
          ERRORS.UNIT_NOT_FOUND,
          `Prep unit "${unitId}" not found`,
        );
      }

      const orderId = unit.orderLine.orderId;

      // 2. CRITICAL: Row-level lock on Order row first
      const orderRows: any[] = await tx.$queryRaw`
        SELECT id, status, "kitchenStartedAt", "kitchenReadyAt"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `;

      if (!orderRows || orderRows.length === 0) {
        throw DomainError.notFound(
          ERRORS.ORDER_NOT_FOUND,
          `Order "${orderId}" not found`,
        );
      }

      const order = orderRows[0];
      if (order.status !== 'CONFIRMED') {
        throw DomainError.conflict(
          ERRORS.ORDER_NOT_CONFIRMED,
          `Order is in status ${order.status}. Only CONFIRMED orders can be prepared in the kitchen.`,
        );
      }

      // 3. Atomically update unit: startedAt = COALESCE(startedAt, now), doneAt = now
      const now = new Date();
      const updateCount = await tx.$executeRaw`
        UPDATE "OrderLineCombination"
        SET "startedAt" = COALESCE("startedAt", ${now}),
            "doneAt" = ${now},
            "doneById" = ${actor.id},
            "updatedAt" = ${now}
        WHERE id = ${unitId} AND "doneAt" IS NULL
      `;

      if (updateCount === 0) {
        throw DomainError.conflict(
          ERRORS.UNIT_ALREADY_DONE,
          `Prep unit "${unitId}" is already done`,
        );
      }

      // 4. Update order.kitchenStartedAt if not yet set
      await tx.$executeRaw`
        UPDATE "Order"
        SET "kitchenStartedAt" = COALESCE("kitchenStartedAt", ${now}), "updatedAt" = ${now}
        WHERE id = ${orderId}
      `;

      // 5. Check if all units for this order are done -> set order.kitchenReadyAt
      await tx.$executeRaw`
        UPDATE "Order"
        SET "kitchenReadyAt" = ${now}, "updatedAt" = ${now}
        WHERE id = ${orderId}
          AND "kitchenReadyAt" IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "OrderLineCombination" c
            JOIN "OrderLine" l ON l.id = c."orderLineId"
            WHERE l."orderId" = ${orderId} AND c."doneAt" IS NULL
          )
      `;

      // 6. Fetch updated unit and order
      const [updatedUnit, updatedOrder] = await Promise.all([
        tx.orderLineCombination.findUnique({
          where: { id: unitId },
          include: {
            orderLine: {
              select: {
                id: true,
                orderId: true,
                dishName: true,
                dishSku: true,
              },
            },
          },
        }),
        tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            status: true,
            kitchenStartedAt: true,
            kitchenReadyAt: true,
          },
        }),
      ]);

      return {
        unit: updatedUnit,
        order: updatedOrder,
      };
    });
  }

  /**
   * POST /kitchen/orders/:id/force-complete
   * Admin operation. Sets all unstarted/unfinished units and order timestamps in one tx.
   */
  async forceCompleteOrder(
    orderId: string,
    actor: { id: string; permissions: string[] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Row-level lock on Order row first
      const orderRows: any[] = await tx.$queryRaw`
        SELECT id, status, "kitchenStartedAt", "kitchenReadyAt"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `;

      if (!orderRows || orderRows.length === 0) {
        throw DomainError.notFound(
          ERRORS.ORDER_NOT_FOUND,
          `Order "${orderId}" not found`,
        );
      }

      const order = orderRows[0];
      if (order.status !== 'CONFIRMED') {
        throw DomainError.conflict(
          ERRORS.ORDER_NOT_CONFIRMED,
          `Order is in status ${order.status}. Only CONFIRMED orders can be force-completed.`,
        );
      }

      const now = new Date();

      // 2. Mark all unstarted / unfinished units as done
      await tx.$executeRaw`
        UPDATE "OrderLineCombination"
        SET "startedAt" = COALESCE("startedAt", ${now}),
            "doneAt" = COALESCE("doneAt", ${now}),
            "doneById" = COALESCE("doneById", ${actor.id}),
            "updatedAt" = ${now}
        WHERE "orderLineId" IN (
          SELECT id FROM "OrderLine" WHERE "orderId" = ${orderId}
        ) AND "doneAt" IS NULL
      `;

      // 3. Mark order as kitchen started and ready
      await tx.$executeRaw`
        UPDATE "Order"
        SET "kitchenStartedAt" = COALESCE("kitchenStartedAt", ${now}),
            "kitchenReadyAt" = COALESCE("kitchenReadyAt", ${now}),
            "updatedAt" = ${now}
        WHERE id = ${orderId}
      `;

      // 4. Fetch updated order with lines and combinations
      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          company: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true, email: true } },
          lines: {
            orderBy: { sortOrder: 'asc' },
            include: {
              combinations: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      });
    });
  }
}
