import { describe, it, expect, beforeEach } from 'vitest';
import { XORCrypto, createXORCrypto, type XORConfig } from '../app/utils/xor-encryption.server';
import { Transform } from 'stream';

describe('XORCrypto', () => {
  let xorCrypto: XORCrypto;
  const testKey = 'test-encryption-key-123';

  beforeEach(() => {
    xorCrypto = new XORCrypto({ key: testKey });
  });

  describe('Constructor', () => {
    it('should create XORCrypto instance with valid key', () => {
      expect(xorCrypto).toBeInstanceOf(XORCrypto);
    });

    it('should throw error with empty key', () => {
      expect(() => new XORCrypto({ key: '' })).toThrow('XOR encryption key cannot be empty');
    });

    it('should throw error with undefined key', () => {
      expect(() => new XORCrypto({ key: undefined as any })).toThrow('XOR encryption key cannot be empty');
    });

    it('should support different encodings', () => {
      const base64Crypto = new XORCrypto({ key: 'dGVzdC1rZXk=', encoding: 'base64' });
      expect(base64Crypto).toBeInstanceOf(XORCrypto);
    });
  });

  describe('encryptChunk', () => {
    it('should encrypt and decrypt data correctly (XOR symmetry)', () => {
      const originalData = Buffer.from('Hello, World! This is test data for XOR encryption.');
      
      // Encrypt
      const encrypted = xorCrypto.encryptChunk(originalData);
      expect(encrypted).not.toEqual(originalData);
      expect(encrypted.length).toBe(originalData.length);

      // Decrypt (XOR with same key)
      const decrypted = xorCrypto.encryptChunk(encrypted);
      expect(decrypted).toEqual(originalData);
      expect(decrypted.toString()).toBe(originalData.toString());
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = xorCrypto.encryptChunk(emptyBuffer);
      expect(result.length).toBe(0);
    });

    it('should handle single byte', () => {
      const singleByte = Buffer.from([65]); // 'A'
      const encrypted = xorCrypto.encryptChunk(singleByte);
      expect(encrypted.length).toBe(1);
      
      const decrypted = xorCrypto.encryptChunk(encrypted);
      expect(decrypted).toEqual(singleByte);
    });

    it('should handle large data', () => {
      const largeData = Buffer.alloc(1024 * 1024, 'A'); // 1MB of 'A's
      const encrypted = xorCrypto.encryptChunk(largeData);
      expect(encrypted.length).toBe(largeData.length);
      
      const decrypted = xorCrypto.encryptChunk(encrypted);
      expect(decrypted).toEqual(largeData);
    });

    it('should produce different results for same data at different offsets', () => {
      const data = Buffer.from('Test data');
      
      const encrypted1 = xorCrypto.encryptChunk(data, 0);
      const encrypted2 = xorCrypto.encryptChunk(data, 10);
      
      // Different offsets should produce different encrypted results
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should handle offset correctly for continuous encryption', () => {
      const data1 = Buffer.from('First chunk');
      const data2 = Buffer.from('Second chunk');
      
      // Encrypt as separate chunks
      const encrypted1 = xorCrypto.encryptChunk(data1, 0);
      const encrypted2 = xorCrypto.encryptChunk(data2, data1.length);
      
      // Encrypt as single chunk
      const combinedData = Buffer.concat([data1, data2]);
      const encryptedCombined = xorCrypto.encryptChunk(combinedData, 0);
      
      // Should produce same result
      const combinedChunks = Buffer.concat([encrypted1, encrypted2]);
      expect(combinedChunks).toEqual(encryptedCombined);
    });
  });

  describe('createDecryptStream', () => {
    it('should create a Transform stream', () => {
      const stream = xorCrypto.createDecryptStream();
      expect(stream).toBeInstanceOf(Transform);
    });

    it('should decrypt streamed data correctly', async () => {
      const originalData = Buffer.from('Streaming test data for XOR decryption');
      const encryptedData = xorCrypto.encryptChunk(originalData);
      
      const decryptStream = xorCrypto.createDecryptStream(0);
      let result = Buffer.alloc(0);
      
      return new Promise<void>((resolve) => {
        decryptStream.on('data', (chunk) => {
          result = Buffer.concat([result, chunk]);
        });
        
        decryptStream.on('end', () => {
          expect(result).toEqual(originalData);
          expect(result.toString()).toBe(originalData.toString());
          resolve();
        });
        
        decryptStream.write(encryptedData);
        decryptStream.end();
      });
    });

    it('should handle multiple chunks correctly', async () => {
      const chunk1 = Buffer.from('First part ');
      const chunk2 = Buffer.from('Second part ');
      const chunk3 = Buffer.from('Third part');
      
      // Encrypt chunks with proper offsets
      const encrypted1 = xorCrypto.encryptChunk(chunk1, 0);
      const encrypted2 = xorCrypto.encryptChunk(chunk2, chunk1.length);
      const encrypted3 = xorCrypto.encryptChunk(chunk3, chunk1.length + chunk2.length);
      
      const decryptStream = xorCrypto.createDecryptStream(0);
      let result = Buffer.alloc(0);
      
      return new Promise<void>((resolve) => {
        decryptStream.on('data', (chunk) => {
          result = Buffer.concat([result, chunk]);
        });
        
        decryptStream.on('end', () => {
          const expected = Buffer.concat([chunk1, chunk2, chunk3]);
          expect(result).toEqual(expected);
          resolve();
        });
        
        decryptStream.write(encrypted1);
        decryptStream.write(encrypted2);
        decryptStream.write(encrypted3);
        decryptStream.end();
      });
    });

    it('should handle start offset correctly', async () => {
      const fullData = Buffer.from('This is the full data string for offset testing');
      const startOffset = 10;
      const partialData = fullData.subarray(startOffset);
      
      // Encrypt the partial data with offset
      const encryptedPartial = xorCrypto.encryptChunk(partialData, startOffset);
      
      const decryptStream = xorCrypto.createDecryptStream(startOffset);
      let result = Buffer.alloc(0);
      
      return new Promise<void>((resolve) => {
        decryptStream.on('data', (chunk) => {
          result = Buffer.concat([result, chunk]);
        });
        
        decryptStream.on('end', () => {
          expect(result).toEqual(partialData);
          resolve();
        });
        
        decryptStream.write(encryptedPartial);
        decryptStream.end();
      });
    });
  });

  describe('createEncryptStream', () => {
    it('should create a Transform stream', () => {
      const stream = xorCrypto.createEncryptStream();
      expect(stream).toBeInstanceOf(Transform);
    });

    it('should encrypt streamed data correctly', async () => {
      const originalData = Buffer.from('Data to be encrypted via stream');
      
      const encryptStream = xorCrypto.createEncryptStream(0);
      let result = Buffer.alloc(0);
      
      return new Promise<void>((resolve) => {
        encryptStream.on('data', (chunk) => {
          result = Buffer.concat([result, chunk]);
        });
        
        encryptStream.on('end', () => {
          // Result should be encrypted (different from original)
          expect(result).not.toEqual(originalData);
          expect(result.length).toBe(originalData.length);
          
          // Should be able to decrypt back to original
          const decrypted = xorCrypto.encryptChunk(result);
          expect(decrypted).toEqual(originalData);
          resolve();
        });
        
        encryptStream.write(originalData);
        encryptStream.end();
      });
    });
  });

  describe('getKeyInfo', () => {
    it('should return key information without exposing the key', () => {
      const keyInfo = xorCrypto.getKeyInfo();
      
      expect(keyInfo).toHaveProperty('keyLength');
      expect(keyInfo).toHaveProperty('keyHash');
      expect(keyInfo.keyLength).toBe(Buffer.from(testKey).length);
      expect(typeof keyInfo.keyHash).toBe('string');
      expect(keyInfo.keyHash.length).toBe(8);
      
      // Hash should not contain the original key
      expect(keyInfo.keyHash).not.toContain(testKey);
    });
  });

  describe('Key cycling behavior', () => {
    it('should cycle through key bytes correctly', () => {
      const shortKey = 'AB'; // 2 bytes: 65, 66
      const shortKeyCrypto = new XORCrypto({ key: shortKey });
      
      const data = Buffer.from([100, 100, 100, 100, 100]); // 5 bytes of same value
      const encrypted = shortKeyCrypto.encryptChunk(data);
      
      // Should cycle through key: data[0]^65, data[1]^66, data[2]^65, data[3]^66, data[4]^65
      expect(encrypted[0]).toBe(100 ^ 65); // A
      expect(encrypted[1]).toBe(100 ^ 66); // B
      expect(encrypted[2]).toBe(100 ^ 65); // A (cycled)
      expect(encrypted[3]).toBe(100 ^ 66); // B (cycled)
      expect(encrypted[4]).toBe(100 ^ 65); // A (cycled)
    });
  });

  describe('Error handling', () => {
    it('should handle stream errors gracefully', () => {
      const stream = xorCrypto.createDecryptStream(0);
      
      // Test that the stream can handle invalid input by checking the callback
      stream._transform(null as any, 'utf8', (err) => {
        expect(err).toBeDefined();
      });
      
      // Stream should still be usable for valid data
      expect(stream).toBeInstanceOf(Transform);
    });
  });
});

