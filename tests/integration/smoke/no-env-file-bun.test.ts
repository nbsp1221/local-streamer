import { describe, expect, test } from 'vitest';
import { createNoEnvFileBunCommand, prependNoEnvFile } from '../../../scripts/no-env-file-bun';

describe('no-env-file Bun command helpers', () => {
  test('prepends --no-env-file for child Bun invocations', () => {
    expect(prependNoEnvFile(['run', 'dev'])).toEqual(['--no-env-file', 'run', 'dev']);
  });

  test('does not duplicate --no-env-file when already present', () => {
    expect(prependNoEnvFile(['--no-env-file', 'run', 'dev'])).toEqual(['--no-env-file', 'run', 'dev']);
  });

  test('builds Bun spawn commands with --no-env-file enabled', () => {
    expect(createNoEnvFileBunCommand(['./build/server/index.js'])).toEqual([
      'bun',
      '--no-env-file',
      './build/server/index.js',
    ]);
  });
});
