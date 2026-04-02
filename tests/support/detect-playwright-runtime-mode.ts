export const PLAYWRIGHT_SMOKE_SPEC_PATHS = [
  'tests/e2e/home-library-owner-smoke.spec.ts',
  'tests/e2e/playlist-owner-smoke.spec.ts',
  'tests/e2e/player-layout.spec.ts',
] as const;

export type PlaywrightRuntimeMode = 'developer-full' | 'hermetic-smoke';

const REQUIRED_HERMETIC_SMOKE_SPEC_SETS = [
  [
    'tests/e2e/home-library-owner-smoke.spec.ts',
    'tests/e2e/player-layout.spec.ts',
  ],
  [...PLAYWRIGHT_SMOKE_SPEC_PATHS],
] as const;

export function detectPlaywrightRuntimeMode(argv: string[]): PlaywrightRuntimeMode {
  const requestedSpecs = new Set(
    argv.filter(argument => argument.endsWith('.spec.ts')),
  );

  if (requestedSpecs.size === 0) {
    return 'developer-full';
  }

  for (const expectedSpecSet of REQUIRED_HERMETIC_SMOKE_SPEC_SETS) {
    const expectedSmokeSpecs = new Set<string>(expectedSpecSet);

    if (requestedSpecs.size !== expectedSmokeSpecs.size) {
      continue;
    }

    let matches = true;
    for (const specPath of requestedSpecs) {
      if (!expectedSmokeSpecs.has(specPath)) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return 'hermetic-smoke';
    }
  }

  return 'developer-full';
}
