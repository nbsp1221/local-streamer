import { expect, test } from '@playwright/test';
import { getE2ESharedPassword } from '../support/shared-password';
import { loginToPlayer } from './support/player-auth';

const playbackFixtureVideoId = '68e5f819-15e8-41ef-90ee-8a96769311b7';
const sharedPassword = getE2ESharedPassword(process.env.AUTH_SHARED_PASSWORD);

test.describe('player playback compatibility', () => {
  test('boots protected playback without dash.js DRM bootstrap errors and fetches encrypted video', async ({ page }) => {
    const consoleMessages: string[] = [];
    const requests: string[] = [];

    page.on('console', (message) => {
      consoleMessages.push(message.text());
    });

    page.on('request', (request) => {
      requests.push(request.url());
    });

    await loginToPlayer(page, {
      sharedPassword,
      videoId: playbackFixtureVideoId,
    });
    await page.waitForSelector('[data-media-player][data-can-play]');
    await page.locator('[data-media-player] video').evaluate(async (player: HTMLVideoElement) => {
      await player.play();
    });
    await expect.poll(async () => page.locator('[data-media-player] video').evaluate((player: HTMLVideoElement) => ({
      currentTime: player.currentTime,
      paused: player.paused,
    })), {
      timeout: 10_000,
    }).toMatchObject({
      paused: false,
    });
    await expect.poll(async () => page.locator('[data-media-player] video').evaluate((player: HTMLVideoElement) => player.currentTime), {
      timeout: 10_000,
    }).toBeGreaterThan(0);

    const dashBootstrapErrors = consoleMessages.filter(message => message.includes('getSupportedKeySystemMetadataFromContentProtection'));
    const clearKeyWarnings = consoleMessages.filter(message => message.includes('ClearKey schemeIdURI'));
    const manifestRequests = requests.filter(url => url.includes(`/videos/${playbackFixtureVideoId}/manifest.mpd`) && url.includes('token='));
    const protectedAudioRequests = requests.filter(url => url.includes(`/videos/${playbackFixtureVideoId}/audio/`) && url.includes('token='));
    const protectedVideoRequests = requests.filter(url => url.includes(`/videos/${playbackFixtureVideoId}/video/`) && url.includes('token='));

    expect(dashBootstrapErrors).toEqual([]);
    expect(clearKeyWarnings).toEqual([]);
    expect(manifestRequests.length).toBeGreaterThan(0);
    expect(protectedAudioRequests.length).toBeGreaterThan(0);
    expect(protectedVideoRequests.length).toBeGreaterThan(0);
  });
});
