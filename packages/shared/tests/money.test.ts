import { describe, it, expect } from 'vitest';
import { derive, roundUp5, formatCents, parseMoneyToCents } from '../src/money.js';

describe('money', () => {
  describe('derive', () => {
    // derive(baseCents, factorBps) = ceil(baseCents * factorBps / 50000) * 5
    it('derive(211, 10000) → 215 (1× factor rounds up)', () => {
      // ceil(211 * 10000 / 50000) * 5 = ceil(42.2) * 5 = 43 * 5 = 215
      expect(derive(211, 10000)).toBe(215);
    });

    it('derive(100, 24000) → 240 (cost × 2.4)', () => {
      // ceil(100 * 24000 / 50000) * 5 = ceil(48) * 5 = 48 * 5 = 240
      expect(derive(100, 24000)).toBe(240);
    });

    it('derive(1000, 11500) → 1150 (Standard + 15%)', () => {
      // ceil(1000 * 11500 / 50000) * 5 = ceil(230) * 5 = 230 * 5 = 1150
      expect(derive(1000, 11500)).toBe(1150);
    });

    it('derive(1, 10000) → 5 (tiny base rounds up to $0.05)', () => {
      // ceil(1 * 10000 / 50000) * 5 = ceil(0.2) * 5 = 1 * 5 = 5
      expect(derive(1, 10000)).toBe(5);
    });

    it('derive(0, anything) → null (not orderable)', () => {
      expect(derive(0, 10000)).toBe(null);
      expect(derive(0, 24000)).toBe(null);
    });

    it('derive(-50, 10000) → null (negative base)', () => {
      expect(derive(-50, 10000)).toBe(null);
    });

    it('result is always a multiple of 5', () => {
      const testCases = [
        [100, 10000], [211, 10000], [333, 15000],
        [1, 10000], [7, 12345], [999, 24000],
        [50, 11500], [123, 9000],
      ] as const;
      for (const [base, factor] of testCases) {
        const result = derive(base, factor);
        if (result !== null) {
          expect(result % 5).toBe(0);
        }
      }
    });

    it('derive(500, 10000) → 500 (exact — no rounding needed)', () => {
      // ceil(500 * 10000 / 50000) * 5 = ceil(100) * 5 = 500
      expect(derive(500, 10000)).toBe(500);
    });

    it('derive(300, 24000) → 720 (cost × 2.4 exact)', () => {
      // ceil(300 * 24000 / 50000) * 5 = ceil(144) * 5 = 720
      expect(derive(300, 24000)).toBe(720);
    });
  });

  describe('roundUp5', () => {
    it('211 → 215', () => expect(roundUp5(211)).toBe(215));
    it('210 → 210', () => expect(roundUp5(210)).toBe(210));
    it('1 → 5', () => expect(roundUp5(1)).toBe(5));
    it('0 → 0', () => expect(roundUp5(0)).toBe(0));
    it('5 → 5', () => expect(roundUp5(5)).toBe(5));
    it('6 → 10', () => expect(roundUp5(6)).toBe(10));
  });

  describe('formatCents', () => {
    it('1250 → $12.50', () => expect(formatCents(1250)).toBe('$12.50'));
    it('0 → $0.00', () => expect(formatCents(0)).toBe('$0.00'));
    it('5 → $0.05', () => expect(formatCents(5)).toBe('$0.05'));
    it('-500 → -$5.00', () => expect(formatCents(-500)).toBe('-$5.00'));
  });

  describe('parseMoneyToCents', () => {
    it('"$12.50" → 1250', () => expect(parseMoneyToCents('$12.50')).toBe(1250));
    it('12.5 → 1250', () => expect(parseMoneyToCents(12.5)).toBe(1250));
    it('"0" → 0', () => expect(parseMoneyToCents('0')).toBe(0));
    it('throws on invalid', () => {
      expect(() => parseMoneyToCents('abc')).toThrow();
    });
  });
});
