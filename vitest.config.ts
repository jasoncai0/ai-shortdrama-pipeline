import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The CLI is an I/O shell and default-config is data; both are covered
      // indirectly by the e2e run rather than by assertions.
      exclude: ['src/cli.ts', 'src/default-config.ts', 'src/plugins/builtins.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
  },
})
