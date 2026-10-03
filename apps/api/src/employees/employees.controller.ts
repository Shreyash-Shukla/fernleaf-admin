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
import {
  EmployeesService,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ImportEmployeesDto,
} from './employees.service';
import { RequirePermissions, RequireAnyPermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequireAnyPermissions(PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.COMPANIES_READ)
  async listEmployees(
    @Query('companyId') companyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    return this.employeesService.listEmployees({ companyId, page, limit, active, q });
  }

  @Get(':id')
  @RequireAnyPermissions(PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.COMPANIES_READ)
  async getEmployee(@Param('id') id: string) {
    return this.employeesService.getEmployee(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  async createEmployee(@Body() body: CreateEmployeeDto) {
    return this.employeesService.createEmployee(body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  async updateEmployee(
    @Param('id') id: string,
    @Body() body: UpdateEmployeeDto,
  ) {
    return this.employeesService.updateEmployee(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  async deleteEmployee(@Param('id') id: string) {
    return this.employeesService.deleteEmployee(id);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.EMPLOYEES_WRITE)
  async importEmployees(@Body() body: ImportEmployeesDto) {
    const companyId = body.companyId;
    if (!companyId) {
      throw new Error('companyId is required for employee import');
    }
    return this.employeesService.importEmployees(companyId, body);
  }
}
