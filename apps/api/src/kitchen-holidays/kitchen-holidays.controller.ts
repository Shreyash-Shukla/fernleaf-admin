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
import { KitchenHolidaysService } from './kitchen-holidays.service';
import {
  RequirePermissions,
  RequireAnyPermissions,
} from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('kitchen-holidays')
export class KitchenHolidaysController {
  constructor(private readonly service: KitchenHolidaysService) {}

  @Get()
  @RequireAnyPermissions(PERMISSIONS.SETTINGS_READ, PERMISSIONS.KITCHEN_READ)
  async listAll() {
    return this.service.listAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  async create(@Body() body: { date: string; name: string }) {
    return this.service.createOrUpdate(body.date, body.name);
  }

  @Delete(':date')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  async delete(@Param('date') date: string) {
    return this.service.delete(date);
  }
}
