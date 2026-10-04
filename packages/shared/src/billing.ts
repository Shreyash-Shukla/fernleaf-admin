// ─── Billing Utilities & Types ─────────────────────────────────────

import { AdjustmentReason, InvoiceStatus, InvoiceItemKind, AdjustmentStatus } from './enums.js';

/**
 * Format an invoice sequence number as INV-XXXXXX (6 digits).
 */
export function formatInvoiceNumber(seq: number): string {
  if (seq < 1) seq = 1;
  return `INV-${String(seq).padStart(6, '0')}`;
}

/**
 * Parse an invoice number string back to its integer sequence number.
 * Returns null if not in expected format.
 */
export function parseInvoiceNumber(invoiceNumber: string): number | null {
  if (!invoiceNumber || typeof invoiceNumber !== 'string') return null;
  const match = invoiceNumber.trim().match(/^INV-(\d+)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? null : num;
}

/**
 * Check if an order is billable.
 * An order is billable if and only if:
 * 1. Status is CONFIRMED or DELIVERED
 * 2. It has not yet been assigned to an invoice (invoiceId is null)
 */
export function isOrderBillable(order: {
  status: string;
  invoiceId?: string | null;
}): boolean {
  return (
    (order.status === 'CONFIRMED' || order.status === 'DELIVERED') &&
    (order.invoiceId === null || order.invoiceId === undefined)
  );
}

/**
 * Pure function: calculates the total invoice amount in cents
 * from a list of invoice items (orders and adjustments).
 * Total must equal sum of items.
 */
export function calculateInvoiceTotal(items: { amountCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

// ─── DTO Types ──────────────────────────────────────────────────

export interface CreateInvoiceInput {
  companyId: string;
  orderIds: string[];
  adjustmentIds?: string[];
}

export interface CreateAdjustmentInput {
  companyId: string;
  orderId: string;
  reason: AdjustmentReason;
  amountCents: number;
  note?: string;
}

export interface UnbilledOrderSummary {
  id: string;
  number: number;
  deliveryDate: string;
  deliveryTimeMin: number;
  status: string;
  totalCents: number;
  employeeId: string;
  employeeName: string;
  mealsCount: number;
}

export interface UnbilledDateGroup {
  deliveryDate: string;
  orderCount: number;
  mealsCount: number;
  totalCents: number;
  orders: UnbilledOrderSummary[];
}

export interface OpenAdjustmentSummary {
  id: string;
  orderId: string;
  orderNumber: number;
  reason: AdjustmentReason;
  amountCents: number;
  status: AdjustmentStatus;
  note: string | null;
  createdAt: string;
}

export interface UnbilledOrdersResponse {
  companyId: string;
  companyName: string;
  totalCents: number;
  orderCount: number;
  mealsCount: number;
  oldestDeliveryDate: string | null;
  byDeliveryDate: UnbilledDateGroup[];
  openAdjustments: OpenAdjustmentSummary[];
  adjustmentsTotalCents: number;
  netUnbilledCents: number;
}
