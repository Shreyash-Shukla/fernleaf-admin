// ─── Dispatch Controller ─────────────────────────────────────────

import { Controller, Get, Query } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  /**
   * GET /dispatch/board?date=...
   * Dispatch board: drops for the date grouped by stage with order counts.
   */
  @Get('board')
  @RequirePermissions(PERMISSIONS.DISPATCH_READ)
  async getBoard(@Query('date') date?: string) {
    return this.dispatchService.getBoard({ date });
  }
}
