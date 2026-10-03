import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import { ERRORS } from '@repo/shared';

export interface GroupOptionInput {
  optionId: string;
  sortOrder?: number;
}

export interface GroupPortionInput {
  portionSizeId: string;
  extraCents: number;
  sortOrder?: number;
}

export interface CreateOptionGroupDto {
  name: string;
  required: boolean;
  sortOrder?: number;
  usesPortions?: boolean;
  options?: GroupOptionInput[];
  portions?: GroupPortionInput[];
}

export interface UpdateOptionGroupDto {
  name?: string;
  required?: boolean;
  sortOrder?: number;
  usesPortions?: boolean;
  options?: GroupOptionInput[];
  portions?: GroupPortionInput[];
}

@Injectable()
export class OptionGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapGroupOutput(group: any) {
    if (!group) return group;
    return {
      id: group.id,
      dishId: group.dishId,
      name: group.name,
      required: group.required,
      sortOrder: group.sortOrder,
      usesPortions: group.usesPortions,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      options: group.options?.map((go: any) => ({
        optionId: go.optionId,
        sortOrder: go.sortOrder,
        ...(go.option
          ? {
              name: go.option.name,
              costCents: go.option.costCents,
              active: go.option.active,
              allergens: go.option.allergens?.map((a: any) => a.allergen ?? a) ?? [],
              dietaryTags: go.option.dietaryTags?.map((t: any) => t.tag ?? t) ?? [],
            }
          : {}),
      })) ?? [],
      portions: group.portions?.map((gp: any) => ({
        portionSizeId: gp.portionSizeId,
        extraCents: gp.extraCents,
        sortOrder: gp.sortOrder,
        ...(gp.portionSize
          ? {
              name: gp.portionSize.name,
              active: gp.portionSize.active,
            }
          : {}),
      })) ?? [],
    };
  }

  async listGroupsForDish(dishId: string) {
    const dish = await this.prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) {
      throw DomainError.notFound(ERRORS.DISH_NOT_FOUND, `Dish with id "${dishId}" not found`);
    }

    const groups = await this.prisma.optionGroup.findMany({
      where: { dishId },
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
    });

    return groups.map((g) => this.mapGroupOutput(g));
  }

  async getGroup(id: string) {
    const group = await this.prisma.optionGroup.findUnique({
      where: { id },
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
    });

    if (!group) {
      throw DomainError.notFound(ERRORS.OPTION_GROUP_NOT_FOUND, `Option group with id "${id}" not found`);
    }

    return this.mapGroupOutput(group);
  }

  async createGroup(dishId: string, data: CreateOptionGroupDto) {
    const dish = await this.prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) {
      throw DomainError.notFound(ERRORS.DISH_NOT_FOUND, `Dish with id "${dishId}" not found`);
    }

    const name = data.name?.trim();
    if (!name) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Group name is required', { name: 'Name is required' });
    }
    if (data.required === undefined) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Required flag must be specified', { required: 'Required flag is required' });
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.optionGroup.create({
        data: {
          dishId,
          name,
          required: Boolean(data.required),
          sortOrder: data.sortOrder ?? 0,
          usesPortions: Boolean(data.usesPortions),
        },
      });

      if (data.options && data.options.length > 0) {
        await tx.optionGroupOption.createMany({
          data: data.options.map((opt, idx) => ({
            groupId: group.id,
            optionId: opt.optionId,
            sortOrder: opt.sortOrder ?? idx,
          })),
          skipDuplicates: true,
        });
      }

      if (data.usesPortions && data.portions && data.portions.length > 0) {
        await tx.optionGroupPortion.createMany({
          data: data.portions.map((p, idx) => ({
            groupId: group.id,
            portionSizeId: p.portionSizeId,
            extraCents: Math.round(p.extraCents),
            sortOrder: p.sortOrder ?? idx,
          })),
          skipDuplicates: true,
        });
      }

      const created = await tx.optionGroup.findUnique({
        where: { id: group.id },
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
      });

      return this.mapGroupOutput(created);
    });
  }

  async updateGroup(id: string, data: UpdateOptionGroupDto) {
    const existing = await this.prisma.optionGroup.findUnique({ where: { id } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.OPTION_GROUP_NOT_FOUND, `Option group with id "${id}" not found`);
    }

    const updateFields: any = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name cannot be empty');
      updateFields.name = name;
    }
    if (data.required !== undefined) {
      updateFields.required = Boolean(data.required);
    }
    if (data.sortOrder !== undefined) {
      updateFields.sortOrder = Number(data.sortOrder);
    }
    if (data.usesPortions !== undefined) {
      updateFields.usesPortions = Boolean(data.usesPortions);
    }

    const effectiveUsesPortions =
      data.usesPortions !== undefined ? data.usesPortions : existing.usesPortions;

    return this.prisma.$transaction(async (tx) => {
      await tx.optionGroup.update({
        where: { id },
        data: updateFields,
      });

      if (data.options !== undefined) {
        await tx.optionGroupOption.deleteMany({ where: { groupId: id } });
        if (data.options.length > 0) {
          await tx.optionGroupOption.createMany({
            data: data.options.map((opt, idx) => ({
              groupId: id,
              optionId: opt.optionId,
              sortOrder: opt.sortOrder ?? idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (!effectiveUsesPortions) {
        // If usesPortions is disabled, clear any portions
        await tx.optionGroupPortion.deleteMany({ where: { groupId: id } });
      } else if (data.portions !== undefined) {
        await tx.optionGroupPortion.deleteMany({ where: { groupId: id } });
        if (data.portions.length > 0) {
          await tx.optionGroupPortion.createMany({
            data: data.portions.map((p, idx) => ({
              groupId: id,
              portionSizeId: p.portionSizeId,
              extraCents: Math.round(p.extraCents),
              sortOrder: p.sortOrder ?? idx,
            })),
            skipDuplicates: true,
          });
        }
      }

      const updated = await tx.optionGroup.findUnique({
        where: { id },
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
      });

      return this.mapGroupOutput(updated);
    });
  }

  async deleteGroup(id: string) {
    const existing = await this.prisma.optionGroup.findUnique({ where: { id } });
    if (!existing) {
      throw DomainError.notFound(ERRORS.OPTION_GROUP_NOT_FOUND, `Option group with id "${id}" not found`);
    }

    await this.prisma.optionGroup.delete({ where: { id } });
    return { ok: true, id };
  }
}
