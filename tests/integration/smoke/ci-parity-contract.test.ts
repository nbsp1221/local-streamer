import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

describe('CI parity contract', () => {
  test('pins GitHub Actions Bun setup to the repo packageManager contract', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
    const dockerfile = await readFile('Dockerfile', 'utf8');

    expect(workflow).toContain('bun-version-file: package.json');
    expect(workflow).not.toContain('bun-version: latest');
    expect(workflow).toContain('hashFiles(\'bun.lock\')');
    expect(dockerfile).toContain('FROM oven/bun:1.3.5 AS base');
    expect(dockerfile).toContain('FROM oven/bun:1.3.5 AS production');
  });

  test('runs a dedicated e2e-smoke workflow job through the standard e2e script', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
    const packageJson = await readFile('package.json', 'utf8');

    expect(workflow).toContain('e2e-smoke:');
    expect(workflow).toContain('bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts');
    expect(packageJson).toContain('"test:e2e":');
    expect(packageJson).not.toContain('"test:e2e:smoke"');
  });

  test('keeps Bun version enforcement at install time instead of repeating a custom prefix across every verification script', async () => {
    const packageJson = await readFile('package.json', 'utf8');

    expect(packageJson).toContain('"preinstall": "bun --no-env-file ./scripts/verify-bun-version.ts"');
    expect(packageJson).not.toContain('./scripts/verify-bun-version.ts && eslint .');
    expect(packageJson).not.toContain('./scripts/verify-bun-version.ts && react-router typegen && tsc');
    expect(packageJson).not.toContain('./scripts/verify-bun-version.ts && LOCAL_STREAMER_DISABLE_VITE_ENV_FILES=true bun --no-env-file ./scripts/run-vitest.ts');
    expect(packageJson).not.toContain('./scripts/verify-bun-version.ts && react-router build');
    expect(packageJson).not.toContain('./scripts/verify-bun-version.ts && LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=Etc/UTC LOCAL_STREAMER_DISABLE_VITE_ENV_FILES=true bun --no-env-file x playwright test');
  });

  test('keeps executable parity contracts on code and config surfaces only', async () => {
    const playwrightConfig = await readFile('playwright.config.ts', 'utf8');

    expect(playwrightConfig).toContain('detectPlaywrightRuntimeMode(process.argv)');
    expect(playwrightConfig).toContain('timezoneId: \'UTC\'');
    expect(playwrightConfig).toContain('locale: \'en-US\'');
    expect(playwrightConfig).toContain('bun --no-env-file run build && bun --no-env-file ./build/server/index.js');
  });

  test('pre-bundles player-only dev dependencies before the first player navigation', async () => {
    const viteConfig = await readFile('vite.config.ts', 'utf8');

    expect(viteConfig).toContain('optimizeDeps: {');
    expect(viteConfig).toContain('include: [');
    expect(viteConfig).toContain('\'@vidstack/react\'');
    expect(viteConfig).toContain('\'@vidstack/react/player/layouts/default\'');
    expect(viteConfig).toContain('\'dashjs\'');
  });
});
