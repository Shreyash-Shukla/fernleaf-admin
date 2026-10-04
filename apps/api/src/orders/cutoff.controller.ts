// ─── Cut-off Controller ─────────────────────────────────────────

import { Controller, Post, Body, Req } from '@nestjs/common';
import { CutoffService } from './cutoff.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS, isValidDateString, ERRORS } from '@repo/shared';
import { DomainError } from '../common/domain-error';

@Controller('cutoff')
export class CutoffController {
  constructor(private readonly cutoffService: CutoffService) {}

  /**
   * POST /cutoff/run
   * Manual trigger for cut-off processing. Admin only.
   * Body: { date: 'YYYY-MM-DD', force?: boolean }
   */
  @Post('run')
  @RequirePermissions(PERMISSIONS.CUTOFF_RUN)
  async run(@Body() body: { date: string; force?: boolean }) {
    if (!body.date || !isValidDateString(body.date)) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'A valid date in YYYY-MM-DD format is required',
        { date: 'Valid date required' },
      );
    }

    return this.cutoffService.manualTrigger(body.date, body.force);
  }

  /**
   * POST /cutoff/sweep
   * Manually trigger the sweep (finds all unprocessed dates). Admin only.
   */
  @Post('sweep')
  @RequirePermissions(PERMISSIONS.CUTOFF_RUN)
  async sweep() {
    return this.cutoffService.sweep();
  }
}
