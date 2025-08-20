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
      const seed = process.env.HLS_MASTER_ENCRYPTION_SEED;
      if (!seed) {
        throw new Error('HLS_MASTER_ENCRYPTION_SEED environment variable is required for video encryption');
      }
      return seed;
    },

    // Key derivation settings
    keyDerivation: {
      get algorithm() {
        return process.env.KEY_DERIVATION_ALGORITHM || 'PBKDF2-SHA256';
      },
      get rounds() {
        return parseInt(process.env.KEY_DERIVATION_ROUNDS!) || 100000;
      },
      get saltPrefix() {
        return process.env.KEY_SALT_PREFIX || 'local-streamer-hls-v1';
      },
    },

    // Authentication settings for video streaming
    auth: {
      get secret() {
        const secret = process.env.HLS_JWT_SECRET;
        if (!secret) {
          throw new Error('HLS_JWT_SECRET environment variable is required for video streaming authentication');
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
      get segmentDuration() {
        return parseInt(process.env.HLS_SEGMENT_DURATION!) || 10;
      },
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
