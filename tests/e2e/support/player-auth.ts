import type { Page } from '@playwright/test';
import { getE2ESharedPassword } from './shared-password';

const sharedPassword = getE2ESharedPassword();

export async function loginToPlayer(page: Page, videoId: string) {
  await page.goto(`/login?redirectTo=%2Fplayer%2F${videoId}`);
  await page.getByLabel('Shared password').fill(sharedPassword);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.waitForURL(new RegExp(`/player/${videoId}$`));
}
