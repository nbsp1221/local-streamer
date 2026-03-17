import { readFileSync } from 'node:fs';

interface PackageJsonContract {
  packageManager?: string;
}

interface VersionCheckInput {
  currentVersion: string;
  packageJson: PackageJsonContract;
}

interface VersionCheckResult {
  currentVersion: string;
  ok: boolean;
  requiredVersion: string;
}

export function getRequiredBunVersion(packageJson: PackageJsonContract): string {
  const packageManager = packageJson.packageManager ?? '';
  const match = /^bun@(.+)$/.exec(packageManager);

  if (!match) {
    throw new Error('package.json must declare packageManager as bun@<version>.');
  }

  return match[1];
}

export function verifyBunVersion(input: VersionCheckInput): VersionCheckResult {
  const requiredVersion = getRequiredBunVersion(input.packageJson);

  return {
    currentVersion: input.currentVersion,
    ok: input.currentVersion === requiredVersion,
    requiredVersion,
  };
}

export function createBunVersionMismatchMessage(input: {
  currentVersion: string;
  requiredVersion: string;
}): string {
  return [
    'Bun version mismatch for repo install/setup.',
    `Current Bun: ${input.currentVersion}`,
    `Required Bun: ${input.requiredVersion}`,
    'Use the package.json Bun contract before running bun install.',
  ].join('\n');
}

function readPackageJson(): PackageJsonContract {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as PackageJsonContract;
}

if (import.meta.main) {
  const result = verifyBunVersion({
    currentVersion: Bun.version,
    packageJson: readPackageJson(),
  });

  if (!result.ok) {
    console.error(createBunVersionMismatchMessage(result));
    process.exit(1);
  }
}
