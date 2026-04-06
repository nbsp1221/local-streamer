import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlaybackClearKeyService as PlaybackClearKeyServicePort } from '../../application/ports/playback-clearkey-service.port';
import { assertValidPlaybackVideoId } from '../../domain/playback-video-id';
import { getPlaybackStoragePaths } from '../storage/playback-storage-paths.server';
import { generatePlaybackKeyId } from './generate-playback-key-id';

export class PlaybackClearKeyService implements PlaybackClearKeyServicePort {
  async serveLicense(input: Parameters<PlaybackClearKeyServicePort['serveLicense']>[0]) {
    assertValidPlaybackVideoId(input.videoId);

    const keyPath = join(getPlaybackStoragePaths().videosDir, input.videoId, 'key.bin');

    let keyBuffer: Buffer;

    try {
      keyBuffer = await readFile(keyPath);
    }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw Object.assign(new Error('Encryption key not found'), {
          name: 'NotFoundError',
          statusCode: 404,
        });
      }

      throw error;
    }

    const keyId = generatePlaybackKeyId(input.videoId);

    return {
      body: JSON.stringify({
        keys: [
          {
            k: keyBuffer.toString('base64url'),
            kid: Buffer.from(keyId, 'hex').toString('base64url'),
            kty: 'oct',
          },
        ],
        type: 'temporary',
      }),
      headers: {
        'Access-Control-Allow-Credentials': 'false',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
        'Expires': '0',
        'Pragma': 'no-cache',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    };
  }
}
