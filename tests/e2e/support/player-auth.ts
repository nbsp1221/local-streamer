import type { Page } from '@playwright/test';

const sharedPassword = process.env.AUTH_SHARED_PASSWORD ?? '1q2w3e4r!qwerty';

export async function loginToPlayer(page: Page, videoId: string) {
  await page.goto(`/login?redirectTo=%2Fplayer%2F${videoId}`);
  await page.getByLabel('Shared password').fill(sharedPassword);
  await page.getByRole('button', { name: 'Unlock' }).click();
}
