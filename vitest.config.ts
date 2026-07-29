import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/api/src/**/*.test.ts', 'packages/shared/src/**/*.test.ts'],
    env: {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      PHOTO_TOKEN_SECRET: 'test-photo-secret',
    },
  },
});
