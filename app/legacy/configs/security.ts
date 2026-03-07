import * as argon2 from 'argon2';

export const security = {
  session: {
    duration: 7 * 24 * 60 * 60 * 1000, // 7 days (milliseconds)
    refreshThreshold: 4 * 24 * 60 * 60 * 1000, // 4 days (session refresh threshold)
    cookieName: 'session_id',
  },

  argon2: {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64MB
    timeCost: 3, // 3 iterations
    parallelism: 1, // 1 thread
  },

  video: {
    // Master encryption seed for key derivation (required for video encryption)
    get masterSeed() {
      const seed = process.env.VIDEO_MASTER_ENCRYPTION_SEED;
      if (!seed) {
        throw new Error('VIDEO_MASTER_ENCRYPTION_SEED environment variable is required for video encryption');
      }
      return seed;
    },

    // Key derivation settings
    keyDerivation: {
      algorithm: 'PBKDF2-SHA256',
      rounds: 100000,
      get saltPrefix() {
        return process.env.KEY_SALT_PREFIX || 'local-streamer-video-v1';
      },
    },

    // Authentication settings for video streaming
    auth: {
      get secret() {
        const secret = process.env.VIDEO_JWT_SECRET;
        if (!secret) {
          throw new Error('VIDEO_JWT_SECRET environment variable is required for video streaming authentication');
        }
        return secret;
      },
      get allowedOrigins() {
        return [
          'http://localhost:5173',
          'http://localhost:3000',
          process.env.FRONTEND_URL,
        ].filter(Boolean);
      },
    },

    // Streaming settings
    streaming: {
      segmentDuration: 10, // seconds
      playlistType: 'vod' as const,
      deleteSegments: true,
    },

    // FFmpeg encoding settings
    encoding: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      preset: 'medium',
      crf: 23,
      maxrate: '2M',
      bufsize: '4M',
      audioBitrate: '128k',
      audioChannels: 2,
      audioSampleRate: 44100,
    },
  },
};
