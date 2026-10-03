import {
  Controller,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly menuService: MenuService) {}

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateMenuItem(
    @Param('id') id: string,
    @Body() body: { sortOrder?: number; active?: boolean },
  ) {
    return this.menuService.updateMenuItem(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async removeMenuItem(@Param('id') id: string) {
    return this.menuService.removeMenuItem(id);
  }
}
