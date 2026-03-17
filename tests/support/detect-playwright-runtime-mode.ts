export const PLAYWRIGHT_SMOKE_SPEC_PATHS = [
  'tests/e2e/home-library-owner-smoke.spec.ts',
  'tests/e2e/player-layout.spec.ts',
] as const;

export type PlaywrightRuntimeMode = 'developer-full' | 'hermetic-smoke';

export function detectPlaywrightRuntimeMode(argv: string[]): PlaywrightRuntimeMode {
  const requestedSpecs = new Set(
    argv.filter(argument => argument.endsWith('.spec.ts')),
  );

  if (requestedSpecs.size === 0) {
    return 'developer-full';
  }

  const expectedSmokeSpecs = new Set<string>(PLAYWRIGHT_SMOKE_SPEC_PATHS);

  if (requestedSpecs.size !== expectedSmokeSpecs.size) {
    return 'developer-full';
  }

  for (const specPath of requestedSpecs) {
    if (!expectedSmokeSpecs.has(specPath)) {
      return 'developer-full';
    }
  }

  return 'hermetic-smoke';
}
