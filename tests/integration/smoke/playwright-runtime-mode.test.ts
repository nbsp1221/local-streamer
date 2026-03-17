import { describe, expect, test } from 'vitest';
import {
  detectPlaywrightRuntimeMode,
  PLAYWRIGHT_SMOKE_SPEC_PATHS,
} from '../../support/detect-playwright-runtime-mode';

describe('detectPlaywrightRuntimeMode', () => {
  test('selects hermetic-smoke mode when the selected spec set matches the required smoke subset', () => {
    expect(detectPlaywrightRuntimeMode([
      'playwright',
      'test',
      PLAYWRIGHT_SMOKE_SPEC_PATHS[1],
      PLAYWRIGHT_SMOKE_SPEC_PATHS[0],
      '--project=chromium',
    ])).toBe('hermetic-smoke');
  });

  test('selects developer-full mode when no explicit spec files are passed', () => {
    expect(detectPlaywrightRuntimeMode([
      'playwright',
      'test',
    ])).toBe('developer-full');
  });

  test('selects developer-full mode when any broader playback spec is included', () => {
    expect(detectPlaywrightRuntimeMode([
      'playwright',
      'test',
      PLAYWRIGHT_SMOKE_SPEC_PATHS[0],
      'tests/e2e/player-playback-compatibility.spec.ts',
    ])).toBe('developer-full');
  });
});
