import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService implements OnModuleInit {
  private get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
      throw new Error(
        'JWT_SECRET environment variable is missing or empty. Application cannot operate securely.',
      );
    }
    return secret;
  }

  onModuleInit() {
    // Enforce JWT_SECRET configuration on module initialization
    this.jwtSecret;
  }

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

    if (!user.active) {
      throw new UnauthorizedException('Account is deactivated');
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
        id: user.id,
        email: user.email,
        name: user.name,
      },
      role: user.role.key,
      permissions: user.role.permissions,
      landingPath: user.role.landingPath,
      dashboardKey: user.role.dashboardKey,
    };
  }

  async getMe(token?: string) {
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const secret = this.jwtSecret;

    try {
      const payload = this.jwtService.verify(token, {
        secret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });

      if (!user || !user.active) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        role: user.role.key,
        permissions: user.role.permissions,
        landingPath: user.role.landingPath,
        dashboardKey: user.role.dashboardKey,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
