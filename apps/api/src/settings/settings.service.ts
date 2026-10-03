import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { isValidDateString, ERRORS } from '@repo/shared';
import { DomainError } from '../common/domain-error';

export const SETTINGS_DEFAULTS = {
  timezone: 'Asia/Kolkata',
  kitchenWorkingDays: [1, 2, 3, 4, 5],
  cutoffTime: '16:00',
  cutoffDays: 2,
  kitchenBufferMinutes: 30,
  atRiskWindowMinutes: 60,
  onTimeGraceMinutes: 10,
  defaultDispatchLeadMinutes: 60,
  cutoffHoldDates: [] as string[],
};

export type AppSettings = typeof SETTINGS_DEFAULTS;
export type SettingsKey = keyof AppSettings;

export const SETTING_SCHEMAS: Record<string, z.ZodTypeAny> = {
  timezone: z.string().refine((val) => DateTime.now().setZone(val).isValid, {
    message: 'Invalid IANA timezone identifier',
  }),
  kitchenWorkingDays: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'At least one working day is required')
    .refine((days) => new Set(days).size === days.length, {
      message: 'Working days cannot contain duplicates',
    }),
  cutoffTime: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      'Cutoff time must be in HH:mm 24-hour format',
    ),
  cutoffDays: z.number().int().min(0).max(14),
  kitchenBufferMinutes: z.number().int().min(0).max(240),
  atRiskWindowMinutes: z.number().int().min(5).max(480),
  onTimeGraceMinutes: z.number().int().min(0).max(120),
  defaultDispatchLeadMinutes: z.number().int().min(0).max(240),
  cutoffHoldDates: z.array(
    z.string().refine(isValidDateString, {
      message: 'Hold dates must be valid YYYY-MM-DD date strings',
    }),
  ),
};

@Injectable()
export class SettingsService {
  private cache: AppSettings | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 10_000; // 10 seconds

  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<AppSettings> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiry) {
      return { ...this.cache };
    }

    const rows = await this.prisma.setting.findMany();
    const settings: Record<string, any> = { ...SETTINGS_DEFAULTS };

    for (const row of rows) {
      settings[row.key] = row.value;
    }

    this.cache = settings as AppSettings;
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return { ...this.cache };
  }

  async get<K extends SettingsKey>(key: K): Promise<AppSettings[K]> {
    const all = await this.getAll();
    return all[key];
  }

  async getTimezone(): Promise<string> {
    return this.get('timezone');
  }

  async set(key: string, rawValue: any): Promise<{ key: string; value: any }> {
    const schema = SETTING_SCHEMAS[key];
    if (!schema) {
      throw DomainError.badRequest(
        ERRORS.SETTING_NOT_FOUND,
        `Unknown setting key: "${key}"`,
      );
    }

    let parsedValue: any;
    try {
      parsedValue = schema.parse(rawValue);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          fieldErrors[issue.path.join('.') || key] = issue.message;
        }
        throw DomainError.badRequest(
          ERRORS.INVALID_SETTING_VALUE,
          `Invalid value for setting "${key}": ${err.issues.map((i) => i.message).join('; ')}`,
          fieldErrors,
        );
      }
      throw err;
    }

    await this.prisma.setting.upsert({
      where: { key },
      update: { value: parsedValue },
      create: { key, value: parsedValue },
    });

    // Invalidate cache immediately on write
    this.invalidateCache();

    return { key, value: parsedValue };
  }

  invalidateCache() {
    this.cache = null;
    this.cacheExpiry = 0;
  }
}
