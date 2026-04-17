import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonWriteQueue } from './json-write-queue';

describe('JsonWriteQueue', () => {
  let queue: JsonWriteQueue;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'playlist-json-write-queue-'));
    testFilePath = path.join(testDir, 'playlists.json');
    queue = new JsonWriteQueue();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('writes JSON data to disk with stable formatting', async () => {
    const data = { name: 'Playlist', nested: { count: 1 } };

    await queue.writeJson(testFilePath, data);

    const fileContent = await fs.readFile(testFilePath, 'utf8');
    expect(JSON.parse(fileContent)).toEqual(data);
    expect(fileContent).toContain('{\n  "name": "Playlist"');
    expect(fileContent).toContain('  "nested": {\n    "count": 1');
  });

  it('creates parent directories for nested targets', async () => {
    const nestedPath = path.join(testDir, 'nested', 'deep', 'playlist.json');

    await queue.writeJson(nestedPath, { ok: true });

    await expect(fs.readFile(nestedPath, 'utf8')).resolves.toContain('"ok": true');
  });

  it('serializes concurrent writes to the same file without corrupting JSON', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) => queue.writeJson(testFilePath, {
        iteration: index,
      })),
    );

    const fileContent = await fs.readFile(testFilePath, 'utf8');
    expect(JSON.parse(fileContent)).toHaveProperty('iteration');
  });

  it('handles concurrent writes to different files independently', async () => {
    const fileOne = path.join(testDir, 'one.json');
    const fileTwo = path.join(testDir, 'two.json');

    await Promise.all([
      queue.writeJson(fileOne, { file: 1 }),
      queue.writeJson(fileTwo, { file: 2 }),
    ]);

    await expect(queue.readJson(fileOne, { file: 0 })).resolves.toEqual({ file: 1 });
    await expect(queue.readJson(fileTwo, { file: 0 })).resolves.toEqual({ file: 2 });
  });

  it('cleans up the temp file when rename fails', async () => {
    const originalRename = fs.rename;
    fs.rename = async () => {
      throw new Error('rename failed');
    };

    try {
      await expect(queue.writeJson(testFilePath, { ok: true }))
        .rejects.toThrow('Failed to write JSON file: rename failed');
      await expect(fs.access(`${testFilePath}.tmp`)).rejects.toThrow();
    }
    finally {
      fs.rename = originalRename;
    }
  });

  it('reads the default value when the file does not exist', async () => {
    await expect(queue.readJson(testFilePath, { empty: true })).resolves.toEqual({
      empty: true,
    });
  });

  it('wraps invalid JSON parsing failures', async () => {
    await fs.writeFile(testFilePath, 'not valid json');

    await expect(queue.readJson(testFilePath, {}))
      .rejects.toThrow('Failed to read JSON file');
  });

  it('does not overwrite existing content when ensuring a file', async () => {
    await queue.writeJson(testFilePath, { name: 'Existing playlist' });
    await queue.ensureFile(testFilePath, { name: 'Default playlist' });

    await expect(queue.readJson(testFilePath, { name: 'Fallback playlist' })).resolves.toEqual({
      name: 'Existing playlist',
    });
  });
});
