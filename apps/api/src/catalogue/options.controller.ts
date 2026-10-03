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
import { OptionsService, CreateOptionDto, UpdateOptionDto } from './options.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('options')
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listOptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    return this.optionsService.listOptions({ page, limit, active, q });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async getOption(@Param('id') id: string) {
    return this.optionsService.getOption(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createOption(@Body() body: CreateOptionDto) {
    return this.optionsService.createOption(body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateOption(@Param('id') id: string, @Body() body: UpdateOptionDto) {
    return this.optionsService.updateOption(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async deleteOption(@Param('id') id: string) {
    return this.optionsService.deleteOption(id);
  }
}
