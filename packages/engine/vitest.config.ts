import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        'src/socialSecurity/**': {
          statements: 88,
          branches: 75,
          functions: 90,
          lines: 90,
        },
        // `insights/` is deliberately absent: the detector suites live in the
        // app workspace (app/src/integration/) because they exercise the
        // detectors through app harnesses (useProjection, the learning
        // registry, the spending solver), so package-local coverage there is
        // not meaningful.
        'src/{allocation,decisions,ladder,model,montecarlo,params,projection,rmd,scenarios,spending,strategies,tax}/**': {
          statements: 90,
          branches: 75,
          functions: 90,
          lines: 87,
        },
      },
    },
  },
})
