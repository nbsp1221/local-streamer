import { constants } from './constants';
import * as ffmpeg from './ffmpeg';
import { paths } from './paths';
import { security } from './security';
import { server } from './server';

export { constants, ffmpeg, paths, security, server };

// Export all configs as a single object
export const config = {
  paths,
  security,
  constants,
  server,
  ffmpeg,
} as const;
