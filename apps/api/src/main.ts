import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function validateStartupEnvironment() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '') {
    console.error(
      'FATAL: JWT_SECRET environment variable is missing or empty. Application cannot start securely.',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  validateStartupEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Set trust proxy so Secure cookies work behind reverse proxies like Render
  app.set('trust proxy', 1);

  // Enable cookie parsing middleware
  app.use(cookieParser());

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`API server running on http://0.0.0.0:${port}`);
}

bootstrap();
