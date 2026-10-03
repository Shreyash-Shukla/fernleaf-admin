import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import {
  ERRORS,
  normalizeEmail,
  isValidEmail,
} from '@repo/shared';

export interface CreateEmployeeDto {
  companyId: string;
  name: string;
  email: string;
  phone?: string | null;
  canChooseAddress?: boolean;
  canChangeTime?: boolean;
  canChangePackaging?: boolean;
  active?: boolean;
  allergenIds?: string[];
  dietaryTagIds?: string[];
}

export interface UpdateEmployeeDto {
  companyId?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  canChooseAddress?: boolean;
  canChangeTime?: boolean;
  canChangePackaging?: boolean;
  active?: boolean;
  allergenIds?: string[];
  dietaryTagIds?: string[];
}

export interface ImportEmployeesDto {
  companyId?: string;
  csvText?: string;
  rows?: Array<{
    name: string;
    email: string;
    phone?: string;
    canChooseAddress?: boolean | string;
    canChangeTime?: boolean | string;
    canChangePackaging?: boolean | string;
    allergens?: string[] | string;
    dietaryTags?: string[] | string;
  }>;
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapEmployeeRelations(emp: any) {
    if (!emp) return emp;
    return {
      ...emp,
      allergens: emp.allergens?.map((a: any) => a.allergen ?? a) ?? [],
      dietaryTags: emp.dietaryTags?.map((t: any) => t.tag ?? t) ?? [],
      orderCount: emp._count?.orders ?? undefined,
    };
  }

