// ─── Billing Module ──────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { InvoicesController } from './invoices.controller';
import { AdjustmentsController } from './adjustments.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    BillingController,
    InvoicesController,
    AdjustmentsController,
  ],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
