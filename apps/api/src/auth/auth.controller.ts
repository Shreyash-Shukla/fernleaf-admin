import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.login(body.email, body.password);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
      path: '/',
    });

    return { ok: true, user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });

    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const token = req.cookies?.token;
    return this.authService.getMe(token);
  }
}