  private async findEmployeeOrThrow(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!employee) {
      throw DomainError.notFound(ERRORS.EMPLOYEE_NOT_FOUND, `Employee "${id}" not found`);
    }
    return employee;
  }

  async listEmployees(query: {
    companyId?: string;
    page?: number | string;
    limit?: number | string;
    active?: boolean | string;
    q?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.active !== undefined && query.active !== '' && query.active !== 'all') {
      where.active = query.active === true || query.active === 'true' || query.active === '1';
    }

    if (query.q && query.q.trim()) {
      const search = query.q.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          company: {
            select: { id: true, name: true, tierId: true },
          },
          allergens: {
            include: { allergen: true },
          },
          dietaryTags: {
            include: { tag: true },
          },
          _count: {
            select: { orders: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((e) => this.mapEmployeeRelations(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEmployee(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            tier: { select: { id: true, name: true, derivation: true, factorBps: true } },
            addresses: { where: { active: true }, orderBy: [{ isDefault: 'desc' }, { label: 'asc' }] },
          },
        },
        allergens: {
          include: { allergen: true },
        },
        dietaryTags: {
          include: { tag: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!employee) {
      throw DomainError.notFound(ERRORS.EMPLOYEE_NOT_FOUND, `Employee "${id}" not found`);
    }

    const openOrdersCount = await this.prisma.order.count({
      where: {
        employeeId: id,
        status: { in: ['DRAFT', 'PLACED'] },
      },
    });

    return {
      ...this.mapEmployeeRelations(employee),
      openOrdersCount,
    };
  }

  async createEmployee(dto: CreateEmployeeDto) {
    if (!dto.companyId) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Company ID is required', {
        companyId: 'Company ID is required',
      });
    }
    if (!dto.name || !dto.name.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Employee name is required', {
        name: 'Name is required',
      });
    }
    if (!dto.email || !dto.email.trim()) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Email is required', {
        email: 'Email is required',
      });
    }

    const email = normalizeEmail(dto.email);
    if (!isValidEmail(email)) {
      throw DomainError.badRequest(ERRORS.INVALID_EMAIL, `Invalid email address: "${dto.email}"`, {
        email: 'Invalid email address',
      });
    }

    // Verify company exists and is active
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, `Company "${dto.companyId}" not found`);
    }
    if (!company.active) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, `Company "${company.name}" is inactive`);
    }

    // Check email uniqueness
    const existing = await this.prisma.employee.findUnique({
      where: { email },
    });
    if (existing) {
      throw DomainError.conflict(
        ERRORS.EMPLOYEE_EMAIL_TAKEN,
        `Employee with email "${email}" already exists`,
        { email: 'Email already exists' },
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          companyId: dto.companyId,
          name: dto.name.trim(),
          email,
          phone: dto.phone?.trim() ?? null,
          canChooseAddress: dto.canChooseAddress ?? false,
          canChangeTime: dto.canChangeTime ?? false,
          canChangePackaging: dto.canChangePackaging ?? false,
          active: dto.active ?? true,
          allergens: dto.allergenIds?.length
            ? {
                create: dto.allergenIds.map((allergenId) => ({ allergenId })),
              }
            : undefined,
          dietaryTags: dto.dietaryTagIds?.length
            ? {
                create: dto.dietaryTagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        },
        include: {
          company: {
            select: { id: true, name: true },
          },
          allergens: {
            include: { allergen: true },
          },
          dietaryTags: {
            include: { tag: true },
          },
        },
      });

      return emp;
    });

    return this.mapEmployeeRelations(created);
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.findEmployeeOrThrow(id);

    const updateData: any = {};

    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (!trimmed) {
        throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, 'Name cannot be empty');
      }
      updateData.name = trimmed;
    }

    if (dto.email !== undefined) {
      const email = normalizeEmail(dto.email);
      if (!isValidEmail(email)) {
        throw DomainError.badRequest(ERRORS.INVALID_EMAIL, 'Invalid email address');
      }
      if (email !== existing.email) {
        const conflict = await this.prisma.employee.findUnique({
          where: { email },
        });
        if (conflict && conflict.id !== id) {
          throw DomainError.conflict(
            ERRORS.EMPLOYEE_EMAIL_TAKEN,
            `Employee with email "${email}" already exists`,
          );
        }
      }
      updateData.email = email;
    }

    if (dto.phone !== undefined) {
      updateData.phone = dto.phone?.trim() ?? null;
    }

    if (dto.canChooseAddress !== undefined) {
      updateData.canChooseAddress = Boolean(dto.canChooseAddress);
    }

    if (dto.canChangeTime !== undefined) {
      updateData.canChangeTime = Boolean(dto.canChangeTime);
    }

    if (dto.canChangePackaging !== undefined) {
      updateData.canChangePackaging = Boolean(dto.canChangePackaging);
    }

    if (dto.active !== undefined) {
      updateData.active = Boolean(dto.active);
    }

    // CRITICAL MOVE RULE: Moving employee to another company
    if (dto.companyId !== undefined && dto.companyId !== existing.companyId) {
      const openOrders = await this.prisma.order.count({
        where: {
          employeeId: id,
          status: { in: ['DRAFT', 'PLACED'] },
        },
      });

      if (openOrders > 0) {
        throw DomainError.badRequest(
          ERRORS.EMPLOYEE_HAS_OPEN_ORDERS,
          `Cannot move employee to another company while they have ${openOrders} open (Draft or Placed) orders. Orders must be confirmed, delivered, or cancelled first.`,
          { companyId: 'Employee has open orders' },
        );
      }

      const targetCompany = await this.prisma.company.findUnique({
        where: { id: dto.companyId },
      });

      if (!targetCompany) {
        throw DomainError.notFound(
          ERRORS.COMPANY_NOT_FOUND,
          `Target company "${dto.companyId}" not found`,
        );
      }
      if (!targetCompany.active) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          `Target company "${targetCompany.name}" is inactive`,
        );
      }

      updateData.companyId = dto.companyId;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.allergenIds !== undefined) {
        await tx.employeeAllergen.deleteMany({
          where: { employeeId: id },
        });
        if (dto.allergenIds.length > 0) {
          await tx.employeeAllergen.createMany({
            data: dto.allergenIds.map((allergenId) => ({
              employeeId: id,
              allergenId,
            })),
          });
        }
      }

      if (dto.dietaryTagIds !== undefined) {
        await tx.employeeDietaryTag.deleteMany({
          where: { employeeId: id },
        });
        if (dto.dietaryTagIds.length > 0) {
          await tx.employeeDietaryTag.createMany({
            data: dto.dietaryTagIds.map((tagId) => ({
              employeeId: id,
              tagId,
            })),
          });
        }
      }

      return tx.employee.update({
        where: { id },
        data: updateData,
        include: {
          company: {
            select: { id: true, name: true, tierId: true },
          },
          allergens: {
            include: { allergen: true },
          },
          dietaryTags: {
            include: { tag: true },
          },
        },
      });
    });

    return this.mapEmployeeRelations(updated);
  }

  async deleteEmployee(id: string) {
    await this.findEmployeeOrThrow(id);
    return this.prisma.employee.update({
      where: { id },
      data: { active: false },
    });
  }

  // ─── CSV BULK IMPORT ────────────────────────────────────────────

  private parseCsv(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let c = 0; c < lines[i].length; c++) {
        const char = lines[i][c];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').replace(/^["']|["']$/g, '').trim();
      });
      rows.push(row);
    }
    return rows;
  }

  async importEmployees(companyId: string, dto: ImportEmployeesDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, `Company "${companyId}" not found`);
    }
    if (!company.active) {
      throw DomainError.badRequest(ERRORS.VALIDATION_ERROR, `Company "${company.name}" is inactive`);
    }

    let rawRows: any[] = [];
    if (dto.csvText) {
      rawRows = this.parseCsv(dto.csvText);
    } else if (Array.isArray(dto.rows)) {
      rawRows = dto.rows;
    } else {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Either csvText or rows array must be provided for employee import',
      );
    }

    // Pre-load allergens and dietary tags to map by name or id
    const [allAllergens, allTags] = await Promise.all([
      this.prisma.allergen.findMany(),
      this.prisma.dietaryTag.findMany(),
    ]);

    const allergenMap = new Map<string, string>();
    allAllergens.forEach((a) => {
      allergenMap.set(a.id.toLowerCase(), a.id);
      allergenMap.set(a.name.toLowerCase(), a.id);
    });

    const tagMap = new Map<string, string>();
    allTags.forEach((t) => {
      tagMap.set(t.id.toLowerCase(), t.id);
      tagMap.set(t.name.toLowerCase(), t.id);
    });

    const errors: Array<{ row: number; email?: string; error: string }> = [];
    let imported = 0;
    const seenEmailsInBatch = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 1;

      const name = (row.name || '').trim();
      const rawEmail = (row.email || '').trim();

      if (!name) {
        errors.push({ row: rowNum, error: 'Name is required' });
        continue;
      }
      if (!rawEmail) {
        errors.push({ row: rowNum, error: 'Email is required' });
        continue;
      }

      const email = normalizeEmail(rawEmail);
      if (!isValidEmail(email)) {
        errors.push({ row: rowNum, email, error: `Invalid email address: "${rawEmail}"` });
        continue;
      }

      if (seenEmailsInBatch.has(email)) {
        errors.push({ row: rowNum, email, error: `Duplicate email in import file: "${email}"` });
        continue;
      }

      const existingInDb = await this.prisma.employee.findUnique({
        where: { email },
      });
      if (existingInDb) {
        errors.push({ row: rowNum, email, error: `Email "${email}" is already registered in system` });
        continue;
      }

      seenEmailsInBatch.add(email);

      // Parse booleans
      const parseBool = (v: any) =>
        v === true || v === 'true' || v === '1' || v === 'yes' || v === 'y';
      const canChooseAddress = parseBool(row.canchooseaddress ?? row.canChooseAddress);
      const canChangeTime = parseBool(row.canchangetime ?? row.canChangeTime);
      const canChangePackaging = parseBool(row.canchangepackaging ?? row.canChangePackaging);
      const phone = (row.phone || '').trim() || null;

      // Parse allergens & tags
      const parseList = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map((x) => String(x).trim().toLowerCase());
        return String(val)
          .split(/[;,]/)
          .map((x) => x.trim().toLowerCase())
          .filter((x) => x.length > 0);
      };

      const rawAllergenList = parseList(row.allergens);
      const allergenIds = rawAllergenList
        .map((a) => allergenMap.get(a))
        .filter((id): id is string => Boolean(id));

      const rawTagList = parseList(row.dietarytags ?? row.dietaryTags);
      const dietaryTagIds = rawTagList
        .map((t) => tagMap.get(t))
        .filter((id): id is string => Boolean(id));

      try {
        await this.prisma.employee.create({
          data: {
            companyId,
            name,
            email,
            phone,
            canChooseAddress,
            canChangeTime,
            canChangePackaging,
            active: true,
            allergens: allergenIds.length
              ? { create: allergenIds.map((allergenId) => ({ allergenId })) }
              : undefined,
            dietaryTags: dietaryTagIds.length
              ? { create: dietaryTagIds.map((tagId) => ({ tagId })) }
              : undefined,
          },
        });
        imported++;
      } catch (err: any) {
        errors.push({
          row: rowNum,
          email,
          error: err?.message || 'Failed to save employee',
        });
      }
    }

    return {
      total: rawRows.length,
      imported,
      errorCount: errors.length,
      errors,
    };
  }
}
