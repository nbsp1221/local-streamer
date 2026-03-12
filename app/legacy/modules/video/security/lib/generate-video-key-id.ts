import crypto from 'node:crypto';

export function generateVideoKeyId(videoId: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(videoId);

  return hash.digest().subarray(0, 16).toString('hex');
}
