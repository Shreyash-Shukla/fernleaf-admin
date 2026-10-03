import { describe, it, expect } from 'vitest';
import {
  normalizeDomain,
  isValidDomain,
  isPublicEmailDomain,
  normalizeEmail,
  isValidEmail,
  PUBLIC_EMAIL_DOMAINS,
} from '../src/companies.js';

describe('Company Domain Utilities', () => {
  it('normalizes domains properly', () => {
    expect(normalizeDomain('  Acme.COM  ')).toBe('acme.com');
    expect(normalizeDomain('@acme.corp.in')).toBe('acme.corp.in');
    expect(normalizeDomain('GMAIL.COM')).toBe('gmail.com');
  });

  it('identifies public email domains', () => {
    expect(isPublicEmailDomain('gmail.com')).toBe(true);
    expect(isPublicEmailDomain('  GMAIL.COM ')).toBe(true);
    expect(isPublicEmailDomain('@yahoo.com')).toBe(true);
    expect(isPublicEmailDomain('hotmail.com')).toBe(true);
    expect(isPublicEmailDomain('outlook.com')).toBe(true);
    expect(isPublicEmailDomain('proton.me')).toBe(true);

    expect(isPublicEmailDomain('acme.com')).toBe(false);
    expect(isPublicEmailDomain('fernleaf.in')).toBe(false);
    expect(isPublicEmailDomain('google.internal')).toBe(false);
  });

  it('validates well-formed domains', () => {
    expect(isValidDomain('acme.com')).toBe(true);
    expect(isValidDomain('sub.domain.co.uk')).toBe(true);
    expect(isValidDomain('my-company.org')).toBe(true);

    expect(isValidDomain('')).toBe(false);
    expect(isValidDomain('invalid')).toBe(false);
    expect(isValidDomain('not a domain.com')).toBe(false);
    expect(isValidDomain('domain..com')).toBe(false);
  });

  it('normalizes and validates emails', () => {
    expect(normalizeEmail(' John.Doe@Acme.COM ')).toBe('john.doe@acme.com');
    expect(isValidEmail('john.doe@acme.com')).toBe(true);
    expect(isValidEmail('user@sub.domain.co')).toBe(true);
    expect(isValidEmail('plainaddress')).toBe(false);
    expect(isValidEmail('@missinguser.com')).toBe(false);
    expect(isValidEmail('missingdomain@')).toBe(false);
  });
});
