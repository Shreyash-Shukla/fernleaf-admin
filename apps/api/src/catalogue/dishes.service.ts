import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import { ERRORS } from '@repo/shared';
import { Temperature } from '@prisma/client';

export interface CreateDishDto {
  sku: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  temperature: Temperature;
  costCents: number;
  stationId?: string | null;
  minOrderQty?: number | null;
  active?: boolean;
  allergenIds?: string[];
  dietaryTagIds?: string[];
}

export interface UpdateDishDto {
  sku?: string;
  name?: string;
  description?: string;
  imageUrl?: string | null;
  temperature?: Temperature;
  costCents?: number;
  stationId?: string | null;
  minOrderQty?: number | null;
  active?: boolean;
  allergenIds?: string[];
  dietaryTagIds?: string[];
}

@Injectable()
export class DishesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapDishRelations(dish: any) {
    if (!dish) return dish;
    return {
      ...dish,
      allergens: dish.allergens?.map((a: any) => a.allergen ?? a) ?? [],
      dietaryTags: dish.dietaryTags?.map((t: any) => t.tag ?? t) ?? [],
    };
  }

  async listDishes(query: {
    page?: number | string;
    limit?: number | string;
    active?: boolean | string;
    stationId?: string;
    q?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.active !== undefined && query.active !== '') {
      where.active = query.active === true || query.active === 'true' || query.active === '1';
    }

    if (query.stationId) {
      where.stationId = query.stationId;
    }

    if (query.q && query.q.trim()) {
      const search = query.q.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.dish.count({ where }),
      this.prisma.dish.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          station: true,
          allergens: {
            include: { allergen: true },
          },
          dietaryTags: {
            include: { tag: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((d) => this.mapDishRelations(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDish(id: string) {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: {
        station: true,
        allergens: {
          include: { allergen: true },
        },
        dietaryTags: {
          include: { tag: true },
        },
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
    });

    if (!dish) {
      throw DomainError.notFound(ERRORS.DISH_NOT_FOUND, `Dish with id "${id}" not found`);
    }

    return {
      ...this.mapDishRelations(dish),
      optionGroups: dish.optionGroups.map((g) => ({
        id: g.id,
        dishId: g.dishId,
        name: g.name,
        required: g.required,
        sortOrder: g.sortOrder,
        usesPortions: g.usesPortions,
        options: g.options.map((go) => ({
          optionId: go.optionId,
          sortOrder: go.sortOrder,
          ...this.mapDishRelations(go.option),
        })),
        portions: g.portions.map((gp) => ({
          portionSizeId: gp.portionSizeId,
          extraCents: gp.extraCents,
          sortOrder: gp.sortOrder,
          portionSize: gp.portionSize,
        })),
      })),
    };
  }

  async createDish(data: CreateDishDto) {
    const sku = data.sku?.trim().toUpperCase();
    const name = data.name?.trim();
    const description = data.description?.trim();

    if (!sku) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'SKU is required', { sku: 'SKU is required' });
    }
    if (!name) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name is required', { name: 'Name is required' });
    }
    if (!description) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Description is required', { description: 'Description is required' });
    }
    if (!data.temperature || !['HOT', 'COLD'].includes(data.temperature)) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Temperature must be HOT or COLD', { temperature: 'Invalid temperature' });
    }
    if (data.costCents === undefined || data.costCents === null || data.costCents < 0) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Cost in cents must be a non-negative integer', { costCents: 'Invalid cost' });
    }

    const existingSku = await this.prisma.dish.findUnique({
      where: { sku },
    });
    if (existingSku) {
      throw DomainError.conflict(ERRORS.CONFLICT, `A dish with SKU "${sku}" already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const dish = await tx.dish.create({
        data: {
          sku,
          name,
          description,
          imageUrl: data.imageUrl ?? null,
          temperature: data.temperature,
          costCents: Math.round(data.costCents),
          stationId: data.stationId ?? null,
          minOrderQty: data.minOrderQty ? Math.max(1, Math.round(data.minOrderQty)) : null,
          active: data.active ?? true,
        },
      });

      if (data.allergenIds && data.allergenIds.length > 0) {
        await tx.dishAllergen.createMany({
          data: data.allergenIds.map((allergenId) => ({
            dishId: dish.id,
            allergenId,
          })),
          skipDuplicates: true,
        });
      }

      if (data.dietaryTagIds && data.dietaryTagIds.length > 0) {
        await tx.dishDietaryTag.createMany({
          data: data.dietaryTagIds.map((tagId) => ({
            dishId: dish.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      const created = await tx.dish.findUnique({
        where: { id: dish.id },
        include: {
          station: true,
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { tag: true } },
        },
      });

      return this.mapDishRelations(created);
    });
  }

  async updateDish(id: string, data: UpdateDishDto) {
    const existing = await this.prisma.dish.findUnique({
      where: { id },
    });
    if (!existing) {
      throw DomainError.notFound(ERRORS.DISH_NOT_FOUND, `Dish with id "${id}" not found`);
    }

    const updateFields: any = {};

    if (data.sku !== undefined) {
      const sku = data.sku.trim().toUpperCase();
      if (!sku) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'SKU cannot be empty');
      }
      if (sku !== existing.sku) {
        const existingSku = await this.prisma.dish.findUnique({ where: { sku } });
        if (existingSku) {
          throw DomainError.conflict(ERRORS.CONFLICT, `A dish with SKU "${sku}" already exists`);
        }
        updateFields.sku = sku;
      }
    }

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name cannot be empty');
      updateFields.name = name;
    }

    if (data.description !== undefined) {
      const description = data.description.trim();
      if (!description) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Description cannot be empty');
      updateFields.description = description;
    }

    if (data.imageUrl !== undefined) {
      updateFields.imageUrl = data.imageUrl;
    }

    if (data.temperature !== undefined) {
      if (!['HOT', 'COLD'].includes(data.temperature)) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Temperature must be HOT or COLD');
      }
      updateFields.temperature = data.temperature;
    }

    if (data.costCents !== undefined) {
      if (data.costCents < 0) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Cost in cents must be >= 0');
      }
      updateFields.costCents = Math.round(data.costCents);
    }

    if (data.stationId !== undefined) {
      updateFields.stationId = data.stationId;
    }

    if (data.minOrderQty !== undefined) {
      updateFields.minOrderQty = data.minOrderQty ? Math.max(1, Math.round(data.minOrderQty)) : null;
    }

    if (data.active !== undefined) {
      updateFields.active = Boolean(data.active);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.dish.update({
        where: { id },
        data: updateFields,
      });

      if (data.allergenIds !== undefined) {
        await tx.dishAllergen.deleteMany({ where: { dishId: id } });
        if (data.allergenIds.length > 0) {
          await tx.dishAllergen.createMany({
            data: data.allergenIds.map((allergenId) => ({
              dishId: id,
              allergenId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (data.dietaryTagIds !== undefined) {
        await tx.dishDietaryTag.deleteMany({ where: { dishId: id } });
        if (data.dietaryTagIds.length > 0) {
          await tx.dishDietaryTag.createMany({
            data: data.dietaryTagIds.map((tagId) => ({
              dishId: id,
              tagId,
            })),
            skipDuplicates: true,
          });
        }
      }

      const updated = await tx.dish.findUnique({
        where: { id },
        include: {
          station: true,
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { tag: true } },
        },
      });

      return this.mapDishRelations(updated);
    });
  }

  async deleteDish(id: string) {
    // Soft delete: dishes are deactivated, never hard-deleted
    return this.updateDish(id, { active: false });
  }
}
