/**
 * Pre-loading for the `lazy()` route chunks (routes/lazyPages.tsx), so a
 * jsdom test that *renders* one does not also *pay for it* inside vitest's
 * per-test timeout.
 *
 * The problem this solves is an order dependency, not a slow test. A route
 * behind `lazy()` is a dynamic import, and the first file in a run to reach
 * one pays the whole cold cost of transforming and evaluating that module
 * graph — `PlanRoutes` alone measures ~6 s on a developer machine, past the
 * 5 s test timeout. Every later file finds the graph warm and resolves in a
 * microtask. So the suite passes as a whole while individual files fail on
 * their own, and a shard boundary or a reordering moves which file draws the
 * short straw. That is a mystery failure waiting to happen, and it has
 * already surfaced as intermittent redness on the two `/examples` tests.
 *
 * Awaiting the same dynamic import in `beforeAll` — with a hook timeout wide
 * enough for a cold graph — moves the cost outside the timed window and puts
 * `lazy()`'s own import on the runner's already-populated module cache. The
 * test then waits on rendering, which is what it meant to assert.
 *
 * `groups.test.tsx` had been getting this for free from a static
 * `import PlanRoutes from './PlanRoutes'` it needed for an unrelated
 * assertion, and its `Results:` wait from whatever the workspace render
 * happened to warm first. Calling this helper says so on purpose.
 */

/**
 * The dynamic imports must match the `lazy()` bindings specifier for
 * specifier — a differently-spelled path is a different module id, and would
 * warm a second copy while leaving `lazy()`'s cold.
 *
 * This mirrors BOTH binding modules, in their order: the top-level route
 * groups in `routes/lazyPages.tsx`, then the plan workspace's output screens
 * in `routes/planPages.tsx`. Mirroring them whole is deliberate — a table
 * covering only the chunks that happen to be preloaded today is a trap for
 * the next test that waits on one of the others. Naming a chunk here costs
 * nothing until a caller asks for it.
 */
const loaders = {
  // routes/lazyPages.tsx — the top-level route groups.
  plan: () => import('../routes/PlanRoutes'),
  learn: () => import('../routes/LearnRoutes'),
  examples: () => import('../planner/examples/ExamplesPage'),
  compare: () => import('../planner/ComparePlansPage'),
  howTested: () => import('../planner/HowTestedPage'),
  import: () => import('../import/ImportPage'),
  // routes/planPages.tsx — the workspace output screens. The Enter sections
  // are eager inside PlanRoutes, so `plan` covers those; everything a reader
  // opens on demand needs naming separately.
  assumptionsCard: () => import('../planner/AssumptionsCardPage'),
  ssAnalysis: () => import('../planner/SsAnalysisPage'),
  results: () => import('../planner/ResultsPage'),
  monteCarlo: () => import('../planner/MonteCarloPage'),
  scenarios: () => import('../planner/ScenariosPage'),
  householdMap: () => import('../householdMap/HouseholdMapPage'),
  survivor: () => import('../planner/SurvivorTransitionPage'),
  relocation: () => import('../planner/RelocationComparePage'),
  optimize: () => import('../planner/OptimizePage'),
  spendingSolver: () => import('../planner/SpendingSolverPage'),
  insights: () => import('../planner/insights/InsightsPage'),
  report: () => import('../planner/ReportPage'),
} as const

/** The lazy route chunks a test can ask for by name. */
export type LazyRouteName = keyof typeof loaders

/**
 * Hook timeout for a `beforeAll` that preloads. Cold-graph evaluation is the
 * slowest thing in the package and CI runners are slower than a laptop, so
 * this sits well above the ~6 s observed locally rather than close to it —
 * the point is to never turn a slow machine into a failed suite. It is a
 * ceiling on a one-time cost, not a wait: a warm graph returns immediately.
 */
export const LAZY_ROUTE_PRELOAD_TIMEOUT_MS = 60_000

/**
 * Evaluate the named lazy route chunks now. Pass only what the file renders;
 * preloading the whole table would add every chunk's evaluation cost to
 * files that never mount it.
 */
export async function preloadLazyRoutes(...names: readonly LazyRouteName[]): Promise<void> {
  await Promise.all(names.map((name) => loaders[name]()))
}
