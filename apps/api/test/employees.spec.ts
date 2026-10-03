import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmployeesService } from '../src/employees/employees.service';
import { DomainError } from '../src/common/domain-error';
import { ERRORS } from '@repo/shared';
import { HttpStatus } from '@nestjs/common';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      employee: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      company: {
        findUnique: vi.fn(),
      },
      order: {
        count: vi.fn(),
      },
      employeeAllergen: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      employeeDietaryTag: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      allergen: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'all-1', name: 'Dairy' },
          { id: 'all-2', name: 'Gluten' },
        ]),
      },
      dietaryTag: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'tag-1', name: 'Vegetarian' },
          { id: 'tag-2', name: 'Vegan' },
        ]),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new EmployeesService(prisma);
  });

  describe('Employee Creation', () => {
    it('validates required fields on create', async () => {
      await expect(
        service.createEmployee({
          companyId: '',
          name: 'John',
          email: 'john@example.com',
        }),
      ).rejects.toThrow(DomainError);

      await expect(
        service.createEmployee({
          companyId: 'comp-1',
          name: '',
          email: 'john@example.com',
        }),
      ).rejects.toThrow(DomainError);

      await expect(
        service.createEmployee({
          companyId: 'comp-1',
          name: 'John',
          email: 'not-an-email',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects employee for non-existent company with 404', async () => {
      prisma.company.findUnique.mockResolvedValueOnce(null);

      try {
        await service.createEmployee({
          companyId: 'non-existent',
          name: 'John',
          email: 'john@example.com',
        });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(err.code).toBe(ERRORS.COMPANY_NOT_FOUND);
      }
    });

    it('rejects employee for inactive company', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({
        id: 'comp-1',
        name: 'Acme',
        active: false,
      });

      await expect(
        service.createEmployee({
          companyId: 'comp-1',
          name: 'John',
          email: 'john@example.com',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects duplicate employee email with 409 CONFLICT', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({
        id: 'comp-1',
        name: 'Acme',
        active: true,
      });
      prisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        email: 'john@example.com',
      });

      try {
        await service.createEmployee({
          companyId: 'comp-1',
          name: 'John',
          email: 'john@example.com',
        });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.code).toBe(ERRORS.EMPLOYEE_EMAIL_TAKEN);
      }
    });

    it('creates employee and stores email in lowercase', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({
        id: 'comp-1',
        name: 'Acme',
        active: true,
      });
      prisma.employee.findUnique.mockResolvedValueOnce(null);
      prisma.employee.create.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: 'comp-1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        canChooseAddress: true,
        canChangeTime: false,
        canChangePackaging: true,
        active: true,
        allergens: [],
        dietaryTags: [],
      });

      const res = await service.createEmployee({
        companyId: 'comp-1',
        name: 'John Doe',
        email: 'John.Doe@Example.COM',
        canChooseAddress: true,
        canChangePackaging: true,
      });

      expect(res.id).toBe('emp-1');
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'john.doe@example.com',
            canChooseAddress: true,
            canChangeTime: false,
            canChangePackaging: true,
          }),
        }),
      );
    });
  });

  describe('Employee Move Rules', () => {
    it('blocks moving employee when DRAFT or PLACED orders exist', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: 'comp-1',
        email: 'emp@acme.com',
      });
      prisma.order.count.mockResolvedValueOnce(2); // 2 open orders

      try {
        await service.updateEmployee('emp-1', { companyId: 'comp-2' });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.code).toBe(ERRORS.EMPLOYEE_HAS_OPEN_ORDERS);
      }
    });

    it('allows moving employee when 0 open orders exist', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: 'comp-1',
        email: 'emp@acme.com',
      });
      prisma.order.count.mockResolvedValueOnce(0); // 0 open orders
      prisma.company.findUnique.mockResolvedValueOnce({
        id: 'comp-2',
        name: 'New Company',
        active: true,
      });
      prisma.employee.update.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: 'comp-2',
        name: 'Employee One',
        email: 'emp@acme.com',
        allergens: [],
        dietaryTags: [],
      });

      const res = await service.updateEmployee('emp-1', { companyId: 'comp-2' });
      expect(res.companyId).toBe('comp-2');
      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'comp-2' }),
        }),
      );
    });

    it('rejects moving employee to non-existent company', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        companyId: 'comp-1',
        email: 'emp@acme.com',
      });
      prisma.order.count.mockResolvedValueOnce(0);
      prisma.company.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateEmployee('emp-1', { companyId: 'comp-missing' }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('CSV Bulk Import', () => {
    it('imports valid CSV rows and reports row errors without rejecting whole file', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({
        id: 'comp-1',
        name: 'Acme',
        active: true,
      });

      // row 1: valid
      // row 2: invalid email
      // row 3: valid with allergens and dietary tags
      // row 4: missing name
      prisma.employee.findUnique
        .mockResolvedValueOnce(null) // row 1
        .mockResolvedValueOnce(null); // row 3
      prisma.employee.create.mockResolvedValue({});

      const csv = `name,email,phone,canChooseAddress,canChangeTime,canChangePackaging,allergens,dietaryTags
Alice,alice@acme.com,123456,true,false,true,Dairy,Vegetarian
Bob,invalid-email,234567,false,false,false,,
Charlie,charlie@acme.com,,false,true,false,Gluten,Vegan
,missingname@acme.com,,,,,,`;

      const res = await service.importEmployees('comp-1', { csvText: csv });

      expect(res.total).toBe(4);
      expect(res.imported).toBe(2);
      expect(res.errorCount).toBe(2);
      expect(res.errors[0].row).toBe(2);
      expect(res.errors[1].row).toBe(4);
    });
  });
});
