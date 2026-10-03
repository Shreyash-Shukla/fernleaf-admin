import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DishesService } from '../src/catalogue/dishes.service';
import { OptionsService } from '../src/catalogue/options.service';
import { OptionGroupsService } from '../src/catalogue/option-groups.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DomainError } from '../src/common/domain-error';
import { ERRORS } from '@repo/shared';

describe('DishesService', () => {
  let service: DishesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      dish: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      dishAllergen: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      dishDietaryTag: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new DishesService(prisma);
  });

  it('rejects dish creation with invalid or missing required fields', async () => {
    await expect(
      service.createDish({
        sku: '',
        name: 'Dish',
        description: 'Desc',
        temperature: 'HOT',
        costCents: 100,
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      service.createDish({
        sku: 'DISH-1',
        name: 'Dish',
        description: 'Desc',
        temperature: 'WARM' as any,
        costCents: 100,
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      service.createDish({
        sku: 'DISH-1',
        name: 'Dish',
        description: 'Desc',
        temperature: 'HOT',
        costCents: -50,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects duplicate SKU', async () => {
    prisma.dish.findUnique.mockResolvedValue({ id: 'existing-id', sku: 'DISH-1' });
    await expect(
      service.createDish({
        sku: 'DISH-1',
        name: 'Dish',
        description: 'Desc',
        temperature: 'HOT',
        costCents: 100,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('creates dish with allergens and dietary tags in transaction', async () => {
    prisma.dish.findUnique
      .mockResolvedValueOnce(null) // check sku
      .mockResolvedValueOnce({
        id: 'new-id',
        sku: 'DISH-1',
        name: 'Paneer Bowl',
        description: 'Yummy',
        temperature: 'HOT',
        costCents: 450,
        active: true,
        allergens: [{ allergen: { id: 'a1', name: 'Dairy' } }],
        dietaryTags: [{ tag: { id: 't1', name: 'Vegetarian' } }],
      });
    prisma.dish.create.mockResolvedValue({ id: 'new-id' });

    const result = await service.createDish({
      sku: 'DISH-1',
      name: 'Paneer Bowl',
      description: 'Yummy',
      temperature: 'HOT',
      costCents: 450,
      allergenIds: ['a1'],
      dietaryTagIds: ['t1'],
    });

    expect(prisma.dish.create).toHaveBeenCalled();
    expect(prisma.dishAllergen.createMany).toHaveBeenCalledWith({
      data: [{ dishId: 'new-id', allergenId: 'a1' }],
      skipDuplicates: true,
    });
    expect(result.sku).toBe('DISH-1');
    expect(result.allergens).toEqual([{ id: 'a1', name: 'Dairy' }]);
  });

  it('soft-deletes dish by setting active to false', async () => {
    prisma.dish.findUnique
      .mockResolvedValueOnce({ id: 'd1', sku: 'DISH-1', active: true })
      .mockResolvedValueOnce({ id: 'd1', sku: 'DISH-1', active: false, allergens: [], dietaryTags: [] });

    const result = await service.deleteDish('d1');
    expect(prisma.dish.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { active: false },
    });
    expect(result.active).toBe(false);
  });
});

describe('OptionsService', () => {
  let service: OptionsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      option: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      optionAllergen: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      optionDietaryTag: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new OptionsService(prisma);
  });

  it('validates option fields on create', async () => {
    await expect(service.createOption({ name: '', costCents: 50 })).rejects.toThrow(DomainError);
    await expect(service.createOption({ name: 'Tofu', costCents: -10 })).rejects.toThrow(DomainError);
  });

  it('creates option and maps relations', async () => {
    prisma.option.create.mockResolvedValue({ id: 'opt-1' });
    prisma.option.findUnique.mockResolvedValue({
      id: 'opt-1',
      name: 'Tofu',
      costCents: 80,
      active: true,
      allergens: [{ allergen: { id: 'a2', name: 'Soy' } }],
      dietaryTags: [],
    });

    const result = await service.createOption({
      name: 'Tofu',
      costCents: 80,
      allergenIds: ['a2'],
    });

    expect(result.name).toBe('Tofu');
    expect(result.allergens).toEqual([{ id: 'a2', name: 'Soy' }]);
  });
});

describe('OptionGroupsService', () => {
  let service: OptionGroupsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      dish: { findUnique: vi.fn() },
      optionGroup: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      optionGroupOption: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      optionGroupPortion: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new OptionGroupsService(prisma);
  });

  it('rejects creating group for non-existent dish', async () => {
    prisma.dish.findUnique.mockResolvedValue(null);
    await expect(
      service.createGroup('missing-dish', { name: 'Protein', required: true }),
    ).rejects.toThrow(DomainError);
  });

  it('creates group with options and portions when usesPortions is true', async () => {
    prisma.dish.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.optionGroup.create.mockResolvedValue({ id: 'g1' });
    prisma.optionGroup.findUnique.mockResolvedValue({
      id: 'g1',
      dishId: 'd1',
      name: 'Protein',
      required: true,
      sortOrder: 1,
      usesPortions: true,
      options: [{ optionId: 'opt-1', sortOrder: 0, option: { name: 'Paneer', allergens: [], dietaryTags: [] } }],
      portions: [{ portionSizeId: 'ps-1', extraCents: 50, sortOrder: 0, portionSize: { name: 'Large' } }],
    });

    const result = await service.createGroup('d1', {
      name: 'Protein',
      required: true,
      sortOrder: 1,
      usesPortions: true,
      options: [{ optionId: 'opt-1' }],
      portions: [{ portionSizeId: 'ps-1', extraCents: 50 }],
    });

    expect(prisma.optionGroupOption.createMany).toHaveBeenCalled();
    expect(prisma.optionGroupPortion.createMany).toHaveBeenCalled();
    expect(result.name).toBe('Protein');
    expect(result.options[0].name).toBe('Paneer');
    expect(result.portions[0].extraCents).toBe(50);
  });
});
