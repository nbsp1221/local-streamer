import { paths } from './paths';
import { security } from './security';
import { constants } from './constants';
import { server } from './server';

export { paths, security, constants, server };

// Export all configs as a single object
export const config = {
  paths,
  security,
  constants,
  server,
} as const;