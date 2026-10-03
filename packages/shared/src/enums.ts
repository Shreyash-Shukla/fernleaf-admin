// ─── Domain Enums ────────────────────────────────────────────────
// Mirror of Prisma enums, usable without Prisma client dependency.
// Every enum is a string-literal union + a const array for iteration.

export const TEMPERATURES = ['HOT', 'COLD'] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export const PACKAGINGS = ['STANDARD', 'INSULATED', 'ECO'] as const;
export type Packaging = (typeof PACKAGINGS)[number];

export const ORDER_STATUSES = [
  'DRAFT',
  'PLACED',
  'CONFIRMED',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_SOURCES = ['STAFF', 'DEMO'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const TIER_DERIVATIONS = ['NONE', 'COST_FACTOR', 'TIER_FACTOR'] as const;
export type TierDerivation = (typeof TIER_DERIVATIONS)[number];

export const INVOICE_STATUSES = ['ISSUED', 'PAID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_ITEM_KINDS = ['ORDER', 'ADJUSTMENT'] as const;
export type InvoiceItemKind = (typeof INVOICE_ITEM_KINDS)[number];

export const ADJUSTMENT_STATUSES = ['OPEN', 'INVOICED', 'WAIVED'] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];

export const ADJUSTMENT_REASONS = [
  'CANCELLED_AFTER_INVOICE',
  'SHORT_DELIVERY',
  'MANUAL',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const CUTOFF_TRIGGERS = ['CRON', 'LAZY', 'MANUAL'] as const;
export type CutoffTrigger = (typeof CUTOFF_TRIGGERS)[number];
