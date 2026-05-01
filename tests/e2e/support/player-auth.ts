import type { Page } from '@playwright/test';
import { loginToPath } from './auth';

export async function loginToPlayer(page: Page, input: {
  sharedPassword: string;
  videoId: string;
}) {
  await loginToPath(page, {
    expectedUrl: new RegExp(`/player/${input.videoId}$`),
    redirectTo: `/player/${input.videoId}`,
    sharedPassword: input.sharedPassword,
  });
}
