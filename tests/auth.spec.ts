import { test, expect, request } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test.beforeAll(async () => {
        const apiContext = await request.newContext();
        await apiContext.get('http://localhost:3000/api/auth/seed');
        await apiContext.dispose();
    });

    test('Valid Login redirects to employee dashboard', async ({ page }) => {
        await page.goto('/login');

        // Fill in phone number and password
        await page.fill('input[type="text"]', '0912345678'); // Assuming this is a valid user
        await page.fill('input[type="password"]', '345678'); // Last 6 digits default password

        // Click Sign In
        await page.click('button[type="submit"]');

        // Wait for navigation to dashboard
        await expect(page).toHaveURL(/\/employee\/dashboard/);
        await expect(page.locator('h1').filter({ hasText: 'My Live Schedule' })).toBeVisible();
    });

    test('Invalid Login shows error message', async ({ page }) => {
        await page.goto('/login');

        // Fill in invalid phone number and password
        await page.fill('input[type="text"]', '0900000000');
        await page.fill('input[type="password"]', 'wrongpass');

        // Click Sign In
        await page.click('button[type="submit"]');

        // Assert error message exists
        await expect(page.locator('text=Invalid phone number or password')).toBeVisible({ timeout: 5000 });
    });
});
