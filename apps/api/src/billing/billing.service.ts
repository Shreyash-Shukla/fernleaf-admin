// ─── Billing Service ─────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ERRORS,
  dbDateToString,
  formatInvoiceNumber,
  parseInvoiceNumber,
  calculateInvoiceTotal,
  CreateInvoiceInput,
  CreateAdjustmentInput,
  UnbilledOrdersResponse,
  UnbilledDateGroup,
} from '@repo/shared';
import { DomainError } from '../common/domain-error';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Unbilled Orders ──────────────────────────────────────────

  /**
   * GET /billing/companies/:id/unbilled
   * Returns confirmed/delivered orders where invoiceId IS NULL,
   * grouped by delivery date with totals and open adjustments.
   */
  async getUnbilledOrders(companyId: string): Promise<UnbilledOrdersResponse> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw DomainError.notFound(
        ERRORS.COMPANY_NOT_FOUND,
        `Company "${companyId}" not found`,
      );
    }

    const [orders, openAdjustments] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          companyId,
          status: { in: ['CONFIRMED', 'DELIVERED'] },
          invoiceId: null,
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          lines: {
            include: {
              combinations: true,
            },
          },
        },
        orderBy: [
          { deliveryDate: 'asc' },
          { deliveryTimeMin: 'asc' },
          { number: 'asc' },
        ],
      }),
      this.prisma.adjustment.findMany({
        where: {
          companyId,
          status: 'OPEN',
        },
        include: {
          order: {
            select: { id: true, number: true, deliveryDate: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Group orders by delivery date
    const groupMap = new Map<string, UnbilledDateGroup>();
    let totalMealsCount = 0;

    for (const order of orders) {
      const dateKey = dbDateToString(order.deliveryDate);
      const mealsCount = order.lines.reduce(
        (acc, line) =>
          acc + line.combinations.reduce((cAcc, c) => cAcc + c.quantity, 0),
        0,
      );
      totalMealsCount += mealsCount;

      let group = groupMap.get(dateKey);
      if (!group) {
        group = {
          deliveryDate: dateKey,
          orderCount: 0,
          mealsCount: 0,
          totalCents: 0,
          orders: [],
        };
        groupMap.set(dateKey, group);
      }

      group.orderCount++;
      group.mealsCount += mealsCount;
      group.totalCents += order.totalCents;
      group.orders.push({
        id: order.id,
        number: order.number,
        deliveryDate: dateKey,
        deliveryTimeMin: order.deliveryTimeMin,
        status: order.status,
        totalCents: order.totalCents,
        employeeId: order.employeeId,
        employeeName: order.employee.name,
        mealsCount,
      });
    }

    const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const adjustmentsTotalCents = openAdjustments.reduce(
      (sum, a) => sum + a.amountCents,
      0,
    );
    const oldestDeliveryDate =
      orders.length > 0 ? dbDateToString(orders[0].deliveryDate) : null;

    return {
      companyId: company.id,
      companyName: company.name,
      totalCents,
      orderCount: orders.length,
      mealsCount: totalMealsCount,
      oldestDeliveryDate,
      byDeliveryDate: Array.from(groupMap.values()),
      openAdjustments: openAdjustments.map((a) => ({
        id: a.id,
        orderId: a.orderId,
        orderNumber: a.order.number,
        reason: a.reason,
        amountCents: a.amountCents,
        status: a.status,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
      })),
      adjustmentsTotalCents,
      netUnbilledCents: totalCents + adjustmentsTotalCents,
    };
  }

  /**
   * GET /billing/unbilled
   * Summary of unbilled orders across all companies.
   */
  async getUnbilledSummary() {
    const companies = await this.prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const summaries = await Promise.all(
      companies.map(async (c) => {
        const [orderAgg, adjAgg, oldestOrder] = await Promise.all([
          this.prisma.order.aggregate({
            where: {
              companyId: c.id,
              status: { in: ['CONFIRMED', 'DELIVERED'] },
              invoiceId: null,
            },
            _sum: { totalCents: true },
            _count: { id: true },
          }),
          this.prisma.adjustment.aggregate({
            where: {
              companyId: c.id,
              status: 'OPEN',
            },
            _sum: { amountCents: true },
            _count: { id: true },
          }),
          this.prisma.order.findFirst({
            where: {
              companyId: c.id,
              status: { in: ['CONFIRMED', 'DELIVERED'] },
              invoiceId: null,
            },
            orderBy: { deliveryDate: 'asc' },
            select: { deliveryDate: true },
          }),
        ]);

        const unbilledCents = orderAgg._sum.totalCents || 0;
        const adjustmentsCents = adjAgg._sum.amountCents || 0;
        const orderCount = orderAgg._count.id;
        const adjustmentCount = adjAgg._count.id;

        return {
          companyId: c.id,
          companyName: c.name,
          orderCount,
          unbilledCents,
          adjustmentCount,
          adjustmentsCents,
          netUnbilledCents: unbilledCents + adjustmentsCents,
          oldestDeliveryDate: oldestOrder
            ? dbDateToString(oldestOrder.deliveryDate)
            : null,
        };
      }),
    );

    return summaries.filter((s) => s.orderCount > 0 || s.adjustmentCount > 0);
  }

  // ─── Create Invoice ───────────────────────────────────────────

  /**
   * POST /invoices
   * Group confirmed/delivered orders into an invoice.
   * Concurrency-safe: conditional atomic update invoiceId IS NULL.
   * 409 if any order is not billable or already invoiced.
   */
  async createInvoice(
    dto: CreateInvoiceInput,
    actor: { id: string; permissions: string[] },
  ) {
    if (!dto.companyId) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'companyId is required',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw DomainError.notFound(
        ERRORS.COMPANY_NOT_FOUND,
        `Company "${dto.companyId}" not found`,
      );
    }

    const orderIds = Array.isArray(dto.orderIds) ? dto.orderIds : [];
    const adjustmentIds = Array.isArray(dto.adjustmentIds)
      ? dto.adjustmentIds
      : [];

    if (orderIds.length === 0 && adjustmentIds.length === 0) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'At least one order or adjustment must be included in the invoice',
      );
    }

    // Pre-flight check on orders
    const orders =
      orderIds.length > 0
        ? await this.prisma.order.findMany({
            where: { id: { in: orderIds } },
            include: {
              employee: { select: { id: true, name: true } },
            },
          })
        : [];

    if (orders.length !== orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missingIds = orderIds.filter((id) => !foundIds.has(id));
      throw DomainError.conflict(
        ERRORS.ORDERS_NOT_BILLABLE,
        `One or more orders do not exist: ${missingIds.join(', ')}`,
      );
    }

    for (const order of orders) {
      if (order.companyId !== dto.companyId) {
        throw DomainError.conflict(
          ERRORS.ORDERS_NOT_BILLABLE,
          `Order #${order.number} does not belong to company "${company.name}"`,
        );
      }
      if (order.status !== 'CONFIRMED' && order.status !== 'DELIVERED') {
        throw DomainError.conflict(
          ERRORS.ORDERS_NOT_BILLABLE,
          `Order #${order.number} in status "${order.status}" is not billable (must be CONFIRMED or DELIVERED)`,
        );
      }
      if (order.invoiceId) {
        throw DomainError.conflict(
          ERRORS.ORDER_ALREADY_INVOICED,
          `Order #${order.number} has already been invoiced`,
        );
      }
    }

    // Pre-flight check on adjustments
    let adjustments: any[] = [];
    if (adjustmentIds.length > 0) {
      adjustments = await this.prisma.adjustment.findMany({
        where: { id: { in: adjustmentIds } },
        include: {
          order: { select: { id: true, number: true } },
        },
      });

      if (adjustments.length !== adjustmentIds.length) {
        throw DomainError.conflict(
          ERRORS.CONFLICT,
          'One or more specified adjustments do not exist',
        );
      }

      for (const adj of adjustments) {
        if (adj.companyId !== dto.companyId) {
          throw DomainError.conflict(
            ERRORS.CONFLICT,
            'Adjustments must belong to the specified company',
          );
        }
        if (adj.status !== 'OPEN') {
          throw DomainError.conflict(
            ERRORS.CONFLICT,
            `Adjustment for Order #${adj.order.number} is already ${adj.status.toLowerCase()}`,
          );
        }
      }
    }

    // Execute atomic creation in transaction
    return this.prisma.$transaction(async (tx) => {
      // Determine next sequential invoice number
      const count = await tx.invoice.count();
      let seq = count + 1;
      let invoiceNumber = formatInvoiceNumber(seq);

      let existingWithNum = await tx.invoice.findUnique({
        where: { number: invoiceNumber },
      });
      while (existingWithNum) {
        seq++;
        invoiceNumber = formatInvoiceNumber(seq);
        existingWithNum = await tx.invoice.findUnique({
          where: { number: invoiceNumber },
        });
      }

      // Build invoice items
      const itemsData: any[] = [];
      for (const order of orders) {
        const dateStr = dbDateToString(order.deliveryDate);
        itemsData.push({
          kind: 'ORDER' as const,
          orderId: order.id,
          description: `Order #${order.number} (${order.employee.name}) - ${dateStr}`,
          amountCents: order.totalCents,
        });
      }

      for (const adj of adjustments) {
        itemsData.push({
          kind: 'ADJUSTMENT' as const,
          adjustmentId: adj.id,
          description:
            adj.note ||
            `Adjustment for Order #${adj.order.number} (${adj.reason})`,
          amountCents: adj.amountCents,
        });
      }

      const totalCents = calculateInvoiceTotal(itemsData);

      // Create invoice record
      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          companyId: dto.companyId,
          status: 'ISSUED',
          totalCents,
          issuedAt: new Date(),
          createdById: actor.id,
          items: {
            create: itemsData,
          },
        },
      });

      // Atomically link orders: must still have invoiceId === null
      if (orderIds.length > 0) {
        const updateRes = await tx.order.updateMany({
          where: {
            id: { in: orderIds },
            companyId: dto.companyId,
            status: { in: ['CONFIRMED', 'DELIVERED'] },
            invoiceId: null,
          },
          data: {
            invoiceId: invoice.id,
          },
        });

        if (updateRes.count !== orderIds.length) {
          throw DomainError.conflict(
            ERRORS.ORDERS_NOT_BILLABLE,
            'One or more orders are not billable or have already been invoiced',
          );
        }
      }

      // Atomically link adjustments: mark as INVOICED
      if (adjustmentIds.length > 0) {
        const adjUpdate = await tx.adjustment.updateMany({
          where: {
            id: { in: adjustmentIds },
            companyId: dto.companyId,
            status: 'OPEN',
          },
          data: {
            status: 'INVOICED',
          },
        });

        if (adjUpdate.count !== adjustmentIds.length) {
          throw DomainError.conflict(
            ERRORS.CONFLICT,
            'One or more adjustments are no longer open',
          );
        }
      }

      const fullInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          company: true,
          items: {
            orderBy: { createdAt: 'asc' },
          },
          orders: {
            include: {
              employee: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ deliveryDate: 'asc' }, { number: 'asc' }],
          },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      return this.formatInvoiceDetail(fullInvoice!);
    });
  }

  // ─── Invoice List ─────────────────────────────────────────────

  /**
   * GET /invoices?companyId&status&page&pageSize&search
   * Paginated invoice list with summary details.
   */
  async listInvoices(query: {
    companyId?: string;
    status?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, query.pageSize || query.limit || 20),
    );
    const where: any = {};

    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      where.issuedAt = {};
      if (query.from) {
        where.issuedAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.issuedAt.lte = new Date(query.to);
      }
    }
    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          company: { select: { id: true, name: true } },
          _count: {
            select: { orders: true, items: true },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        companyId: inv.companyId,
        companyName: inv.company.name,
        status: inv.status,
        totalCents: inv.totalCents,
        issuedAt: inv.issuedAt.toISOString(),
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
        createdById: inv.createdById,
        orderCount: inv._count.orders,
        itemsCount: inv._count.items,
        createdAt: inv.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Invoice Detail ───────────────────────────────────────────

  /**
   * GET /invoices/:id
   * Detail of invoice with orders, items and company info.
   */
  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { number: id }],
      },
      include: {
        company: true,
        items: {
          orderBy: { createdAt: 'asc' },
        },
        orders: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ deliveryDate: 'asc' }, { number: 'asc' }],
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invoice) {
      throw DomainError.notFound(
        ERRORS.INVOICE_NOT_FOUND,
        `Invoice "${id}" not found`,
      );
    }

    return this.formatInvoiceDetail(invoice);
  }

  // ─── Mark Paid ────────────────────────────────────────────────

  /**
   * POST /invoices/:id/pay
   * Marks invoice status as PAID and sets paidAt timestamp.
   */
  async markPaid(
    invoiceId: string,
    actor: { id: string; permissions: string[] },
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw DomainError.notFound(
        ERRORS.INVOICE_NOT_FOUND,
        `Invoice "${invoiceId}" not found`,
      );
    }

    if (invoice.status === 'PAID') {
      throw DomainError.conflict(
        ERRORS.INVOICE_ALREADY_PAID,
        `Invoice "${invoice.number}" has already been paid`,
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: {
        company: true,
        items: {
          orderBy: { createdAt: 'asc' },
        },
        orders: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ deliveryDate: 'asc' }, { number: 'asc' }],
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return this.formatInvoiceDetail(updated);
  }

  // ─── Adjustments ──────────────────────────────────────────────

  /**
   * GET /adjustments
   * List adjustments with optional companyId, orderId, or status filters.
   */
  async listAdjustments(query: {
    companyId?: string;
    orderId?: string;
    status?: string;
  }) {
    const where: any = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.orderId) where.orderId = query.orderId;
    if (query.status) where.status = query.status;

    const adjustments = await this.prisma.adjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            number: true,
            deliveryDate: true,
            status: true,
            employee: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return adjustments.map((a) => ({
      id: a.id,
      companyId: a.companyId,
      companyName: a.company.name,
      orderId: a.orderId,
      orderNumber: a.order.number,
      orderDeliveryDate: dbDateToString(a.order.deliveryDate),
      orderStatus: a.order.status,
      employeeName: a.order.employee?.name,
      reason: a.reason,
      amountCents: a.amountCents,
      status: a.status,
      note: a.note,
      createdById: a.createdById,
      createdByName: a.createdBy?.name,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  /**
   * POST /adjustments
   * Create a manual or short-delivery adjustment.
   */
  async createAdjustment(
    dto: CreateAdjustmentInput,
    actor: { id: string; permissions: string[] },
  ) {
    if (!dto.companyId || !dto.orderId) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'companyId and orderId are required',
      );
    }

    if (
      typeof dto.amountCents !== 'number' ||
      dto.amountCents === 0 ||
      !Number.isInteger(dto.amountCents)
    ) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'amountCents must be a non-zero integer',
      );
    }

    const validReasons = ['CANCELLED_AFTER_INVOICE', 'SHORT_DELIVERY', 'MANUAL'];
    if (!validReasons.includes(dto.reason)) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        `reason must be one of: ${validReasons.join(', ')}`,
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw DomainError.notFound(ERRORS.COMPANY_NOT_FOUND, 'Company not found');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw DomainError.notFound(ERRORS.ORDER_NOT_FOUND, 'Order not found');
    }
    if (order.companyId !== dto.companyId) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Order does not belong to the specified company',
      );
    }

    const adjustment = await this.prisma.adjustment.create({
      data: {
        companyId: dto.companyId,
        orderId: dto.orderId,
        reason: dto.reason,
        amountCents: dto.amountCents,
        status: 'OPEN',
        note: dto.note?.trim() || null,
        createdById: actor.id,
      },
      include: {
        company: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            number: true,
            deliveryDate: true,
            status: true,
            employee: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: adjustment.id,
      companyId: adjustment.companyId,
      companyName: adjustment.company.name,
      orderId: adjustment.orderId,
      orderNumber: adjustment.order.number,
      orderDeliveryDate: dbDateToString(adjustment.order.deliveryDate),
      orderStatus: adjustment.order.status,
      employeeName: adjustment.order.employee?.name,
      reason: adjustment.reason,
      amountCents: adjustment.amountCents,
      status: adjustment.status,
      note: adjustment.note,
      createdById: adjustment.createdById,
      createdByName: adjustment.createdBy?.name,
      createdAt: adjustment.createdAt.toISOString(),
      updatedAt: adjustment.updatedAt.toISOString(),
    };
  }

  /**
   * GET /adjustments/:id
   * Detail of a single adjustment.
   */
  async getAdjustment(id: string) {
    const adjustment = await this.prisma.adjustment.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            number: true,
            deliveryDate: true,
            status: true,
            employee: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!adjustment) {
      throw DomainError.notFound(
        ERRORS.NOT_FOUND,
        `Adjustment "${id}" not found`,
      );
    }

    return {
      id: adjustment.id,
      companyId: adjustment.companyId,
      companyName: adjustment.company.name,
      orderId: adjustment.orderId,
      orderNumber: adjustment.order.number,
      orderDeliveryDate: dbDateToString(adjustment.order.deliveryDate),
      orderStatus: adjustment.order.status,
      employeeName: adjustment.order.employee?.name,
      reason: adjustment.reason,
      amountCents: adjustment.amountCents,
      status: adjustment.status,
      note: adjustment.note,
      createdById: adjustment.createdById,
      createdByName: adjustment.createdBy?.name,
      createdAt: adjustment.createdAt.toISOString(),
      updatedAt: adjustment.updatedAt.toISOString(),
    };
  }

  // ─── Formatters ───────────────────────────────────────────────

  private formatInvoiceDetail(invoice: any) {
    return {
      id: invoice.id,
      number: invoice.number,
      companyId: invoice.companyId,
      company: {
        id: invoice.company.id,
        name: invoice.company.name,
        billingName: invoice.company.billingName,
        billingEmail: invoice.company.billingEmail,
        billingPhone: invoice.company.billingPhone,
        billingAddress: invoice.company.billingAddress,
      },
      status: invoice.status,
      totalCents: invoice.totalCents,
      issuedAt: invoice.issuedAt.toISOString(),
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      createdById: invoice.createdById,
      createdBy: invoice.createdBy
        ? {
            id: invoice.createdBy.id,
            name: invoice.createdBy.name,
            email: invoice.createdBy.email,
          }
        : null,
      items: invoice.items.map((item: any) => ({
        id: item.id,
        kind: item.kind,
        orderId: item.orderId,
        adjustmentId: item.adjustmentId,
        description: item.description,
        amountCents: item.amountCents,
      })),
      orders: invoice.orders.map((order: any) => ({
        id: order.id,
        number: order.number,
        deliveryDate: dbDateToString(order.deliveryDate),
        deliveryTimeMin: order.deliveryTimeMin,
        status: order.status,
        totalCents: order.totalCents,
        employeeId: order.employeeId,
        employeeName: order.employee?.name,
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}
