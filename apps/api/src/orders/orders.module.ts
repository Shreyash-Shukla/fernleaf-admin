import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { MenuModule } from '../menu/menu.module';
import { OrdersService } from './orders.service';
import { OrderValidatorService } from './order-validator.service';
import { CutoffService } from './cutoff.service';
import { OrdersController } from './orders.controller';
import { CutoffController } from './cutoff.controller';

@Module({
  imports: [SettingsModule, MenuModule],
  controllers: [OrdersController, CutoffController],
  providers: [OrdersService, OrderValidatorService, CutoffService],
  exports: [OrdersService, CutoffService],
})
export class OrdersModule {}
