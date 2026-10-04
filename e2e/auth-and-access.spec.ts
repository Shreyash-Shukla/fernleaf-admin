import { expect, test } from '@playwright/test';
import { accounts, loginViaApi, loginViaUi, waitForReactHydration, type Role } from './support';

const roles = Object.keys(accounts) as Role[];

test.describe('Authentication and access control', () => {
  for (const role of roles) {
    test(`@smoke ${role} signs in with reviewer credentials and lands correctly`, async ({ page }) => {
      await loginViaUi(page, role);
      await expect(page.locator('body')).not.toContainText('Application error');
    });
  }

  test('@smoke invalid credentials are rejected', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await waitForReactHydration(page);
    await page.getByLabel('Staff Email').fill('admin@test.com');
    await page.getByLabel('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign in to Dashboard' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('form').locator('..')).toContainText(/invalid|failed|credentials/i);
  });

  test('@regression unauthenticated protected route redirects to login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login$/);
  });

  const forbiddenRoutes: Record<Exclude<Role, 'admin'>, string[]> = {
    kitchen: ['/settings', '/billing', '/staff', '/pricing', '/orders/new'],
    dispatch: ['/settings', '/billing', '/staff', '/pricing', '/orders/new'],
    driver: ['/settings', '/billing', '/staff', '/orders', '/kitchen', '/dispatch'],
  };

  for (const role of ['kitchen', 'dispatch', 'driver'] as const) {
    test(`@regression ${role} is denied restricted UI routes`, async ({ page }) => {
      await loginViaUi(page, role);
      for (const route of forbiddenRoutes[role]) {
        await page.goto(route);
        await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible();
      }
    });

    test(`@regression ${role} is denied admin writes by the API`, async ({ request }) => {
      await loginViaApi(request, role);
      const response = await request.put('/api/settings/cutoffTime', {
        data: { value: '15:30' },
      });
      expect(response.status()).toBe(403);
    });
  }

  test('@regression role responses expose the intended permission sets', async ({ request }) => {
    const expected: Record<Role, string[]> = {
      admin: ['*'],
      kitchen: ['kitchen:read', 'kitchen:work', 'orders:read', 'catalogue:read'],
      dispatch: ['dispatch:read', 'dispatch:work', 'kitchen:read', 'orders:read', 'companies:read', 'deliveries:read_any'],
      driver: ['deliveries:read_own', 'deliveries:deliver'],
    };

    for (const role of roles) {
      const data = await loginViaApi(request, role);
      expect(data.role).toBe(role);
      expect(data.landingPath).toBe(accounts[role].landing);
      expect(new Set(data.permissions)).toEqual(new Set(expected[role]));
      await request.post('/api/auth/logout');
    }
  });
});