describe('createXORCrypto helper function', () => {
  it('should create XORCrypto instance', () => {
    const crypto = createXORCrypto('test-key');
    expect(crypto).toBeInstanceOf(XORCrypto);
  });

  it('should support encoding parameter', () => {
    const crypto = createXORCrypto('dGVzdA==', 'base64');
    expect(crypto).toBeInstanceOf(XORCrypto);
  });
});

describe('Integration tests', () => {
  it('should work with different key sizes', () => {
    const keys = [
      'A',                    // 1 byte
      'AB',                   // 2 bytes
      'Test Key',             // 8 bytes
      'Very Long Key For Testing XOR Encryption', // 38 bytes
      'a'.repeat(256),        // 256 bytes
    ];
    
    keys.forEach((key) => {
      const crypto = new XORCrypto({ key });
      const data = Buffer.from('Test data with various key sizes');
      
      const encrypted = crypto.encryptChunk(data);
      const decrypted = crypto.encryptChunk(encrypted);
      
      expect(decrypted).toEqual(data);
    });
  });

  it('should handle binary data correctly', () => {
    const testCrypto = new XORCrypto({ key: 'binary-test-key' });
    const binaryData = Buffer.from([0, 1, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
    
    const encrypted = testCrypto.encryptChunk(binaryData);
    const decrypted = testCrypto.encryptChunk(encrypted);
    
    expect(decrypted).toEqual(binaryData);
  });
});