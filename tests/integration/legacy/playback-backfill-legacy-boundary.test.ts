import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const FORBIDDEN_PATTERNS = [
  /~\/legacy(?:\/|['"])/,
  /app\/legacy(?:\/|['"])/,
];

describe('playback backfill import boundary', () => {
  test('script and integration test import only active-owned playback backfill code', async () => {
    const targets = [
      'scripts/backfill-browser-compatible-playback.ts',
      'tests/integration/playback/browser-compatible-backfill.test.ts',
    ];

    const results = await Promise.all(targets.map(async target => ({
      content: await readFile(target, 'utf8'),
      target,
    })));
    const blockers = results
      .filter(result => FORBIDDEN_PATTERNS.some(pattern => pattern.test(result.content)))
      .map(result => result.target);

    expect(blockers).toEqual([]);
  });
});
