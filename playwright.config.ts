import { defineConfig, devices } from '@playwright/test';
import { getE2ESharedPassword } from './tests/e2e/support/shared-password';

const port = 4173;
const sharedPassword = getE2ESharedPassword();
const smokeVideoJwtSecret = 'smoke-video-jwt-secret';
const smokeVideoMasterEncryptionSeed =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createPlaywrightWebServerEnv(portValue: number): Record<string, string> {
  const forwardedKeys = [
    'CI',
    'FORCE_COLOR',
    'GITHUB_ACTIONS',
    'HOME',
    'LANG',
    'LC_ALL',
    'PATH',
    'TEMP',
    'TERM',
    'TMP',
    'TMPDIR',
  ] as const;

  const forwardedEnv = Object.fromEntries(
    forwardedKeys.flatMap((key) => {
      const value = process.env[key];
      return value ? [[key, value]] : [];
    }),
  );

  return {
    ...forwardedEnv,
    AUTH_SHARED_PASSWORD: sharedPassword,
    LOCAL_STREAMER_DISABLE_VITE_ENV_FILES: 'true',
    PORT: String(portValue),
    VIDEO_JWT_SECRET: smokeVideoJwtSecret,
    VIDEO_MASTER_ENCRYPTION_SEED: smokeVideoMasterEncryptionSeed,
  };
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'bun --no-env-file run build && bun --no-env-file run backfill:browser-playback-fixtures && bun --no-env-file run start',
    env: createPlaywrightWebServerEnv(port),
    reuseExistingServer: false,
    timeout: 180_000,
    url: `http://127.0.0.1:${port}`,
  },
});
