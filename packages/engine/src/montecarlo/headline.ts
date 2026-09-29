/**
 * The headline Monte Carlo run's options, published for every host (decision
 * D-MC-DEFAULT-SEED, 2026-09-28).
 *
 * The app's headline success rate (the KPI bar, the Results verdict, the
 * Monte Carlo page on arrival) is one configuration: 1,000 paths, the engine's
 * default seed, and the lognormal market model built from the plan (its
 * inflation mean, 12 percent return volatility, and per-class shocks when it
 * holds allocated accounts). A host that uses these options draws exactly the
 * app's markets for the same plan. It shows the app's rate only when the rest
 * of the run matches too: the same plan document (after `parsePlan`), the same
 * start year (the app runs from the clock's calendar year), and the same tax
 * calculator (the app's `taxCalculatorFor(plan)`: the federal engine plus the
 * plan's state stack, with its flat override and local rate), with no
 * stochastic longevity and no care shock.
 */
import type { Plan } from '../model/plan.js'
import { buildLognormalModelConfigForPlan, type LognormalModelConfig } from './marketModels.js'
import { DEFAULT_MONTE_CARLO_SEED } from './rng.js'

/** The headline run's path count. */
export const HEADLINE_MONTE_CARLO_PATH_COUNT = 1000

/** The headline model's return volatility, percent a year. */
export const HEADLINE_MONTE_CARLO_RETURN_VOL_PCT = 12

export interface HeadlineMonteCarloOptions {
  readonly startYear: number
  readonly pathCount: number
  readonly seed: number
  readonly model: LognormalModelConfig
}

/**
 * The headline configuration for `plan` from `startYear`: the default seed,
 * `pathCount` paths (1,000 unless a host asks for more, as the Monte Carlo
 * page's "Run 10,000 paths" does; path i is the same market at any count), and
 * `buildLognormalModelConfigForPlan(plan, 12)`.
 */
export function headlineMonteCarloOptions(
  plan: Plan,
  startYear: number,
  pathCount: number = HEADLINE_MONTE_CARLO_PATH_COUNT,
): HeadlineMonteCarloOptions {
  return {
    startYear,
    pathCount,
    seed: DEFAULT_MONTE_CARLO_SEED,
    model: buildLognormalModelConfigForPlan(plan, HEADLINE_MONTE_CARLO_RETURN_VOL_PCT),
  }
}
