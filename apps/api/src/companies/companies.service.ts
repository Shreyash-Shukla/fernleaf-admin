import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import {
  ERRORS,
  normalizeDomain,
  isValidDomain,
  isPublicEmailDomain,
  normalizeEmail,
  isValidEmail,
  dbDateToString,
  stringToDbDate,
  isValidDateString,
} from '@repo/shared';
import { Packaging } from '@prisma/client';

export interface CreateCompanyAddressDto {
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postcode: string;
  isDefault?: boolean;
}

export interface UpdateCompanyAddressDto {
  label?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string | null;
  postcode?: string;
  isDefault?: boolean;
  active?: boolean;
}

export interface CreateCompanyHolidayDto {
  date: string;
  name: string;
}

export interface CreateCompanyDto {
  name: string;
  tierId?: string | null;
  ownerEmployeeId?: string | null;
  workingDays?: number[];
  defaultDeliveryTimeMin?: number;
  dispatchLeadMinutes?: number;
  defaultPackaging?: Packaging;
  driverNotes?: string | null;
  defaultDriverId?: string | null;
  billingName: string;
  billingEmail: string;
  billingPhone?: string | null;
  billingAddress: string;
  active?: boolean;
  domains?: string[];
  address?: CreateCompanyAddressDto;
}

export interface UpdateCompanyDto {
  name?: string;
  tierId?: string | null;
  ownerEmployeeId?: string | null;
  workingDays?: number[];
  defaultDeliveryTimeMin?: number;
  dispatchLeadMinutes?: number;
  defaultPackaging?: Packaging;
  driverNotes?: string | null;
  defaultDriverId?: string | null;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string | null;
  billingAddress?: string;
  active?: boolean;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  private async findCompanyOrThrow(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });
    if (!company) {
      throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, `Company "${id}" not found`);
    }
    return company;
  }

  async listCompanies(query: {
    page?: number | string;
    limit?: number | string;
    active?: boolean | string;
    q?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.active !== undefined && query.active !== '' && query.active !== 'all') {
      where.active = query.active === true || query.active === 'true' || query.active === '1';
    }

    if (query.q && query.q.trim()) {
      const search = query.q.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { billingName: { contains: search, mode: 'insensitive' } },
        { billingEmail: { contains: search, mode: 'insensitive' } },
        {
          domains: {
            some: {
              domain: { contains: search.toLowerCase(), mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          tier: {
            select: { id: true, name: true, derivation: true, factorBps: true },
          },
          defaultDriver: {
            select: { id: true, name: true, email: true },
          },
          domains: true,
          addresses: {
            where: { active: true },
            orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
          },
          _count: {
            select: {
              employees: true,
              orders: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((c) => ({
        ...c,
        employeeCount: c._count.employees,
        orderCount: c._count.orders,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        tier: {
          select: { id: true, name: true, derivation: true, factorBps: true, isDefault: true },
        },
        defaultDriver: {
          select: { id: true, name: true, email: true },
        },
        domains: true,
        addresses: {
          where: { active: true },
          orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
        },
        holidays: {
          orderBy: { date: 'asc' },
        },
        _count: {
          select: {
            employees: true,
            orders: true,
          },
        },
      },
    });

    if (!company) {
      throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, `Company "${id}" not found`);
    }

    let owner: any = null;
    if (company.ownerEmployeeId) {
      owner = await this.prisma.employee.findUnique({
        where: { id: company.ownerEmployeeId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          active: true,
        },
      });
    }

    return {
      ...company,
      owner,
      holidays: company.holidays.map((h) => ({
        id: h.id,
        companyId: h.companyId,
        date: dbDateToString(h.date),
        name: h.name,
      })),
      employeeCount: company._count.employees,
      orderCount: company._count.orders,
    };
  }

  async createCompany(dto: CreateCompanyDto) {
    if (!dto.name || !dto.name.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Company name is required', {
        name: 'Name is required',
      });
    }
    if (!dto.billingName || !dto.billingName.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Billing name is required', {
        billingName: 'Billing name is required',
      });
    }
    if (!dto.billingEmail || !dto.billingEmail.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Billing email is required', {
        billingEmail: 'Billing email is required',
      });
    }
    if (!isValidEmail(dto.billingEmail)) {
      throw DomainError.badRequest(ERRORS.INVALID_EMAIL, 'Invalid billing email address', {
        billingEmail: 'Invalid email address',
      });
    }
    if (!dto.billingAddress || !dto.billingAddress.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Billing address is required', {
        billingAddress: 'Billing address is required',
      });
    }

    const name = dto.name.trim();

    // Check name uniqueness
    const existingName = await this.prisma.company.findUnique({
      where: { name },
    });
    if (existingName) {
      throw DomainError.conflict(ERRORS.CONFLICT, `Company with name "${name}" already exists`);
    }

    // Verify tier if provided
    if (dto.tierId) {
      const tier = await this.prisma.priceTier.findUnique({
        where: { id: dto.tierId },
      });
      if (!tier || !tier.active) {
        throw DomainError.badRequest(ERRORS.TIER_NOT_FOUND, `Price tier "${dto.tierId}" not found or inactive`);
      }
    }

    // Verify driver if provided
    if (dto.defaultDriverId) {
      const driver = await this.prisma.user.findUnique({
        where: { id: dto.defaultDriverId },
      });
      if (!driver || !driver.active) {
        throw DomainError.badRequest(ERRORS.NOT_FOUND, `Default driver "${dto.defaultDriverId}" not found or inactive`);
      }
    }

    // Validate initial domains if provided
    const validDomains: string[] = [];
    if (dto.domains && dto.domains.length > 0) {
      for (const d of dto.domains) {
        const norm = normalizeDomain(d);
        if (!isValidDomain(norm)) {
          throw DomainError.badRequest(ERRORS.INVALID_DOMAIN, `Invalid domain format: "${d}"`);
        }
        if (isPublicEmailDomain(norm)) {
          throw DomainError.unprocessable(
            ERRORS.DOMAIN_PUBLIC,
            `Public email domain "${norm}" is not allowed`,
          );
        }
        const taken = await this.prisma.companyDomain.findUnique({ where: { domain: norm } });
        if (taken) {
          throw DomainError.conflict(
            ERRORS.DOMAIN_TAKEN,
            `Domain "${norm}" is already registered to another company`,
          );
        }
        validDomains.push(norm);
      }
    }

    const workingDays =
      Array.isArray(dto.workingDays) && dto.workingDays.length > 0
        ? dto.workingDays
        : [1, 2, 3, 4, 5];

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name,
          tierId: dto.tierId ?? null,
          ownerEmployeeId: dto.ownerEmployeeId ?? null,
          workingDays,
          defaultDeliveryTimeMin: dto.defaultDeliveryTimeMin ?? 720,
          dispatchLeadMinutes: dto.dispatchLeadMinutes ?? 60,
          defaultPackaging: dto.defaultPackaging ?? Packaging.STANDARD,
          driverNotes: dto.driverNotes?.trim() ?? null,
          defaultDriverId: dto.defaultDriverId ?? null,
          billingName: dto.billingName.trim(),
          billingEmail: normalizeEmail(dto.billingEmail),
          billingPhone: dto.billingPhone?.trim() ?? null,
          billingAddress: dto.billingAddress.trim(),
          active: dto.active ?? true,
        },
      });

      // Create domains if provided
      if (validDomains.length > 0) {
        await tx.companyDomain.createMany({
          data: validDomains.map((domain) => ({
            domain,
            companyId: company.id,
          })),
        });
      }

      // Create initial address if provided
      if (dto.address) {
        await tx.companyAddress.create({
          data: {
            companyId: company.id,
            label: dto.address.label.trim(),
            line1: dto.address.line1.trim(),
            line2: dto.address.line2?.trim() ?? null,
            city: dto.address.city.trim(),
            state: dto.address.state?.trim() ?? null,
            postcode: dto.address.postcode.trim(),
            isDefault: true,
          },
        });
      }

      return company;
    });
  }

  async updateCompany(id: string, dto: UpdateCompanyDto) {
    const existing = await this.findCompanyOrThrow(id);

    const updateData: any = {};

    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (!trimmed) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Company name cannot be empty');
      }
      if (trimmed !== existing.name) {
        const nameConflict = await this.prisma.company.findUnique({
          where: { name: trimmed },
        });
        if (nameConflict && nameConflict.id !== id) {
          throw DomainError.conflict(ERRORS.CONFLICT, `Company with name "${trimmed}" already exists`);
        }
      }
      updateData.name = trimmed;
    }

    if (dto.tierId !== undefined) {
      if (dto.tierId !== null) {
        const tier = await this.prisma.priceTier.findUnique({
          where: { id: dto.tierId },
        });
        if (!tier || !tier.active) {
          throw DomainError.badRequest(ERRORS.TIER_NOT_FOUND, `Price tier "${dto.tierId}" not found or inactive`);
        }
      }
      updateData.tierId = dto.tierId;
    }

    // Owner validation
    if (dto.ownerEmployeeId !== undefined) {
      if (dto.ownerEmployeeId !== null) {
        const employee = await this.prisma.employee.findUnique({
          where: { id: dto.ownerEmployeeId },
        });
        if (!employee) {
          throw DomainError.badRequest(
            ERRORS.EMPLOYEE_NOT_FOUND,
            `Employee "${dto.ownerEmployeeId}" not found`,
          );
        }
        if (employee.companyId !== id) {
          throw DomainError.badRequest(
            ERRORS.INVALID_OWNER,
            `Owner must be an employee of this company (employee belongs to company "${employee.companyId}")`,
            { ownerEmployeeId: 'Must be an employee of this company' },
          );
        }
        if (!employee.active) {
          throw DomainError.badRequest(
            ERRORS.INVALID_OWNER,
            `Owner employee "${employee.name}" is inactive`,
            { ownerEmployeeId: 'Owner must be an active employee' },
          );
        }
      }
      updateData.ownerEmployeeId = dto.ownerEmployeeId;
    }

    if (dto.workingDays !== undefined) {
      if (!Array.isArray(dto.workingDays) || dto.workingDays.length === 0) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'workingDays must be a non-empty array of day numbers (1-7)',
        );
      }
      for (const day of dto.workingDays) {
        if (!Number.isInteger(day) || day < 1 || day > 7) {
          throw DomainError.badRequest(
            ERRORS.VALIDATION_ERROR,
            `Invalid day number: ${day}. Working days must be integers between 1 and 7.`,
          );
        }
      }
      updateData.workingDays = dto.workingDays;
    }

    if (dto.defaultDeliveryTimeMin !== undefined) {
      if (
        !Number.isInteger(dto.defaultDeliveryTimeMin) ||
        dto.defaultDeliveryTimeMin < 0 ||
        dto.defaultDeliveryTimeMin > 1439
      ) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'defaultDeliveryTimeMin must be between 0 and 1439 minutes',
        );
      }
      updateData.defaultDeliveryTimeMin = dto.defaultDeliveryTimeMin;
    }

    if (dto.dispatchLeadMinutes !== undefined) {
      if (!Number.isInteger(dto.dispatchLeadMinutes) || dto.dispatchLeadMinutes < 0) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'dispatchLeadMinutes must be a positive integer',
        );
      }
      updateData.dispatchLeadMinutes = dto.dispatchLeadMinutes;
    }

    if (dto.defaultPackaging !== undefined) {
      updateData.defaultPackaging = dto.defaultPackaging;
    }

    if (dto.driverNotes !== undefined) {
      updateData.driverNotes = dto.driverNotes?.trim() ?? null;
    }

    if (dto.defaultDriverId !== undefined) {
      if (dto.defaultDriverId !== null) {
        const driver = await this.prisma.user.findUnique({
          where: { id: dto.defaultDriverId },
        });
        if (!driver || !driver.active) {
          throw DomainError.badRequest(
            ERRORS.NOT_FOUND,
            `Driver "${dto.defaultDriverId}" not found or inactive`,
          );
        }
      }
      updateData.defaultDriverId = dto.defaultDriverId;
    }

    if (dto.billingName !== undefined) {
      const trimmed = dto.billingName.trim();
      if (!trimmed) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'billingName cannot be empty');
      }
      updateData.billingName = trimmed;
    }

    if (dto.billingEmail !== undefined) {
      const email = normalizeEmail(dto.billingEmail);
      if (!isValidEmail(email)) {
        throw DomainError.badRequest(ERRORS.INVALID_EMAIL, 'Invalid billing email');
      }
      updateData.billingEmail = email;
    }

    if (dto.billingPhone !== undefined) {
      updateData.billingPhone = dto.billingPhone?.trim() ?? null;
    }

    if (dto.billingAddress !== undefined) {
      const trimmed = dto.billingAddress.trim();
      if (!trimmed) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'billingAddress cannot be empty');
      }
      updateData.billingAddress = trimmed;
    }

    if (dto.active !== undefined) {
      updateData.active = Boolean(dto.active);
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async deleteCompany(id: string) {
    await this.findCompanyOrThrow(id);
    return this.prisma.company.update({
      where: { id },
      data: { active: false },
    });
  }

  // ─── DOMAINS ────────────────────────────────────────────────────

  async getDomains(companyId: string) {
    await this.findCompanyOrThrow(companyId);
    return this.prisma.companyDomain.findMany({
      where: { companyId },
      orderBy: { domain: 'asc' },
    });
  }

  async addDomain(companyId: string, rawDomain: string) {
    await this.findCompanyOrThrow(companyId);

    if (!rawDomain || !rawDomain.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Domain is required', {
        domain: 'Domain is required',
      });
    }

    const domain = normalizeDomain(rawDomain);

    if (!isValidDomain(domain)) {
      throw DomainError.badRequest(ERRORS.INVALID_DOMAIN, `Invalid domain format: "${rawDomain}"`, {
        domain: 'Invalid domain format (e.g. acme.com)',
      });
    }

    if (isPublicEmailDomain(domain)) {
      throw DomainError.unprocessable(
        ERRORS.DOMAIN_PUBLIC,
        `Public email domain "${domain}" is not allowed`,
        { domain: 'Public email domains like gmail.com or yahoo.com are not allowed' },
      );
    }

    const existing = await this.prisma.companyDomain.findUnique({
      where: { domain },
    });

    if (existing) {
      if (existing.companyId === companyId) {
        return existing;
      }
      throw DomainError.conflict(
        ERRORS.DOMAIN_TAKEN,
        `Domain "${domain}" is already registered to another company`,
        { domain: 'Domain is already claimed by another company' },
      );
    }

    return this.prisma.companyDomain.create({
      data: {
        domain,
        companyId,
      },
    });
  }

  async removeDomain(companyId: string, rawDomain: string) {
    await this.findCompanyOrThrow(companyId);
    const domain = normalizeDomain(rawDomain);

    const existing = await this.prisma.companyDomain.findFirst({
      where: { domain, companyId },
    });

    if (!existing) {
      throw DomainError.notFound(
        ERRORS.DOMAIN_NOT_FOUND,
        `Domain "${domain}" is not associated with this company`,
      );
    }

    await this.prisma.companyDomain.delete({
      where: { domain },
    });

    return { ok: true, domain };
  }

  // ─── ADDRESSES ──────────────────────────────────────────────────

  async getAddresses(companyId: string) {
    await this.findCompanyOrThrow(companyId);
    return this.prisma.companyAddress.findMany({
      where: { companyId, active: true },
      orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
    });
  }

  async addAddress(companyId: string, dto: CreateCompanyAddressDto) {
    await this.findCompanyOrThrow(companyId);

    if (!dto.label?.trim() || !dto.line1?.trim() || !dto.city?.trim() || !dto.postcode?.trim()) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'label, line1, city, and postcode are required address fields',
      );
    }

    const activeCount = await this.prisma.companyAddress.count({
      where: { companyId, active: true },
    });

    const isDefault = dto.isDefault === true || activeCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.companyAddress.updateMany({
          where: { companyId },
          data: { isDefault: false },
        });
      }

      return tx.companyAddress.create({
        data: {
          companyId,
          label: dto.label.trim(),
          line1: dto.line1.trim(),
          line2: dto.line2?.trim() ?? null,
          city: dto.city.trim(),
          state: dto.state?.trim() ?? null,
          postcode: dto.postcode.trim(),
          isDefault,
          active: true,
        },
      });
    });
  }

  async updateAddress(companyId: string, addressId: string, dto: UpdateCompanyAddressDto) {
    await this.findCompanyOrThrow(companyId);

    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId },
    });

    if (!address) {
      throw DomainError.notFound(
        ERRORS.ADDRESS_NOT_FOUND,
        `Address "${addressId}" not found for this company`,
      );
    }

    const updateData: any = {};
    if (dto.label !== undefined) updateData.label = dto.label.trim();
    if (dto.line1 !== undefined) updateData.line1 = dto.line1.trim();
    if (dto.line2 !== undefined) updateData.line2 = dto.line2?.trim() ?? null;
    if (dto.city !== undefined) updateData.city = dto.city.trim();
    if (dto.state !== undefined) updateData.state = dto.state?.trim() ?? null;
    if (dto.postcode !== undefined) updateData.postcode = dto.postcode.trim();
    if (dto.active !== undefined) updateData.active = Boolean(dto.active);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.companyAddress.updateMany({
          where: { companyId },
          data: { isDefault: false },
        });
        updateData.isDefault = true;
      } else if (dto.isDefault === false) {
        updateData.isDefault = false;
      }

      return tx.companyAddress.update({
        where: { id: addressId },
        data: updateData,
      });
    });
  }

  async deleteAddress(companyId: string, addressId: string) {
    await this.findCompanyOrThrow(companyId);

    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId },
    });

    if (!address) {
      throw DomainError.notFound(
        ERRORS.ADDRESS_NOT_FOUND,
        `Address "${addressId}" not found for this company`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.companyAddress.update({
        where: { id: addressId },
        data: { active: false, isDefault: false },
      });

      // If the deleted address was default, make another active address default if one exists
      if (address.isDefault) {
        const nextDefault = await tx.companyAddress.findFirst({
          where: { companyId, active: true, id: { not: addressId } },
          orderBy: { createdAt: 'asc' },
        });
        if (nextDefault) {
          await tx.companyAddress.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }

      return { ok: true, active: false };
    });
  }

  // ─── HOLIDAYS & CALENDAR ────────────────────────────────────────

  async getHolidays(companyId: string) {
    await this.findCompanyOrThrow(companyId);

    const holidays = await this.prisma.companyHoliday.findMany({
      where: { companyId },
      orderBy: { date: 'asc' },
    });

    return holidays.map((h) => ({
      id: h.id,
      companyId: h.companyId,
      date: dbDateToString(h.date),
      name: h.name,
    }));
  }

  async addHoliday(companyId: string, dto: CreateCompanyHolidayDto) {
    await this.findCompanyOrThrow(companyId);

    if (!dto.date || !isValidDateString(dto.date)) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Valid date string in YYYY-MM-DD format is required',
        { date: 'Invalid date format' },
      );
    }
    if (!dto.name || !dto.name.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Holiday name is required', {
        name: 'Name is required',
      });
    }

    const dbDate = stringToDbDate(dto.date);

    const holiday = await this.prisma.companyHoliday.upsert({
      where: {
        companyId_date: {
          companyId,
          date: dbDate,
        },
      },
      update: {
        name: dto.name.trim(),
      },
      create: {
        companyId,
        date: dbDate,
        name: dto.name.trim(),
      },
    });

    return {
      id: holiday.id,
      companyId: holiday.companyId,
      date: dbDateToString(holiday.date),
      name: holiday.name,
    };
  }

  async removeHoliday(companyId: string, idOrDate: string) {
    await this.findCompanyOrThrow(companyId);

    if (isValidDateString(idOrDate)) {
      const dbDate = stringToDbDate(idOrDate);
      await this.prisma.companyHoliday.deleteMany({
        where: { companyId, date: dbDate },
      });
    } else {
      await this.prisma.companyHoliday.deleteMany({
        where: { companyId, id: idOrDate },
      });
    }

    return { ok: true };
  }

  async getCalendar(companyId: string) {
    const company = await this.findCompanyOrThrow(companyId);
    const holidays = await this.getHolidays(companyId);

    return {
      companyId: company.id,
      companyName: company.name,
      workingDays: company.workingDays,
      holidays,
    };
  }
}
