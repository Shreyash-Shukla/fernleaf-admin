// ─── Cut-off Service ────────────────────────────────────────────
// Processes cut-off for delivery dates: cancels drafts, confirms placed,
// creates drops, and sets planned times.
// Uses pg_try_advisory_xact_lock (transaction-level) for idempotency.
// CRITICAL: xact-level locks are required for Neon pooled connections.

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DomainError } from '../common/domain-error';
import { DateTime } from 'luxon';
import {
  ERRORS,
  dbDateToString,
  stringToDbDate,
  isKitchenWorkingDay,
  isKitchenHoliday,
  cutoffAt,
  planTimes,
  addDays,
  type CutoffSettings,
} from '@repo/shared';

// Use a stable lock ID derived from the delivery date
// This ensures concurrent calls for the same date get serialized,
// while different dates can process in parallel.
function dateLockId(dateStr: string): bigint {
  // Hash the date string to a stable 64-bit integer
  // Using a simple approach: convert YYYY-MM-DD to a number
  const num = parseInt(dateStr.replace(/-/g, ''), 10);
  // Add a namespace to avoid collisions with other advisory locks
  return BigInt(1000000) + BigInt(num);
}

export interface CutoffResult {
  date: string;
  trigger: string;
  skipped: boolean;
  draftsCancelled: number;
  ordersConfirmed: number;
  dropsCreated: number;
}

@Injectable()
export class CutoffService implements OnModuleDestroy {
  private readonly logger = new Logger(CutoffService.name);
  private sweepRunning = false;
  private sweepTimeout?: NodeJS.Timeout;
  private sweepInterval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {
    // Start the sweep cron (every 60 seconds)
    this.startSweepCron();
  }

  onModuleDestroy() {
    if (this.sweepTimeout) clearTimeout(this.sweepTimeout);
    if (this.sweepInterval) clearInterval(this.sweepInterval);
  }

  /**
   * Process cut-off for a specific delivery date.
   * Idempotent: running twice for the same date is harmless.
   *
   * Uses pg_try_advisory_xact_lock INSIDE the transaction (xact-level).
   * This is critical for Neon pooled connections which break session-level locks.
   */
  async processDate(
    date: string,
    trigger: 'CRON' | 'LAZY' | 'MANUAL',
    force?: boolean,
  ): Promise<CutoffResult> {
    this.logger.log(`Processing cut-off for date=${date}, trigger=${trigger}, force=${force}`);

    const lockId = dateLockId(date);

    // Run the entire cut-off in a single transaction with advisory lock
    const result = await this.prisma.$transaction(async (tx) => {
      // ── Advisory lock (transaction-level) ─────────────────────
      // pg_try_advisory_xact_lock automatically releases when the transaction ends.
      // It does NOT require explicit unlock, unlike session-level pg_try_advisory_lock.
      const lockResult = await tx.$queryRawUnsafe<Array<{ pg_try_advisory_xact_lock: boolean }>>(
        `SELECT pg_try_advisory_xact_lock($1::bigint)`,
        lockId,
      );

      if (!lockResult[0]?.pg_try_advisory_xact_lock) {
        this.logger.warn(`Cut-off for ${date} skipped: another process holds the lock`);
        return {
          date,
          trigger,
          skipped: true,
          draftsCancelled: 0,
          ordersConfirmed: 0,
          dropsCreated: 0,
        };
      }

      const deliveryDate = stringToDbDate(date);

      // ── Cancel all drafts for this date ───────────────────────
      const cancelResult = await tx.order.updateMany({
        where: {
          deliveryDate,
          status: 'DRAFT',
        },
        data: {
          status: 'CANCELLED',
          cancelReason: 'Cut-off passed: draft auto-cancelled',
          cancelledAt: new Date(),
        },
      });

      // ── Find all placed orders for this date ──────────────────
      const placedOrders = await tx.order.findMany({
        where: {
          deliveryDate,
          status: 'PLACED',
        },
        include: {
          company: true,
        },
      });

      const appSettings = await this.settings.getAll();
      let dropsCreated = 0;

      // ── Confirm each placed order ─────────────────────────────
      for (const order of placedOrders) {
        // Compute planned times
        const planned = planTimes(
          date,
          order.deliveryTimeMin,
          order.leadMinutes,
          appSettings.kitchenBufferMinutes,
          appSettings.timezone,
        );

        // Find or create drop
        const drop = await tx.drop.upsert({
          where: {
            deliveryDate_companyId_addressId_deliveryTimeMin: {
              deliveryDate,
              companyId: order.companyId,
              addressId: order.addressId,
              deliveryTimeMin: order.deliveryTimeMin,
            },
          },
          create: {
            deliveryDate,
            companyId: order.companyId,
            addressId: order.addressId,
            deliveryTimeMin: order.deliveryTimeMin,
            // Set default driver from company if available
            driverId: order.company.defaultDriverId ?? null,
          },
          update: {},
        });

        // Track if this was a new drop (crude check: if created very recently)
        // We'll just count unique drops after
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            dropId: drop.id,
            plannedKitchenReadyAt: new Date(planned.plannedKitchenReadyAt),
            plannedDispatchReadyAt: new Date(planned.plannedDispatchReadyAt),
          },
        });
      }

      // Count unique drops created/used for this date
      const dropsForDate = await tx.drop.count({
        where: { deliveryDate },
      });

