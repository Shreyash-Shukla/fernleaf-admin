import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  dbDateToString,
  stringToDbDate,
  isValidDateString,
  ERRORS,
} from '@repo/shared';
import { DomainError } from '../common/domain-error';

export interface KitchenHolidayDto {
  date: string;
  name: string;
}

@Injectable()
export class KitchenHolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<KitchenHolidayDto[]> {
    const holidays = await this.prisma.kitchenHoliday.findMany({
      orderBy: { date: 'asc' },
    });

    return holidays.map((h) => ({
      date: dbDateToString(h.date),
      name: h.name,
    }));
  }

  async createOrUpdate(dateStr: string, name: string): Promise<KitchenHolidayDto> {
    if (!isValidDateString(dateStr)) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Invalid date format, expected YYYY-MM-DD',
        { date: 'Invalid date format, expected YYYY-MM-DD' },
      );
    }

    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Holiday name is required',
        { name: 'Holiday name is required' },
      );
    }

    const dbDate = stringToDbDate(dateStr);

    const holiday = await this.prisma.kitchenHoliday.upsert({
      where: { date: dbDate },
      update: { name: trimmedName },
      create: { date: dbDate, name: trimmedName },
    });

    return {
      date: dbDateToString(holiday.date),
      name: holiday.name,
    };
  }

  async delete(dateStr: string): Promise<{ ok: boolean }> {
    if (!isValidDateString(dateStr)) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Invalid date format, expected YYYY-MM-DD',
      );
    }

    const dbDate = stringToDbDate(dateStr);

    try {
      await this.prisma.kitchenHoliday.delete({
        where: { date: dbDate },
      });
      return { ok: true };
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw DomainError.notFound(
          ERRORS.NOT_FOUND,
          `Kitchen holiday for date ${dateStr} not found`,
        );
      }
      throw err;
    }
  }
}
