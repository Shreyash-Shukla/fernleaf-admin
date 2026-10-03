import { Module } from '@nestjs/common';
import { KitchenHolidaysService } from './kitchen-holidays.service';
import { KitchenHolidaysController } from './kitchen-holidays.controller';

@Module({
  controllers: [KitchenHolidaysController],
  providers: [KitchenHolidaysService],
  exports: [KitchenHolidaysService],
})
export class KitchenHolidaysModule {}
