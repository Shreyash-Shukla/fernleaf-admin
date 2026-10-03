import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  CompaniesService,
  CreateCompanyAddressDto,
  UpdateCompanyAddressDto,
} from './companies.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('companies/:companyId/addresses')
export class CompanyAddressesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  async getAddresses(@Param('companyId') companyId: string) {
    return this.companiesService.getAddresses(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async addAddress(
    @Param('companyId') companyId: string,
    @Body() body: CreateCompanyAddressDto,
  ) {
    return this.companiesService.addAddress(companyId, body);
  }

  @Put(':addressId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async updateAddress(
    @Param('companyId') companyId: string,
    @Param('addressId') addressId: string,
    @Body() body: UpdateCompanyAddressDto,
  ) {
    return this.companiesService.updateAddress(companyId, addressId, body);
  }

  @Put(':addressId/default')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async setDefaultAddress(
    @Param('companyId') companyId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.companiesService.updateAddress(companyId, addressId, { isDefault: true });
  }

  @Delete(':addressId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.COMPANIES_WRITE)
  async deleteAddress(
    @Param('companyId') companyId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.companiesService.deleteAddress(companyId, addressId);
  }
}
