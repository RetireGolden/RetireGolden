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
        // `insights/` is guarded here now. Every detector has an engine-local
        // sibling suite driving it from plan fixtures and plain projection
        // outputs, so a published @retiregolden/engine can be validated
        // standalone for detectors instead of only through the planner-ui
        // consumer harnesses (src/integration/insightsDetectors.test.ts,
        // guaranteedIncomeDetectors.test.ts, incomeCoverage.test.ts). Those
        // still exercise the same detectors end to end through useProjection,
        // the learning registry, and the spending solver; what they cannot do
        // is fail this package's own build.
        //
        // The floors sit a few points under what the suite measures today
        // (89.34 statements / 83.66 branches / 92.62 functions / 92.90 lines
        // over src/insights/**) — enough headroom that an unrelated edit does
        // not trip them, little enough that deleting a detector's fixtures
        // does. The uncovered remainder is concentrated in the exact-ledger
        // `evaluate()` phases the consumer suites drive; re-running the
        // relocation sweep or the spending solver from here would be a slow
        // second copy of those modules' own tests, not new evidence.
        'src/insights/**': {
          statements: 85,
          branches: 78,
          functions: 88,
          lines: 88,
        },
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
