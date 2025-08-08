import { Transform } from 'stream';

/**
 * XOR 암호화 설정 인터페이스
 */
export interface XORConfig {
  key: string;
  encoding?: BufferEncoding;
}

/**
 * XOR 암호화/복호화 클래스
 * 
 * XOR 암호화는 대칭키 방식으로 같은 키로 암호화와 복호화를 수행합니다.
 * 스트리밍 비디오 파일의 보호를 위해 설계되었습니다.
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
   * 단일 데이터 청크에 XOR 연산을 수행합니다.
   * 
   * @param data - 암호화/복호화할 데이터
   * @param offset - 키에서 시작할 오프셋 위치 (스트리밍 시 연속성 보장)
   * @returns XOR 연산이 적용된 데이터
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
   * 복호화용 Transform 스트림을 생성합니다.
   * Range Request를 지원하기 위해 시작 오프셋을 받습니다.
   * 
   * @param startOffset - 파일 내에서 시작할 바이트 위치
   * @returns Transform 스트림
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
   * 암호화용 Transform 스트림을 생성합니다.
   * 파일을 저장할 때 사용됩니다.
   * 
   * @param startOffset - 파일 내에서 시작할 바이트 위치 (기본값: 0)
   * @returns Transform 스트림
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
   * 키 정보를 안전하게 반환합니다 (디버깅용)
   * 실제 키는 노출하지 않고 길이와 해시만 반환합니다.
   */
  getKeyInfo() {
    return {
      keyLength: this.keyBuffer.length,
      keyHash: require('crypto').createHash('sha256').update(this.keyBuffer).digest('hex').substring(0, 8)
    };
  }
}

/**
 * 기본 XOR 암호화 인스턴스 생성 함수
 */
export function createXORCrypto(key: string, encoding?: BufferEncoding): XORCrypto {
  return new XORCrypto({ key, encoding });
}