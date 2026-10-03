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
import { DishesService, CreateDishDto, UpdateDishDto } from './dishes.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('dishes')
export class DishesController {
  constructor(private readonly dishesService: DishesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listDishes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
    @Query('stationId') stationId?: string,
    @Query('q') q?: string,
  ) {
    return this.dishesService.listDishes({ page, limit, active, stationId, q });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async getDish(@Param('id') id: string) {
    return this.dishesService.getDish(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createDish(@Body() body: CreateDishDto) {
    return this.dishesService.createDish(body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateDish(@Param('id') id: string, @Body() body: UpdateDishDto) {
    return this.dishesService.updateDish(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async deleteDish(@Param('id') id: string) {
    return this.dishesService.deleteDish(id);
  }
}
