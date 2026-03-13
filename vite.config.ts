import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolveViteEnvDir } from './scripts/vite-env-files';

export default defineConfig(({ command }) => ({
  plugins: [
    // Use Hono server only in production build
    ...(command === 'build' ? [reactRouterHonoServer({ runtime: 'bun' })] : []),
    tailwindcss(),
    ...(process.env.VITEST ? [] : [reactRouter()]),
    tsconfigPaths(),
  ],
  build: {
    target: 'es2022',
  },
  envDir: resolveViteEnvDir(process.env),
  test: {
    globals: true,
    exclude: ['node_modules', 'build', 'public'],
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'modules',
          environment: 'node',
          include: [
            'app/modules/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: [
            'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: [
            'tests/setup/ui-test.setup.ts',
          ],
          include: [
            'tests/ui/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'legacy',
          environment: 'node',
          include: [
            'app/legacy/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'tests/Json*.test.ts',
            'tests/hybrid-upload.test.ts',
          ],
        },
      },
    ],
  },
}));
