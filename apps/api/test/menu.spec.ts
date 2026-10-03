import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MenuService } from '../src/menu/menu.service';
import { DomainError } from '../src/common/domain-error';
import { ERRORS } from '@repo/shared';

describe('MenuService', () => {
  let service: MenuService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      menuCategory: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      menuItem: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      dish: {
        findUnique: vi.fn(),
      },
      employee: {
        findUnique: vi.fn(),
      },
      company: {
        findUnique: vi.fn(),
      },
      companyHiddenCategory: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      companyHiddenItem: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      priceTier: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      dishTierPrice: {
        findMany: vi.fn(),
      },
      optionTierPrice: {
        findMany: vi.fn(),
      },
    };
    service = new MenuService(prisma);
  });

  it('rejects duplicate category slug', async () => {
    prisma.menuCategory.findUnique.mockResolvedValue({ id: 'c1', slug: 'bowls' });
    await expect(
      service.createCategory({ name: 'Bowls', slug: 'bowls' }),
    ).rejects.toThrow(DomainError);
  });

  it('adds menu item and calculates sortOrder', async () => {
    prisma.menuCategory.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.dish.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.menuItem.findFirst.mockResolvedValue({ sortOrder: 3 });
    prisma.menuItem.upsert.mockResolvedValue({
      id: 'mi-1',
      categoryId: 'c1',
      dishId: 'd1',
      sortOrder: 4,
      dish: { allergens: [], dietaryTags: [] },
    });

    const item = await service.addMenuItem('c1', { dishId: 'd1' });
    expect(prisma.menuItem.upsert).toHaveBeenCalledWith({
      where: { categoryId_dishId: { categoryId: 'c1', dishId: 'd1' } },
      create: { categoryId: 'c1', dishId: 'd1', sortOrder: 4, active: true },
      update: { sortOrder: 4, active: true },
      include: expect.any(Object),
    });
  });

  describe('resolveForEmployee', () => {
    const mockTier = {
      id: 'tier-standard',
      name: 'Standard',
      isDefault: true,
      derivation: 'NONE',
      factorBps: null,
      baseTierId: null,
      active: true,
    };

    const mockEmployee = {
      id: 'emp-1',
      name: 'Alice',
      active: true,
      company: {
        id: 'comp-1',
        name: 'Acme Corp',
        tierId: 'tier-standard',
        active: true,
      },
    };

    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.priceTier.findFirst.mockResolvedValue(mockTier);
      prisma.priceTier.findUnique.mockResolvedValue(mockTier);
      prisma.priceTier.findMany.mockResolvedValue([mockTier]);
      prisma.companyHiddenCategory.findMany.mockResolvedValue([]);
      prisma.companyHiddenItem.findMany.mockResolvedValue([]);
      prisma.optionTierPrice.findMany.mockResolvedValue([]);
    });

    it('Trap 3: hides dishes with no price on employee tier', async () => {
      // Category with 2 dishes: d1 has price 800, d2 has no price
      prisma.menuCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Lunch',
          slug: 'lunch',
          sortOrder: 1,
          isSecret: false,
          active: true,
          items: [
            {
              id: 'mi-1',
              sortOrder: 1,
              active: true,
              dish: {
                id: 'd1',
                sku: 'D1',
                name: 'Priced Dish',
                costCents: 400,
                active: true,
                allergens: [],
                dietaryTags: [],
                optionGroups: [],
              },
            },
            {
              id: 'mi-2',
              sortOrder: 2,
              active: true,
              dish: {
                id: 'd2',
                sku: 'D2',
                name: 'Unpriced Dish',
                costCents: 400,
                active: true,
                allergens: [],
                dietaryTags: [],
                optionGroups: [],
              },
            },
          ],
        },
      ]);

      // Only d1 has override
      prisma.dishTierPrice.findMany.mockResolvedValue([
        { dishId: 'd1', tierId: 'tier-standard', priceCents: 800 },
      ]);

      const resolved = await service.resolveForEmployee('emp-1');
      expect(resolved.categories).toHaveLength(1);
      const items = resolved.categories[0].items;
      expect(items).toHaveLength(1);
      expect(items[0].dish.id).toBe('d1');
      expect(items[0].dish.priceCents).toBe(800);
    });

    it('Trap A2: secret category is reachable by slug but excluded from listing', async () => {
      // 1. Listing without slug: query where active=true, isSecret=false
      prisma.menuCategory.findMany.mockResolvedValue([
        {
          id: 'cat-public',
          name: 'Public',
          slug: 'public',
          sortOrder: 1,
          isSecret: false,
          active: true,
          items: [],
        },
      ]);
      prisma.dishTierPrice.findMany.mockResolvedValue([]);

      const listing = await service.resolveForEmployee('emp-1');
      expect(prisma.menuCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSecret: false }),
        }),
      );
      expect(listing.categories[0].slug).toBe('public');

      // 2. Querying by slug: can find secret category
      prisma.menuCategory.findMany.mockResolvedValue([
        {
          id: 'cat-secret',
          name: 'Secret VIP',
          slug: 'secret-vip',
          sortOrder: 1,
          isSecret: true,
          active: true,
          items: [],
        },
      ]);

      const secretRes = await service.resolveForEmployee('emp-1', 'secret-vip');
      expect(prisma.menuCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ slug: 'secret-vip' }),
        }),
      );
      expect(secretRes.categories[0].slug).toBe('secret-vip');
    });

    it('Trap A4 & A5: dish is hidden if required option group has 0 options with prices; $0 options are valid', async () => {
      // Dish with required group where options are opt-paid (has price $0) and opt-unpriced (no price)
      prisma.dishTierPrice.findMany.mockResolvedValue([
        { dishId: 'd1', tierId: 'tier-standard', priceCents: 1000 },
      ]);
      prisma.optionTierPrice.findMany.mockResolvedValue([
        { optionId: 'opt-free', tierId: 'tier-standard', priceCents: 0 }, // $0 option surcharge
      ]);

      prisma.menuCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Lunch',
          slug: 'lunch',
          sortOrder: 1,
          isSecret: false,
          active: true,
          items: [
            {
              id: 'mi-1',
              sortOrder: 1,
              active: true,
              dish: {
                id: 'd1',
                sku: 'D1',
                name: 'Dish With Valid Group',
                costCents: 400,
                active: true,
                allergens: [],
                dietaryTags: [],
                optionGroups: [
                  {
                    id: 'g1',
                    name: 'Sauce',
                    required: true,
                    usesPortions: false,
                    sortOrder: 1,
                    options: [
                      {
                        sortOrder: 1,
                        option: {
                          id: 'opt-free',
                          name: 'Free Sauce',
                          costCents: 0,
                          active: true,
                          allergens: [],
                          dietaryTags: [],
                        },
                      },
                    ],
                    portions: [],
                  },
                ],
              },
            },
            {
              id: 'mi-2',
              sortOrder: 2,
              active: true,
              dish: {
                id: 'd2',
                sku: 'D2',
                name: 'Dish With Empty Required Group',
                costCents: 400,
                active: true,
                allergens: [],
                dietaryTags: [],
                optionGroups: [
                  {
                    id: 'g2',
                    name: 'Base',
                    required: true,
                    usesPortions: false,
                    sortOrder: 1,
                    options: [
                      {
                        sortOrder: 1,
                        option: {
                          id: 'opt-unpriced',
                          name: 'Unpriced Rice',
                          costCents: 50,
                          active: true,
                          allergens: [],
                          dietaryTags: [],
                        },
                      },
                    ],
                    portions: [],
                  },
                ],
              },
            },
          ],
        },
      ]);

      // Give d2 a price as well, so only the group check fails it
      prisma.dishTierPrice.findMany.mockResolvedValue([
        { dishId: 'd1', tierId: 'tier-standard', priceCents: 1000 },
        { dishId: 'd2', tierId: 'tier-standard', priceCents: 1200 },
      ]);

      const resolved = await service.resolveForEmployee('emp-1');
      const items = resolved.categories[0].items;

      // d1 should be present, d2 should be hidden because its required group has 0 priced options
      expect(items).toHaveLength(1);
      expect(items[0].dish.id).toBe('d1');
      expect(items[0].optionGroups[0].options[0].priceCents).toBe(0); // $0 option is valid
    });

    it('excludes company hidden categories and items', async () => {
      prisma.companyHiddenCategory.findMany.mockResolvedValue([{ categoryId: 'cat-hidden' }]);
      prisma.companyHiddenItem.findMany.mockResolvedValue([{ menuItemId: 'mi-hidden' }]);

      prisma.dishTierPrice.findMany.mockResolvedValue([
        { dishId: 'd1', tierId: 'tier-standard', priceCents: 900 },
      ]);

      prisma.menuCategory.findMany.mockResolvedValue([
        {
          id: 'cat-hidden',
          name: 'Hidden Category',
          slug: 'hidden',
          sortOrder: 1,
          isSecret: false,
          active: true,
          items: [],
        },
        {
          id: 'cat-visible',
          name: 'Visible Category',
          slug: 'visible',
          sortOrder: 2,
          isSecret: false,
          active: true,
          items: [
            {
              id: 'mi-hidden',
              sortOrder: 1,
              active: true,
              dish: { id: 'd-hidden', sku: 'DH', name: 'Hidden Dish', costCents: 100, active: true, allergens: [], dietaryTags: [], optionGroups: [] },
            },
            {
              id: 'mi-visible',
              sortOrder: 2,
              active: true,
              dish: { id: 'd1', sku: 'D1', name: 'Visible Dish', costCents: 100, active: true, allergens: [], dietaryTags: [], optionGroups: [] },
            },
          ],
        },
      ]);

      const resolved = await service.resolveForEmployee('emp-1');
      expect(resolved.categories).toHaveLength(1);
      expect(resolved.categories[0].id).toBe('cat-visible');
      expect(resolved.categories[0].items).toHaveLength(1);
      expect(resolved.categories[0].items[0].id).toBe('mi-visible');
    });
  });
});
