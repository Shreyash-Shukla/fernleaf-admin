import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReferenceDataService } from './reference-data.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('ref')
export class ReferenceDataController {
  constructor(private readonly service: ReferenceDataService) {}

  // ─── Allergens ───────────────────────────────────────────
  @Get('allergens')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listAllergens(@Query('active') active?: string) {
    const activeOnly = active === 'true' || active === '1';
    return this.service.listAllergens(activeOnly);
  }

  @Post('allergens')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createAllergen(@Body() body: { name: string }) {
    return this.service.createAllergen(body.name);
  }

  @Put('allergens/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateAllergen(
    @Param('id') id: string,
    @Body() body: { name?: string; active?: boolean },
  ) {
    return this.service.updateAllergen(id, body);
  }

  // ─── Dietary Tags ────────────────────────────────────────
  @Get('dietary-tags')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listDietaryTags(@Query('active') active?: string) {
    const activeOnly = active === 'true' || active === '1';
    return this.service.listDietaryTags(activeOnly);
  }

  @Post('dietary-tags')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createDietaryTag(@Body() body: { name: string }) {
    return this.service.createDietaryTag(body.name);
  }

  @Put('dietary-tags/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateDietaryTag(
    @Param('id') id: string,
    @Body() body: { name?: string; active?: boolean },
  ) {
    return this.service.updateDietaryTag(id, body);
  }

  // ─── Kitchen Stations ────────────────────────────────────
  @Get('stations')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listStations(@Query('active') active?: string) {
    const activeOnly = active === 'true' || active === '1';
    return this.service.listStations(activeOnly);
  }

  @Post('stations')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createStation(
    @Body() body: { name: string; sortOrder?: number },
  ) {
    return this.service.createStation(body.name, body.sortOrder);
  }

  @Put('stations/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updateStation(
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; active?: boolean },
  ) {
    return this.service.updateStation(id, body);
  }

  // ─── Portion Sizes ───────────────────────────────────────
  @Get('portion-sizes')
  @RequirePermissions(PERMISSIONS.CATALOGUE_READ)
  async listPortionSizes(@Query('active') active?: string) {
    const activeOnly = active === 'true' || active === '1';
    return this.service.listPortionSizes(activeOnly);
  }

  @Post('portion-sizes')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async createPortionSize(
    @Body() body: { name: string; sortOrder?: number },
  ) {
    return this.service.createPortionSize(body.name, body.sortOrder);
  }

  @Put('portion-sizes/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.CATALOGUE_WRITE)
  async updatePortionSize(
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; active?: boolean },
  ) {
    return this.service.updatePortionSize(id, body);
  }
}
