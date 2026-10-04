import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { RequireAnyPermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('preview')
  @RequireAnyPermissions(PERMISSIONS.CATALOGUE_READ, PERMISSIONS.ORDERS_READ)
  async previewMenu(
    @Query('employeeId') employeeId?: string,
    @Query('companyId') companyId?: string,
    @Query('slug') slug?: string,
  ) {
    if (employeeId) {
      return this.menuService.resolveForEmployee(employeeId, slug);
    }
    if (companyId) {
      return this.menuService.resolveForCompany(companyId, slug);
    }
    return this.menuService.resolveDefault(slug);
  }

  @Get('categories')
  @RequireAnyPermissions(PERMISSIONS.CATALOGUE_READ, PERMISSIONS.ORDERS_READ)
  async listCategories(@Query('includeSecret') includeSecret?: string) {
    const withSecret = includeSecret === 'true' || includeSecret === '1' || includeSecret === undefined;
    return this.menuService.listCategories({ includeSecret: withSecret });
  }
}
