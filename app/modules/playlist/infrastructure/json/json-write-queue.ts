import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Mutex } from 'async-mutex';

export class JsonWriteQueue {
  private readonly mutexMap = new Map<string, Mutex>();

  private getMutex(filePath: string) {
    const normalizedPath = path.resolve(filePath);

    if (!this.mutexMap.has(normalizedPath)) {
      this.mutexMap.set(normalizedPath, new Mutex());
    }

    return this.mutexMap.get(normalizedPath)!;
  }

  async writeJson<T>(filePath: string, data: T) {
    const mutex = this.getMutex(filePath);

    await mutex.runExclusive(async () => {
      const dir = path.dirname(filePath);
      const tempPath = `${filePath}.tmp`;

      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
        await fs.rename(tempPath, filePath);
      }
      catch (error) {
        await fs.rm(tempPath, { force: true });
        throw new Error(
          `Failed to write JSON file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async readJson<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as T;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultValue;
      }

      throw new Error(
        `Failed to read JSON file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async ensureFile<T>(filePath: string, defaultValue: T) {
    try {
      await fs.access(filePath);
    }
    catch {
      await this.writeJson(filePath, defaultValue);
    }
  }

  async exists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    }
    catch {
      return false;
    }
  }

  getMutexCount() {
    return this.mutexMap.size;
  }

  clearMutexes() {
    this.mutexMap.clear();
  }
}

export const jsonWriteQueue = new JsonWriteQueue();
