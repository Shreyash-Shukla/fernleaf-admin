import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET!;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email?: string, password?: string) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '12h',
    });

    return {
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role.key,
      },
    };
  }

  async getMe(token?: string) {
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.jwtSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        email: user.email,
        name: user.name,
        role: user.role.key,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
