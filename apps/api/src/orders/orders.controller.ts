// ─── Orders Controller ──────────────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders/preview
   * Run validation + pricing without persisting. Returns breakdown + errors.
   */
  @Post('preview')
  @RequirePermissions(PERMISSIONS.ORDERS_WRITE)
  async preview(@Body() body: any, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.ordersService.preview(body, actor);
  }

  /**
   * POST /orders
   * Create a draft order (saves draftPayload JSON).
   */
  @Post()
  @RequirePermissions(PERMISSIONS.ORDERS_WRITE)
  async createDraft(@Body() body: any, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.ordersService.createDraft(body, actor);
  }

  /**
   * GET /orders
   * Paginated, filterable order list.
   */
  @Get()
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  async list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string | string[],
    @Query('companyId') companyId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('invoiced') invoiced?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: string,
  ) {
    const statusArr = status
      ? Array.isArray(status)
        ? status
        : [status]
      : undefined;

    return this.ordersService.listOrders({
      from,
      to,
      status: statusArr,
      companyId,
      employeeId,
      invoiced,
      q,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      sort,
    });
  }

  /**
   * GET /orders/:id
   * Full order detail with lines, combinations, options, money, locked flag, actions.
   */
  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  /**
   * POST /orders/:id/place
   * Validate fully, create snapshot rows, transition DRAFT → PLACED.
   */
  @Post(':id/place')
  @RequirePermissions(PERMISSIONS.ORDERS_WRITE)
  async placeOrder(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    // Body is optional: if empty, uses the draft payload
    const input = body && Object.keys(body).length > 0 ? body : null;
    return this.ordersService.placeOrder(id, input, actor);
  }

  /**
   * PUT /orders/:id
   * Edit draft (updates payload) or placed order (re-validates, re-prices, replaces rows).
   */
  @Put(':id')
  @RequirePermissions(PERMISSIONS.ORDERS_WRITE)
  async editOrder(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.ordersService.editOrder(id, body, actor, body.version);
  }

  /**
   * POST /orders/:id/cancel
   * Cancel draft/placed (before cut-off, or admin anytime).
   * If invoiced → creates Adjustment.
   */
  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDERS_WRITE)
  async cancelOrder(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.ordersService.cancelOrder(id, actor, body?.reason);
  }

  /**
   * POST /orders/:id/reject
   * Admin only. Reason required. Terminal, non-billable.
   */
  @Post(':id/reject')
  @RequirePermissions(PERMISSIONS.ORDERS_OVERRIDE)
  async rejectOrder(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.ordersService.rejectOrder(id, actor, body?.reason);
  }

  /**
   * PUT /orders/:id/override
   * Admin override: change delivery time, address, or packaging after confirmation.
   */
  @Put(':id/override')
  @RequirePermissions(PERMISSIONS.ORDERS_OVERRIDE)
  async adminOverride(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.ordersService.adminOverride(id, actor, body);
  }
}
