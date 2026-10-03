import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { cutoffAt, isLocked, CutoffSettings } from '../src/cutoff.js';

const TZ = 'Asia/Kolkata';

function makeSettings(overrides?: Partial<CutoffSettings>): CutoffSettings {
  return {
    cutoffDays: 2,
    cutoffTime: '16:00',
    kitchenWorkingDays: [1, 2, 3, 4, 5], // Mon-Fri
    kitchenHolidays: new Set<string>(),
    timezone: TZ,
    ...overrides,
  };
}

describe('cutoff', () => {
  describe('cutoffAt', () => {
    // Basic: Wed delivery, 2 working days back → Mon 16:00
    it('Wed delivery → Mon 16:00 (2 working days back)', () => {
      const settings = makeSettings();
      const result = cutoffAt('2026-10-07', settings); // Wed
      // Count back: Tue (1), Mon (2) → Mon
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 5, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Mon delivery, 2 working days back → skip weekend → Thu 16:00
    it('Mon delivery → Thu 16:00 (skips weekend)', () => {
      const settings = makeSettings();
      const result = cutoffAt('2026-10-05', settings); // Mon
      // Count back: Sun (skip), Sat (skip), Fri (1), Thu (2) → Thu
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 1, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Tue delivery, 2 working days back → skip weekend → Fri 16:00
    it('Tue delivery → Fri 16:00 (skips weekend)', () => {
      const settings = makeSettings();
      const result = cutoffAt('2026-10-06', settings); // Tue
      // Count back: Mon (1), Sun (skip), Sat (skip), Fri (2) → Fri
      // Wait: Mon is 1 working day. Then Sun = skip, Sat = skip, Fri = 2. → Fri
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 2, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // With kitchen holiday: Wed delivery, Tue is holiday → skip Tue, Mon (1), Fri (2) → Fri
    it('skips kitchen holidays', () => {
      const settings = makeSettings({
        kitchenHolidays: new Set(['2026-10-06']), // Tue is holiday
      });
      const result = cutoffAt('2026-10-07', settings); // Wed
      // Count back: Tue (holiday, skip), Mon (1), Sun (skip), Sat (skip), Fri (2)
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 2, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // cutoffDays = 0 → same delivery date at cutoff time
    it('cutoffDays=0 → cutoff at delivery date', () => {
      const settings = makeSettings({ cutoffDays: 0 });
      const result = cutoffAt('2026-10-07', settings); // Wed
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 7, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // cutoffDays = 1
    it('cutoffDays=1 → 1 working day back', () => {
      const settings = makeSettings({ cutoffDays: 1 });
      const result = cutoffAt('2026-10-07', settings); // Wed → Tue
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 6, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // cutoffDays = 3
    it('cutoffDays=3 → 3 working days back', () => {
      const settings = makeSettings({ cutoffDays: 3 });
      const result = cutoffAt('2026-10-07', settings); // Wed
      // Count back: Tue (1), Mon (2), Sun (skip), Sat (skip), Fri (3) → Fri
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 2, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Different cutoff time
    it('cutoffTime=09:30', () => {
      const settings = makeSettings({ cutoffTime: '09:30' });
      const result = cutoffAt('2026-10-07', settings); // Wed → Mon 09:30
      expect(result.hour).toBe(9);
      expect(result.minute).toBe(30);
    });

    // Multiple holidays in sequence
    it('handles consecutive holidays', () => {
      const settings = makeSettings({
        kitchenHolidays: new Set(['2026-10-06', '2026-10-05']), // Tue + Mon
      });
      const result = cutoffAt('2026-10-07', settings); // Wed
      // Count back: Tue (hol skip), Mon (hol skip), Sun (skip), Sat (skip), Fri (1), Thu (2)
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 1, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Holiday on a weekend doesn't double-skip
    it('holiday on weekend has no extra effect', () => {
      const settings = makeSettings({
        kitchenHolidays: new Set(['2026-10-03']), // Sat
      });
      const result = cutoffAt('2026-10-07', settings); // Wed
      // Sat is already not a working day, so holiday doesn't matter
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 5, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Thu delivery, cutoffDays=2 → Tue
    it('Thu delivery → Tue', () => {
      const settings = makeSettings();
      const result = cutoffAt('2026-10-08', settings); // Thu
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 6, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Fri delivery, cutoffDays=2 → Wed
    it('Fri delivery → Wed', () => {
      const settings = makeSettings();
      const result = cutoffAt('2026-10-09', settings); // Fri
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 7, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Different timezone
    it('works with different timezone', () => {
      const settings = makeSettings({ timezone: 'America/New_York' });
      const result = cutoffAt('2026-10-07', settings);
      expect(result.zoneName).toBe('America/New_York');
    });

    // Kitchen with 6-day work week (Mon-Sat)
    it('6-day work week (Mon-Sat)', () => {
      const settings = makeSettings({
        kitchenWorkingDays: [1, 2, 3, 4, 5, 6],
      });
      const result = cutoffAt('2026-10-05', settings); // Mon
      // Count back: Sun (skip), Sat (1, it's working now), Fri (2) → Fri Oct 2
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 2, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Large cutoff days
    it('cutoffDays=5 → full week back', () => {
      const settings = makeSettings({ cutoffDays: 5 });
      const result = cutoffAt('2026-10-09', settings); // Fri
      // Count back: Thu(1), Wed(2), Tue(3), Mon(4), Sun(skip), Sat(skip), Fri(5) → Oct 2
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 2, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });

    // Holidays passed as array (not Set)
    it('accepts holidays as array', () => {
      const settings = makeSettings({
        kitchenHolidays: ['2026-10-06'] as readonly string[],
      });
      const result = cutoffAt('2026-10-07', settings);
      expect(result.toISO()).toBe(
        DateTime.fromObject(
          { year: 2026, month: 10, day: 2, hour: 16, minute: 0 },
          { zone: TZ },
        ).toISO(),
      );
    });
  });

  describe('isLocked', () => {
    it('returns false before cutoff', () => {
      const settings = makeSettings();
      const now = DateTime.fromObject(
        { year: 2026, month: 10, day: 5, hour: 15, minute: 59 },
        { zone: TZ },
      );
      expect(isLocked('2026-10-07', now, settings)).toBe(false);
    });

    it('returns true AT cutoff (equal = locked)', () => {
      const settings = makeSettings();
      const now = DateTime.fromObject(
        { year: 2026, month: 10, day: 5, hour: 16, minute: 0 },
        { zone: TZ },
      );
      expect(isLocked('2026-10-07', now, settings)).toBe(true);
    });

    it('returns true after cutoff', () => {
      const settings = makeSettings();
      const now = DateTime.fromObject(
        { year: 2026, month: 10, day: 5, hour: 16, minute: 1 },
        { zone: TZ },
      );
      expect(isLocked('2026-10-07', now, settings)).toBe(true);
    });
  });
});
