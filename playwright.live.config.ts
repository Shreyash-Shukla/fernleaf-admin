import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const liveBaseURL = process.env.E2E_BASE_URL;
if (!liveBaseURL) {
  throw new Error('E2E_BASE_URL is required for live tests (for example, https://your-app.example.com).');
}

export default defineConfig({
  ...baseConfig,
  webServer: undefined,
  use: {
    ...baseConfig.use,
    baseURL: liveBaseURL,
  },
});
