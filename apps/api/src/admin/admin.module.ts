import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { SeedService } from '../seed.service';

@Module({
  controllers: [AdminController],
  providers: [SeedService],
  exports: [SeedService],
})
export class AdminModule {}
