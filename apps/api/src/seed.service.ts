import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export const SEED_ROLES = [
  {
    key: 'admin',
    name: 'Admin',
    permissions: ['*'],
    landingPath: '/dashboard',
    dashboardKey: 'admin',
    isSystem: true,
  },
  {
    key: 'kitchen',
    name: 'Kitchen',
    permissions: ['kitchen:read', 'kitchen:work', 'orders:read', 'catalogue:read'],
    landingPath: '/kitchen',
    dashboardKey: 'kitchen',
    isSystem: true,
  },
  {
    key: 'dispatch',
    name: 'Dispatch',
    permissions: [
      'dispatch:read',
      'dispatch:work',
      'kitchen:read',
      'orders:read',
      'companies:read',
      'deliveries:read_any',
    ],
    landingPath: '/dispatch',
    dashboardKey: 'dispatch',
    isSystem: true,
  },
  {
    key: 'driver',
    name: 'Driver',
    permissions: ['deliveries:read_own', 'deliveries:deliver'],
    landingPath: '/driver',
    dashboardKey: 'driver',
    isSystem: true,
  },
];

export const SEED_USERS = [
  { email: 'admin@test.com', name: 'Admin', roleKey: 'admin' },
  { email: 'kitchen@test.com', name: 'Kitchen', roleKey: 'kitchen' },
  { email: 'dispatch@test.com', name: 'Dispatch', roleKey: 'dispatch' },
  { email: 'driver@test.com', name: 'Driver', roleKey: 'driver' },
];

export const DEFAULT_PASSWORD = 'Test@1234';

export async function runSeed(
  prisma: any,
  logger?: { log: (msg: string) => void; warn: (msg: string) => void },
) {
  const log = (msg: string) => (logger ? logger.log(msg) : console.log(`[Seed] ${msg}`));
  const warn = (msg: string) => (logger ? logger.warn(msg) : console.warn(`[Seed Warning] ${msg}`));

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 1. Upsert roles idempotently
    const roleMap: Record<string, string> = {};
    for (const roleDef of SEED_ROLES) {
      const role = await prisma.role.upsert({
        where: { key: roleDef.key },
        update: {
          name: roleDef.name,
          permissions: roleDef.permissions,
          landingPath: roleDef.landingPath,
          dashboardKey: roleDef.dashboardKey,
          isSystem: roleDef.isSystem,
        },
        create: {
          key: roleDef.key,
          name: roleDef.name,
          permissions: roleDef.permissions,
          landingPath: roleDef.landingPath,
          dashboardKey: roleDef.dashboardKey,
          isSystem: roleDef.isSystem,
        },
      });
      roleMap[roleDef.key] = role.id;
    }

    // 2. Upsert users idempotently
    for (const userDef of SEED_USERS) {
      const roleId = roleMap[userDef.roleKey];
      if (!roleId) {
        warn(`Role ${userDef.roleKey} not found for user ${userDef.email}`);
        continue;
      }
      await prisma.user.upsert({
        where: { email: userDef.email },
        update: {
          name: userDef.name,
          passwordHash,
          roleId,
        },
        create: {
          email: userDef.email,
          name: userDef.name,
          passwordHash,
          roleId,
        },
      });
    }

    // 3. Upsert default settings
    const defaultSettings: Array<{ key: string; value: any }> = [
      { key: 'timezone', value: 'Asia/Kolkata' },
      { key: 'kitchenWorkingDays', value: [1, 2, 3, 4, 5] },
      { key: 'cutoffTime', value: '16:00' },
      { key: 'cutoffDays', value: 2 },
      { key: 'kitchenBufferMinutes', value: 30 },
      { key: 'atRiskWindowMinutes', value: 60 },
      { key: 'onTimeGraceMinutes', value: 10 },
      { key: 'cutoffHoldDates', value: [] },
    ];

    for (const setting of defaultSettings) {
      await prisma.setting.upsert({
        where: { key: setting.key },
        update: {},  // Don't overwrite if already set
        create: {
          key: setting.key,
          value: setting.value,
        },
      });
    }

    log('Idempotent seed completed: 4 roles, 4 users, and default settings ensured.');
  } catch (err: any) {
    warn(`Seed skipped or failed: ${err.message}`);
  }
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    this.logger.log('Running automatic idempotent seed on API boot...');
    await runSeed(this.prisma, this.logger);
  }
}
