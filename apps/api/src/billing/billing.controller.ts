// ─── Billing Controller ──────────────────────────────────────────

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

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * GET /billing/companies/:id/unbilled
   * Returns confirmed/delivered orders where invoiceId IS NULL,
   * grouped by delivery date with totals and open adjustments.
   */
  @Get('companies/:id/unbilled')
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async getUnbilledOrders(@Param('id') id: string) {
    return this.billingService.getUnbilledOrders(id);
  }

  /**
   * GET /billing/unbilled
   * Overview of all unbilled orders across all companies.
   */
  @Get('unbilled')
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async getUnbilledSummary() {
    return this.billingService.getUnbilledSummary();
  }

  // ─── Aliases under /billing for frontend convenience ───────────

  @Get('invoices')
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

  @Post('invoices')
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  async createInvoice(@Body() body: any, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.billingService.createInvoice(body, actor);
  }

  @Get('invoices/:id')
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async getInvoice(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }

  @Post('invoices/:id/pay')
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  async markPaid(@Param('id') id: string, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.billingService.markPaid(id, actor);
  }

  @Get('adjustments')
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async listAdjustments(
    @Query('companyId') companyId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
  ) {
    return this.billingService.listAdjustments({ companyId, orderId, status });
  }
}
