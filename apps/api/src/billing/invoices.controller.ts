// ─── Invoices Controller ─────────────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * POST /invoices
   * Group confirmed/delivered orders into an invoice.
   */
  @Post()
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  async createInvoice(@Body() body: any, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.billingService.createInvoice(body, actor);
  }

  /**
   * GET /invoices
   * Paginated invoice list with filters.
   */
  @Get()
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async listInvoices(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.listInvoices({
      companyId,
      status,
      from,
      to,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /invoices/:id
   * Invoice detail with line items and orders.
   */
  @Get(':id')
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async getInvoice(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }

  /**
   * POST /invoices/:id/pay
   * Mark invoice as paid.
   */
  @Post(':id/pay')
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  async markPaid(@Param('id') id: string, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.billingService.markPaid(id, actor);
  }
}
