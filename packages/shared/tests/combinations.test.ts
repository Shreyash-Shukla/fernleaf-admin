import { describe, it, expect } from 'vitest';
import {
  validateCombinations,
  computeSignature,
  priceCombo,
  priceLine,
  priceOrder,
  ResolvedGroup,
  CombinationInput,
} from '../src/combinations.js';

// ── Test Helpers ────────────────────────────────────────────────

function makeGroups(): ResolvedGroup[] {
  return [
    {
      groupId: 'g-protein',
      name: 'Protein',
      required: true,
      usesPortions: false,
      options: [
        { optionId: 'opt-paneer', name: 'Paneer', priceCents: 50 },
        { optionId: 'opt-tofu', name: 'Tofu', priceCents: 40 },
        { optionId: 'opt-chickpeas', name: 'Chickpeas', priceCents: 30 },
      ],
      portions: [],
    },
    {
      groupId: 'g-rice',
      name: 'Rice',
      required: false,
      usesPortions: false,
      options: [
        { optionId: 'opt-brown', name: 'Brown Rice', priceCents: 20 },
        { optionId: 'opt-jeera', name: 'Jeera Rice', priceCents: 25 },
      ],
      portions: [],
    },
  ];
}

function makePortionGroups(): ResolvedGroup[] {
  return [
    {
      groupId: 'g-size',
      name: 'Size',
      required: true,
      usesPortions: true,
      options: [
        { optionId: 'opt-dal', name: 'Dal', priceCents: 30 },
      ],
      portions: [
        { portionSizeId: 'ps-regular', name: 'Regular', extraCents: 0 },
        { portionSizeId: 'ps-large', name: 'Large', extraCents: 50 },
      ],
    },
  ];
}

