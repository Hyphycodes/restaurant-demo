import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The email templates are TSX; the project's tsconfig leaves JSX for Next
  // to compile, so the test runner is told to use the automatic runtime.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // `server-only` is a Next.js build-time marker with no runtime behaviour —
      // its whole job is to fail the build if a client component imports the
      // module. Under vitest there is no bundler to enforce that, so it resolves
      // to an empty module rather than being stripped from the source, which
      // would remove the very guard that keeps the service-role key server-side.
      'server-only': path.resolve(import.meta.dirname, 'src/test/server-only.ts'),
    },
  },
});
