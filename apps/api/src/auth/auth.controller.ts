import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { DomainError } from '../common/domain-error';
import { ERRORS } from '@repo/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      body.email,
      body.password,
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
      path: '/',
    });

    return {
      ok: true,
      token: result.token,
      user: result.user,
      role: result.role,
      permissions: result.permissions,
      landingPath: result.landingPath,
      dashboardKey: result.dashboardKey,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });

    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    if (!user) {
      throw DomainError.unauthorized(
        ERRORS.UNAUTHORIZED,
        'Missing authentication token',
      );
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      role: user.role,
      permissions: user.permissions,
      landingPath: user.landingPath,
      dashboardKey: user.dashboardKey,
    };
  }
}
