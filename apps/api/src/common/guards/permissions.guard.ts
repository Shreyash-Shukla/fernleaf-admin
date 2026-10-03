import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { canAll, canAny, ERRORS } from '@repo/shared';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_ANY_KEY,
} from '../decorators/permissions.decorator';
import { DomainError } from '../domain-error';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!requiredAnyPermissions || requiredAnyPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      throw DomainError.forbidden(
        ERRORS.FORBIDDEN,
        'Forbidden: No permissions assigned to user',
      );
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = canAll(user.permissions, requiredPermissions);
      if (!hasAll) {
        throw DomainError.forbidden(
          ERRORS.FORBIDDEN,
          `Forbidden: Missing required permission(s): ${requiredPermissions.join(', ')}`,
        );
      }
    }

    if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
      const hasAny = canAny(user.permissions, requiredAnyPermissions);
      if (!hasAny) {
        throw DomainError.forbidden(
          ERRORS.FORBIDDEN,
          `Forbidden: Missing required permission (needs at least one of: ${requiredAnyPermissions.join(', ')})`,
        );
      }
    }

    return true;
  }
}
