import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmployeesService, CreateEmployeeDto, ImportEmployeesDto } from '../employees/employees.service';
import { RequirePermissions, RequireAnyPermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('companies/:companyId/employees')
export class CompanyEmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequireAnyPermissions(PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.COMPANIES_READ)
  async listCompanyEmployees(
    @Param('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    return this.employeesService.listEmployees({ companyId, page, limit, active, q });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  async createEmployee(
    @Param('companyId') companyId: string,
    @Body() body: Omit<CreateEmployeeDto, 'companyId'> & { companyId?: string },
  ) {
    return this.employeesService.createEmployee({
      ...body,
      companyId,
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  async importEmployees(
    @Param('companyId') companyId: string,
    @Body() body: ImportEmployeesDto,
  ) {
    return this.employeesService.importEmployees(companyId, body);
  }
}
