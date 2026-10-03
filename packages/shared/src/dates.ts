// ─── Date Utilities ─────────────────────────────────────────────
// Dates = 'YYYY-MM-DD' strings everywhere in code/API.
// DB Date columns store native DATE; these helpers convert.

/**
 * Convert a JS Date (from Prisma's @db.Date) to 'YYYY-MM-DD' string.
 * Prisma returns @db.Date as a Date at midnight UTC.
 */
export function dbDateToString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Convert a 'YYYY-MM-DD' string to a JS Date suitable for Prisma @db.Date.
 * We use UTC midnight so there's no timezone shift.
 */
export function stringToDbDate(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

/**
 * Validate that a string is a well-formed YYYY-MM-DD date.
 */
export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Get the ISO day-of-week for a date string (1=Mon, 7=Sun).
 * This is timezone-independent since we use UTC midnight.
 */
export function isoDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  // JS getUTCDay: 0=Sun,1=Mon...6=Sat → ISO: 1=Mon...7=Sun
  const jsDay = d.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Check if a date is a kitchen working day.
 * @param dateStr  'YYYY-MM-DD'
 * @param workingDays  ISO day numbers that are working days (e.g. [1,2,3,4,5] for Mon-Fri)
 */
export function isKitchenWorkingDay(
  dateStr: string,
  workingDays: readonly number[],
): boolean {
  return workingDays.includes(isoDayOfWeek(dateStr));
}

/**
 * Check if a date is a kitchen holiday.
 * @param dateStr  'YYYY-MM-DD'
 * @param holidays  Set or array of 'YYYY-MM-DD' strings
 */
export function isKitchenHoliday(
  dateStr: string,
  holidays: ReadonlySet<string> | readonly string[],
): boolean {
  if (holidays instanceof Set) return holidays.has(dateStr);
  return (holidays as readonly string[]).includes(dateStr);
}

/**
 * Add N days to a date string. Returns 'YYYY-MM-DD'.
 */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Check if a date is a company working day.
 */
export function isCompanyWorkingDay(
  dateStr: string,
  workingDays: readonly number[],
): boolean {
  return workingDays.includes(isoDayOfWeek(dateStr));
}

/**
 * Check if a date is a company holiday.
 */
export function isCompanyHoliday(
  dateStr: string,
  holidays: ReadonlySet<string> | readonly string[],
): boolean {
  if (holidays instanceof Set) return holidays.has(dateStr);
  return (holidays as readonly string[]).includes(dateStr);
}
