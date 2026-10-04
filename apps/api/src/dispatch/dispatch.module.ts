// ─── Dispatch Module ──────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { DispatchController } from './dispatch.controller';
import { DropsController } from './drops.controller';
import { DriverController } from './driver.controller';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [DispatchController, DropsController, DriverController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
