import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DomainError } from '../domain-error';
import { ERRORS } from '@repo/shared';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
      throw new Error(
        'JWT_SECRET environment variable is missing or empty. Application cannot operate securely.',
      );
    }
    return secret;
  }

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) {
        return true;
      }
      throw DomainError.unauthorized(
        ERRORS.UNAUTHORIZED,
        'Authentication required',
      );
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
        if (isPublic) {
          return true;
        }
        throw DomainError.unauthorized(
          ERRORS.UNAUTHORIZED,
          'User not found or account is deactivated',
        );
      }

      request.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.key,
        roleId: user.roleId,
        permissions: user.role.permissions,
        landingPath: user.role.landingPath,
        dashboardKey: user.role.dashboardKey,
      };

      return true;
    } catch (err: any) {
      if (isPublic) {
        return true;
      }
      if (err instanceof DomainError) {
        throw err;
      }
      throw DomainError.unauthorized(
        ERRORS.UNAUTHORIZED,
        'Invalid or expired authentication token',
      );
    }
  }

  private extractToken(request: any): string | null {
    if (request.cookies && request.cookies.token) {
      return request.cookies.token;
    }

    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const [type, token] = authHeader.split(' ');
      if (type?.toLowerCase() === 'bearer' && token) {
        return token;
      }
    }

    return null;
  }
}
