import type { Page } from '@playwright/test';
export async function loginToPlayer(page: Page, input: {
  sharedPassword: string;
  videoId: string;
}) {
  await page.goto(`/login?redirectTo=%2Fplayer%2F${input.videoId}`);
  await page.getByLabel('Shared password').fill(input.sharedPassword);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.waitForURL(new RegExp(`/player/${input.videoId}$`));
}
