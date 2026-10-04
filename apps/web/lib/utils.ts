import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '$0.00';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`;
}

export function parseMoneyToCents(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function formatMinutesToTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '--:--';
  const mins = Math.max(0, Math.min(1439, minutes));
  const hours = Math.floor(mins / 60);
  const m = mins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(m).padStart(2, '0')} ${period}`;
}

export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 720; // default 12:00
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr || '12', 10);
  const m = parseInt(mStr || '0', 10);
  return h * 60 + m;
}

export function minutesToTimeString(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '12:00';
  const mins = Math.max(0, Math.min(1439, minutes));
  const hours = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  // dateStr is 'YYYY-MM-DD' or ISO string
  const clean = dateStr.slice(0, 10);
  const [year, month, day] = clean.split('-');
  if (!year || !month || !day) return dateStr;
  const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Resiliently extracts a list of items regardless of whether the API returns:
 * - an array directly `[...]`
 * - standard CRUD paginated `{ items: [...] }`
 * - orders paginated `{ data: [...] }`
 * - or entity-named arrays `{ orders: [...] }`, `{ companies: [...] }`, etc.
 */
export function extractList<T = any>(payload: any): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.companies)) return payload.companies;
  if (Array.isArray(payload.employees)) return payload.employees;
  if (Array.isArray(payload.dishes)) return payload.dishes;
  if (Array.isArray(payload.options)) return payload.options;
  if (Array.isArray(payload.staff)) return payload.staff;
  if (Array.isArray(payload.drops)) return payload.drops;
  if (Array.isArray(payload.rows)) return payload.rows;
  return [];
}

/**
 * Pluralize helper ("1 Draft", "2 Drafts")
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${plural || `${singular}s`}`;
}

export type StatusCategory = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

/**
 * Standard Status Mapping per Calm Density Design Spec
 * - neutral: Draft, Not started, Idle, Cancelled
 * - info: Placed, Confirmed, In progress, Scheduled, Assigned, Staging, On route
 * - warning: At risk, Due soon, Pending, Delayed-minor
 * - danger: Late, Failed, Overdue, Delayed, Behind schedule
 * - success: Delivered, Done, Ready, Paid, Completed
 */
export function getStatusCategory(status: string | null | undefined): StatusCategory {
  if (!status) return 'neutral';
  const clean = status.trim().toUpperCase().replace(/[\s_-]+/g, '');

  if (['DELIVERED', 'DONE', 'READY', 'PAID', 'COMPLETED', 'ONTIME', 'SUCCESS'].includes(clean)) {
    return 'success';
  }
  if (['LATE', 'FAILED', 'OVERDUE', 'DELAYED', 'BEHINDSCHEDULE', 'REJECTED'].includes(clean)) {
    return 'danger';
  }
  if (['ATRISK', 'DUESOON', 'PENDING', 'DELAYEDMINOR', 'UNBILLED', 'COOKING'].includes(clean)) {
    return 'warning';
  }
  if (['PLACED', 'CONFIRMED', 'INPROGRESS', 'SCHEDULED', 'ASSIGNED', 'STAGING', 'ONROUTE', 'OUTFORDELIVERY', 'PREPARING', 'DISPATCHREADY', 'ISSUED'].includes(clean)) {
    return 'info';
  }
  return 'neutral';
}


