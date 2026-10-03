import { Controller, Get } from '@nestjs/common';
import { StaffService } from './staff.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async getRoles() {
    return this.staffService.listRoles();
  }
}
