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

  test('keeps contributor guidance aligned with packageManager as the Bun source of truth', async () => {
    const agentsGuide = await readFile('AGENTS.md', 'utf8');
    const e2eGuide = await readFile('docs/E2E_TESTING_GUIDE.md', 'utf8');
    const verificationContract = await readFile('docs/verification-contract.md', 'utf8');

    expect(agentsGuide).not.toContain('oven/bun:1.3.10');
    expect(e2eGuide).not.toContain('oven/bun:1.3.10');
    expect(agentsGuide).toContain('matching the repo `packageManager` Bun version');
    expect(e2eGuide).toContain('matching the repo `packageManager` Bun version');
    expect(e2eGuide).toContain('required browser smoke');
    expect(verificationContract).not.toContain('- `bun run test:e2e`');
    expect(verificationContract).toContain('broader developer browser suite');
  });
});
