import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompaniesService, CreateCompanyDto, UpdateCompanyDto } from './companies.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  async listCompanies(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    return this.companiesService.listCompanies({ page, limit, active, q });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  async getCompany(@Param('id') id: string) {
    return this.companiesService.getCompany(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async createCompany(@Body() body: CreateCompanyDto) {
    return this.companiesService.createCompany(body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async updateCompany(@Param('id') id: string, @Body() body: UpdateCompanyDto) {
    return this.companiesService.updateCompany(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async deleteCompany(@Param('id') id: string) {
    return this.companiesService.deleteCompany(id);
  }

  @Get(':id/calendar')
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  async getCalendar(@Param('id') id: string) {
    return this.companiesService.getCalendar(id);
  }

  @Put(':id/owner')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async setOwner(
    @Param('id') id: string,
    @Body() body: { ownerEmployeeId: string | null },
  ) {
    return this.companiesService.updateCompany(id, { ownerEmployeeId: body.ownerEmployeeId });
  }
}
