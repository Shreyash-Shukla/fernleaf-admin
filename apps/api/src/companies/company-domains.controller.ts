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
import { CompaniesService } from './companies.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('companies/:companyId/domains')
export class CompanyDomainsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  async getDomains(@Param('companyId') companyId: string) {
    return this.companiesService.getDomains(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async addDomain(
    @Param('companyId') companyId: string,
    @Body() body: { domain: string },
  ) {
    return this.companiesService.addDomain(companyId, body.domain);
  }

  @Delete(':domain')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async removeDomain(
    @Param('companyId') companyId: string,
    @Param('domain') domain: string,
  ) {
    return this.companiesService.removeDomain(companyId, domain);
  }
}
