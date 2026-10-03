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
import { MenuService, CreateCategoryDto, UpdateCategoryDto } from './menu.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('menu-categories')
export class MenuCategoriesController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listCategories(
    @Query('active') active?: string,
    @Query('includeSecret') includeSecret?: string,
  ) {
    const activeOnly = active === 'true' || active === '1';
    const withSecret = includeSecret === 'true' || includeSecret === '1';
    return this.menuService.listCategories({ activeOnly, includeSecret: withSecret });
  }

  @Get(':idOrSlug')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async getCategory(@Param('idOrSlug') idOrSlug: string) {
    return this.menuService.getCategory(idOrSlug);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createCategory(@Body() body: CreateCategoryDto) {
    return this.menuService.createCategory(body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.menuService.updateCategory(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async deleteCategory(@Param('id') id: string) {
    return this.menuService.deleteCategory(id);
  }

  @Get(':categoryId/items')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listCategoryItems(@Param('categoryId') categoryId: string) {
    return this.menuService.listCategoryItems(categoryId);
  }

  @Post(':categoryId/items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async addMenuItem(
    @Param('categoryId') categoryId: string,
    @Body() body: { dishId: string; sortOrder?: number; active?: boolean },
  ) {
    return this.menuService.addMenuItem(categoryId, body);
  }
}
