import crypto from 'node:crypto';

interface DeriveVideoEncryptionKeyInput {
  masterSeed: string;
  rounds: number;
  saltPrefix: string;
  videoId: string;
}

export function deriveVideoEncryptionKey(input: DeriveVideoEncryptionKeyInput): Buffer {
  const salt = crypto.createHash('sha256')
    .update(input.saltPrefix + input.videoId)
    .digest();

  return crypto.pbkdf2Sync(input.masterSeed, salt, input.rounds, 16, 'sha256');
}
