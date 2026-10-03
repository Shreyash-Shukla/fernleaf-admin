import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { MenuCategoriesController } from './menu-categories.controller';
import { MenuItemsController } from './menu-items.controller';
import { CompanyHiddenController } from './company-hidden.controller';

@Module({
  controllers: [
    MenuController,
    MenuCategoriesController,
    MenuItemsController,
    CompanyHiddenController,
  ],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
