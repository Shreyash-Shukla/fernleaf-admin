import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  async getAll() {
    return this.settingsService.getAll();
  }

  @Put(':key')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.SETTINGS_WRITE)
  async update(
    @Param('key') key: string,
    @Body() body: any,
  ) {
    const rawValue =
      body !== null && typeof body === 'object' && 'value' in body
        ? body.value
        : body;

    return this.settingsService.set(key, rawValue);
  }
}
