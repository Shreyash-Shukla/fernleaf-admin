// ─── Drops Controller ───────────────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DispatchService } from './dispatch.service';
import {
  RequirePermissions,
  RequireAnyPermissions,
} from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@repo/shared';

@Controller('drops')
export class DropsController {
  constructor(private readonly dispatchService: DispatchService) {}

  /**
   * GET /drops/:id
   * Detail of a single drop.
   */
  @Get(':id')
  @RequireAnyPermissions(
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.DELIVERIES_READ_OWN,
    PERMISSIONS.ORDERS_READ,
  )
  async getDrop(@Param('id') id: string) {
    return this.dispatchService.getDrop(id);
  }

  /**
   * POST /drops/:id/dispatch-ready
   * Sets dispatchReadyAt on all active orders in the drop.
   * Requires all active orders to have kitchenReadyAt.
   */
  @Post(':id/dispatch-ready')
  @RequirePermissions(PERMISSIONS.DISPATCH_WORK)
  async dispatchReady(@Param('id') id: string, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.dispatchService.dispatchReady(id, actor);
  }

  /**
   * POST /drops/:id/assign-driver
   * Assigns or updates driver on a drop.
   */
  @Post(':id/assign-driver')
  @RequirePermissions(PERMISSIONS.DISPATCH_WORK)
  async assignDriver(
    @Param('id') id: string,
    @Body() body: { driverId: string | null },
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.dispatchService.assignDriver(id, body, actor);
  }

  /**
   * POST /drops/:id/out-for-delivery
   * Sets outForDeliveryAt on drop and all active orders.
   * Requires driver assigned and all active orders dispatch-ready.
   */
  @Post(':id/out-for-delivery')
  @RequirePermissions(PERMISSIONS.DISPATCH_WORK)
  async outForDelivery(@Param('id') id: string, @Req() req: any) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.dispatchService.outForDelivery(id, actor);
  }

  /**
   * POST /drops/:id/deliver
   * Marks drop and its active orders as delivered.
   * Requires drop to be out-for-delivery. Driver ownership verified.
   * Computes onTime flag.
   */
  @Post(':id/deliver')
  @RequirePermissions(PERMISSIONS.DELIVERIES_DELIVER)
  async deliver(
    @Param('id') id: string,
    @Body() body: { note?: string; photo?: string },
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };
    return this.dispatchService.deliver(
      id,
      {
        note: body?.note,
        photoData: body?.photo,
      },
      actor,
    );
  }

  /**
   * POST /drops/:id/photo
   * Upload delivery photo proof (supports multipart file or base64 JSON).
   */
  @Post(':id/photo')
  @RequireAnyPermissions(PERMISSIONS.DELIVERIES_DELIVER, PERMISSIONS.DISPATCH_WORK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: { data?: string; mime?: string },
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      permissions: req.user.role?.permissions ?? req.user.permissions ?? [],
    };

    let buffer: Buffer;
    let mime: string;

    if (file && file.buffer) {
      buffer = file.buffer;
      mime = file.mimetype || 'image/jpeg';
    } else if (body && body.data) {
      const base64Str = body.data.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Str, 'base64');
      mime = body.mime || 'image/jpeg';
    } else {
      buffer = Buffer.from('placeholder');
      mime = 'image/jpeg';
    }

    return this.dispatchService.uploadPhoto(id, buffer, mime, actor);
  }

  /**
   * GET /drops/:id/photo
   * Retrieve binary photo proof.
   */
  @Get(':id/photo')
  @RequireAnyPermissions(
    PERMISSIONS.DISPATCH_READ,
    PERMISSIONS.DELIVERIES_READ_OWN,
    PERMISSIONS.ORDERS_READ,
  )
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const photo = await this.dispatchService.getPhoto(id);
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Content-Length', photo.size);
    res.send(photo.data);
  }
}
