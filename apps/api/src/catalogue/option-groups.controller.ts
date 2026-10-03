import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  OptionGroupsService,
  CreateOptionGroupDto,
  UpdateOptionGroupDto,
} from './option-groups.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('dishes/:dishId/groups')
export class DishOptionGroupsController {
  constructor(private readonly optionGroupsService: OptionGroupsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listGroupsForDish(@Param('dishId') dishId: string) {
    return this.optionGroupsService.listGroupsForDish(dishId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createGroup(
    @Param('dishId') dishId: string,
    @Body() body: CreateOptionGroupDto,
  ) {
    return this.optionGroupsService.createGroup(dishId, body);
  }

  @Put(':groupId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateGroup(
    @Param('groupId') groupId: string,
    @Body() body: UpdateOptionGroupDto,
  ) {
    return this.optionGroupsService.updateGroup(groupId, body);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async deleteGroup(@Param('groupId') groupId: string) {
    return this.optionGroupsService.deleteGroup(groupId);
  }
}

@Controller('option-groups')
export class OptionGroupsController {
  constructor(private readonly optionGroupsService: OptionGroupsService) {}

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async getGroup(@Param('id') id: string) {
    return this.optionGroupsService.getGroup(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateGroup(
    @Param('id') id: string,
    @Body() body: UpdateOptionGroupDto,
  ) {
    return this.optionGroupsService.updateGroup(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async deleteGroup(@Param('id') id: string) {
    return this.optionGroupsService.deleteGroup(id);
  }
}
