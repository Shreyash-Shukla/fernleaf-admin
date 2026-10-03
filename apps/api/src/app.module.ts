import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { KitchenHolidaysModule } from './kitchen-holidays/kitchen-holidays.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { StaffModule } from './staff/staff.module';
import { MetaModule } from './meta/meta.module';
import { SeedService } from './seed.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    SettingsModule,
    KitchenHolidaysModule,
    ReferenceDataModule,
    StaffModule,
    MetaModule,
  ],
  providers: [
    SeedService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
