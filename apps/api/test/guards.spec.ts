import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service';
import { DomainError } from '../src/common/domain-error';
import { ExecutionContext } from '@nestjs/common';
import { PERMISSIONS } from '@repo/shared';

function createMockContext(
  req: Record<string, any>,
  handler = () => {},
  cls = class {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let prisma: PrismaService;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({});
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
    } as unknown as PrismaService;
    guard = new JwtAuthGuard(reflector, jwtService, prisma);
  });

  it('allows access to public routes without token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext({ cookies: {} });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws 401 when token is missing on protected route', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext({ cookies: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(DomainError);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('throws 401 when token is invalid on protected route', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('invalid token');
    });

    const context = createMockContext({ cookies: { token: 'bad-token' } });
    await expect(guard.canActivate(context)).rejects.toThrow(DomainError);
  });

  it('authenticates user and attaches rich user object to request', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'user-1' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-1',
      email: 'admin@test.com',
      name: 'Admin User',
      active: true,
      roleId: 'role-admin',
      role: {
        id: 'role-admin',
        key: 'admin',
        permissions: ['*'],
        landingPath: '/dashboard',
        dashboardKey: 'admin',
      },
    } as any);

    const req: Record<string, any> = { cookies: { token: 'valid-token' } };
    const context = createMockContext(req);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user-1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin',
      roleId: 'role-admin',
      permissions: ['*'],
      landingPath: '/dashboard',
      dashboardKey: 'admin',
    });
  });

  it('rejects deactivated user even if token is valid', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'user-inactive' });
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-inactive',
      email: 'inactive@test.com',
      active: false,
      role: { key: 'kitchen', permissions: [] },
    } as any);

    const req = { cookies: { token: 'valid-token' } };
    const context = createMockContext(req);

    await expect(guard.canActivate(context)).rejects.toThrow(DomainError);
  });
});

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows access when no permissions are required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ user: { permissions: [] } });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access for admin wildcard user', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.SETTINGS_READ];
      return undefined;
    });

    const context = createMockContext({
      user: { permissions: ['*'] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user has the exact required permission', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.KITCHEN_READ];
      return undefined;
    });

    const context = createMockContext({
      user: { permissions: [PERMISSIONS.KITCHEN_READ, PERMISSIONS.ORDERS_READ] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access with 403 when user lacks required permission', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions') return [PERMISSIONS.SETTINGS_WRITE];
      return undefined;
    });

    const context = createMockContext({
      user: { permissions: [PERMISSIONS.SETTINGS_READ] },
    });

    expect(() => guard.canActivate(context)).toThrow(DomainError);
    try {
      guard.canActivate(context);
    } catch (e: any) {
      expect(e.code).toBe('FORBIDDEN');
      expect(e.getStatus()).toBe(403);
    }
  });

  it('allows access when user matches any required permission in requireAny', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions_any') {
        return [PERMISSIONS.SETTINGS_READ, PERMISSIONS.KITCHEN_READ];
      }
      return undefined;
    });

    const context = createMockContext({
      user: { permissions: [PERMISSIONS.KITCHEN_READ] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
