/**
 * Port for video encryption key management
 * Abstracts key generation, storage, and retrieval operations
 * Following Hexagonal Architecture pattern for clean separation
 */
export interface KeyManagementPort {
  /**
   * Generate and store encryption key for a video
   * Returns the generated key and keyInfo file path for FFmpeg integration
   */
  generateAndStoreKey(videoId: string): Promise<{
    key: Buffer;
    keyInfoFile: string;
  }>;

  /**
   * Retrieve stored encryption key for a video
   * @throws Error if key not found
   */
  retrieveKey(videoId: string): Promise<Buffer>;

  /**
   * Check if encryption key exists for a video
   */
  keyExists(videoId: string): Promise<boolean>;

  /**
   * Clean up temporary files (keyinfo.txt) for a video
   * Used after video processing completion
   */
  cleanupTempFiles(videoId: string): Promise<void>;
}

/**
 * Result type for key generation operations
 * Provides both the key data and FFmpeg integration support
 */
export interface KeyGenerationResult {
  key: Buffer;
  keyInfoFile: string;
}
