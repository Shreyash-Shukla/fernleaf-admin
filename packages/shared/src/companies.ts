// ─── Company & Employee Domain Utilities ─────────────────────────

/**
 * Public email domains that companies cannot claim.
 * Masterplan specifies: gmail.com, yahoo.com, hotmail.com, outlook.com (case-insensitive).
 * We include standard variants of common free webmail providers.
 */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'yandex.com',
  'gmx.com',
]);

/**
 * Normalize an email domain name:
 * - strip leading '@' if provided
 * - trim whitespace
 * - convert to lowercase
 */
export function normalizeDomain(rawDomain: string): string {
  let cleaned = rawDomain.trim().toLowerCase();
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Check if a domain is a well-formed domain string.
 */
export function isValidDomain(rawDomain: string): boolean {
  const domain = normalizeDomain(rawDomain);
  if (!domain || domain.length > 255) return false;
  // Standard domain regex: labels separated by dots, each label 1-63 alphanumeric/hyphens
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Check if a domain belongs to a public email provider.
 */
export function isPublicEmailDomain(rawDomain: string): boolean {
  const domain = normalizeDomain(rawDomain);
  return PUBLIC_EMAIL_DOMAINS.has(domain);
}

/**
 * Normalize an email address:
 * - trim whitespace
 * - convert to lowercase
 */
export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

/**
 * Basic email format validator.
 */
export function isValidEmail(rawEmail: string): boolean {
  const email = normalizeEmail(rawEmail);
  if (!email || email.length > 320) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
