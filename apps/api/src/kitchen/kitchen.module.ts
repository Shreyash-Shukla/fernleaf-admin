// ─── Kitchen Module ─────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';

@Module({
  imports: [SettingsModule],
  controllers: [KitchenController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
