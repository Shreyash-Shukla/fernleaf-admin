import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import {
  RequirePermissions,
  RequireAnyPermissions,
} from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequireAnyPermissions(PERMISSIONS.STAFF_READ, PERMISSIONS.STAFF_WRITE)
  async listStaff() {
    return this.staffService.listStaff();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.STAFF_WRITE)
  async createStaff(
    @Body()
    body: {
      email: string;
      name: string;
      password: string;
      roleId?: string;
      roleKey?: string;
    },
  ) {
    return this.staffService.createStaff(body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.STAFF_WRITE)
  async updateStaff(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      roleId?: string;
      roleKey?: string;
      active?: boolean;
      password?: string;
    },
  ) {
    return this.staffService.updateStaff(id, body);
  }
}
