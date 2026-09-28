/**
 * The one-year death probability, the leaf both montecarlo/mortality.ts and
 * montecarlo/survival.ts read (so neither imports the other in a cycle).
 *
 * q(x) is the one SSA publishes: Table 4C6's "Probability of dying within one
 * year" column for each sex and exact age, read from
 * longevity/ssaPeriodLifeTable.ts as printed (record
 * mortality-published-death-probability). The table's last row is closed, so
 * a life at 119 dies during that year although SSA prints q(119) = 0.926604.
 *
 * A person whose sex is 'average' has no single q(x): 'average' is the 50/50
 * mixture of the male and female survival curves from the person's current
 * age, which montecarlo/survival.ts#survivalCurve builds. So `annualMortality`
 * takes a table sex only.
 *
 * @see ../longevity/ssaPeriodLifeTable.ts (SSA Table 4C6, 2023 period, 2026 Trustees Report)
 */

import { LAST_TABLE_AGE, SSA_PERIOD_LIFE_TABLE } from '../longevity/ssaPeriodLifeTable.js'

export type Sex = 'male' | 'female' | 'average'

/** A sex SSA publishes a column for. 'average' is a mixture of the two, not a column. */
export type TableSex = 'male' | 'female'

/** Oldest integer age in the table; everyone is forced to die by here. */
export const MAX_AGE = LAST_TABLE_AGE

/**
 * One-year probability of death at integer age floor(`age`) for a man or a
 * woman: SSA's published q(x). 0 below age 0; 1 from the table's closed last
 * row (119) on. 'average' is refused: it has no single death probability, so
 * read survival.ts#survivalCurve instead.
 */
export function annualMortality(age: number, sex: TableSex): number {
  if (sex !== 'male' && sex !== 'female') {
    throw new RangeError(
      `annualMortality takes 'male' or 'female'; got ${String(sex)}. 'average' is the mixture of the two survival curves, read through survivalCurve`,
    )
  }
  const x = Math.floor(age)
  if (x < 0) return 0
  if (x >= MAX_AGE) return 1
  return SSA_PERIOD_LIFE_TABLE[sex].q[x] ?? Number.NaN
}
