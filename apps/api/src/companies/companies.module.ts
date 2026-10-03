import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompanyDomainsController } from './company-domains.controller';
import { CompanyAddressesController } from './company-addresses.controller';
import { CompanyHolidaysController } from './company-holidays.controller';

import { EmployeesModule } from '../employees/employees.module';
import { CompanyEmployeesController } from './company-employees.controller';

@Module({
  imports: [PrismaModule, EmployeesModule],
  controllers: [
    CompaniesController,
    CompanyDomainsController,
    CompanyAddressesController,
    CompanyHolidaysController,
    CompanyEmployeesController,
  ],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
