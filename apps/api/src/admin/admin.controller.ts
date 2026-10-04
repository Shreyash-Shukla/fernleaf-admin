// ─── Admin Controller ─────────────────────────────────────────────

import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';
import { SeedService } from '../seed.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly seedService: SeedService) {}

  /**
   * POST /admin/reseed
   * Admin-only endpoint to trigger a full reseed of DEMO data.
   * Cleans and regenerates date-relative demo data without touching STAFF data.
   */
  @Post('reseed')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  async reseed() {
    return this.seedService.reseed(true);
  }
}
