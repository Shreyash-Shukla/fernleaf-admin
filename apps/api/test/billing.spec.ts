import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from '../src/billing/billing.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DomainError } from '../src/common/domain-error';
import { ERRORS } from '@repo/shared';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      company: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        aggregate: vi.fn(),
      },
      invoice: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      adjustment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        aggregate: vi.fn(),
      },
      $transaction: vi.fn((fn: any) => fn(prisma)),
    };
    service = new BillingService(prisma as unknown as PrismaService);
  });

  describe('getUnbilledOrders', () => {
    it('throws 404 if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      await expect(service.getUnbilledOrders('comp-none')).rejects.toThrow(DomainError);
    });

    it('returns grouped unbilled orders with totals and open adjustments', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Acme Corp' });
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          number: 101,
          deliveryDate: new Date('2026-10-12T00:00:00Z'),
          deliveryTimeMin: 720,
          status: 'CONFIRMED',
          totalCents: 2500,
          employeeId: 'emp-1',
          employee: { name: 'Alice' },
          lines: [
            { combinations: [{ quantity: 1 }, { quantity: 1 }] },
          ],
        },
        {
          id: 'ord-2',
          number: 102,
          deliveryDate: new Date('2026-10-12T00:00:00Z'),
          deliveryTimeMin: 720,
          status: 'DELIVERED',
          totalCents: 1500,
          employeeId: 'emp-2',
          employee: { name: 'Bob' },
          lines: [
            { combinations: [{ quantity: 1 }] },
          ],
        },
      ]);
      prisma.adjustment.findMany.mockResolvedValue([
        {
          id: 'adj-1',
          orderId: 'ord-old',
          order: { number: 99, deliveryDate: new Date('2026-10-05T00:00:00Z') },
          reason: 'CANCELLED_AFTER_INVOICE',
          amountCents: -1200,
          status: 'OPEN',
          note: 'Credit for cancelled order',
          createdAt: new Date('2026-10-06T10:00:00Z'),
        },
      ]);

      const result = await service.getUnbilledOrders('comp-1');

      expect(result.companyId).toBe('comp-1');
      expect(result.companyName).toBe('Acme Corp');
      expect(result.totalCents).toBe(4000);
      expect(result.orderCount).toBe(2);
      expect(result.mealsCount).toBe(3);
      expect(result.oldestDeliveryDate).toBe('2026-10-12');
      expect(result.byDeliveryDate).toHaveLength(1);
      expect(result.byDeliveryDate[0].orderCount).toBe(2);
      expect(result.byDeliveryDate[0].mealsCount).toBe(3);
      expect(result.byDeliveryDate[0].totalCents).toBe(4000);
      expect(result.openAdjustments).toHaveLength(1);
      expect(result.adjustmentsTotalCents).toBe(-1200);
      expect(result.netUnbilledCents).toBe(2800);
    });
  });

  describe('createInvoice', () => {
    it('throws validation error if orderIds and adjustmentIds are both empty', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Acme Corp' });
      await expect(
        service.createInvoice(
          { companyId: 'comp-1', orderIds: [] },
          { id: 'usr-1', permissions: ['*'] },
        ),
      ).rejects.toThrow(DomainError);
    });

    it('throws 409 if an order belongs to another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Acme Corp' });
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          number: 101,
          companyId: 'comp-2', // Different company
          status: 'CONFIRMED',
          totalCents: 2000,
          employee: { name: 'Alice' },
        },
      ]);

      await expect(
        service.createInvoice(
          { companyId: 'comp-1', orderIds: ['ord-1'] },
          { id: 'usr-1', permissions: ['*'] },
        ),
      ).rejects.toThrow(DomainError);
    });

    it('throws 409 if order is not billable (e.g. DRAFT or CANCELLED)', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Acme Corp' });
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          number: 101,
          companyId: 'comp-1',
          status: 'PLACED', // PLACED is not billable until CONFIRMED/DELIVERED
          totalCents: 2000,
          employee: { name: 'Alice' },
        },
      ]);

      await expect(
        service.createInvoice(
          { companyId: 'comp-1', orderIds: ['ord-1'] },
          { id: 'usr-1', permissions: ['*'] },
        ),
      ).rejects.toThrow(DomainError);
    });

    it('throws 409 if order is already invoiced', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Acme Corp' });
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          number: 101,
          companyId: 'comp-1',
          status: 'CONFIRMED',
          invoiceId: 'inv-prev',
          totalCents: 2000,
          employee: { name: 'Alice' },
        },
      ]);

      await expect(
        service.createInvoice(
          { companyId: 'comp-1', orderIds: ['ord-1'] },
          { id: 'usr-1', permissions: ['*'] },
        ),
      ).rejects.toThrow(DomainError);
    });

    it('creates invoice and calculates total equal to sum of orders', async () => {
      prisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        name: 'Acme Corp',
        billingName: 'Acme Accounts',
        billingEmail: 'billing@acme.com',
        billingAddress: '123 Tech Park',
      });
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          number: 101,
          companyId: 'comp-1',
          status: 'CONFIRMED',
          invoiceId: null,
          totalCents: 2500,
          deliveryDate: new Date('2026-10-12T00:00:00Z'),
          employee: { id: 'emp-1', name: 'Alice', email: 'alice@acme.com' },
        },
        {
          id: 'ord-2',
          number: 102,
          companyId: 'comp-1',
          status: 'DELIVERED',
          invoiceId: null,
          totalCents: 1500,
          deliveryDate: new Date('2026-10-12T00:00:00Z'),
          employee: { id: 'emp-2', name: 'Bob', email: 'bob@acme.com' },
        },
      ]);
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.findUnique
        .mockResolvedValueOnce(null) // check for invoiceNumber uniqueness
        .mockResolvedValueOnce({
          id: 'inv-1',
          number: 'INV-000001',
          companyId: 'comp-1',
          company: {
            id: 'comp-1',
            name: 'Acme Corp',
            billingName: 'Acme Accounts',
            billingEmail: 'billing@acme.com',
            billingAddress: '123 Tech Park',
          },
          status: 'ISSUED',
          totalCents: 4000,
          issuedAt: new Date('2026-10-12T10:00:00Z'),
          paidAt: null,
          createdById: 'usr-1',
          createdBy: { id: 'usr-1', name: 'Admin', email: 'admin@test.com' },
          items: [
            {
              id: 'item-1',
              kind: 'ORDER',
              orderId: 'ord-1',
              description: 'Order #101',
              amountCents: 2500,
            },
            {
              id: 'item-2',
              kind: 'ORDER',
              orderId: 'ord-2',
              description: 'Order #102',
              amountCents: 1500,
            },
          ],
          orders: [
            {
              id: 'ord-1',
              number: 101,
              deliveryDate: new Date('2026-10-12T00:00:00Z'),
              deliveryTimeMin: 720,
              status: 'CONFIRMED',
              totalCents: 2500,
              employeeId: 'emp-1',
              employee: { name: 'Alice' },
            },
            {
              id: 'ord-2',
              number: 102,
              deliveryDate: new Date('2026-10-12T00:00:00Z'),
              deliveryTimeMin: 720,
              status: 'DELIVERED',
              totalCents: 1500,
              employeeId: 'emp-2',
              employee: { name: 'Bob' },
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', number: 'INV-000001' });
      prisma.order.updateMany.mockResolvedValue({ count: 2 });

      const invoice = await service.createInvoice(
        { companyId: 'comp-1', orderIds: ['ord-1', 'ord-2'] },
        { id: 'usr-1', permissions: ['*'] },
      );

      expect(invoice.id).toBe('inv-1');
      expect(invoice.totalCents).toBe(4000);
      expect(invoice.status).toBe('ISSUED');
      expect(invoice.items).toHaveLength(2);
      expect(invoice.orders).toHaveLength(2);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['ord-1', 'ord-2'] },
          companyId: 'comp-1',
          status: { in: ['CONFIRMED', 'DELIVERED'] },
          invoiceId: null,
        },
        data: {
          invoiceId: 'inv-1',
        },
      });
    });
  });

  describe('markPaid', () => {
    it('throws 404 if invoice not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(
        service.markPaid('inv-none', { id: 'usr-1', permissions: ['*'] }),
      ).rejects.toThrow(DomainError);
    });

    it('throws 409 if invoice is already paid', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        number: 'INV-000001',
        status: 'PAID',
      });

      await expect(
        service.markPaid('inv-1', { id: 'usr-1', permissions: ['*'] }),
      ).rejects.toThrow(DomainError);
    });

    it('marks invoice as paid and sets paidAt timestamp', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        number: 'INV-000001',
        status: 'ISSUED',
      });
      prisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        number: 'INV-000001',
        companyId: 'comp-1',
        company: { id: 'comp-1', name: 'Acme Corp' },
        status: 'PAID',
        totalCents: 4000,
        issuedAt: new Date('2026-10-12T10:00:00Z'),
        paidAt: new Date('2026-10-12T12:00:00Z'),
        createdById: 'usr-1',
        items: [],
        orders: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await service.markPaid('inv-1', { id: 'usr-1', permissions: ['*'] });
      expect(updated.status).toBe('PAID');
      expect(updated.paidAt).toBeTruthy();
    });
  });

  describe('adjustments', () => {
    it('creates manual adjustment for an order', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Acme Corp' });
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        companyId: 'comp-1',
        number: 101,
        deliveryDate: new Date('2026-10-12T00:00:00Z'),
      });
      prisma.adjustment.create.mockResolvedValue({
        id: 'adj-1',
        companyId: 'comp-1',
        company: { name: 'Acme Corp' },
        orderId: 'ord-1',
        order: {
          id: 'ord-1',
          number: 101,
          deliveryDate: new Date('2026-10-12T00:00:00Z'),
          status: 'DELIVERED',
          employee: { name: 'Alice' },
        },
        reason: 'SHORT_DELIVERY',
        amountCents: -500,
        status: 'OPEN',
        note: 'Missing drink',
        createdById: 'usr-1',
        createdBy: { name: 'Admin' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const adj = await service.createAdjustment(
        {
          companyId: 'comp-1',
          orderId: 'ord-1',
          reason: 'SHORT_DELIVERY',
          amountCents: -500,
          note: 'Missing drink',
        },
        { id: 'usr-1', permissions: ['*'] },
      );

      expect(adj.id).toBe('adj-1');
      expect(adj.amountCents).toBe(-500);
      expect(adj.status).toBe('OPEN');
    });

    it('rejects invalid adjustment amount (zero or non-integer)', async () => {
      await expect(
        service.createAdjustment(
          {
            companyId: 'comp-1',
            orderId: 'ord-1',
            reason: 'SHORT_DELIVERY',
            amountCents: 0,
          },
          { id: 'usr-1', permissions: ['*'] },
        ),
      ).rejects.toThrow(DomainError);
    });
  });
});
