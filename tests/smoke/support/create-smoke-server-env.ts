const SMOKE_VIDEO_JWT_SECRET = 'smoke-video-jwt-secret';
const SMOKE_VIDEO_MASTER_ENCRYPTION_SEED =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const FORWARDED_ENV_KEYS = [
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

type SmokeServerEnvOverrides = Record<string, string>;

export function createSmokeServerEnv(overrides: SmokeServerEnvOverrides): Record<string, string> {
  const forwardedEnv = Object.fromEntries(
    FORWARDED_ENV_KEYS.flatMap((key) => {
      const value = process.env[key];
      return value ? [[key, value]] : [];
    }),
  );

  return {
    ...forwardedEnv,
    VIDEO_JWT_SECRET: SMOKE_VIDEO_JWT_SECRET,
    VIDEO_MASTER_ENCRYPTION_SEED: SMOKE_VIDEO_MASTER_ENCRYPTION_SEED,
    ...overrides,
  };
}
