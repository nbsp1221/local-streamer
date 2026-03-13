export function prependNoEnvFile(args: string[]): string[] {
  if (args[0] === '--no-env-file') {
    return args;
  }

  return ['--no-env-file', ...args];
}

export function createNoEnvFileBunCommand(args: string[]): string[] {
  return ['bun', ...prependNoEnvFile(args)];
}
