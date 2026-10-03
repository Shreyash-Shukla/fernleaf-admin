import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompaniesService, CreateCompanyHolidayDto } from './companies.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('companies/:companyId/holidays')
export class CompanyHolidaysController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  async getHolidays(@Param('companyId') companyId: string) {
    return this.companiesService.getHolidays(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async addHoliday(
    @Param('companyId') companyId: string,
    @Body() body: CreateCompanyHolidayDto,
  ) {
    return this.companiesService.addHoliday(companyId, body);
  }

  @Delete(':idOrDate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async removeHoliday(
    @Param('companyId') companyId: string,
    @Param('idOrDate') idOrDate: string,
  ) {
    return this.companiesService.removeHoliday(companyId, idOrDate);
  }
}
