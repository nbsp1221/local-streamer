import path from 'node:path';
import { expect, test } from '@playwright/test';
import { getE2ESharedPassword } from '../support/shared-password';

const sharedPassword = getE2ESharedPassword(process.env.AUTH_SHARED_PASSWORD);
const uploadFixturePath = path.resolve('tests/fixtures/upload/smoke-upload.mp4');

test.describe('add-videos owner upload smoke', () => {
  test('uploads a browser-selected video and commits it to the library', async ({ page }) => {
    await page.goto('/login?redirectTo=%2Fadd-videos');
    await page.getByLabel('Shared password').fill(sharedPassword);
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(page).toHaveURL(/\/add-videos$/);
    await page.locator('#choose-video-input').setInputFiles(uploadFixturePath);

    await expect(page.getByRole('heading', { level: 2, name: 'smoke-upload.mp4' })).toBeVisible();
    await expect(page.getByText('Ready to Add')).toBeVisible();

    await page.getByLabel('Title *').fill('Uploaded Smoke Fixture');
    await page.getByLabel('Tags').fill('Good Boy-comedy');
    await page.getByLabel('Tags').press('Enter');
    await expect(page.getByText('good boy-comedy')).toBeVisible();
    await page.getByRole('button', { name: 'Add to Library' }).click();

    await expect(
      page.getByText('"Uploaded Smoke Fixture" has been added to the library.'),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Upload Another Video' }).click();
    await expect(page.getByRole('button', { name: 'Choose Video' })).toBeVisible();

    await page.goto('/?q=good_boy-comedy&tag=good_boy-comedy');
    await expect(page.getByText('Has: good boy-comedy')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Uploaded Smoke Fixture' }).first()).toBeVisible();
  });
});
