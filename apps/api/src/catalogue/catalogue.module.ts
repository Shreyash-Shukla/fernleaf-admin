import { Module } from '@nestjs/common';
import { DishesService } from './dishes.service';
import { DishesController } from './dishes.controller';
import { OptionsService } from './options.service';
import { OptionsController } from './options.controller';
import { OptionGroupsService } from './option-groups.service';
import {
  DishOptionGroupsController,
  OptionGroupsController,
} from './option-groups.controller';

@Module({
  controllers: [
    DishesController,
    OptionsController,
    DishOptionGroupsController,
    OptionGroupsController,
  ],
  providers: [DishesService, OptionsService, OptionGroupsService],
  exports: [DishesService, OptionsService, OptionGroupsService],
})
export class CatalogueModule {}
