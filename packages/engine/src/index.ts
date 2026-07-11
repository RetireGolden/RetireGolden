/**
 * Root entry — the core loop: validate a plan, run the ledger.
 *
 * Deep subpath imports are the primary API surface
 * (`@retiregolden/engine/projection/simulate`,
 * `@retiregolden/engine/montecarlo/run`, `@retiregolden/engine/params`, …);
 * this root re-exports just enough to parse a plan and run a projection.
 */
export { CURRENT_PLAN_SCHEMA_VERSION, planSchema, type Plan } from './model/plan.js'
export { migratePlanToCurrent } from './model/migrations.js'
export { simulatePlan, type SimulateOptions } from './projection/simulate.js'
export type { ProjectionResult, YearResult } from './projection/types.js'
export { summarizeProjection } from './projection/compare.js'
