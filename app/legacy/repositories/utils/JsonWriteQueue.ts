import { promises as fs } from 'fs';
import path from 'path';
import { Mutex } from 'async-mutex';

/**
 * JSON Write Queue for safe concurrent file operations
 * Uses mutex locks per file path to prevent race conditions and data corruption
 */
export class JsonWriteQueue {
  private mutexMap = new Map<string, Mutex>();

  /**
   * Get or create mutex for a specific file path
   */
  private getMutex(filePath: string): Mutex {
    const normalizedPath = path.resolve(filePath);

    if (!this.mutexMap.has(normalizedPath)) {
      this.mutexMap.set(normalizedPath, new Mutex());
    }

    return this.mutexMap.get(normalizedPath)!;
  }

  /**
   * Safely write JSON data to file using atomic operations
   * @param filePath - Path to the JSON file
   * @param data - Data to serialize and write
   */
  async writeJson<T>(filePath: string, data: T): Promise<void> {
    const mutex = this.getMutex(filePath);

    return mutex.runExclusive(async () => {
      try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Atomic write: write to temp file then rename
        const tempPath = `${filePath}.tmp`;
        const jsonContent = JSON.stringify(data, null, 2);

        await fs.writeFile(tempPath, jsonContent, 'utf-8');
        await fs.rename(tempPath, filePath);
      }
      catch (error) {
        // Clean up temp file if it exists
        const tempPath = `${filePath}.tmp`;
        try {
          await fs.unlink(tempPath);
        }
        catch {
          // Ignore errors when cleaning up temp file
        }

        throw new Error(`Failed to write JSON file ${filePath}: ${error}`);
      }
    });
  }

  /**
   * Safely read JSON data from file
   * @param filePath - Path to the JSON file
   * @param defaultValue - Default value to return if file doesn't exist
   */
  async readJson<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
    catch (error: any) {
      // If file doesn't exist, return default value
      if (error.code === 'ENOENT') {
        return defaultValue;
      }

      throw new Error(`Failed to read JSON file ${filePath}: ${error}`);
    }
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Ensure JSON file exists with default content
   */
  async ensureFile<T>(filePath: string, defaultContent: T): Promise<void> {
    if (!(await this.exists(filePath))) {
      await this.writeJson(filePath, defaultContent);
    }
  }

  /**
   * Clear all mutexes (useful for testing)
   */
  clearMutexes(): void {
    this.mutexMap.clear();
  }

  /**
   * Get number of active mutexes (useful for debugging)
   */
  getMutexCount(): number {
    return this.mutexMap.size;
  }
}

// Global instance to ensure single write queue across the application
export const jsonWriteQueue = new JsonWriteQueue();
