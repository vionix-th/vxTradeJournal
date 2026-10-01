import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.js', 'tests/domain/**/*.test.js', 'tests/application/**/*.test.js'] } },
      { test: { name: 'integration', include: ['tests/integration/**/*.test.js'], testTimeout: 20000, hookTimeout: 20000 } },
    ],
  },
});
