import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

export type Role = 'admin' | 'kitchen' | 'dispatch' | 'driver';

export const accounts: Record<Role, { email: string; password: string; landing: string }> = {
  admin: { email: 'admin@test.com', password: 'Test@1234', landing: '/dashboard' },
  kitchen: { email: 'kitchen@test.com', password: 'Test@1234', landing: '/kitchen' },
  dispatch: { email: 'dispatch@test.com', password: 'Test@1234', landing: '/dispatch' },
  driver: { email: 'driver@test.com', password: 'Test@1234', landing: '/driver' },
};

export async function waitForReactHydration(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return Boolean(form && Object.keys(form).some((key) => key.startsWith('__reactProps')));
  });
}

export async function loginViaUi(page: Page, role: Role) {
  const account = accounts[role];
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await waitForReactHydration(page);
  await page.getByLabel('Staff Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in to Dashboard' }).click();
  await expect(page).toHaveURL(new RegExp(`${account.landing.replace('/', '\\/')}(?:\\?.*)?$`));
}

export async function loginViaApi(request: APIRequestContext, role: Role) {
  const account = accounts[role];
  const response = await request.post('/api/auth/login', {
    data: { email: account.email, password: account.password },
  });
  await expectOk(response, `login as ${role}`);
  return response.json();
}

export async function expectOk(response: APIResponse, action: string) {
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`${action} failed (${response.status()}): ${body}`);
  }
  return response;
}

export async function json<T = any>(response: APIResponse, action: string): Promise<T> {
  await expectOk(response, action);
  return response.json() as Promise<T>;
}

export function listItems<T = any>(body: any, keys: string[] = ['items', 'orders', 'companies']): T[] {
  if (Array.isArray(body)) return body;
  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

export const mutationsEnabled = process.env.E2E_ALLOW_MUTATIONS === '1';
export const reseedEnabled = process.env.E2E_RESEED === '1';
