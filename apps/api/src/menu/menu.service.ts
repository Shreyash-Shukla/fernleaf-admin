import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import {
  ERRORS,
  createPricingContext,
  resolveDish,
  resolveOption,
  effectiveTierId,
} from '@repo/shared';

export interface CreateCategoryDto {
  name: string;
  slug: string;
  sortOrder?: number;
  active?: boolean;
  isSecret?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  sortOrder?: number;
  active?: boolean;
  isSecret?: boolean;
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Categories ──────────────────────────────────────────

  async listCategories(options?: { activeOnly?: boolean; includeSecret?: boolean }) {
    const where: any = {};
    if (options?.activeOnly) {
      where.active = true;
    }
    if (!options?.includeSecret) {
      where.isSecret = false;
    }

    return this.prisma.menuCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  async getCategory(idOrSlug: string) {
    const category = await this.prisma.menuCategory.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            dish: {
              include: {
                station: true,
                allergens: { include: { allergen: true } },
                dietaryTags: { include: { tag: true } },
              },
            },
          },
        },
      },
    });

    if (!category) {
      throw DomainError.notFound(
        ERRORS.MENU_CATEGORY_NOT_FOUND,
        `Menu category "${idOrSlug}" not found`,
      );
    }

    return {
      ...category,
      items: category.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        dishId: item.dishId,
        sortOrder: item.sortOrder,
        active: item.active,
        dish: {
          ...item.dish,
          allergens: item.dish.allergens.map((a) => a.allergen),
          dietaryTags: item.dish.dietaryTags.map((t) => t.tag),
        },
      })),
    };
  }

  async createCategory(data: CreateCategoryDto) {
    const name = data.name?.trim();
    const slug = data.slug?.trim().toLowerCase();

    if (!name) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Category name is required', { name: 'Name is required' });
    }
    if (!slug) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Slug is required', { slug: 'Slug is required' });
    }

    const existingSlug = await this.prisma.menuCategory.findUnique({ where: { slug } });
    if (existingSlug) {
      throw DomainError.conflict(ERRORS.CONFLICT, `Category slug "${slug}" already exists`);
    }

    return this.prisma.menuCategory.create({
      data: {
        name,
        slug,
        sortOrder: data.sortOrder ?? 0,
        active: data.active ?? true,
        isSecret: Boolean(data.isSecret),
      },
    });
  }

  async updateCategory(id: string, data: UpdateCategoryDto) {
    const existing = await this.prisma.menuCategory.findUnique({ where: { id } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.MENU_CATEGORY_NOT_FOUND, `Category with id "${id}" not found`);
    }

    const updateFields: any = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name cannot be empty');
      updateFields.name = name;
    }
    if (data.slug !== undefined) {
      const slug = data.slug.trim().toLowerCase();
      if (!slug) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Slug cannot be empty');
      if (slug !== existing.slug) {
        const dup = await this.prisma.menuCategory.findUnique({ where: { slug } });
        if (dup) throw DomainError.conflict(ERRORS.CONFLICT, `Category slug "${slug}" already exists`);
        updateFields.slug = slug;
      }
    }
    if (data.sortOrder !== undefined) updateFields.sortOrder = Number(data.sortOrder);
    if (data.active !== undefined) updateFields.active = Boolean(data.active);
    if (data.isSecret !== undefined) updateFields.isSecret = Boolean(data.isSecret);

    return this.prisma.menuCategory.update({
      where: { id },
      data: updateFields,
    });
  }

  async deleteCategory(id: string) {
    // Soft delete: deactivate
    return this.updateCategory(id, { active: false });
  }

  // ─── Menu Items ──────────────────────────────────────────

  async listCategoryItems(categoryId: string) {
    const category = await this.prisma.menuCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw DomainError.notFound(ERRORS.MENU_CATEGORY_NOT_FOUND, `Category "${categoryId}" not found`);
    }

    const items = await this.prisma.menuItem.findMany({
      where: { categoryId },
      orderBy: { sortOrder: 'asc' },
      include: {
        dish: {
          include: {
            station: true,
            allergens: { include: { allergen: true } },
            dietaryTags: { include: { tag: true } },
          },
        },
      },
    });

    return items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      dishId: item.dishId,
      sortOrder: item.sortOrder,
      active: item.active,
      dish: {
        ...item.dish,
        allergens: item.dish.allergens.map((a) => a.allergen),
        dietaryTags: item.dish.dietaryTags.map((t) => t.tag),
      },
    }));
  }

  async addMenuItem(
    categoryId: string,
    data: { dishId: string; sortOrder?: number; active?: boolean },
  ) {
    const category = await this.prisma.menuCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw DomainError.notFound(ERRORS.MENU_CATEGORY_NOT_FOUND, `Category "${categoryId}" not found`);
    }

    const dish = await this.prisma.dish.findUnique({ where: { id: data.dishId } });
    if (!dish) {
      throw DomainError.notFound(ERRORS.DISH_NOT_FOUND, `Dish "${data.dishId}" not found`);
    }

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxItem = await this.prisma.menuItem.findFirst({
        where: { categoryId },
        orderBy: { sortOrder: 'desc' },
      });
      sortOrder = maxItem ? maxItem.sortOrder + 1 : 0;
    }

    return this.prisma.menuItem.upsert({
      where: {
        categoryId_dishId: { categoryId, dishId: data.dishId },
      },
      create: {
        categoryId,
        dishId: data.dishId,
        sortOrder,
        active: data.active ?? true,
      },
      update: {
        sortOrder,
        active: data.active ?? true,
      },
      include: {
        dish: {
          include: {
            station: true,
            allergens: { include: { allergen: true } },
            dietaryTags: { include: { tag: true } },
          },
        },
      },
    });
  }

  async updateMenuItem(itemId: string, data: { sortOrder?: number; active?: boolean }) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.MENU_ITEM_NOT_FOUND, `Menu item "${itemId}" not found`);
    }

    const updateFields: any = {};
    if (data.sortOrder !== undefined) updateFields.sortOrder = Number(data.sortOrder);
    if (data.active !== undefined) updateFields.active = Boolean(data.active);

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: updateFields,
      include: {
        dish: {
          include: {
            station: true,
            allergens: { include: { allergen: true } },
            dietaryTags: { include: { tag: true } },
          },
        },
      },
    });
  }

  async removeMenuItem(itemId: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.MENU_ITEM_NOT_FOUND, `Menu item "${itemId}" not found`);
    }

    await this.prisma.menuItem.delete({ where: { id: itemId } });
    return { ok: true, id: itemId };
  }

  // ─── Company Hiding ──────────────────────────────────────

  async getHiddenCategories(companyId: string) {
    return this.prisma.companyHiddenCategory.findMany({
      where: { companyId },
      include: { category: true },
    });
  }

  async addHiddenCategory(companyId: string, categoryId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, `Company "${companyId}" not found`);

    const category = await this.prisma.menuCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw DomainError.notFound(ERRORS.MENU_CATEGORY_NOT_FOUND, `Category "${categoryId}" not found`);

    return this.prisma.companyHiddenCategory.upsert({
      where: { companyId_categoryId: { companyId, categoryId } },
      create: { companyId, categoryId },
      update: {},
    });
  }

  async removeHiddenCategory(companyId: string, categoryId: string) {
    await this.prisma.companyHiddenCategory.deleteMany({
      where: { companyId, categoryId },
    });
    return { ok: true, companyId, categoryId };
  }

  async getHiddenItems(companyId: string) {
    return this.prisma.companyHiddenItem.findMany({
      where: { companyId },
      include: {
        menuItem: {
          include: { dish: true, category: true },
        },
      },
    });
  }

  async addHiddenItem(companyId: string, menuItemId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, `Company "${companyId}" not found`);

    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) throw DomainError.notFound(ERRORS.MENU_ITEM_NOT_FOUND, `MenuItem "${menuItemId}" not found`);

    return this.prisma.companyHiddenItem.upsert({
      where: { companyId_menuItemId: { companyId, menuItemId } },
      create: { companyId, menuItemId },
      update: {},
    });
  }

  async removeHiddenItem(companyId: string, menuItemId: string) {
    await this.prisma.companyHiddenItem.deleteMany({
      where: { companyId, menuItemId },
    });
    return { ok: true, companyId, menuItemId };
  }

  // ─── Menu Resolution Service ─────────────────────────────

  async resolveForEmployee(employeeId: string, slug?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: true,
      },
    });

    if (!employee || !employee.active) {
      throw DomainError.notFound(ERRORS.EMPLOYEE_NOT_FOUND, `Employee "${employeeId}" not found or inactive`);
    }

    const company = employee.company;
    if (!company || !company.active) {
      throw DomainError.badRequest(ERRORS.COMPANY_NOT_FOUND, `Company for employee "${employeeId}" not found or inactive`);
    }

    return this.resolveMenuInternal({
      companyId: company.id,
      companyTierId: company.tierId,
      employeeInfo: {
        id: employee.id,
        name: employee.name,
        companyId: company.id,
        companyName: company.name,
      },
      slug,
    });
  }

  async resolveForCompany(companyId: string, slug?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company || !company.active) {
      throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, `Company "${companyId}" not found or inactive`);
    }

    return this.resolveMenuInternal({
      companyId: company.id,
      companyTierId: company.tierId,
      slug,
    });
  }

  async resolveDefault(slug?: string) {
    const defaultTier = await this.prisma.priceTier.findFirst({
      where: { isDefault: true, active: true },
    });
    if (!defaultTier) {
      throw DomainError.badRequest(ERRORS.TIER_NOT_FOUND, 'No active default price tier found');
    }

    return this.resolveMenuInternal({
      companyTierId: defaultTier.id,
      slug,
    });
  }

  private async resolveMenuInternal(options: {
    companyId?: string;
    companyTierId?: string | null;
    employeeInfo?: { id: string; name: string; companyId: string; companyName: string };
    slug?: string;
  }) {
    // 1. Determine effective tier
    const defaultTier = await this.prisma.priceTier.findFirst({
      where: { isDefault: true, active: true },
    });
    const defaultTierId = defaultTier?.id || '';
    const tierId = effectiveTierId(options.companyTierId, defaultTierId);

    const activeTier = await this.prisma.priceTier.findUnique({ where: { id: tierId } });
    if (!activeTier || !activeTier.active) {
      throw DomainError.badRequest(ERRORS.TIER_NOT_FOUND, `Effective price tier "${tierId}" not found or inactive`);
    }

    // 2. Load company hidden categories & items
    let hiddenCategoryIds = new Set<string>();
    let hiddenMenuItemIds = new Set<string>();

    if (options.companyId) {
      const [hiddenCats, hiddenItems] = await Promise.all([
        this.prisma.companyHiddenCategory.findMany({ where: { companyId: options.companyId } }),
        this.prisma.companyHiddenItem.findMany({ where: { companyId: options.companyId } }),
      ]);
      hiddenCategoryIds = new Set(hiddenCats.map((c) => c.categoryId));
      hiddenMenuItemIds = new Set(hiddenItems.map((i) => i.menuItemId));
    }

    // 3. Load categories
    const categoryWhere: any = { active: true };
    if (options.slug) {
      categoryWhere.slug = options.slug;
    } else {
      categoryWhere.isSecret = false;
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: categoryWhere,
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            dish: {
              include: {
                station: true,
                allergens: { include: { allergen: true } },
                dietaryTags: { include: { tag: true } },
                optionGroups: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    options: {
                      orderBy: { sortOrder: 'asc' },
                      include: {
                        option: {
                          include: {
                            allergens: { include: { allergen: true } },
                            dietaryTags: { include: { tag: true } },
                          },
                        },
                      },
                    },
                    portions: {
                      orderBy: { sortOrder: 'asc' },
                      include: { portionSize: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 4. Load pricing context
    const [allTiers, dishOverrides, optionOverrides] = await Promise.all([
      this.prisma.priceTier.findMany({ where: { active: true } }),
      this.prisma.dishTierPrice.findMany(),
      this.prisma.optionTierPrice.findMany(),
    ]);

    const ctx = createPricingContext(
      allTiers.map((t) => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
        derivation: t.derivation as any,
        baseTierId: t.baseTierId,
        factorBps: t.factorBps,
      })),
      dishOverrides.map((d) => ({ dishId: d.dishId, tierId: d.tierId, priceCents: d.priceCents })),
      optionOverrides.map((o) => ({ optionId: o.optionId, tierId: o.tierId, priceCents: o.priceCents })),
    );

    // 5. Filter and resolve each category and its dishes
    const resolvedCategories: any[] = [];

    for (const cat of categories) {
      if (hiddenCategoryIds.has(cat.id)) {
        continue;
      }

      const resolvedItems: any[] = [];

      for (const item of cat.items) {
        if (hiddenMenuItemIds.has(item.id)) {
          continue;
        }

        const dish = item.dish;
        if (!dish || !dish.active) {
          continue;
        }

        // Resolve dish price
        const dishPriceCents = resolveDish({ id: dish.id, costCents: dish.costCents }, tierId, ctx);
        // Trap 3 & Spec 4.3.5: Missing price ≠ $0. No price on tier -> dish not orderable -> hide!
        if (dishPriceCents === null || dishPriceCents <= 0) {
          continue;
        }

        // Resolve option groups
        let dishOrderable = true;
        const resolvedOptionGroups: any[] = [];

        for (const group of dish.optionGroups) {
          const availableOptions: any[] = [];

          for (const go of group.options) {
            if (!go.option || !go.option.active) continue;

            const optPriceCents = resolveOption(
              { id: go.option.id, costCents: go.option.costCents },
              tierId,
              ctx,
            );

            // Option must have a valid non-null price (>= 0 is legitimate surcharge)
            if (optPriceCents !== null && optPriceCents >= 0) {
              availableOptions.push({
                id: go.option.id,
                name: go.option.name,
                priceCents: optPriceCents,
                sortOrder: go.sortOrder,
                allergens: go.option.allergens.map((a: any) => a.allergen),
                dietaryTags: go.option.dietaryTags.map((t: any) => t.tag),
              });
            }
          }

          // Trap A4: Required group with 0 available options -> dish hidden!
          if (group.required && availableOptions.length === 0) {
            dishOrderable = false;
            break;
          }

          const portions = group.usesPortions
            ? group.portions
                .filter((p: any) => p.portionSize && p.portionSize.active)
                .map((p: any) => ({
                  portionSizeId: p.portionSizeId,
                  name: p.portionSize.name,
                  extraCents: p.extraCents,
                  sortOrder: p.sortOrder,
                }))
            : [];

          resolvedOptionGroups.push({
            id: group.id,
            name: group.name,
            required: group.required,
            sortOrder: group.sortOrder,
            usesPortions: group.usesPortions,
            options: availableOptions,
            portions,
          });
        }

        if (!dishOrderable) {
          continue;
        }

        resolvedItems.push({
          id: item.id,
          sortOrder: item.sortOrder,
          dish: {
            id: dish.id,
            sku: dish.sku,
            name: dish.name,
            description: dish.description,
            imageUrl: dish.imageUrl,
            temperature: dish.temperature,
            costCents: dish.costCents,
            minOrderQty: dish.minOrderQty,
            priceCents: dishPriceCents,
            station: dish.station ? { id: dish.station.id, name: dish.station.name } : null,
            allergens: dish.allergens.map((a: any) => a.allergen),
            dietaryTags: dish.dietaryTags.map((t: any) => t.tag),
          },
          optionGroups: resolvedOptionGroups,
        });
      }

      resolvedCategories.push({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
        isSecret: cat.isSecret,
        items: resolvedItems,
      });
    }

    return {
      employee: options.employeeInfo ?? null,
      tier: {
        id: activeTier.id,
        name: activeTier.name,
        isDefault: activeTier.isDefault,
      },
      categories: resolvedCategories,
    };
  }
}
