import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonWriteQueue } from '../app/repositories/utils/JsonWriteQueue';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('JsonWriteQueue', () => {
  let writeQueue: JsonWriteQueue;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    writeQueue = new JsonWriteQueue();
    
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'json-write-queue-test-'));
    testFilePath = path.join(testDir, 'test.json');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    writeQueue.clearMutexes();
  });

  describe('writeJson', () => {
    it('should write JSON data to file', async () => {
      const testData = { name: 'test', value: 123 };
      
      await writeQueue.writeJson(testFilePath, testData);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const parsedData = JSON.parse(fileContent);
      
      expect(parsedData).toEqual(testData);
    });

    it('should write JSON with proper formatting', async () => {
      const testData = { name: 'test', nested: { value: 123 } };
      
      await writeQueue.writeJson(testFilePath, testData);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      
      // Should be formatted with 2-space indentation
      expect(fileContent).toContain('{\n  "name": "test"');
      expect(fileContent).toContain('  "nested": {\n    "value": 123');
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = path.join(testDir, 'nested', 'deep', 'file.json');
      const testData = { test: true };
      
      await writeQueue.writeJson(nestedPath, testData);
      
      const fileContent = await fs.readFile(nestedPath, 'utf-8');
      expect(JSON.parse(fileContent)).toEqual(testData);
    });

    it('should handle concurrent writes to same file safely', async () => {
      const promises: Promise<void>[] = [];
      
      // Start 10 concurrent writes
      for (let i = 0; i < 10; i++) {
        const data = { iteration: i, timestamp: Date.now() };
        promises.push(writeQueue.writeJson(testFilePath, data));
      }
      
      // Wait for all writes to complete
      await Promise.all(promises);
      
      // File should exist and be valid JSON
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const parsedData = JSON.parse(fileContent);
      
      expect(parsedData).toHaveProperty('iteration');
      expect(parsedData).toHaveProperty('timestamp');
    });

    it('should handle concurrent writes to different files', async () => {
      const file1 = path.join(testDir, 'file1.json');
      const file2 = path.join(testDir, 'file2.json');
      const data1 = { file: 1 };
      const data2 = { file: 2 };
      
      await Promise.all([
        writeQueue.writeJson(file1, data1),
        writeQueue.writeJson(file2, data2)
      ]);
      
      const content1 = JSON.parse(await fs.readFile(file1, 'utf-8'));
      const content2 = JSON.parse(await fs.readFile(file2, 'utf-8'));
      
      expect(content1).toEqual(data1);
      expect(content2).toEqual(data2);
    });

    it('should clean up temp files on error', async () => {
      // Mock fs.rename to throw an error
      const originalRename = fs.rename;
      fs.rename = async () => {
        throw new Error('Rename failed');
      };
      
      try {
        await expect(writeQueue.writeJson(testFilePath, { test: true }))
          .rejects.toThrow('Failed to write JSON file');
        
        // Temp file should not exist
        const tempPath = `${testFilePath}.tmp`;
        await expect(fs.access(tempPath)).rejects.toThrow();
      } finally {
        // Restore original function
        fs.rename = originalRename;
      }
    });
  });

  describe('readJson', () => {
    it('should read JSON data from file', async () => {
      const testData = { name: 'test', value: 123 };
      await writeQueue.writeJson(testFilePath, testData);
      
      const readData = await writeQueue.readJson(testFilePath, {});
      
      expect(readData).toEqual(testData);
    });

    it('should return default value if file does not exist', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.json');
      const defaultValue = { default: true };
      
      const result = await writeQueue.readJson(nonExistentPath, defaultValue);
      
      expect(result).toEqual(defaultValue);
    });

    it('should throw error for invalid JSON', async () => {
      await fs.writeFile(testFilePath, 'invalid json content');
      
      await expect(writeQueue.readJson(testFilePath, {}))
        .rejects.toThrow('Failed to read JSON file');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      await writeQueue.writeJson(testFilePath, { test: true });
      
      const exists = await writeQueue.exists(testFilePath);
      
      expect(exists).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.json');
      
      const exists = await writeQueue.exists(nonExistentPath);
      
      expect(exists).toBe(false);
    });
  });

  describe('ensureFile', () => {
    it('should create file with default content if it does not exist', async () => {
      const defaultContent = { initialized: true };
      
      await writeQueue.ensureFile(testFilePath, defaultContent);
      
      const content = await writeQueue.readJson(testFilePath, {});
      expect(content).toEqual(defaultContent);
    });

    it('should not overwrite existing file', async () => {
      const originalContent = { original: true };
      const defaultContent = { default: true };
      
      await writeQueue.writeJson(testFilePath, originalContent);
      await writeQueue.ensureFile(testFilePath, defaultContent);
      
      const content = await writeQueue.readJson(testFilePath, {});
      expect(content).toEqual(originalContent);
    });
  });

  describe('utility methods', () => {
    it('should track mutex count', async () => {
      expect(writeQueue.getMutexCount()).toBe(0);
      
      // Writing to a file should create a mutex
      await writeQueue.writeJson(testFilePath, { test: true });
      expect(writeQueue.getMutexCount()).toBe(1);
    });

    it('should clear mutexes', async () => {
      await writeQueue.writeJson(testFilePath, { test: true });
      expect(writeQueue.getMutexCount()).toBe(1);
      
      writeQueue.clearMutexes();
      expect(writeQueue.getMutexCount()).toBe(0);
    });
  });
});