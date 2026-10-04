// ─── Dispatch Service ───────────────────────────────────────────

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
import {
  DropStage,
  computeDropStage,
  getOrderStage,
  DispatchBoardResponse,
  DispatchBoardDrop,
  DispatchBoardOrder,
  DriverDropsResponse,
  DriverDropDto,
} from './dispatch.types';

export interface BoardQueryDto {
  date?: string;
}

export interface DriverQueryDto {
  date?: string;
}

export interface AssignDriverDto {
  driverId: string | null;
}

export interface DeliverDropDto {
  note?: string;
  photoData?: Buffer | string;
  mime?: string;
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Helper to format minute-of-day into HH:mm
   */
  private formatTime(timeMin: number): string {
    const hours = Math.floor(timeMin / 60);
    const mins = timeMin % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * GET /dispatch/board?date=...
   * Board of drops for a given delivery date grouped by stage.
   */
  async getBoard(query: BoardQueryDto): Promise<DispatchBoardResponse> {
    const appSettings = await this.settings.getAll();
    const tz = appSettings.timezone || 'Asia/Kolkata';

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
    const nowMs = Date.now();

    // Fetch drops for this date with relations
    const drops = await this.prisma.drop.findMany({
      where: {
        deliveryDate: dbDate,
      },
      include: {
        company: {
          include: {
            addresses: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        photo: {
          select: {
            id: true,
            mime: true,
            size: true,
            createdAt: true,
          },
        },
        orders: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            lines: {
              include: {
                combinations: {
                  select: {
                    quantity: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ deliveryTimeMin: 'asc' }, { createdAt: 'asc' }],
    });

    const stageCounts: Record<DropStage, number> = {
      [DropStage.PREPARING]: 0,
      [DropStage.KITCHEN_READY]: 0,
      [DropStage.DISPATCH_READY]: 0,
      [DropStage.OUT_FOR_DELIVERY]: 0,
      [DropStage.DELIVERED]: 0,
    };

    let totalOrdersCount = 0;
    let totalMealsCount = 0;
    let unassignedCount = 0;
    let behindScheduleCount = 0;

    const boardDrops: DispatchBoardDrop[] = [];

    for (const drop of drops) {
      // Filter to active orders: CONFIRMED or DELIVERED (cancelled/rejected excluded from active work)
      const activeOrders = drop.orders.filter(
        (o) => o.status === 'CONFIRMED' || o.status === 'DELIVERED',
      );

      // If drop has no active orders and was never delivered or out, exclude it
      if (activeOrders.length === 0 && !drop.deliveredAt && !drop.outForDeliveryAt) {
        continue;
      }

      // Compute drop stage as least advanced active order
      const stage = computeDropStage(activeOrders, drop);
      stageCounts[stage] += 1;

      // Meals count
      let dropMeals = 0;
      for (const order of activeOrders) {
        for (const line of order.lines) {
          for (const comb of line.combinations) {
            dropMeals += comb.quantity;
          }
        }
      }

      totalOrdersCount += activeOrders.length;
      totalMealsCount += dropMeals;

      if (!drop.driverId && stage !== DropStage.DELIVERED) {
        unassignedCount += 1;
      }

      // Check if all active orders are kitchen ready
      const stillCookingOrders = activeOrders.filter((o) => !o.kitchenReadyAt);
      const canDispatchReady = activeOrders.length > 0 && stillCookingOrders.length === 0;

      // Behind schedule calculation:
      // Drop not dispatch-ready (i.e. PREPARING or KITCHEN_READY) and now > min(plannedDispatchReadyAt)
      let minPlannedDispatchReadyAt: Date | null = null;
      for (const o of activeOrders) {
        if (o.plannedDispatchReadyAt) {
          if (!minPlannedDispatchReadyAt || o.plannedDispatchReadyAt < minPlannedDispatchReadyAt) {
            minPlannedDispatchReadyAt = o.plannedDispatchReadyAt;
          }
        }
      }

      const isBehindSchedule =
        (stage === DropStage.PREPARING || stage === DropStage.KITCHEN_READY) &&
        minPlannedDispatchReadyAt !== null &&
        nowMs > minPlannedDispatchReadyAt.getTime();

      if (isBehindSchedule) {
        behindScheduleCount += 1;
      }

      // Resolve address
      const companyAddr = drop.company.addresses.find((a) => a.id === drop.addressId);
      const firstOrderSnapshot = activeOrders[0]?.addressSnapshot as any;
      const address = companyAddr
        ? {
            id: companyAddr.id,
            label: companyAddr.label,
            line1: companyAddr.line1,
            line2: companyAddr.line2,
            city: companyAddr.city,
            state: companyAddr.state,
            postcode: companyAddr.postcode,
          }
        : firstOrderSnapshot
        ? {
            id: firstOrderSnapshot.id || drop.addressId,
            label: firstOrderSnapshot.label || 'Default',
            line1: firstOrderSnapshot.line1 || '',
            line2: firstOrderSnapshot.line2 || null,
            city: firstOrderSnapshot.city || '',
            state: firstOrderSnapshot.state || null,
            postcode: firstOrderSnapshot.postcode || '',
          }
        : {
            id: drop.addressId,
            label: 'Unknown',
            line1: '',
            line2: null,
            city: '',
            state: null,
            postcode: '',
          };

      // Map orders
      const orderList: DispatchBoardOrder[] = activeOrders.map((o) => {
        let orderMeals = 0;
        for (const line of o.lines) {
          for (const comb of line.combinations) {
            orderMeals += comb.quantity;
          }
        }
        return {
          id: o.id,
          number: o.number,
          status: o.status,
          employeeName: o.employee.name,
          packaging: o.packaging,
          totalMeals: orderMeals,
          kitchenReadyAt: o.kitchenReadyAt ? o.kitchenReadyAt.toISOString() : null,
          dispatchReadyAt: o.dispatchReadyAt ? o.dispatchReadyAt.toISOString() : null,
          outForDeliveryAt: o.outForDeliveryAt ? o.outForDeliveryAt.toISOString() : null,
          deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
          plannedKitchenReadyAt: o.plannedKitchenReadyAt
            ? o.plannedKitchenReadyAt.toISOString()
            : null,
          plannedDispatchReadyAt: o.plannedDispatchReadyAt
            ? o.plannedDispatchReadyAt.toISOString()
            : null,
        };
      });

      boardDrops.push({
        id: drop.id,
        deliveryDate: dateStr,
        deliveryTimeMin: drop.deliveryTimeMin,
        deliveryTime: this.formatTime(drop.deliveryTimeMin),
        company: {
          id: drop.company.id,
          name: drop.company.name,
          driverNotes: drop.company.driverNotes,
          defaultDriverId: drop.company.defaultDriverId,
          dispatchLeadMinutes: drop.company.dispatchLeadMinutes,
        },
        address,
        driver: drop.driver,
        stage,
        orderCount: activeOrders.length,
        totalMeals: dropMeals,
        canDispatchReady,
        stillCookingCount: stillCookingOrders.length,
        isBehindSchedule,
        plannedDispatchReadyAt: minPlannedDispatchReadyAt
          ? minPlannedDispatchReadyAt.toISOString()
          : null,
        outForDeliveryAt: drop.outForDeliveryAt ? drop.outForDeliveryAt.toISOString() : null,
        deliveredAt: drop.deliveredAt ? drop.deliveredAt.toISOString() : null,
        deliveredNote: drop.deliveredNote,
        onTime: drop.onTime,
        hasPhoto: !!drop.photo,
        orders: orderList,
      });
    }

    return {
      date: dateStr,
      summary: {
        totalDrops: boardDrops.length,
        stageCounts,
        unassignedCount,
        behindScheduleCount,
        totalOrders: totalOrdersCount,
        totalMeals: totalMealsCount,
      },
      drops: boardDrops,
    };
  }

  /**
   * GET /drops/:id
   * Fetch a single drop by ID.
   */
  async getDrop(id: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            addresses: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        photo: {
          select: {
            id: true,
            mime: true,
            size: true,
            createdAt: true,
          },
        },
        orders: {
          include: {
            employee: true,
            lines: {
              include: {
                combinations: true,
              },
            },
          },
        },
      },
    });

    if (!drop) {
      throw DomainError.notFound(ERRORS.DROP_NOT_FOUND, `Drop "${id}" not found`);
    }

    const activeOrders = drop.orders.filter(
      (o) => o.status === 'CONFIRMED' || o.status === 'DELIVERED',
    );
    const stage = computeDropStage(activeOrders, drop);

    return {
      ...drop,
      stage,
      activeOrderCount: activeOrders.length,
    };
  }

  /**
   * POST /drops/:id/dispatch-ready
   * Transition: PREPARING / KITCHEN_READY -> DISPATCH_READY
   * Requires: all active orders in drop have kitchenReadyAt.
   */
  async dispatchReady(dropId: string, actor: { id: string; permissions: string[] }) {
    if (!can(actor.permissions, PERMISSIONS.DISPATCH_WORK)) {
      throw DomainError.forbidden(
        ERRORS.FORBIDDEN,
        'Only dispatch staff and admins can mark drops dispatch-ready',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Row-level lock on Drop
      const rows = await tx.$queryRaw<any[]>`
        SELECT * FROM "Drop" WHERE id = ${dropId} FOR UPDATE
      `;
      if (!rows || rows.length === 0) {
        throw DomainError.notFound(ERRORS.DROP_NOT_FOUND, `Drop "${dropId}" not found`);
      }
      const drop = rows[0];

      if (drop.deliveredAt) {
        throw DomainError.conflict(
          ERRORS.DROP_ALREADY_DELIVERED,
          'Cannot mark dispatch-ready: drop has already been delivered',
        );
      }

      if (drop.outForDeliveryAt) {
        throw DomainError.conflict(
          ERRORS.INVALID_STATUS_TRANSITION,
          'Cannot mark dispatch-ready: drop is already out for delivery',
        );
      }

      // Check active orders
      const activeOrders = await tx.order.findMany({
        where: {
          dropId,
          status: { in: ['CONFIRMED', 'DELIVERED'] },
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      });

      if (activeOrders.length === 0) {
        throw DomainError.conflict(
          ERRORS.DROP_HAS_NO_ACTIVE_ORDERS,
          'Drop has no active orders to dispatch',
        );
      }

      // Check prerequisite: ALL active orders must have kitchenReadyAt
      const stillCooking = activeOrders.filter((o) => !o.kitchenReadyAt);
      if (stillCooking.length > 0) {
        throw DomainError.conflict(
          ERRORS.PREREQUISITE_NOT_MET,
          `Cannot mark drop dispatch-ready. The following orders are still being prepared in the kitchen: ${stillCooking
            .map((o) => `#${o.number} (${o.employee.name})`)
            .join(', ')}`,
          {
            stillCookingOrders: stillCooking.map((o) => ({
              id: o.id,
              number: o.number,
              employeeName: o.employee.name,
            })),
          },
        );
      }

      const now = new Date();

      // Bulk update active orders with dispatchReadyAt where null
      await tx.order.updateMany({
        where: {
          dropId,
          status: 'CONFIRMED',
          dispatchReadyAt: null,
        },
        data: {
          dispatchReadyAt: now,
        },
      });

      return {
        id: dropId,
        stage: DropStage.DISPATCH_READY,
        dispatchReadyAt: now.toISOString(),
        orderCount: activeOrders.length,
      };
    });
  }

  /**
   * POST /drops/:id/assign-driver
   * Assign or reassign driver to a drop. Allowed until delivered.
   */
  async assignDriver(
    dropId: string,
    dto: AssignDriverDto,
    actor: { id: string; permissions: string[] },
  ) {
    if (!can(actor.permissions, PERMISSIONS.DISPATCH_WORK)) {
      throw DomainError.forbidden(
        ERRORS.FORBIDDEN,
        'Only dispatch staff and admins can assign drivers',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<any[]>`
        SELECT * FROM "Drop" WHERE id = ${dropId} FOR UPDATE
      `;
      if (!rows || rows.length === 0) {
        throw DomainError.notFound(ERRORS.DROP_NOT_FOUND, `Drop "${dropId}" not found`);
      }
      const drop = rows[0];

      if (drop.deliveredAt) {
        throw DomainError.conflict(
          ERRORS.DROP_ALREADY_DELIVERED,
          'Cannot assign driver: drop has already been delivered',
        );
      }

      let driver: { id: string; name: string; email: string; active: boolean } | null = null;
      if (dto.driverId) {
        driver = await tx.user.findUnique({
          where: { id: dto.driverId },
          select: { id: true, name: true, email: true, active: true },
        });

        if (!driver || !driver.active) {
          throw DomainError.badRequest(
            ERRORS.NOT_FOUND,
            `Driver user "${dto.driverId}" not found or is inactive`,
          );
        }
      }

      const updated = await tx.drop.update({
        where: { id: dropId },
        data: {
          driverId: dto.driverId ?? null,
        },
        include: {
          driver: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return {
        id: updated.id,
        driverId: updated.driverId,
        driver: updated.driver,
      };
    });
  }

  /**
   * POST /drops/:id/out-for-delivery
   * Transition: DISPATCH_READY -> OUT_FOR_DELIVERY
   * Requires: driver assigned AND all active orders dispatchReadyAt set.
   */
  async outForDelivery(dropId: string, actor: { id: string; permissions: string[] }) {
    if (!can(actor.permissions, PERMISSIONS.DISPATCH_WORK)) {
      throw DomainError.forbidden(
        ERRORS.FORBIDDEN,
        'Only dispatch staff and admins can mark drops out for delivery',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<any[]>`
        SELECT * FROM "Drop" WHERE id = ${dropId} FOR UPDATE
      `;
      if (!rows || rows.length === 0) {
        throw DomainError.notFound(ERRORS.DROP_NOT_FOUND, `Drop "${dropId}" not found`);
      }
      const drop = rows[0];

      if (drop.deliveredAt) {
        throw DomainError.conflict(
          ERRORS.DROP_ALREADY_DELIVERED,
          'Cannot mark out for delivery: drop has already been delivered',
        );
      }

      if (drop.outForDeliveryAt) {
        throw DomainError.conflict(
          ERRORS.INVALID_STATUS_TRANSITION,
          'Drop is already out for delivery',
        );
      }

      // Check driver assigned
      if (!drop.driverId) {
        throw DomainError.conflict(
          ERRORS.DROP_NO_DRIVER,
          'Cannot mark drop out for delivery: a driver must be assigned first',
        );
      }

      // Check active orders
      const activeOrders = await tx.order.findMany({
        where: {
          dropId,
          status: { in: ['CONFIRMED', 'DELIVERED'] },
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      });

      if (activeOrders.length === 0) {
        throw DomainError.conflict(
          ERRORS.DROP_HAS_NO_ACTIVE_ORDERS,
          'Drop has no active orders to dispatch',
        );
      }

      // Prerequisite: all active orders must be dispatchReadyAt
      const notDispatchReady = activeOrders.filter((o) => !o.dispatchReadyAt);
      if (notDispatchReady.length > 0) {
        throw DomainError.conflict(
          ERRORS.DROP_NOT_DISPATCH_READY,
          `Cannot mark drop out for delivery. The following orders are not marked dispatch-ready: ${notDispatchReady
            .map((o) => `#${o.number} (${o.employee.name})`)
            .join(', ')}`,
          {
            notDispatchReadyOrders: notDispatchReady.map((o) => ({
              id: o.id,
              number: o.number,
              employeeName: o.employee.name,
            })),
          },
        );
      }

      const now = new Date();

      // Update drop
      await tx.drop.update({
        where: { id: dropId },
        data: {
          outForDeliveryAt: now,
        },
      });

      // Update active orders
      await tx.order.updateMany({
        where: {
          dropId,
          status: 'CONFIRMED',
          outForDeliveryAt: null,
        },
        data: {
          outForDeliveryAt: now,
        },
      });

      return {
        id: dropId,
        stage: DropStage.OUT_FOR_DELIVERY,
        outForDeliveryAt: now.toISOString(),
      };
    });
  }

  /**
   * POST /drops/:id/deliver
   * Transition: OUT_FOR_DELIVERY -> DELIVERED
   * Requires: drop is out-for-delivery, actor is assigned driver (or has deliveries:read_any / *).
   * Computes on-time delivery flag against deadline = deliveryInstant + onTimeGraceMinutes.
   * Sets deliveredAt on drop and all active orders; sets order status to DELIVERED.
   */
  async deliver(
    dropId: string,
    dto: DeliverDropDto,
    actor: { id: string; permissions: string[] },
  ) {
    if (!can(actor.permissions, PERMISSIONS.DELIVERIES_DELIVER)) {
      throw DomainError.forbidden(
        ERRORS.FORBIDDEN,
        'Only drivers and authorized staff can deliver drops',
      );
    }

    const appSettings = await this.settings.getAll();
    const tz = appSettings.timezone || 'Asia/Kolkata';
    const graceMinutes = appSettings.onTimeGraceMinutes ?? 10;

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<any[]>`
        SELECT * FROM "Drop" WHERE id = ${dropId} FOR UPDATE
      `;
      if (!rows || rows.length === 0) {
        throw DomainError.notFound(ERRORS.DROP_NOT_FOUND, `Drop "${dropId}" not found`);
      }
      const drop = rows[0];

      // Scoping: Drivers can only deliver their own drops unless they have deliveries:read_any or *
      const canDeliverAny =
        can(actor.permissions, PERMISSIONS.DELIVERIES_READ_ANY) ||
        can(actor.permissions, PERMISSIONS.DISPATCH_WORK) ||
        can(actor.permissions, '*');

      if (!canDeliverAny && drop.driverId !== actor.id) {
        throw DomainError.forbidden(
          ERRORS.FORBIDDEN,
          'You are not the assigned driver for this drop',
        );
      }

      if (drop.deliveredAt) {
        throw DomainError.conflict(
          ERRORS.DROP_ALREADY_DELIVERED,
          'Drop has already been delivered',
        );
      }

      if (!drop.outForDeliveryAt) {
        throw DomainError.conflict(
          ERRORS.DROP_NOT_OUT_FOR_DELIVERY,
          'Drop must be marked out for delivery before it can be delivered',
        );
      }

      const now = new Date();

      // On-time calculation
      // deliveryDate in Postgres DATE column
      const deliveryDateStr = dbDateToString(drop.deliveryDate);
      const deliveryInstant = DateTime.fromISO(deliveryDateStr, { zone: tz })
        .startOf('day')
        .plus({ minutes: drop.deliveryTimeMin });
      const deadline = deliveryInstant.plus({ minutes: graceMinutes });
      const onTime = now.getTime() <= deadline.toMillis();

      // Update drop
      const updatedDrop = await tx.drop.update({
        where: { id: dropId },
        data: {
          deliveredAt: now,
          deliveredNote: dto.note ? dto.note.trim() : null,
          deliveredById: actor.id,
          onTime,
        },
      });

      // Update active orders: set status = DELIVERED, deliveredAt = now
      await tx.order.updateMany({
        where: {
          dropId,
          status: 'CONFIRMED',
        },
        data: {
          status: 'DELIVERED',
          deliveredAt: now,
        },
      });

      // Optional photo proof if included in deliver payload
      if (dto.photoData) {
        let photoBuffer: Buffer;
        if (Buffer.isBuffer(dto.photoData)) {
          photoBuffer = dto.photoData;
        } else if (typeof dto.photoData === 'string') {
          // Check for base64 prefix
          const base64Str = dto.photoData.replace(/^data:image\/\w+;base64,/, '');
          photoBuffer = Buffer.from(base64Str, 'base64');
        } else {
          photoBuffer = Buffer.from(dto.photoData as any);
        }

        const mime = dto.mime || 'image/jpeg';

        await tx.deliveryPhoto.upsert({
          where: { dropId },
          create: {
            dropId,
            mime,
            size: photoBuffer.length,
            data: new Uint8Array(photoBuffer),
          },
          update: {
            mime,
            size: photoBuffer.length,
            data: new Uint8Array(photoBuffer),
          },
        });
      }

      return {
        id: dropId,
        stage: DropStage.DELIVERED,
        deliveredAt: now.toISOString(),
        deliveredNote: updatedDrop.deliveredNote,
        onTime: updatedDrop.onTime,
      };
    });
  }

  /**
   * POST /drops/:id/photo
   * Upload delivery photo proof.
   */
  async uploadPhoto(
    dropId: string,
    fileBuffer: Buffer,
    mime: string,
    actor: { id: string; permissions: string[] },
  ) {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      select: { id: true, driverId: true, deliveredAt: true },
    });

    if (!drop) {
      throw DomainError.notFound(ERRORS.DROP_NOT_FOUND, `Drop "${dropId}" not found`);
    }

    const canUploadAny =
      can(actor.permissions, PERMISSIONS.DELIVERIES_READ_ANY) ||
      can(actor.permissions, PERMISSIONS.DISPATCH_WORK) ||
      can(actor.permissions, '*');

    if (!canUploadAny && drop.driverId !== actor.id) {
      throw DomainError.forbidden(
        ERRORS.FORBIDDEN,
        'You are not the assigned driver for this drop',
      );
    }

    const saved = await this.prisma.deliveryPhoto.upsert({
      where: { dropId },
      create: {
        dropId,
        mime: mime || 'image/jpeg',
        size: fileBuffer.length,
        data: new Uint8Array(fileBuffer),
      },
      update: {
        mime: mime || 'image/jpeg',
        size: fileBuffer.length,
        data: new Uint8Array(fileBuffer),
      },
    });

    return {
      dropId: saved.dropId,
      mime: saved.mime,
      size: saved.size,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  /**
   * GET /drops/:id/photo
   * Download / view delivery photo proof.
   */
  async getPhoto(dropId: string) {
    const photo = await this.prisma.deliveryPhoto.findUnique({
      where: { dropId },
    });

    if (!photo) {
      throw DomainError.notFound(ERRORS.NOT_FOUND, `No photo proof found for drop "${dropId}"`);
    }

    return {
      mime: photo.mime,
      data: photo.data,
      size: photo.size,
    };
  }

  /**
   * GET /driver/drops?date=...
   * Scoped strictly to the logged-in driver (driverId = actor.id) and today's date.
   * Returns phone-friendly minimal DTO sorted by delivery time.
   */
  async getDriverDrops(
    query: DriverQueryDto,
    actor: { id: string; permissions: string[] },
  ): Promise<DriverDropsResponse> {
    if (!can(actor.permissions, PERMISSIONS.DELIVERIES_READ_OWN)) {
      throw DomainError.forbidden(
        ERRORS.FORBIDDEN,
        'Forbidden: driver access required',
      );
    }

    const appSettings = await this.settings.getAll();
    const tz = appSettings.timezone || 'Asia/Kolkata';

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

    // Query drops assigned specifically to this driver
    const drops = await this.prisma.drop.findMany({
      where: {
        deliveryDate: dbDate,
        driverId: actor.id,
      },
      include: {
        company: {
          include: {
            addresses: true,
          },
        },
        photo: {
          select: { id: true },
        },
        orders: {
          where: {
            status: { in: ['CONFIRMED', 'DELIVERED'] },
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
              },
            },
            lines: {
              include: {
                combinations: {
                  select: { quantity: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ deliveryTimeMin: 'asc' }, { createdAt: 'asc' }],
    });

    let deliveredCount = 0;
    const driverDrops: DriverDropDto[] = [];

    for (const drop of drops) {
      const activeOrders = drop.orders;
      // Skip if completely empty unless marked delivered
      if (activeOrders.length === 0 && !drop.deliveredAt) {
        continue;
      }

      const stage = computeDropStage(activeOrders, drop);
      if (stage === DropStage.DELIVERED) {
        deliveredCount += 1;
      }

      let mealsCount = 0;
      for (const order of activeOrders) {
        for (const line of order.lines) {
          for (const comb of line.combinations) {
            mealsCount += comb.quantity;
          }
        }
      }

      // Recipient first names for easy box hand over
      const recipientNames = [
        ...new Set(
          activeOrders.map((o) => {
            const parts = o.employee.name.trim().split(/\s+/);
            return parts[0] || o.employee.name;
          }),
        ),
      ];

      const companyAddr = drop.company.addresses.find((a) => a.id === drop.addressId);
      const firstOrderSnapshot = (activeOrders[0] as any)?.addressSnapshot;
      const address = companyAddr
        ? {
            id: companyAddr.id,
            label: companyAddr.label,
            line1: companyAddr.line1,
            line2: companyAddr.line2,
            city: companyAddr.city,
            state: companyAddr.state,
            postcode: companyAddr.postcode,
          }
        : firstOrderSnapshot
        ? {
            id: firstOrderSnapshot.id || drop.addressId,
            label: firstOrderSnapshot.label || 'Default',
            line1: firstOrderSnapshot.line1 || '',
            line2: firstOrderSnapshot.line2 || null,
            city: firstOrderSnapshot.city || '',
            state: firstOrderSnapshot.state || null,
            postcode: firstOrderSnapshot.postcode || '',
          }
        : {
            id: drop.addressId,
            label: 'Unknown',
            line1: '',
            line2: null,
            city: '',
            state: null,
            postcode: '',
          };

      driverDrops.push({
        id: drop.id,
        deliveryDate: dateStr,
        deliveryTimeMin: drop.deliveryTimeMin,
        deliveryTime: this.formatTime(drop.deliveryTimeMin),
        company: {
          id: drop.company.id,
          name: drop.company.name,
          driverNotes: drop.company.driverNotes,
        },
        address,
        stage,
        orderCount: activeOrders.length,
        mealsCount,
        recipientNames,
        outForDeliveryAt: drop.outForDeliveryAt ? drop.outForDeliveryAt.toISOString() : null,
        deliveredAt: drop.deliveredAt ? drop.deliveredAt.toISOString() : null,
        deliveredNote: drop.deliveredNote,
        onTime: drop.onTime,
        hasPhoto: !!drop.photo,
      });
    }

    return {
      date: dateStr,
      summary: {
        totalDrops: driverDrops.length,
        deliveredDrops: deliveredCount,
        remainingDrops: driverDrops.length - deliveredCount,
      },
      drops: driverDrops,
    };
  }
}
