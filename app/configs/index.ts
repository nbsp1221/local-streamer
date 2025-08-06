import { paths } from './paths';
import { security } from './security';
import { constants } from './constants';
import { server } from './server';

export { paths, security, constants, server };

// 전체 설정을 하나의 객체로 export
export const config = {
  paths,
  security,
  constants,
  server,
} as const;