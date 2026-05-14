import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/main/domain/**',
        'src/shared/**',
        'src/main/services/**',
      ],
      exclude: [
        'src/shared/**/*.test.ts',
        'tests/**',
        // Platform connectors require live OAuth — not unit-testable
        'src/main/services/social/instagram.ts',
        'src/main/services/social/x-twitter.ts',
        // Trends fetch real HTTP — integration-only
        'src/main/services/trends/**',
      ],
      thresholds: {
        lines: 50,
        functions: 45,
        branches: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
    },
  },
})
