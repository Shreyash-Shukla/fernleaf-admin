// ─── Cut-off Calculation ────────────────────────────────────────
// Cut-off = configured number of kitchen working days BEFORE delivery,
// at a configured time. Company calendar does NOT affect cut-off.

import { DateTime } from 'luxon';
import { isKitchenWorkingDay, isKitchenHoliday, addDays } from './dates.js';

export interface CutoffSettings {
  /** Number of kitchen working days to count back */
  cutoffDays: number;
  /** Cut-off time as 'HH:MM' (24h) */
  cutoffTime: string;
  /** Kitchen working days, ISO day numbers (1=Mon..7=Sun) */
  kitchenWorkingDays: readonly number[];
  /** Kitchen holiday dates as 'YYYY-MM-DD' strings */
  kitchenHolidays: ReadonlySet<string> | readonly string[];
  /** IANA timezone, e.g. 'Asia/Kolkata' */
  timezone: string;
}

/**
 * Compute the cut-off instant for a given delivery date.
 *
 * Algorithm: count back `cutoffDays` kitchen working days from deliveryDate
 * (not counting deliveryDate itself), then return that date at cutoffTime
 * in the kitchen timezone.
 *
 * Example: cutoffDays=2, cutoffTime='16:00', delivery on Wednesday.
 *   Count back: Tue (working, n=1), Mon (working, n=2) → cutoff at Mon 16:00.
 */
export function cutoffAt(
  deliveryDate: string,
  settings: CutoffSettings,
): DateTime {
  let d = deliveryDate;
  let n = 0;

  while (n < settings.cutoffDays) {
    d = addDays(d, -1);
    if (
      isKitchenWorkingDay(d, settings.kitchenWorkingDays) &&
      !isKitchenHoliday(d, settings.kitchenHolidays)
    ) {
      n++;
    }
  }

  // Build the instant from the landed date + cutoff time in kitchen TZ
  const [hours, minutes] = settings.cutoffTime.split(':').map(Number);
  return DateTime.fromObject(
    {
      year: Number(d.slice(0, 4)),
      month: Number(d.slice(5, 7)),
      day: Number(d.slice(8, 10)),
      hour: hours,
      minute: minutes,
      second: 0,
      millisecond: 0,
    },
    { zone: settings.timezone },
  );
}

/**
 * Check if a delivery date is locked (cut-off has passed).
 * Equal = locked (as per spec: "equal = locked").
 */
export function isLocked(
  deliveryDate: string,
  now: DateTime,
  settings: CutoffSettings,
): boolean {
  const cutoff = cutoffAt(deliveryDate, settings);
  return now >= cutoff; // equal = locked
}
