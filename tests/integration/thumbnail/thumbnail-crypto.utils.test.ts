import { createCipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const VALID_JPEG_FIXTURE_PATH = join(process.cwd(), 'public', 'images', 'video-placeholder.jpg');

describe('thumbnail crypto utils', () => {
  test('encryptWithIVHeader prefixes the IV and decryptWithIVHeader round-trips a valid jpeg payload', async () => {
    const { decryptWithIVHeader, encryptWithIVHeader } = await import('../../../app/modules/thumbnail/infrastructure/crypto/thumbnail-crypto.utils');
    const payload = Buffer.from(await readFile(VALID_JPEG_FIXTURE_PATH));
    const key = Buffer.from('00112233445566778899aabbccddeeff', 'hex');

    const encrypted = encryptWithIVHeader(payload, key);

    expect(encrypted.length).toBeGreaterThan(payload.length);
    expect(encrypted.subarray(0, 16)).toHaveLength(16);

    const decrypted = decryptWithIVHeader(encrypted, key);

    expect(decrypted).toEqual(payload);
  });

  test('validateEncryptedFormat rejects plaintext jpeg input', async () => {
    const { validateEncryptedFormat } = await import('../../../app/modules/thumbnail/infrastructure/crypto/thumbnail-crypto.utils');
    const payload = Buffer.from(await readFile(VALID_JPEG_FIXTURE_PATH));

    expect(validateEncryptedFormat(payload)).toBe(false);
  });

  test('validateEncryptedFormat accepts valid encrypted data even when the IV starts with jpeg-like bytes', async () => {
    const { decryptWithIVHeader, looksLikeJpeg, validateEncryptedFormat } = await import('../../../app/modules/thumbnail/infrastructure/crypto/thumbnail-crypto.utils');
    const payload = Buffer.from(await readFile(VALID_JPEG_FIXTURE_PATH));
    const key = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const iv = Buffer.from([0xff, 0xd8, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
    const cipher = createCipheriv('aes-128-cbc', key, iv);
    const encrypted = Buffer.concat([iv, cipher.update(payload), cipher.final()]);

    expect(validateEncryptedFormat(encrypted)).toBe(true);
    expect(looksLikeJpeg(decryptWithIVHeader(encrypted, key))).toBe(true);
  });

  test('looksLikeJpeg accepts the tracked fixture and rejects malformed data', async () => {
    const { looksLikeJpeg } = await import('../../../app/modules/thumbnail/infrastructure/crypto/thumbnail-crypto.utils');
    const payload = Buffer.from(await readFile(VALID_JPEG_FIXTURE_PATH));

    expect(looksLikeJpeg(payload)).toBe(true);
    expect(looksLikeJpeg(Buffer.from([0x00, 0x11, 0x22, 0x33]))).toBe(false);
  });
});
