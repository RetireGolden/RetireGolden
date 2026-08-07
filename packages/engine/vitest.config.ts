import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The engine suite runs whole projections and optimizer searches, and CI
    // runs it under v8 coverage on runners measured at roughly six times local
    // runtime (#230's diagnosis). The 5s default kept tipping marginal tests
    // one at a time as the suite grew (decisions/search on this branch, after
    // owlParity and decisions/search in the app workspace before #233), so the
    // workload is declared once here, the same way app/vite.config.ts declares
    // it. A hung test still fails; it just gets 30s to prove it.
    testTimeout: 30_000,
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
        'src/{actions,allocation,decisions,ladder,model,montecarlo,params,projection,rmd,scenarios,spending,strategies,tax}/**': {
          statements: 90,
          branches: 75,
          functions: 90,
          lines: 87,
        },
      },
    },
  },
})
