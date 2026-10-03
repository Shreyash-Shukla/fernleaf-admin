import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import { ERRORS } from '@repo/shared';

export interface CreateOptionDto {
  name: string;
  costCents: number;
  active?: boolean;
  allergenIds?: string[];
  dietaryTagIds?: string[];
}

export interface UpdateOptionDto {
  name?: string;
  costCents?: number;
  active?: boolean;
  allergenIds?: string[];
  dietaryTagIds?: string[];
}

@Injectable()
export class OptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapOptionRelations(option: any) {
    if (!option) return option;
    return {
      ...option,
      allergens: option.allergens?.map((a: any) => a.allergen ?? a) ?? [],
      dietaryTags: option.dietaryTags?.map((t: any) => t.tag ?? t) ?? [],
    };
  }

  async listOptions(query: {
    page?: number | string;
    limit?: number | string;
    active?: boolean | string;
    q?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.active !== undefined && query.active !== '') {
      where.active = query.active === true || query.active === 'true' || query.active === '1';
    }

    if (query.q && query.q.trim()) {
      where.name = { contains: query.q.trim(), mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      this.prisma.option.count({ where }),
      this.prisma.option.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { tag: true } },
        },
      }),
    ]);

    return {
      items: items.map((o) => this.mapOptionRelations(o)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOption(id: string) {
    const option = await this.prisma.option.findUnique({
      where: { id },
      include: {
        allergens: { include: { allergen: true } },
        dietaryTags: { include: { tag: true } },
      },
    });

    if (!option) {
      throw DomainError.notFound(ERRORS.OPTION_NOT_FOUND, `Option with id "${id}" not found`);
    }

    return this.mapOptionRelations(option);
  }

  async createOption(data: CreateOptionDto) {
    const name = data.name?.trim();
    if (!name) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name is required', { name: 'Name is required' });
    }
    if (data.costCents === undefined || data.costCents === null || data.costCents < 0) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Cost in cents must be >= 0', { costCents: 'Invalid cost' });
    }

    return this.prisma.$transaction(async (tx) => {
      const option = await tx.option.create({
        data: {
          name,
          costCents: Math.round(data.costCents),
          active: data.active ?? true,
        },
      });

      if (data.allergenIds && data.allergenIds.length > 0) {
        await tx.optionAllergen.createMany({
          data: data.allergenIds.map((allergenId) => ({
            optionId: option.id,
            allergenId,
          })),
          skipDuplicates: true,
        });
      }

      if (data.dietaryTagIds && data.dietaryTagIds.length > 0) {
        await tx.optionDietaryTag.createMany({
          data: data.dietaryTagIds.map((tagId) => ({
            optionId: option.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      const created = await tx.option.findUnique({
        where: { id: option.id },
        include: {
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { tag: true } },
        },
      });

      return this.mapOptionRelations(created);
    });
  }

  async updateOption(id: string, data: UpdateOptionDto) {
    const existing = await this.prisma.option.findUnique({ where: { id } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.OPTION_NOT_FOUND, `Option with id "${id}" not found`);
    }

    const updateFields: any = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name cannot be empty');
      updateFields.name = name;
    }

    if (data.costCents !== undefined) {
      if (data.costCents < 0) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Cost in cents must be >= 0');
      updateFields.costCents = Math.round(data.costCents);
    }

    if (data.active !== undefined) {
      updateFields.active = Boolean(data.active);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.option.update({
        where: { id },
        data: updateFields,
      });

      if (data.allergenIds !== undefined) {
        await tx.optionAllergen.deleteMany({ where: { optionId: id } });
        if (data.allergenIds.length > 0) {
          await tx.optionAllergen.createMany({
            data: data.allergenIds.map((allergenId) => ({
              optionId: id,
              allergenId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (data.dietaryTagIds !== undefined) {
        await tx.optionDietaryTag.deleteMany({ where: { optionId: id } });
        if (data.dietaryTagIds.length > 0) {
          await tx.optionDietaryTag.createMany({
            data: data.dietaryTagIds.map((tagId) => ({
              optionId: id,
              tagId,
            })),
            skipDuplicates: true,
          });
        }
      }

      const updated = await tx.option.findUnique({
        where: { id },
        include: {
          allergens: { include: { allergen: true } },
          dietaryTags: { include: { tag: true } },
        },
      });

      return this.mapOptionRelations(updated);
    });
  }

  async deleteOption(id: string) {
    // Soft delete: deactivation
    return this.updateOption(id, { active: false });
  }
}
