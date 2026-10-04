// ─── Driver Controller ──────────────────────────────────────────

import { Controller, Get, Query, Req } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('driver')
export class DriverController {
  constructor(private readonly dispatchService: DispatchService) {}

  /**
   * GET /driver/drops?date=...
   * Scoped to actor's own assigned drops for today (or specified date).
   * Sorted by delivery time. Minimal phone-first DTO.
   */
  @Get('drops')
  @RequirePermissions(PERMISSIONS.DELIVERIES_READ_OWN)
  async getMyDrops(@Query('date') date: string | undefined, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.dispatchService.getDriverDrops({ date }, actor);
  }
}
