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
    // XOR 암호화 키 (환경변수에서 가져오거나 기본값 사용)
    xorKey: process.env.XOR_ENCRYPTION_KEY || 'local-streamer-default-xor-key-2024-v1',
    
    // 스트리밍 시 사용할 청크 크기 (64KB)
    chunkSize: 64 * 1024,
    
    // 암호화 알고리즘 식별자 (향후 다른 알고리즘 추가 대비)
    algorithm: 'xor-256',
    
    // 암호화된 파일 확장자
    encryptedExtension: '.encrypted',
    
    // 키 검증용 해시 길이
    keyHashLength: 8,
  },
};