// ─── Planned Times ──────────────────────────────────────────────
// Worked back from delivery time:
//   dispatch-ready = delivery instant - leadMin
//   kitchen-ready  = dispatch-ready - bufferMin (default 30)

import { DateTime } from 'luxon';

export interface PlannedTimes {
  /** When the kitchen must have all units done */
  plannedKitchenReadyAt: string; // ISO instant
  /** When the order must leave the kitchen for dispatch */
  plannedDispatchReadyAt: string; // ISO instant
}

/**
 * Compute planned kitchen-ready and dispatch-ready times from delivery details.
 *
 * @param date       Delivery date 'YYYY-MM-DD'
 * @param timeMin    Delivery time in minutes since midnight (0-1439)
 * @param leadMin    Company's dispatch lead time in minutes (default 60)
 * @param bufferMin  Kitchen buffer before dispatch-ready in minutes (default 30)
 * @param tz         IANA timezone (e.g. 'Asia/Kolkata')
 */
export function planTimes(
  date: string,
  timeMin: number,
  leadMin: number,
  bufferMin: number,
  tz: string,
): PlannedTimes {
  const hours = Math.floor(timeMin / 60);
  const minutes = timeMin % 60;

  const deliveryInstant = DateTime.fromObject(
    {
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
      hour: hours,
      minute: minutes,
      second: 0,
      millisecond: 0,
    },
    { zone: tz },
  );

  const dispatchReady = deliveryInstant.minus({ minutes: leadMin });
  const kitchenReady = dispatchReady.minus({ minutes: bufferMin });

  return {
    plannedKitchenReadyAt: kitchenReady.toISO()!,
    plannedDispatchReadyAt: dispatchReady.toISO()!,
  };
}
