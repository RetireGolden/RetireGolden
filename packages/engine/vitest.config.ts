import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Script tests included here must stay independent of engine-source imports:
    // only the equivalence CLI installs the configureEngineTree resolve hook.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
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
        // planner-ui workspace (src/integration/insightsDetectors.test.ts,
        // guaranteedIncomeDetectors.test.ts, incomeCoverage.test.ts) because
        // they exercise the detectors through consumer harnesses
        // (useProjection, the learning registry, the spending solver), so
        // package-local coverage here is not meaningful. The cost is real: a
        // published @retiregolden/engine cannot be validated standalone for
        // detectors, and closing that needs engine-local fixtures over plain
        // projection outputs before any threshold is worth setting.
        //
        // `rules/` and `schema/` are absent for a different reason: neither is
        // guarded by how many of its lines a test happens to run. The registry
        // and its attestations are data, pinned exactly by the conformance and
        // freshness suites against committed artifacts, and the JSON schemas
        // are generated and pinned by equality against the shipped plan.v*.json.
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
