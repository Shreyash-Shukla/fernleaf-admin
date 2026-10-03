import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import { ERRORS } from '@repo/shared';

@Injectable()
export class ReferenceDataService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Allergens ───────────────────────────────────────────
  async listAllergens(activeOnly?: boolean) {
    return this.prisma.allergen.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async createAllergen(name: string) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Allergen name is required',
        { name: 'Allergen name is required' },
      );
    }
    return this.prisma.allergen.create({
      data: { name: trimmed },
    });
  }

  async updateAllergen(
    id: string,
    data: { name?: string; active?: boolean },
  ) {
    const updateData: { name?: string; active?: boolean } = {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Allergen name cannot be empty',
        );
      }
      updateData.name = trimmed;
    }
    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    return this.prisma.allergen.update({
      where: { id },
      data: updateData,
    });
  }

  // ─── Dietary Tags ────────────────────────────────────────
  async listDietaryTags(activeOnly?: boolean) {
    return this.prisma.dietaryTag.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async createDietaryTag(name: string) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Dietary tag name is required',
        { name: 'Dietary tag name is required' },
      );
    }
    return this.prisma.dietaryTag.create({
      data: { name: trimmed },
    });
  }

  async updateDietaryTag(
    id: string,
    data: { name?: string; active?: boolean },
  ) {
    const updateData: { name?: string; active?: boolean } = {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Dietary tag name cannot be empty',
        );
      }
      updateData.name = trimmed;
    }
    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    return this.prisma.dietaryTag.update({
      where: { id },
      data: updateData,
    });
  }

  // ─── Kitchen Stations ────────────────────────────────────
  async listStations(activeOnly?: boolean) {
    return this.prisma.kitchenStation.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createStation(name: string, sortOrder?: number) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Station name is required',
        { name: 'Station name is required' },
      );
    }

    let order = sortOrder;
    if (order === undefined || isNaN(order)) {
      const highest = await this.prisma.kitchenStation.findFirst({
        orderBy: { sortOrder: 'desc' },
      });
      order = highest ? highest.sortOrder + 1 : 0;
    }

    return this.prisma.kitchenStation.create({
      data: {
        name: trimmed,
        sortOrder: order,
      },
    });
  }

  async updateStation(
    id: string,
    data: { name?: string; sortOrder?: number; active?: boolean },
  ) {
    const updateData: { name?: string; sortOrder?: number; active?: boolean } =
      {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Station name cannot be empty',
        );
      }
      updateData.name = trimmed;
    }
    if (data.sortOrder !== undefined && !isNaN(data.sortOrder)) {
      updateData.sortOrder = Number(data.sortOrder);
    }
    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    return this.prisma.kitchenStation.update({
      where: { id },
      data: updateData,
    });
  }

  // ─── Portion Sizes ───────────────────────────────────────
  async listPortionSizes(activeOnly?: boolean) {
    return this.prisma.portionSize.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createPortionSize(name: string, sortOrder?: number) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Portion size name is required',
        { name: 'Portion size name is required' },
      );
    }

    let order = sortOrder;
    if (order === undefined || isNaN(order)) {
      const highest = await this.prisma.portionSize.findFirst({
        orderBy: { sortOrder: 'desc' },
      });
      order = highest ? highest.sortOrder + 1 : 0;
    }

    return this.prisma.portionSize.create({
      data: {
        name: trimmed,
        sortOrder: order,
      },
    });
  }

  async updatePortionSize(
    id: string,
    data: { name?: string; sortOrder?: number; active?: boolean },
  ) {
    const updateData: { name?: string; sortOrder?: number; active?: boolean } =
      {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Portion size name cannot be empty',
        );
      }
      updateData.name = trimmed;
    }
    if (data.sortOrder !== undefined && !isNaN(data.sortOrder)) {
      updateData.sortOrder = Number(data.sortOrder);
    }
    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    return this.prisma.portionSize.update({
      where: { id },
      data: updateData,
    });
  }
}
