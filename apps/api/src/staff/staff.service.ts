import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/domain-error';
import { ERRORS } from '@repo/shared';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        permissions: true,
        landingPath: true,
        dashboardKey: true,
        isSystem: true,
      },
    });
  }

  async listStaff() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            permissions: true,
            landingPath: true,
            dashboardKey: true,
          },
        },
      },
    });
  }

  async createStaff(data: {
    email: string;
    name: string;
    password: string;
    roleId?: string;
    roleKey?: string;
  }) {
    const email = data.email?.toLowerCase().trim();
    const name = data.name?.trim();
    const password = data.password;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'A valid email address is required',
        { email: 'Invalid email address' },
      );
    }

    if (!name) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Name is required',
        { name: 'Name is required' },
      );
    }

    if (!password || password.length < 6) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'Password must be at least 6 characters',
        { password: 'Password must be at least 6 characters' },
      );
    }

    let roleId = data.roleId;
    if (!roleId && data.roleKey) {
      const role = await this.prisma.role.findUnique({
        where: { key: data.roleKey },
      });
      if (!role) {
        throw DomainError.badRequest(
          ERRORS.NOT_FOUND,
          `Role with key "${data.roleKey}" not found`,
        );
      }
      roleId = role.id;
    }

    if (!roleId) {
      throw DomainError.badRequest(
        ERRORS.VALIDATION_ERROR,
        'roleId or roleKey is required',
        { roleId: 'Role is required' },
      );
    }

    // Check if role exists
    const roleExists = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!roleExists) {
      throw DomainError.badRequest(
        ERRORS.NOT_FOUND,
        `Role with id "${roleId}" not found`,
      );
    }

    // Check email uniqueness
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw DomainError.conflict(
        ERRORS.CONFLICT,
        `User with email "${email}" already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        roleId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            permissions: true,
            landingPath: true,
            dashboardKey: true,
          },
        },
      },
    });

    return user;
  }

  async updateStaff(
    id: string,
    data: {
      name?: string;
      roleId?: string;
      roleKey?: string;
      active?: boolean;
      password?: string;
    },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw DomainError.notFound(
        ERRORS.NOT_FOUND,
        `Staff user with id "${id}" not found`,
      );
    }

    const updateData: any = {};

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Name cannot be empty',
        );
      }
      updateData.name = trimmed;
    }

    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    if (data.password !== undefined && data.password.trim().length > 0) {
      if (data.password.length < 6) {
        throw DomainError.badRequest(
          ERRORS.VALIDATION_ERROR,
          'Password must be at least 6 characters',
        );
      }
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    let roleId = data.roleId;
    if (!roleId && data.roleKey) {
      const role = await this.prisma.role.findUnique({
        where: { key: data.roleKey },
      });
      if (!role) {
        throw DomainError.badRequest(
          ERRORS.NOT_FOUND,
          `Role with key "${data.roleKey}" not found`,
        );
      }
      roleId = role.id;
    }

    if (roleId) {
      const roleExists = await this.prisma.role.findUnique({
        where: { id: roleId },
      });
      if (!roleExists) {
        throw DomainError.badRequest(
          ERRORS.NOT_FOUND,
          `Role with id "${roleId}" not found`,
        );
      }
      updateData.roleId = roleId;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            permissions: true,
            landingPath: true,
            dashboardKey: true,
          },
        },
      },
    });
  }
}
