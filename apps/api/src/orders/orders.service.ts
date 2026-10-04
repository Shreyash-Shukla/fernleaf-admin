// ─── Orders Service ─────────────────────────────────────────────
// Handles CRUD, status transitions, and persistence for orders.

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DomainError } from '../common/domain-error';
import {
  OrderValidatorService,
  CreateOrderInput,
  ResolvedLine,
} from './order-validator.service';
import {
  ERRORS,
  dbDateToString,
  stringToDbDate,
  can,
  PERMISSIONS,
  isLocked,
  planTimes,
  type CutoffSettings,
} from '@repo/shared';
import { DateTime } from 'luxon';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly validator: OrderValidatorService,
  ) {}

  // ─── Preview ──────────────────────────────────────────────────

  async preview(
    input: CreateOrderInput,
    actor: { id: string; permissions: string[] },
  ) {
    const result = await this.validator.validate(input, actor, { isDraft: false });
    return {
      valid: result.valid,
      errors: result.errors,
      lines: result.resolvedLines || [],
      totalCents: result.totalCents ?? 0,
      deliveryTimeMin: result.deliveryTimeMin,
      packaging: result.packaging,
      addressSnapshot: result.addressSnapshot,
      plannedKitchenReadyAt: result.plannedKitchenReadyAt,
      plannedDispatchReadyAt: result.plannedDispatchReadyAt,
    };
  }

  // ─── Create Draft ─────────────────────────────────────────────

  async createDraft(
    input: CreateOrderInput,
    actor: { id: string; permissions: string[] },
  ) {
    const result = await this.validator.validate(input, actor, { isDraft: true });

    if (!result.valid) {
      throw DomainError.unprocessable(
        ERRORS.VALIDATION_ERROR,
        'Order validation failed',
        undefined,
        result.errors,
      );
    }

    const order = await this.prisma.order.create({
      data: {
        employeeId: input.employeeId,
        companyId: result.company!.id,
        deliveryDate: stringToDbDate(input.deliveryDate),
        deliveryTimeMin: result.deliveryTimeMin!,
        addressId: result.addressSnapshot?.id ?? '',
        addressSnapshot: result.addressSnapshot ?? {},
        packaging: (result.packaging as any) ?? 'STANDARD',
        status: 'DRAFT',
        source: 'STAFF',
        totalCents: 0,
        leadMinutes: result.leadMinutes ?? 60,
        notes: input.notes ?? null,
        draftPayload: input as any,
        createdById: actor.id,
      },
    });

    return this.getOrder(order.id);
  }

  // ─── Place Order ──────────────────────────────────────────────

  async placeOrder(
    orderId: string,
    input: CreateOrderInput | null,
    actor: { id: string; permissions: string[] },
  ) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.ORDER_NOT_FOUND, `Order "${orderId}" not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw DomainError.badRequest(
        ERRORS.INVALID_STATUS_TRANSITION,
        `Cannot place order in status "${existing.status}"`,
      );
    }

    // If no input provided, use the draft payload
    const orderInput: CreateOrderInput = input || (existing.draftPayload as any);
    if (!orderInput) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'No order data found. Provide order details or save a draft first.',
      );
    }

    // Ensure employeeId matches
    orderInput.employeeId = existing.employeeId;

    const isAdmin = can(actor.permissions, PERMISSIONS.ORDERS_OVERRIDE);
    const result = await this.validator.validate(orderInput, actor, {
      isDraft: false,
      isAdminOverride: isAdmin,
    });

    if (!result.valid) {
      throw DomainError.unprocessable(
        ERRORS.VALIDATION_ERROR,
        'Order validation failed',
        undefined,
        result.errors,
      );
    }

    // Persist in a transaction with snapshots
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      // Update order header
      await tx.order.update({
        where: { id: orderId },
        data: {
          deliveryDate: stringToDbDate(orderInput.deliveryDate),
          deliveryTimeMin: result.deliveryTimeMin!,
          addressId: result.addressSnapshot?.id ?? existing.addressId,
          addressSnapshot: result.addressSnapshot ?? existing.addressSnapshot,
          packaging: (result.packaging as any) ?? existing.packaging,
          status: 'PLACED',
          totalCents: result.totalCents ?? 0,
          leadMinutes: result.leadMinutes ?? existing.leadMinutes,
          notes: orderInput.notes ?? existing.notes,
          draftPayload: Prisma.DbNull,
          placedAt: now,
          plannedKitchenReadyAt: result.plannedKitchenReadyAt
            ? new Date(result.plannedKitchenReadyAt)
            : null,
          plannedDispatchReadyAt: result.plannedDispatchReadyAt
            ? new Date(result.plannedDispatchReadyAt)
            : null,
          version: { increment: 1 },
        },
      });

      // Delete existing lines (for re-placement)
      await tx.orderLine.deleteMany({ where: { orderId } });

      // Create snapshot rows
      await this.createSnapshotRows(tx, orderId, result.resolvedLines!);

      return this.getOrderFromTx(tx, orderId);
    });
  }

  // ─── Edit Order ───────────────────────────────────────────────

  async editOrder(
    orderId: string,
    input: CreateOrderInput,
    actor: { id: string; permissions: string[] },
    expectedVersion?: number,
  ) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.ORDER_NOT_FOUND, `Order "${orderId}" not found`);
    }

    // Version check for optimistic concurrency
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw DomainError.conflict(
        ERRORS.VERSION_CONFLICT,
        `Order has been modified. Expected version ${expectedVersion}, current is ${existing.version}`,
      );
    }

    const appSettings = await this.settings.getAll();
    const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
    const kitchenHolidayDates = new Set(kitchenHolidays.map((h) => dbDateToString(h.date)));
    const isAdmin = can(actor.permissions, PERMISSIONS.ORDERS_OVERRIDE);

    const cutoffSettings: CutoffSettings = {
      cutoffDays: appSettings.cutoffDays,
      cutoffTime: appSettings.cutoffTime,
      kitchenWorkingDays: appSettings.kitchenWorkingDays,
      kitchenHolidays: kitchenHolidayDates,
      timezone: appSettings.timezone,
    };

    const now = DateTime.now().setZone(appSettings.timezone);
    const deliveryDate = dbDateToString(existing.deliveryDate);
    const locked = isLocked(deliveryDate, now, cutoffSettings);

    if (existing.status === 'DRAFT') {
      // Block draft edit after cut-off for non-admins
      if (locked && !isAdmin) {
        throw DomainError.badRequest(
          ERRORS.ORDER_LOCKED,
          'Cannot edit a draft order after cut-off. Only admins can override.',
        );
      }

      // Editing a draft: update the payload
      const result = await this.validator.validate(input, actor, { isDraft: true, isAdminOverride: isAdmin });
      if (!result.valid) {
        throw DomainError.unprocessable(
          ERRORS.VALIDATION_ERROR,
          'Order validation failed',
          undefined,
          result.errors,
        );
      }

      return this.prisma.order.update({
        where: { id: orderId },
        data: {
          deliveryDate: stringToDbDate(input.deliveryDate),
          deliveryTimeMin: result.deliveryTimeMin!,
          addressId: result.addressSnapshot?.id ?? existing.addressId,
          addressSnapshot: result.addressSnapshot ?? existing.addressSnapshot,
          packaging: (result.packaging as any) ?? existing.packaging,
          notes: input.notes ?? existing.notes,
          draftPayload: input as any,
          version: { increment: 1 },
        },
      });
    }

    if (existing.status === 'PLACED') {
      // Editing a placed order: re-validate, re-price, replace rows
      if (locked && !isAdmin) {
        throw DomainError.badRequest(
          ERRORS.ORDER_LOCKED,
          'Cannot edit a placed order after cut-off. Only admins can override.',
        );
      }

      input.employeeId = existing.employeeId;
      const result = await this.validator.validate(input, actor, {
        isDraft: false,
        isEdit: true,
        orderId,
        isAdminOverride: isAdmin,
      });

      if (!result.valid) {
        throw DomainError.unprocessable(
          ERRORS.VALIDATION_ERROR,
          'Order validation failed',
          undefined,
          result.errors,
        );
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            deliveryDate: stringToDbDate(input.deliveryDate),
            deliveryTimeMin: result.deliveryTimeMin!,
            addressId: result.addressSnapshot?.id ?? existing.addressId,
            addressSnapshot: result.addressSnapshot ?? existing.addressSnapshot,
            packaging: (result.packaging as any) ?? existing.packaging,
            totalCents: result.totalCents ?? 0,
            notes: input.notes ?? existing.notes,
            plannedKitchenReadyAt: result.plannedKitchenReadyAt
              ? new Date(result.plannedKitchenReadyAt)
              : null,
            plannedDispatchReadyAt: result.plannedDispatchReadyAt
              ? new Date(result.plannedDispatchReadyAt)
              : null,
            version: { increment: 1 },
          },
        });

        // Replace all line rows
        await tx.orderLine.deleteMany({ where: { orderId } });
        await this.createSnapshotRows(tx, orderId, result.resolvedLines!);

        return this.getOrderFromTx(tx, orderId);
      });
    }

    throw DomainError.badRequest(
      ERRORS.ORDER_NOT_EDITABLE,
      `Cannot edit order in status "${existing.status}"`,
    );
  }

  // ─── Cancel Order ─────────────────────────────────────────────

  async cancelOrder(
    orderId: string,
    actor: { id: string; permissions: string[] },
    reason?: string,
  ) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.ORDER_NOT_FOUND, `Order "${orderId}" not found`);
    }

    const isAdmin = can(actor.permissions, PERMISSIONS.ORDERS_OVERRIDE);
    const appSettings = await this.settings.getAll();
    const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
    const kitchenHolidayDates = new Set(kitchenHolidays.map((h) => dbDateToString(h.date)));
    const now = DateTime.now().setZone(appSettings.timezone);
    const deliveryDate = dbDateToString(existing.deliveryDate);

    const cutoffSettings: CutoffSettings = {
      cutoffDays: appSettings.cutoffDays,
      cutoffTime: appSettings.cutoffTime,
      kitchenWorkingDays: appSettings.kitchenWorkingDays,
      kitchenHolidays: kitchenHolidayDates,
      timezone: appSettings.timezone,
    };

    const locked = isLocked(deliveryDate, now, cutoffSettings);

    if (existing.status === 'DRAFT' || existing.status === 'PLACED') {
      if (locked && !isAdmin) {
        throw DomainError.badRequest(
          ERRORS.ORDER_LOCKED,
          'Cannot cancel after cut-off. Only admins can override.',
        );
      }
    } else if (existing.status === 'CONFIRMED') {
      if (!isAdmin) {
        throw DomainError.forbidden(
          ERRORS.FORBIDDEN,
          'Only admins can cancel confirmed orders',
        );
      }
    } else {
      throw DomainError.badRequest(
        ERRORS.ORDER_NOT_CANCELLABLE,
        `Cannot cancel order in status "${existing.status}"`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelReason: reason || null,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });

      // If order was invoiced, create an adjustment
      if (existing.invoiceId) {
        await tx.adjustment.create({
          data: {
            companyId: existing.companyId,
            orderId: existing.id,
            reason: 'CANCELLED_AFTER_INVOICE',
            amountCents: -existing.totalCents,
            status: 'OPEN',
            note: `Order #${existing.number} cancelled after invoicing. Reason: ${reason || 'N/A'}`,
            createdById: actor.id,
          },
        });
      }

      return this.getOrderFromTx(tx, orderId);
    });
  }

  // ─── Reject Order ─────────────────────────────────────────────

  async rejectOrder(
    orderId: string,
    actor: { id: string; permissions: string[] },
    reason: string,
  ) {
    if (!can(actor.permissions, PERMISSIONS.ORDERS_OVERRIDE)) {
      throw DomainError.forbidden(ERRORS.FORBIDDEN, 'Only admins can reject orders');
    }

    if (!reason || !reason.trim()) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Rejection reason is required',
        { reason: 'Reason is required' },
      );
    }

    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.ORDER_NOT_FOUND, `Order "${orderId}" not found`);
    }

    if (existing.status !== 'PLACED' && existing.status !== 'CONFIRMED') {
      throw DomainError.badRequest(
        ERRORS.INVALID_STATUS_TRANSITION,
        `Cannot reject order in status "${existing.status}"`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'REJECTED',
          rejectReason: reason.trim(),
          rejectedAt: new Date(),
          version: { increment: 1 },
        },
      });

      // If invoiced, create adjustment (rejected = non-billable)
      if (existing.invoiceId) {
        await tx.adjustment.create({
          data: {
            companyId: existing.companyId,
            orderId: existing.id,
            reason: 'CANCELLED_AFTER_INVOICE',
            amountCents: -existing.totalCents,
            status: 'OPEN',
            note: `Order #${existing.number} rejected after invoicing. Reason: ${reason}`,
            createdById: actor.id,
          },
        });
      }

      return this.getOrderFromTx(tx, orderId);
    });
  }

  // ─── Admin Override ───────────────────────────────────────────

  async adminOverride(
    orderId: string,
    actor: { id: string; permissions: string[] },
    data: { deliveryTimeMin?: number; addressId?: string; packaging?: string },
  ) {
    if (!can(actor.permissions, PERMISSIONS.ORDERS_OVERRIDE)) {
      throw DomainError.forbidden(ERRORS.FORBIDDEN, 'Only admins can override orders');
    }

    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        company: { include: { addresses: { where: { active: true } } } },
      },
    });

    if (!existing) {
      throw DomainError.notFound(ERRORS.ORDER_NOT_FOUND, `Order "${orderId}" not found`);
    }

    // Can only override confirmed orders (not yet out for delivery)
    if (existing.status !== 'CONFIRMED' && existing.status !== 'PLACED') {
      throw DomainError.badRequest(
        ERRORS.ORDER_NOT_EDITABLE,
        `Cannot override order in status "${existing.status}"`,
      );
    }

    if (existing.outForDeliveryAt) {
      throw DomainError.conflict(
        ERRORS.ORDER_NOT_EDITABLE,
        'Cannot override order that is already out for delivery',
      );
    }

    const updateData: any = {};
    let needsDropUpdate = false;

    if (data.deliveryTimeMin !== undefined) {
      if (data.deliveryTimeMin < 0 || data.deliveryTimeMin > 1439 || data.deliveryTimeMin % 5 !== 0) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Delivery time must be 0-1439 in 5-minute increments',
        );
      }
      updateData.deliveryTimeMin = data.deliveryTimeMin;
      needsDropUpdate = true;

      // Recalculate planned times
      const appSettings = await this.settings.getAll();
      const deliveryDate = dbDateToString(existing.deliveryDate);
      const planned = planTimes(
        deliveryDate,
        data.deliveryTimeMin,
        existing.leadMinutes,
        appSettings.kitchenBufferMinutes,
        appSettings.timezone,
      );
      updateData.plannedKitchenReadyAt = new Date(planned.plannedKitchenReadyAt);
      updateData.plannedDispatchReadyAt = new Date(planned.plannedDispatchReadyAt);
    }

    if (data.addressId !== undefined) {
      const address = existing.company.addresses.find((a) => a.id === data.addressId);
      if (!address) {
        throw DomainError.badRequest(ERRORS.ADDRESS_NOT_FOUND, 'Address not found');
      }
      updateData.addressId = address.id;
      updateData.addressSnapshot = {
        id: address.id,
        label: address.label,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        postcode: address.postcode,
      };
      needsDropUpdate = true;
    }

    if (data.packaging !== undefined) {
      updateData.packaging = data.packaging;
    }

    return this.prisma.$transaction(async (tx) => {
      // Row-level lock on the order
      await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

      // If drop assignment needs to change, handle re-keying
      if (needsDropUpdate && existing.status === 'CONFIRMED' && existing.dropId) {
        const oldDropId = existing.dropId;
        const deliveryDate = existing.deliveryDate;
        const deliveryTimeMin = updateData.deliveryTimeMin ?? existing.deliveryTimeMin;
        const addressId = updateData.addressId ?? existing.addressId;

        // Find or create the target drop
        const targetDrop = await tx.drop.upsert({
          where: {
            deliveryDate_companyId_addressId_deliveryTimeMin: {
              deliveryDate,
              companyId: existing.companyId,
              addressId,
              deliveryTimeMin,
            },
          },
          create: {
            deliveryDate,
            companyId: existing.companyId,
            addressId,
            deliveryTimeMin,
            driverId: existing.company.defaultDriverId ?? null,
          },
          update: {},
        });

        updateData.dropId = targetDrop.id;

        // If the order moved to a different drop, check if the old drop is now empty
        if (oldDropId !== targetDrop.id) {
          const remainingActive = await tx.order.count({
            where: {
              dropId: oldDropId,
              id: { not: orderId },
              status: { in: ['CONFIRMED', 'DELIVERED'] },
            },
          });

          if (remainingActive === 0) {
            const oldDrop = await tx.drop.findUnique({
              where: { id: oldDropId },
              select: { outForDeliveryAt: true, deliveredAt: true },
            });

            if (oldDrop && !oldDrop.outForDeliveryAt && !oldDrop.deliveredAt) {
              // Unlink non-active orders before deleting drop
              await tx.order.updateMany({
                where: { dropId: oldDropId },
                data: { dropId: null },
              });
              await tx.drop.delete({
                where: { id: oldDropId },
              });
            }
          }
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          ...updateData,
          version: { increment: 1 },
        },
      });

      return this.getOrderFromTx(tx, orderId);
    });
  }

  // ─── Order List ───────────────────────────────────────────────

  async listOrders(query: {
    from?: string;
    to?: string;
    status?: string[];
    companyId?: string;
    employeeId?: string;
    invoiced?: string;
    q?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
  }) {
    const where: any = {};
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));

    if (query.from) {
      where.deliveryDate = { ...where.deliveryDate, gte: stringToDbDate(query.from) };
    }
    if (query.to) {
      where.deliveryDate = { ...where.deliveryDate, lte: stringToDbDate(query.to) };
    }
    if (query.status && query.status.length > 0) {
      where.status = { in: query.status };
    }
    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.invoiced === 'true') {
      where.invoiceId = { not: null };
    } else if (query.invoiced === 'false') {
      where.invoiceId = null;
    }
    if (query.q) {
      const q = query.q.trim();
      // Search by order number or employee name
      const numberSearch = parseInt(q, 10);
      if (!isNaN(numberSearch)) {
        where.number = numberSearch;
      } else {
        where.employee = { name: { contains: q, mode: 'insensitive' } };
      }
    }

    // Sort
    let orderBy: any = { number: 'desc' };
    if (query.sort) {
      const [field, dir] = query.sort.split(':');
      if (['number', 'deliveryDate', 'totalCents', 'createdAt', 'status'].includes(field)) {
        orderBy = { [field]: dir === 'asc' ? 'asc' : 'desc' };
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          employee: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((o) => ({
        ...o,
        deliveryDate: dbDateToString(o.deliveryDate),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ─── Order Detail ─────────────────────────────────────────────

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        drop: {
          select: { id: true, driverId: true, deliveredAt: true },
        },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            combinations: {
              orderBy: { sortOrder: 'asc' },
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw DomainError.notFound(ERRORS.ORDER_NOT_FOUND, `Order "${orderId}" not found`);
    }

    // Compute locked status
    const appSettings = await this.settings.getAll();
    const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
    const kitchenHolidayDates = new Set(kitchenHolidays.map((h) => dbDateToString(h.date)));

    const cutoffSettings: CutoffSettings = {
      cutoffDays: appSettings.cutoffDays,
      cutoffTime: appSettings.cutoffTime,
      kitchenWorkingDays: appSettings.kitchenWorkingDays,
      kitchenHolidays: kitchenHolidayDates,
      timezone: appSettings.timezone,
    };

    const now = DateTime.now().setZone(appSettings.timezone);
    const deliveryDate = dbDateToString(order.deliveryDate);
    const locked = isLocked(deliveryDate, now, cutoffSettings);

    // Determine available actions
    const actions: string[] = [];
    if (order.status === 'DRAFT') {
      if (!locked) {
        actions.push('place', 'edit', 'cancel');
      } else {
        actions.push('cancel'); // admin can still cancel
      }
    }
    if (order.status === 'PLACED') {
      if (!locked) {
        actions.push('edit', 'cancel');
      }
      actions.push('reject'); // admin
    }
    if (order.status === 'CONFIRMED') {
      actions.push('override', 'cancel', 'reject'); // admin
    }

    return {
      ...order,
      deliveryDate: deliveryDate,
      locked,
      actions,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private async getOrderFromTx(tx: any, orderId: string) {
    return tx.order.findUnique({
      where: { id: orderId },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            combinations: {
              orderBy: { sortOrder: 'asc' },
              include: { options: true },
            },
          },
        },
      },
    });
  }

  private async createSnapshotRows(
    tx: any,
    orderId: string,
    resolvedLines: ResolvedLine[],
  ) {
    for (const line of resolvedLines) {
      const orderLine = await tx.orderLine.create({
        data: {
          orderId,
          dishId: line.dishId,
          dishName: line.dishName,
          dishSku: line.dishSku,
          quantity: line.quantity,
          dishPriceCents: line.dishPriceCents,
          dishCostCents: line.dishCostCents,
          tierName: line.tierName,
          lineTotalCents: line.lineTotalCents,
          sortOrder: line.sortOrder,
        },
      });

      for (const combo of line.combinations) {
        const olc = await tx.orderLineCombination.create({
          data: {
            orderLineId: orderLine.id,
            signature: combo.signature,
            label: combo.label,
            quantity: combo.quantity,
            unitCents: combo.unitCents,
            unitCostCents: combo.unitCostCents,
            totalCents: combo.totalCents,
            sortOrder: combo.sortOrder,
          },
        });

        if (combo.options.length > 0) {
          await tx.combinationOption.createMany({
            data: combo.options.map((opt) => ({
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
  }
}
