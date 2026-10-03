import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KitchenHolidaysService } from '../src/kitchen-holidays/kitchen-holidays.service';
import { ReferenceDataService } from '../src/reference-data/reference-data.service';
import { StaffService } from '../src/staff/staff.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DomainError } from '../src/common/domain-error';
import * as bcrypt from 'bcryptjs';

describe('KitchenHolidaysService', () => {
  let service: KitchenHolidaysService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      kitchenHoliday: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as PrismaService;
    service = new KitchenHolidaysService(prisma);
  });

  it('validates date format on create', async () => {
    await expect(service.createOrUpdate('not-a-date', 'New Year')).rejects.toThrow(DomainError);
    await expect(service.createOrUpdate('2026/01/01', 'New Year')).rejects.toThrow(DomainError);
  });

  it('rejects empty name on create', async () => {
    await expect(service.createOrUpdate('2026-01-01', '   ')).rejects.toThrow(DomainError);
  });

  it('creates or updates holiday with valid date string', async () => {
    vi.spyOn(prisma.kitchenHoliday, 'upsert').mockResolvedValue({
      date: new Date('2026-12-25T00:00:00Z'),
      name: 'Christmas',
    } as any);

    const result = await service.createOrUpdate('2026-12-25', 'Christmas');
    expect(result).toEqual({
      date: '2026-12-25',
      name: 'Christmas',
    });
  });

  it('lists holidays in YYYY-MM-DD format', async () => {
    vi.spyOn(prisma.kitchenHoliday, 'findMany').mockResolvedValue([
      { date: new Date('2026-01-01T00:00:00Z'), name: 'New Year' },
      { date: new Date('2026-12-25T00:00:00Z'), name: 'Christmas' },
    ] as any);

    const list = await service.listAll();
    expect(list).toEqual([
      { date: '2026-01-01', name: 'New Year' },
      { date: '2026-12-25', name: 'Christmas' },
    ]);
  });

  it('deletes holiday by date', async () => {
    vi.spyOn(prisma.kitchenHoliday, 'delete').mockResolvedValue({} as any);

    const result = await service.delete('2026-01-01');
    expect(result).toEqual({ ok: true });
  });

  it('throws 404 when deleting non-existent holiday', async () => {
    vi.spyOn(prisma.kitchenHoliday, 'delete').mockRejectedValue({ code: 'P2025' });

    await expect(service.delete('2026-01-01')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('ReferenceDataService', () => {
  let service: ReferenceDataService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      allergen: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      dietaryTag: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      kitchenStation: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      portionSize: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    service = new ReferenceDataService(prisma);
  });

  it('filters allergens by active', async () => {
    const findManySpy = vi.spyOn(prisma.allergen, 'findMany').mockResolvedValue([]);

    await service.listAllergens(true);
    expect(findManySpy).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    await service.listAllergens(false);
    expect(findManySpy).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { name: 'asc' },
    });
  });

  it('creates and updates allergen', async () => {
    vi.spyOn(prisma.allergen, 'create').mockResolvedValue({
      id: 'all-1',
      name: 'Peanuts',
      active: true,
    } as any);

    const created = await service.createAllergen('Peanuts');
    expect(created.name).toBe('Peanuts');

    vi.spyOn(prisma.allergen, 'update').mockResolvedValue({
      id: 'all-1',
      name: 'Peanuts',
      active: false,
    } as any);

    const updated = await service.updateAllergen('all-1', { active: false });
    expect(updated.active).toBe(false);
  });

  it('creates station with auto sortOrder', async () => {
    vi.spyOn(prisma.kitchenStation, 'findFirst').mockResolvedValue({
      sortOrder: 2,
    } as any);
    vi.spyOn(prisma.kitchenStation, 'create').mockImplementation(
      async ({ data }: any) => ({ id: 'st-1', ...data }) as any,
    );

    const station = await service.createStation('Bakery');
    expect(station.sortOrder).toBe(3);
  });
});

describe('StaffService', () => {
  let service: StaffService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      role: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    service = new StaffService(prisma);
  });

  it('creates staff user with hashed password', async () => {
    vi.spyOn(prisma.role, 'findUnique').mockResolvedValue({
      id: 'role-kitchen',
      key: 'kitchen',
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null); // No duplicate
    const createSpy = vi.spyOn(prisma.user, 'create').mockResolvedValue({
      id: 'user-new',
      email: 'cook@test.com',
      name: 'Chef Cook',
      active: true,
      role: { key: 'kitchen' },
    } as any);

    const result = await service.createStaff({
      email: 'Cook@Test.com',
      name: 'Chef Cook',
      password: 'password123',
      roleKey: 'kitchen',
    });

    expect(result.email).toBe('cook@test.com');
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'cook@test.com',
          name: 'Chef Cook',
          roleId: 'role-kitchen',
        }),
      }),
    );
    // Verify password was hashed
    const callData = createSpy.mock.calls[0][0].data;
    expect(callData.passwordHash).not.toBe('password123');
    const matches = await bcrypt.compare('password123', callData.passwordHash);
    expect(matches).toBe(true);
  });

  it('rejects duplicate email when creating staff', async () => {
    vi.spyOn(prisma.role, 'findUnique').mockResolvedValue({ id: 'role-1' } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'existing' } as any);

    await expect(
      service.createStaff({
        email: 'admin@test.com',
        name: 'Admin',
        password: 'password123',
        roleId: 'role-1',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects short passwords', async () => {
    await expect(
      service.createStaff({
        email: 'test@test.com',
        name: 'Test',
        password: '123',
        roleKey: 'kitchen',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
