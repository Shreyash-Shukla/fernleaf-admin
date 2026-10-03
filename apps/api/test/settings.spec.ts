import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService, SETTINGS_DEFAULTS } from '../src/settings/settings.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DomainError } from '../src/common/domain-error';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      setting: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
      },
    } as unknown as PrismaService;
    service = new SettingsService(prisma);
  });

  it('returns default settings when database is empty', async () => {
    const all = await service.getAll();
    expect(all).toEqual(SETTINGS_DEFAULTS);
    expect(all.timezone).toBe('Asia/Kolkata');
    expect(all.cutoffTime).toBe('16:00');
    expect(all.kitchenWorkingDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('merges database settings over defaults', async () => {
    vi.spyOn(prisma.setting, 'findMany').mockResolvedValue([
      { key: 'timezone', value: 'America/New_York' },
      { key: 'cutoffDays', value: 3 },
    ] as any);

    const all = await service.getAll();
    expect(all.timezone).toBe('America/New_York');
    expect(all.cutoffDays).toBe(3);
    // Other values stay default
    expect(all.cutoffTime).toBe('16:00');
  });

  it('validates and accepts valid timezone', async () => {
    vi.spyOn(prisma.setting, 'upsert').mockResolvedValue({
      key: 'timezone',
      value: 'Europe/London',
    } as any);

    const result = await service.set('timezone', 'Europe/London');
    expect(result).toEqual({ key: 'timezone', value: 'Europe/London' });
    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: 'timezone' },
      update: { value: 'Europe/London' },
      create: { key: 'timezone', value: 'Europe/London' },
    });
  });

  it('rejects invalid timezone with INVALID_SETTING_VALUE', async () => {
    await expect(service.set('timezone', 'Invalid/Zone_Name')).rejects.toThrow(
      DomainError,
    );
    await expect(service.set('timezone', 'Invalid/Zone_Name')).rejects.toMatchObject({
      code: 'INVALID_SETTING_VALUE',
    });
  });

  it('validates kitchenWorkingDays array', async () => {
    vi.spyOn(prisma.setting, 'upsert').mockResolvedValue({} as any);

    await expect(service.set('kitchenWorkingDays', [1, 2, 3])).resolves.toEqual({
      key: 'kitchenWorkingDays',
      value: [1, 2, 3],
    });

    // Empty array rejected
    await expect(service.set('kitchenWorkingDays', [])).rejects.toThrow(DomainError);

    // Out of range rejected
    await expect(service.set('kitchenWorkingDays', [0, 8])).rejects.toThrow(DomainError);

    // Duplicates rejected
    await expect(service.set('kitchenWorkingDays', [1, 1, 2])).rejects.toThrow(DomainError);
  });

  it('validates cutoffTime format', async () => {
    vi.spyOn(prisma.setting, 'upsert').mockResolvedValue({} as any);

    await expect(service.set('cutoffTime', '17:30')).resolves.toEqual({
      key: 'cutoffTime',
      value: '17:30',
    });

    await expect(service.set('cutoffTime', '25:00')).rejects.toThrow(DomainError);
    await expect(service.set('cutoffTime', '9:00')).rejects.toThrow(DomainError);
    await expect(service.set('cutoffTime', 'invalid')).rejects.toThrow(DomainError);
  });

  it('validates cutoffDays', async () => {
    vi.spyOn(prisma.setting, 'upsert').mockResolvedValue({} as any);

    await expect(service.set('cutoffDays', 5)).resolves.toEqual({
      key: 'cutoffDays',
      value: 5,
    });

    await expect(service.set('cutoffDays', -1)).rejects.toThrow(DomainError);
    await expect(service.set('cutoffDays', 15)).rejects.toThrow(DomainError);
  });

  it('validates cutoffHoldDates with valid YYYY-MM-DD strings', async () => {
    vi.spyOn(prisma.setting, 'upsert').mockResolvedValue({} as any);

    await expect(
      service.set('cutoffHoldDates', ['2026-10-10', '2026-10-15']),
    ).resolves.toEqual({
      key: 'cutoffHoldDates',
      value: ['2026-10-10', '2026-10-15'],
    });

    await expect(
      service.set('cutoffHoldDates', ['not-a-date']),
    ).rejects.toThrow(DomainError);
  });

  it('rejects unknown setting key with SETTING_NOT_FOUND', async () => {
    await expect(service.set('unknownKey', 123)).rejects.toThrow(DomainError);
    await expect(service.set('unknownKey', 123)).rejects.toMatchObject({
      code: 'SETTING_NOT_FOUND',
    });
  });

  it('caches settings and write invalidates cache', async () => {
    const findManySpy = vi.spyOn(prisma.setting, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.setting, 'upsert').mockResolvedValue({} as any);

    // First call reads from DB
    await service.getAll();
    expect(findManySpy).toHaveBeenCalledTimes(1);

    // Second call hits cache
    await service.getAll();
    expect(findManySpy).toHaveBeenCalledTimes(1);

    // Write invalidates cache
    await service.set('cutoffDays', 3);

    // Next call reads from DB again
    await service.getAll();
    expect(findManySpy).toHaveBeenCalledTimes(2);
  });
});