      return {
        date,
        trigger,
        skipped: false,
        draftsCancelled: cancelResult.count,
        ordersConfirmed: placedOrders.length,
        dropsCreated: dropsForDate,
      };
    });

    this.logger.log(
      `Cut-off result for ${date}: cancelled=${result.draftsCancelled}, confirmed=${result.ordersConfirmed}, drops=${result.dropsCreated}`,
    );

    return result;
  }

  /**
   * Manual trigger endpoint — admin only.
   */
  async manualTrigger(date: string, force?: boolean): Promise<CutoffResult> {
    return this.processDate(date, 'MANUAL', force);
  }

  /**
   * Sweep: find all unprocessed dates where cut-off has passed.
   * Runs every minute via setInterval.
   */
  async sweep(): Promise<CutoffResult[]> {
    if (this.sweepRunning) {
      this.logger.debug('Sweep already running, skipping');
      return [];
    }

    this.sweepRunning = true;
    const results: CutoffResult[] = [];

    try {
      const appSettings = await this.settings.getAll();
      const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
      const kitchenHolidayDates = new Set(kitchenHolidays.map((h) => dbDateToString(h.date)));
      const now = DateTime.now().setZone(appSettings.timezone);
      const today = now.toISODate()!;

      const cutoffSettings: CutoffSettings = {
        cutoffDays: appSettings.cutoffDays,
        cutoffTime: appSettings.cutoffTime,
        kitchenWorkingDays: appSettings.kitchenWorkingDays,
        kitchenHolidays: kitchenHolidayDates,
        timezone: appSettings.timezone,
      };

      // Find dates with DRAFT or PLACED orders that are past cut-off
      // Look at orders from today to today + 30 days
      const unprocessedOrders = await this.prisma.order.findMany({
        where: {
          status: { in: ['DRAFT', 'PLACED'] },
          deliveryDate: {
            gte: stringToDbDate(addDays(today, -7)),
            lte: stringToDbDate(addDays(today, 30)),
          },
        },
        select: { deliveryDate: true },
        distinct: ['deliveryDate'],
      });

      // Check cutoff hold dates
      const holdDates = new Set(appSettings.cutoffHoldDates || []);

      for (const row of unprocessedOrders) {
        const dateStr = dbDateToString(row.deliveryDate);

        // Skip held dates
        if (holdDates.has(dateStr)) {
          this.logger.debug(`Skipping held date: ${dateStr}`);
          continue;
        }

        // Check if cut-off has passed
        const cutoff = cutoffAt(dateStr, cutoffSettings);
        if (now >= cutoff) {
          this.logger.log(`Sweep: processing cut-off for ${dateStr}`);
          try {
            const result = await this.processDate(dateStr, 'CRON');
            results.push(result);
          } catch (err: any) {
            this.logger.error(`Sweep: error processing ${dateStr}: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Sweep error: ${err.message}`);
    } finally {
      this.sweepRunning = false;
    }

    return results;
  }

  /**
   * Get the next upcoming cut-off window:
   * Finds the earliest upcoming delivery date whose cut-off has not passed yet,
   * along with counts of DRAFT and PLACED orders for that delivery date.
   */
  async getNextWindow() {
    const appSettings = await this.settings.getAll();
    const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
    const kitchenHolidayDates = new Set(kitchenHolidays.map((h) => dbDateToString(h.date)));
    const tz = appSettings.timezone || 'Asia/Kolkata';
    const now = DateTime.now().setZone(tz);
    const today = now.toISODate()!;

    const cutoffSettings: CutoffSettings = {
      cutoffDays: appSettings.cutoffDays,
      cutoffTime: appSettings.cutoffTime,
      kitchenWorkingDays: appSettings.kitchenWorkingDays,
      kitchenHolidays: kitchenHolidayDates,
      timezone: tz,
    };

    let nextDeliveryDate: string | null = null;
    let nextCutoff: DateTime | null = null;

    for (let i = 0; i <= 14; i++) {
      const candidateDate = addDays(today, i);
      const cutoff = cutoffAt(candidateDate, cutoffSettings);
      if (cutoff > now) {
        nextDeliveryDate = candidateDate;
        nextCutoff = cutoff;
        break;
      }
    }

    if (!nextDeliveryDate || !nextCutoff) {
      nextDeliveryDate = addDays(today, 1);
      nextCutoff = cutoffAt(nextDeliveryDate, cutoffSettings);
    }

    const deliveryDbDate = stringToDbDate(nextDeliveryDate);

    const [draftCount, placedCount] = await Promise.all([
      this.prisma.order.count({
        where: {
          deliveryDate: deliveryDbDate,
          status: 'DRAFT',
        },
      }),
      this.prisma.order.count({
        where: {
          deliveryDate: deliveryDbDate,
          status: 'PLACED',
        },
      }),
    ]);

    const remainingMs = Math.max(0, nextCutoff.diff(now).as('milliseconds'));

    return {
      deliveryDate: nextDeliveryDate,
      cutoffIso: nextCutoff.toISO(),
      cutoffFormatted: nextCutoff.toFormat('dd LLL yyyy, HH:mm') + ` (${tz})`,
      remainingMs,
      draftCount,
      placedCount,
      cutoffDays: appSettings.cutoffDays,
      cutoffTime: appSettings.cutoffTime,
      holdDatesCount: Array.isArray(appSettings.cutoffHoldDates) ? appSettings.cutoffHoldDates.length : 0,
    };
  }

  /**
   * Start the sweep cron: runs every 60 seconds.
   */
  private startSweepCron() {
    // Delay first run by 30 seconds to let the app fully boot
    this.sweepTimeout = setTimeout(() => {
      this.sweep().catch((err) => {
        this.logger.error(`Initial sweep failed: ${err.message}`);
      });

      // Then run every 60 seconds
      this.sweepInterval = setInterval(() => {
        this.sweep().catch((err) => {
          this.logger.error(`Sweep failed: ${err.message}`);
        });
      }, 60_000);
    }, 30_000);
  }
}
