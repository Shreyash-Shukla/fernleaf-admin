import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SeedService } from './seed.service';

@Module({
  imports: [PrismaModule, HealthModule, AuthModule],
  providers: [SeedService],
})
export class AppModule {}
