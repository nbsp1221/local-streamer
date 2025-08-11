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
    timeCost: 3,         // 3 iterations
    parallelism: 1,      // 1 thread
  },
  
  encryption: {
    // XOR encryption key (from environment variable or default value)
    xorKey: process.env.XOR_ENCRYPTION_KEY || 'local-streamer-default-xor-key-2024-v1',
    
    // Chunk size for streaming (64KB)
    chunkSize: 64 * 1024,
    
    // Encryption algorithm identifier (for future algorithm additions)
    algorithm: 'xor-256',
    
    // Encrypted file extension
    encryptedExtension: '.encrypted',
    
    // Key validation hash length
    keyHashLength: 8,
  },
  
  hls: {
    // Enable/disable HLS functionality
    enabled: process.env.HLS_ENABLED === 'true',
    
    // Master encryption seed for key derivation
    masterSeed: process.env.HLS_MASTER_ENCRYPTION_SEED || '',
    
    // Key derivation settings
    keyDerivation: {
      algorithm: process.env.KEY_DERIVATION_ALGORITHM || 'PBKDF2-SHA256',
      rounds: parseInt(process.env.KEY_DERIVATION_ROUNDS!) || 100000,
      saltPrefix: process.env.KEY_SALT_PREFIX || 'local-streamer-hls-v1',
    },
    
    // Authentication settings for key server
    auth: {
      secret: process.env.KEY_SERVER_AUTH_SECRET || 'default-auth-secret',
      allowedOrigins: [
        'http://localhost:5173',
        'http://localhost:3000',
        process.env.FRONTEND_URL,
      ].filter(Boolean),
    },
    
    // Streaming settings
    streaming: {
      segmentDuration: parseInt(process.env.HLS_SEGMENT_DURATION!) || 10,
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