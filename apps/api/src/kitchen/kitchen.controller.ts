// ─── Kitchen Controller ─────────────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import {
  RequirePermissions,
  RequireAnyPermissions,
} from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  /**
   * GET /kitchen/board?date&stationId
   * Kitchen prep board: confirmed orders with prep units, grouped by station,
   * with late / at-risk status and batch cook totals.
   */
  @Get('board')
  @RequirePermissions(PERMISSIONS.KITCHEN_READ)
  async getBoard(
    @Query('date') date?: string,
    @Query('stationId') stationId?: string,
  ) {
    return this.kitchenService.getBoard({ date, stationId });
  }

  /**
   * POST /kitchen/units/:id/start
   * Start preparation on a prep unit.
   * Row-level FOR UPDATE locking on Order row prevents concurrency anomalies.
   */
  @Post('units/:id/start')
  @RequirePermissions(PERMISSIONS.KITCHEN_WORK)
  async startUnit(@Param('id') id: string, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.kitchenService.startUnit(id, actor);
  }

  /**
   * POST /kitchen/units/:id/done
   * Mark prep unit as completed.
   * Finishing an unstarted unit is allowed and records start = done time.
   * Automatically sets order.kitchenReadyAt when all units are done.
   */
  @Post('units/:id/done')
  @RequirePermissions(PERMISSIONS.KITCHEN_WORK)
  async doneUnit(@Param('id') id: string, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.kitchenService.doneUnit(id, actor);
  }

  /**
   * POST /kitchen/orders/:id/force-complete
   * Admin-only. Force-completes all prep units and marks order ready in one transaction.
   */
  @Post('orders/:id/force-complete')
  @RequireAnyPermissions(PERMISSIONS.KITCHEN_FORCE, PERMISSIONS.ORDERS_OVERRIDE)
  async forceCompleteOrder(@Param('id') id: string, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.kitchenService.forceCompleteOrder(id, actor);
  }
}
