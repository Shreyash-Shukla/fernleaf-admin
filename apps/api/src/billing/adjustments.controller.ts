// ─── Adjustments Controller ──────────────────────────────────────

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

@Controller('adjustments')
export class AdjustmentsController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * GET /adjustments
   * List adjustments with optional companyId, orderId, or status filters.
   */
  @Get()
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async listAdjustments(
    @Query('companyId') companyId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
  ) {
    return this.billingService.listAdjustments({ companyId, orderId, status });
  }

  /**
   * POST /adjustments
   * Create a manual or short-delivery adjustment.
   */
  @Post()
  @RequirePermissions(PERMISSIONS.BILLING_WRITE)
  async createAdjustment(@Body() body: any, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.billingService.createAdjustment(body, actor);
  }

  /**
   * GET /adjustments/:id
   * Detail of a single adjustment.
   */
  @Get(':id')
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  async getAdjustment(@Param('id') id: string) {
    return this.billingService.getAdjustment(id);
  }
}
