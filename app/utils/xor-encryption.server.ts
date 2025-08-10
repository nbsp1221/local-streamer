import { Transform } from 'stream';

/**
 * XOR encryption configuration interface
 */
export interface XORConfig {
  key: string;
  encoding?: BufferEncoding;
}

/**
 * XOR encryption/decryption class
 * 
 * XOR encryption uses symmetric key approach performing both encryption and decryption with the same key.
 * Designed for protecting streaming video files.
 */
export class XORCrypto {
  private keyBuffer: Buffer;

  constructor(config: XORConfig) {
    if (!config.key || config.key.length === 0) {
      throw new Error('XOR encryption key cannot be empty');
    }
    
    this.keyBuffer = Buffer.from(config.key, config.encoding || 'utf8');
    
    if (this.keyBuffer.length === 0) {
      throw new Error('XOR encryption key buffer cannot be empty');
    }
  }

  /**
   * Performs XOR operation on a single data chunk.
   * 
   * @param data - Data to encrypt/decrypt
   * @param offset - Starting offset position in the key (ensures continuity during streaming)
   * @returns Data with XOR operation applied
   */
  encryptChunk(data: Buffer, offset: number = 0): Buffer {
    const result = Buffer.alloc(data.length);
    
    for (let i = 0; i < data.length; i++) {
      const keyIndex = (offset + i) % this.keyBuffer.length;
      result[i] = data[i] ^ this.keyBuffer[keyIndex];
    }
    
    return result;
  }

  /**
   * Creates a Transform stream for decryption.
   * Accepts starting offset to support Range Requests.
   * 
   * @param startOffset - Starting byte position in the file
   * @returns Transform stream
   */
  createDecryptStream(startOffset: number = 0): Transform {
    let currentOffset = startOffset;
    
    return new Transform({
      transform: (chunk: Buffer, encoding, callback) => {
        try {
          const decrypted = this.encryptChunk(chunk, currentOffset);
          currentOffset += chunk.length;
          callback(null, decrypted);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  }

  /**
   * Creates a Transform stream for encryption.
   * Used when saving files.
   * 
   * @param startOffset - Starting byte position in the file (default: 0)
   * @returns Transform stream
   */
  createEncryptStream(startOffset: number = 0): Transform {
    let currentOffset = startOffset;
    
    return new Transform({
      transform: (chunk: Buffer, encoding, callback) => {
        try {
          const encrypted = this.encryptChunk(chunk, currentOffset);
          currentOffset += chunk.length;
          callback(null, encrypted);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  }

  /**
   * Safely returns key information (for debugging).
   * Returns only length and hash without exposing actual key.
   */
  getKeyInfo() {
    return {
      keyLength: this.keyBuffer.length,
      keyHash: require('crypto').createHash('sha256').update(this.keyBuffer).digest('hex').substring(0, 8)
    };
  }
}

/**
 * Default XOR encryption instance creation function
 */
export function createXORCrypto(key: string, encoding?: BufferEncoding): XORCrypto {
  return new XORCrypto({ key, encoding });
}