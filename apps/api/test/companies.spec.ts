import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompaniesService } from '../src/companies/companies.service';
import { DomainError } from '../src/common/domain-error';
import { ERRORS } from '@repo/shared';
import { HttpStatus } from '@nestjs/common';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      company: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      priceTier: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      employee: {
        findUnique: vi.fn(),
      },
      companyDomain: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        delete: vi.fn(),
      },
      companyAddress: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      companyHoliday: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new CompaniesService(prisma);
  });

  describe('Company CRUD', () => {
    it('validates required fields on create', async () => {
      await expect(
        service.createCompany({
          name: '',
          billingName: 'Acme Inc',
          billingEmail: 'billing@acme.com',
          billingAddress: '123 Main St',
        }),
      ).rejects.toThrow(DomainError);

      await expect(
        service.createCompany({
          name: 'Acme',
          billingName: '',
          billingEmail: 'billing@acme.com',
          billingAddress: '123 Main St',
        }),
      ).rejects.toThrow(DomainError);

      await expect(
        service.createCompany({
          name: 'Acme',
          billingName: 'Acme Inc',
          billingEmail: 'invalid-email',
          billingAddress: '123 Main St',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects duplicate company name', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme Corp' });

      await expect(
        service.createCompany({
          name: 'Acme Corp',
          billingName: 'Acme Inc',
          billingEmail: 'billing@acme.com',
          billingAddress: '123 Main St',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('creates company with defaults successfully', async () => {
      prisma.company.findUnique.mockResolvedValueOnce(null); // name check
      prisma.company.create.mockResolvedValueOnce({
        id: 'comp-1',
        name: 'Acme Corp',
        billingEmail: 'billing@acme.com',
        workingDays: [1, 2, 3, 4, 5],
        defaultDeliveryTimeMin: 720,
      });

      const result = await service.createCompany({
        name: 'Acme Corp',
        billingName: 'Acme Inc',
        billingEmail: 'Billing@Acme.COM',
        billingAddress: '123 Main St',
      });

      expect(result.id).toBe('comp-1');
      expect(prisma.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Acme Corp',
            billingEmail: 'billing@acme.com',
            workingDays: [1, 2, 3, 4, 5],
            defaultDeliveryTimeMin: 720,
          }),
        }),
      );
    });

    it('soft deletes company on deleteCompany', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', active: true });
      prisma.company.update.mockResolvedValueOnce({ id: 'comp-1', active: false });

      const res = await service.deleteCompany('comp-1');
      expect(res.active).toBe(false);
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { active: false },
      });
    });
  });

  describe('Owner Validation', () => {
    it('rejects setting owner that does not exist', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateCompany('comp-1', { ownerEmployeeId: 'emp-none' }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects setting owner who belongs to another company', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-2',
        name: 'Alice',
        companyId: 'comp-other',
        active: true,
      });

      try {
        await service.updateCompany('comp-1', { ownerEmployeeId: 'emp-2' });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.code).toBe(ERRORS.INVALID_OWNER);
      }
    });

    it('rejects setting inactive employee as owner', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        name: 'Bob',
        companyId: 'comp-1',
        active: false,
      });

      try {
        await service.updateCompany('comp-1', { ownerEmployeeId: 'emp-1' });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.code).toBe(ERRORS.INVALID_OWNER);
      }
    });

    it('allows setting active employee of company as owner', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        name: 'Bob',
        companyId: 'comp-1',
        active: true,
      });
      prisma.company.update.mockResolvedValueOnce({
        id: 'comp-1',
        ownerEmployeeId: 'emp-1',
      });

      const res = await service.updateCompany('comp-1', { ownerEmployeeId: 'emp-1' });
      expect(res.ownerEmployeeId).toBe('emp-1');
    });

    it('allows unsetting owner by passing null', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.company.update.mockResolvedValueOnce({
        id: 'comp-1',
        ownerEmployeeId: null,
      });

      const res = await service.updateCompany('comp-1', { ownerEmployeeId: null });
      expect(res.ownerEmployeeId).toBeNull();
    });
  });

  describe('Company Domains', () => {
    it('rejects public email domains with 422 UNPROCESSABLE_ENTITY', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });

      try {
        await service.addDomain('comp-1', 'gmail.com');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(err.code).toBe(ERRORS.DOMAIN_PUBLIC);
      }

      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      try {
        await service.addDomain('comp-1', '  yahoo.com  ');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(err.code).toBe(ERRORS.DOMAIN_PUBLIC);
      }
    });

    it('rejects domain claimed by another company with 409 CONFLICT', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.companyDomain.findUnique.mockResolvedValueOnce({
        domain: 'acme.com',
        companyId: 'comp-other',
      });

      try {
        await service.addDomain('comp-1', 'acme.com');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainError);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.code).toBe(ERRORS.DOMAIN_TAKEN);
      }
    });

    it('adds valid unique domain successfully in lowercase', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.companyDomain.findUnique.mockResolvedValueOnce(null);
      prisma.companyDomain.create.mockResolvedValueOnce({
        domain: 'acme.com',
        companyId: 'comp-1',
      });

      const res = await service.addDomain('comp-1', '  @Acme.COM  ');
      expect(res.domain).toBe('acme.com');
      expect(prisma.companyDomain.create).toHaveBeenCalledWith({
        data: { domain: 'acme.com', companyId: 'comp-1' },
      });
    });

    it('removes domain successfully', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1', name: 'Acme' });
      prisma.companyDomain.findFirst.mockResolvedValueOnce({
        domain: 'acme.com',
        companyId: 'comp-1',
      });
      prisma.companyDomain.delete.mockResolvedValueOnce({});

      const res = await service.removeDomain('comp-1', 'acme.com');
      expect(res.ok).toBe(true);
      expect(prisma.companyDomain.delete).toHaveBeenCalledWith({
        where: { domain: 'acme.com' },
      });
    });
  });

  describe('Company Addresses', () => {
    it('sets first address as default automatically', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1' });
      prisma.companyAddress.count.mockResolvedValueOnce(0); // 0 active addresses
      prisma.companyAddress.create.mockResolvedValueOnce({
        id: 'addr-1',
        label: 'HQ',
        isDefault: true,
      });

      const res = await service.addAddress('comp-1', {
        label: 'HQ',
        line1: '100 Market St',
        city: 'San Francisco',
        postcode: '94105',
        isDefault: false,
      });

      expect(res.isDefault).toBe(true);
      expect(prisma.companyAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: true,
          }),
        }),
      );
    });

    it('unsets prior default address when new default address is added', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1' });
      prisma.companyAddress.count.mockResolvedValueOnce(2);
      prisma.companyAddress.create.mockResolvedValueOnce({
        id: 'addr-2',
        label: 'Branch',
        isDefault: true,
      });

      await service.addAddress('comp-1', {
        label: 'Branch',
        line1: '200 Mission St',
        city: 'San Francisco',
        postcode: '94105',
        isDefault: true,
      });

      expect(prisma.companyAddress.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'comp-1' },
        data: { isDefault: false },
      });
    });
  });

  describe('Holidays & Calendar', () => {
    it('adds and formats company holidays with date string YYYY-MM-DD', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1' });
      prisma.companyHoliday.upsert.mockResolvedValueOnce({
        id: 'hol-1',
        companyId: 'comp-1',
        date: new Date('2026-12-25T00:00:00.000Z'),
        name: 'Christmas',
      });

      const res = await service.addHoliday('comp-1', {
        date: '2026-12-25',
        name: 'Christmas',
      });

      expect(res.date).toBe('2026-12-25');
      expect(res.name).toBe('Christmas');
    });

    it('rejects invalid holiday date strings', async () => {
      prisma.company.findUnique.mockResolvedValueOnce({ id: 'comp-1' });

      await expect(
        service.addHoliday('comp-1', {
          date: '25-12-2026',
          name: 'Christmas',
        }),
      ).rejects.toThrow(DomainError);
    });
  });
});
