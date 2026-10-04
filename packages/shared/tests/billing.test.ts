import { describe, it, expect } from 'vitest';
import {
  formatInvoiceNumber,
  parseInvoiceNumber,
  isOrderBillable,
  calculateInvoiceTotal,
} from '../src/billing.js';

describe('Billing Utilities', () => {
  describe('formatInvoiceNumber', () => {
    it('formats sequential numbers with 6 zero-padded digits', () => {
      expect(formatInvoiceNumber(1)).toBe('INV-000001');
      expect(formatInvoiceNumber(42)).toBe('INV-000042');
      expect(formatInvoiceNumber(999999)).toBe('INV-999999');
      expect(formatInvoiceNumber(1000000)).toBe('INV-1000000');
    });

    it('handles non-positive numbers gracefully', () => {
      expect(formatInvoiceNumber(0)).toBe('INV-000001');
      expect(formatInvoiceNumber(-5)).toBe('INV-000001');
    });
  });

  describe('parseInvoiceNumber', () => {
    it('parses valid invoice numbers', () => {
      expect(parseInvoiceNumber('INV-000001')).toBe(1);
      expect(parseInvoiceNumber('inv-000123')).toBe(123);
      expect(parseInvoiceNumber('  INV-000042  ')).toBe(42);
    });

    it('returns null for invalid invoice numbers', () => {
      expect(parseInvoiceNumber('')).toBeNull();
      expect(parseInvoiceNumber('ORD-00001')).toBeNull();
      expect(parseInvoiceNumber('INV-ABC')).toBeNull();
    });
  });

  describe('isOrderBillable', () => {
    it('returns true for CONFIRMED orders without invoiceId', () => {
      expect(isOrderBillable({ status: 'CONFIRMED', invoiceId: null })).toBe(true);
      expect(isOrderBillable({ status: 'CONFIRMED' })).toBe(true);
    });

    it('returns true for DELIVERED orders without invoiceId', () => {
      expect(isOrderBillable({ status: 'DELIVERED', invoiceId: null })).toBe(true);
    });

    it('returns false for orders with invoiceId already set', () => {
      expect(isOrderBillable({ status: 'CONFIRMED', invoiceId: 'inv-1' })).toBe(false);
      expect(isOrderBillable({ status: 'DELIVERED', invoiceId: 'inv-1' })).toBe(false);
    });

    it('returns false for non-billable order statuses', () => {
      expect(isOrderBillable({ status: 'DRAFT', invoiceId: null })).toBe(false);
      expect(isOrderBillable({ status: 'PLACED', invoiceId: null })).toBe(false);
      expect(isOrderBillable({ status: 'CANCELLED', invoiceId: null })).toBe(false);
      expect(isOrderBillable({ status: 'REJECTED', invoiceId: null })).toBe(false);
    });
  });

  describe('calculateInvoiceTotal', () => {
    it('sums positive order item amounts', () => {
      const items = [
        { amountCents: 1500 },
        { amountCents: 2500 },
        { amountCents: 3000 },
      ];
      expect(calculateInvoiceTotal(items)).toBe(7000);
    });

    it('correctly applies negative adjustment items', () => {
      const items = [
        { amountCents: 5000 },
        { amountCents: 3000 },
        { amountCents: -1500 }, // cancellation adjustment
      ];
      expect(calculateInvoiceTotal(items)).toBe(6500);
    });

    it('handles empty item list', () => {
      expect(calculateInvoiceTotal([])).toBe(0);
    });
  });
});
