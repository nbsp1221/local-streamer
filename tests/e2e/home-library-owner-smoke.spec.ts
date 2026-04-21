import { expect, test } from '@playwright/test';
import { getE2ESharedPassword } from '../support/shared-password';

const sharedPassword = getE2ESharedPassword(process.env.AUTH_SHARED_PASSWORD);

test.describe('home library owner smoke', () => {
  test('boots the authenticated home route with loader bootstrap filters', async ({ page }) => {
    await page.goto('/login?redirectTo=%2F%3Fq%3DAction%26tag%3DAction');
    await page.getByLabel('Shared password').fill(sharedPassword);
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(page).toHaveURL(/\/\?q=Action&tag=Action$/);
    await expect(page.getByRole('heading', { level: 1, name: 'My Library' })).toBeVisible();
    await expect(page.getByLabel('Search library (desktop)')).toHaveValue('Action');
    await expect(page.getByText('Active filters:')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Playlists' })).toBeVisible();
  });
});
