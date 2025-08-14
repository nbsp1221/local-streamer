import { paths } from './paths';
import { security } from './security';
import { constants } from './constants';
import { server } from './server';
import * as ffmpeg from './ffmpeg';

export { paths, security, constants, server, ffmpeg };

// Export all configs as a single object
export const config = {
  paths,
  security,
  constants,
  server,
  ffmpeg,
} as const;
