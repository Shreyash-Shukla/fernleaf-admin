import { PrismaClient } from '@prisma/client';
import { runSeed } from './seed.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from api or root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('[pnpm seed] Starting database seed...');
  await runSeed(prisma);
  await prisma.$disconnect();
  console.log('[pnpm seed] Finished!');
}

main().catch((err) => {
  console.error('[pnpm seed] Error:', err);
  process.exit(1);
});
