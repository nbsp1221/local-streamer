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
};