import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { RolesController } from './roles.controller';

@Module({
  controllers: [StaffController, RolesController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
