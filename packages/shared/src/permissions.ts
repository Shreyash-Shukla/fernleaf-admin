// ─── Permission Constants + Helper ──────────────────────────────
// Granular, string-based permissions. Adding a new role or permission
// only means editing this file — no hunting through the codebase.

export const PERMISSIONS = {
  CATALOGUE_READ: 'catalogue:read',
  CATALOGUE_WRITE: 'catalogue:write',
  PRICING_READ: 'pricing:read',
  PRICING_WRITE: 'pricing:write',
  COMPANIES_READ: 'companies:read',
  COMPANIES_WRITE: 'companies:write',
  EMPLOYEES_READ: 'employees:read',
  EMPLOYEES_WRITE: 'employees:write',
  ORDERS_READ: 'orders:read',
  ORDERS_WRITE: 'orders:write',
  ORDERS_OVERRIDE: 'orders:override',
  CUTOFF_RUN: 'cutoff:run',
  KITCHEN_READ: 'kitchen:read',
  KITCHEN_WORK: 'kitchen:work',
  KITCHEN_FORCE: 'kitchen:force',
  DISPATCH_READ: 'dispatch:read',
  DISPATCH_WORK: 'dispatch:work',
  DELIVERIES_READ_OWN: 'deliveries:read_own',
  DELIVERIES_READ_ANY: 'deliveries:read_any',
  DELIVERIES_DELIVER: 'deliveries:deliver',
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  STAFF_READ: 'staff:read',
  STAFF_WRITE: 'staff:write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Wildcard = admin has ['*']. Matches everything.
 */
export function can(
  userPermissions: readonly string[],
  required: string,
): boolean {
  return userPermissions.includes('*') || userPermissions.includes(required);
}

/**
 * Check if a user has ALL of the required permissions.
 */
export function canAll(
  userPermissions: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((p) => can(userPermissions, p));
}

/**
 * Check if a user has ANY of the required permissions.
 */
export function canAny(
  userPermissions: readonly string[],
  required: readonly string[],
): boolean {
  return required.some((p) => can(userPermissions, p));
}

// ── Role permission presets (seed roles reference) ──────────────
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  admin: ['*'],
  kitchen: [
    PERMISSIONS.KITCHEN_READ,
    PERMISSIONS.KITCHEN_WORK,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.CATALOGUE_READ,
  ],
  dispatch: [
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.DISPATCH_WORK,
    PERMISSIONS.KITCHEN_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.COMPANIES_READ,
    PERMISSIONS.DELIVERIES_READ_ANY,
  ],
  driver: [
    PERMISSIONS.DELIVERIES_READ_OWN,
    PERMISSIONS.DELIVERIES_DELIVER,
  ],
};

export const ROLE_LANDING_PATHS: Record<string, string> = {
  admin: '/dashboard',
  kitchen: '/kitchen',
  dispatch: '/dispatch',
  driver: '/driver',
};

export const ROLE_DASHBOARD_KEYS: Record<string, string> = {
  admin: 'admin',
  kitchen: 'kitchen',
  dispatch: 'dispatch',
  driver: 'driver',
};
