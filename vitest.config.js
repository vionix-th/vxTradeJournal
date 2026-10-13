import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    coverage: { enabled: process.env.VXJ_COVERAGE === '1', provider: 'v8', include: ['src/**/*.js', 'scripts/database/**/*.js'], reporter: ['json', 'json-summary', 'text-summary'], reportsDirectory: process.env.VXJ_COVERAGE_DIR || 'coverage/unit' },
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.js', 'tests/domain/**/*.test.js', 'tests/application/**/*.test.js'] } },
      { test: { name: 'integration', include: ['tests/integration/**/*.test.js'], testTimeout: 20000, hookTimeout: 20000 } },
    ],
  },
});
