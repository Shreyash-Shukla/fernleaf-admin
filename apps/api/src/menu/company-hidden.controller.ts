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
import { MenuService } from './menu.service';
import { RequireAnyPermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('companies/:companyId')
export class CompanyHiddenController {
  constructor(private readonly menuService: MenuService) {}

  @Get('hidden-categories')
  @RequireAnyPermissions(PERMISSIONS.COMPANIES_READ, PERMISSIONS.CATALOGUE_READ)
  async getHiddenCategories(@Param('companyId') companyId: string) {
    return this.menuService.getHiddenCategories(companyId);
  }

  @Post('hidden-categories')
  @HttpCode(HttpStatus.CREATED)
  @RequireAnyPermissions(PERMISSIONS.COMPANIES_WRITE, PERMISSIONS.CATALOGUE_WRITE)
  async addHiddenCategory(
    @Param('companyId') companyId: string,
    @Body() body: { categoryId: string },
  ) {
    return this.menuService.addHiddenCategory(companyId, body.categoryId);
  }

  @Delete('hidden-categories/:categoryId')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions(PERMISSIONS.COMPANIES_WRITE, PERMISSIONS.CATALOGUE_WRITE)
  async removeHiddenCategory(
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menuService.removeHiddenCategory(companyId, categoryId);
  }

  @Get('hidden-items')
  @RequireAnyPermissions(PERMISSIONS.COMPANIES_READ, PERMISSIONS.CATALOGUE_READ)
  async getHiddenItems(@Param('companyId') companyId: string) {
    return this.menuService.getHiddenItems(companyId);
  }

  @Post('hidden-items')
  @HttpCode(HttpStatus.CREATED)
  @RequireAnyPermissions(PERMISSIONS.COMPANIES_WRITE, PERMISSIONS.CATALOGUE_WRITE)
  async addHiddenItem(
    @Param('companyId') companyId: string,
    @Body() body: { menuItemId: string },
  ) {
    return this.menuService.addHiddenItem(companyId, body.menuItemId);
  }

  @Delete('hidden-items/:menuItemId')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions(PERMISSIONS.COMPANIES_WRITE, PERMISSIONS.CATALOGUE_WRITE)
  async removeHiddenItem(
    @Param('companyId') companyId: string,
    @Param('menuItemId') menuItemId: string,
  ) {
    return this.menuService.removeHiddenItem(companyId, menuItemId);
  }
}
