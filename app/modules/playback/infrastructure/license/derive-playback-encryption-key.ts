import crypto from 'node:crypto';

export function derivePlaybackEncryptionKey(input: {
  env?: NodeJS.ProcessEnv;
  videoId: string;
}): Buffer {
  const env = input.env ?? process.env;
  const isTest = env.NODE_ENV === 'test' || env.VITEST === 'true';
  const masterSeed = isTest
    ? 'test-master-seed-for-unit-tests-only'
    : env.VIDEO_MASTER_ENCRYPTION_SEED;

  if (!masterSeed) {
    throw new Error('VIDEO_MASTER_ENCRYPTION_SEED environment variable is required for video encryption');
  }

  const saltPrefix = isTest
    ? 'test-salt'
    : env.KEY_SALT_PREFIX || 'local-streamer-video-v1';
  const salt = crypto.createHash('sha256')
    .update(saltPrefix + input.videoId)
    .digest();

  return crypto.pbkdf2Sync(masterSeed, salt, 100000, 16, 'sha256');
}
