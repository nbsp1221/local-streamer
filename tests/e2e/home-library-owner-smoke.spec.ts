import { expect, test } from '@playwright/test';
import { getE2ESharedPassword } from '../support/shared-password';

const sharedPassword = getE2ESharedPassword(process.env.AUTH_SHARED_PASSWORD);

test.describe('home library owner smoke', () => {
  test('boots the authenticated home route with loader bootstrap filters', async ({ page }) => {
    await page.goto('/login?redirectTo=%2F%3Fq%3Daction%26tag%3Daction%26type%3Dclip%26genre%3Daction');
    await page.getByLabel('Shared password').fill(sharedPassword);
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(page).toHaveURL(/\/\?q=action&tag=action&type=clip&genre=action$/);
    await expect(page.getByRole('heading', { level: 1, name: 'My Library' })).toBeVisible();
    await expect(page.getByLabel('Search library (desktop)')).toHaveValue('action');
    await expect(page.getByText('Active filters:')).toBeVisible();
    await expect(page.getByText('Has: action')).toBeVisible();
    await expect(page.getByText('Type: Clip')).toBeVisible();
    await expect(page.getByText('Genre: Action')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Playlists' })).toBeVisible();
  });
});
