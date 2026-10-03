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
import {
  PricingService,
  CreateTierDto,
  UpdateTierDto,
  GridItemUpdate,
} from './pricing.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('tiers')
  @RequirePermissions(PERMISSIONS.PRICING_READ)
  async listTiers() {
    return this.pricingService.listTiers();
  }

  @Get('tiers/:id')
  @RequirePermissions(PERMISSIONS.PRICING_READ)
  async getTier(@Param('id') id: string) {
    return this.pricingService.getTier(id);
  }

  @Post('tiers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.PRICING_WRITE)
  async createTier(@Body() body: CreateTierDto) {
    return this.pricingService.createTier(body);
  }

  @Put('tiers/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PRICING_WRITE)
  async updateTier(@Param('id') id: string, @Body() body: UpdateTierDto) {
    return this.pricingService.updateTier(id, body);
  }

  @Get('tiers/:id/grid')
  @RequirePermissions(PERMISSIONS.PRICING_READ)
  async getTierGrid(
    @Param('id') id: string,
    @Query('kind') kind?: 'dish' | 'option',
    @Query('missing') missing?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pricingService.getTierGrid(id, { kind, missing, q, page, limit });
  }

  @Put('tiers/:id/grid')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PRICING_WRITE)
  async updateTierGrid(
    @Param('id') id: string,
    @Body() body: GridItemUpdate[] | GridItemUpdate,
    @Query('kind') kind?: 'dish' | 'option',
  ) {
    return this.pricingService.updateTierGrid(id, body, kind);
  }
}