describe('combinations', () => {
  describe('validateCombinations', () => {
    it('valid: single combo satisfying required group', () => {
      const result = validateCombinations(5, [
        {
          quantity: 5,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('valid: two combos summing to line quantity', () => {
      const result = validateCombinations(10, [
        {
          quantity: 6,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
            { groupId: 'g-rice', optionId: 'opt-brown' },
          ],
        },
        {
          quantity: 4,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
            { groupId: 'g-rice', optionId: 'opt-jeera' },
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(true);
    });

    it('FAIL: sum mismatch', () => {
      const result = validateCombinations(10, [
        {
          quantity: 6,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
          ],
        },
        {
          quantity: 3, // 6+3=9, not 10
          selections: [
            { groupId: 'g-protein', optionId: 'opt-tofu' },
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'COMBINATION_SUM_MISMATCH')).toBe(true);
    });

    it('FAIL: duplicate signature', () => {
      const result = validateCombinations(10, [
        {
          quantity: 6,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
          ],
        },
        {
          quantity: 4,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' }, // same as combo 0
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'COMBINATION_DUPLICATE_SIGNATURE')).toBe(true);
    });

    it('FAIL: required group missing', () => {
      const result = validateCombinations(5, [
        {
          quantity: 5,
          selections: [
            // Missing g-protein (required)
            { groupId: 'g-rice', optionId: 'opt-brown' },
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'REQUIRED_GROUP_MISSING')).toBe(true);
    });

    it('valid: optional group skipped', () => {
      const result = validateCombinations(5, [
        {
          quantity: 5,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
            // g-rice (optional) skipped — valid
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(true);
    });

    it('FAIL: invalid option selection', () => {
      const result = validateCombinations(5, [
        {
          quantity: 5,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-nonexistent' },
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_OPTION_SELECTION')).toBe(true);
    });

    it('FAIL: no combinations', () => {
      const result = validateCombinations(5, [], makeGroups());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NO_COMBINATIONS')).toBe(true);
    });

    it('FAIL: zero quantity combination', () => {
      const result = validateCombinations(5, [
        {
          quantity: 0,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
          ],
        },
        {
          quantity: 5,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-tofu' },
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(false);
    });

    // Portion tests
    it('valid: portion selection when group uses portions', () => {
      const result = validateCombinations(3, [
        {
          quantity: 3,
          selections: [
            { groupId: 'g-size', optionId: 'opt-dal', portionSizeId: 'ps-regular' },
          ],
        },
      ], makePortionGroups());
      expect(result.valid).toBe(true);
    });

    it('FAIL: missing portion when group uses portions', () => {
      const result = validateCombinations(3, [
        {
          quantity: 3,
          selections: [
            { groupId: 'g-size', optionId: 'opt-dal' }, // no portionSizeId
          ],
        },
      ], makePortionGroups());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PORTION_REQUIRED')).toBe(true);
    });

    it('FAIL: portion provided when group does NOT use portions', () => {
      const result = validateCombinations(5, [
        {
          quantity: 5,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer', portionSizeId: 'ps-regular' },
          ],
        },
      ], makeGroups());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PORTION_NOT_ALLOWED')).toBe(true);
    });

    it('FAIL: option with null price (unavailable)', () => {
      const groups: ResolvedGroup[] = [
        {
          groupId: 'g-protein',
          name: 'Protein',
          required: true,
          usesPortions: false,
          options: [
            { optionId: 'opt-paneer', name: 'Paneer', priceCents: null }, // no price
          ],
          portions: [],
        },
      ];
      const result = validateCombinations(5, [
        {
          quantity: 5,
          selections: [
            { groupId: 'g-protein', optionId: 'opt-paneer' },
          ],
        },
      ], groups);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PRICE_NOT_SET')).toBe(true);
    });
  });

  describe('computeSignature', () => {
    it('same selections in different order → same signature', () => {
      const s1 = computeSignature([
        { groupId: 'g1', optionId: 'o1' },
        { groupId: 'g2', optionId: 'o2' },
      ]);
      const s2 = computeSignature([
        { groupId: 'g2', optionId: 'o2' },
        { groupId: 'g1', optionId: 'o1' },
      ]);
      expect(s1).toBe(s2);
    });

    it('different selections → different signature', () => {
      const s1 = computeSignature([
        { groupId: 'g1', optionId: 'o1' },
      ]);
      const s2 = computeSignature([
        { groupId: 'g1', optionId: 'o2' },
      ]);
      expect(s1).not.toBe(s2);
    });

    it('includes portion in signature', () => {
      const s1 = computeSignature([
        { groupId: 'g1', optionId: 'o1', portionSizeId: 'ps1' },
      ]);
      const s2 = computeSignature([
        { groupId: 'g1', optionId: 'o1', portionSizeId: 'ps2' },
      ]);
      expect(s1).not.toBe(s2);
    });
  });

  describe('pricing', () => {
    it('priceCombo: unitCents = dish + options, totalCents = unit × qty', () => {
      const result = priceCombo(
        500, // dish price
        [
          { groupId: 'g-protein', optionId: 'opt-paneer' },
          { groupId: 'g-rice', optionId: 'opt-brown' },
        ],
        makeGroups(),
        6,
      );
      // unit = 500 + 50 (paneer) + 20 (brown rice) = 570
      // total = 570 * 6 = 3420
      expect(result.unitCents).toBe(570);
      expect(result.totalCents).toBe(3420);
    });

    it('priceCombo: no options → unit = dish only', () => {
      const result = priceCombo(500, [], makeGroups(), 3);
      expect(result.unitCents).toBe(500);
      expect(result.totalCents).toBe(1500);
    });

    it('priceCombo: includes portion extra', () => {
      const result = priceCombo(
        500,
        [{ groupId: 'g-size', optionId: 'opt-dal', portionSizeId: 'ps-large' }],
        makePortionGroups(),
        2,
      );
      // unit = 500 + 30 (dal) + 50 (large extra) = 580
      expect(result.unitCents).toBe(580);
      expect(result.totalCents).toBe(1160);
    });

    it('priceLine: sum of combo totals', () => {
      expect(priceLine([3420, 2400])).toBe(5820);
    });

    it('priceOrder: sum of line totals', () => {
      expect(priceOrder([5820, 1500])).toBe(7320);
    });

    it('order total = Σ lines = Σ Σ combos (reconciliation)', () => {
      // Line 1: 2 combos
      const c1 = priceCombo(500, [{ groupId: 'g-protein', optionId: 'opt-paneer' }], makeGroups(), 6);
      const c2 = priceCombo(500, [{ groupId: 'g-protein', optionId: 'opt-tofu' }], makeGroups(), 4);
      const lineTotal1 = priceLine([c1.totalCents, c2.totalCents]);

      // Line 2: 1 combo
      const c3 = priceCombo(300, [{ groupId: 'g-protein', optionId: 'opt-chickpeas' }], makeGroups(), 5);
      const lineTotal2 = priceLine([c3.totalCents]);

      const orderTotal = priceOrder([lineTotal1, lineTotal2]);

      // Verify reconciliation
      expect(lineTotal1).toBe(c1.totalCents + c2.totalCents);
      expect(lineTotal2).toBe(c3.totalCents);
      expect(orderTotal).toBe(lineTotal1 + lineTotal2);

      // Manual check:
      // c1: unit = 500+50 = 550, total = 550*6 = 3300
      // c2: unit = 500+40 = 540, total = 540*4 = 2160
      // lineTotal1 = 3300+2160 = 5460
      // c3: unit = 300+30 = 330, total = 330*5 = 1650
      // lineTotal2 = 1650
      // orderTotal = 5460+1650 = 7110
      expect(c1.unitCents).toBe(550);
      expect(c1.totalCents).toBe(3300);
      expect(c2.unitCents).toBe(540);
      expect(c2.totalCents).toBe(2160);
      expect(lineTotal1).toBe(5460);
      expect(c3.unitCents).toBe(330);
      expect(c3.totalCents).toBe(1650);
      expect(orderTotal).toBe(7110);
    });
  });
});
