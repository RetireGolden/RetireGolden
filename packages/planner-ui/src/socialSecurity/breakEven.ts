/**
 * Social Security break-even education (V7 phase 2). Pure cumulative-benefit math
 * for a single person's own retirement benefit across a few claim ages, with COLA
 * and an optional investment-growth assumption. This is the simple pedagogical
 * lens; the whole-plan claiming sweep (ssAnalysis) is the more complete answer.
 *
 * Models one person's benefit only — spousal/survivor interactions are out of
 * scope here (the sweep handles those). COLA accrues from age 62 for every claim
 * age (SSA applies COLAs from 62 even before you claim). With a growth rate, each
 * year's benefit compounds to the comparison age, so a higher return lets the
 * early claimant's head start hold longer and pushes break-even later.
 *
 * @see DOCS/features/social-security.md §3.2
 */

import { claimFactor } from '@retiregolden/engine/socialSecurity/claimFactor'

export interface BreakEvenInput {
  dob: { year: number; month: number; day: number }
  /** Monthly PIA at full retirement age, today's dollars. */
  piaMonthly: number
  /** Whole-year claim ages to compare (e.g. [62, fra, 70]). */
  claimAges: number[]
  /** Annual cost-of-living adjustment, percent. */
  colaPct: number
  /** Annual investment return on benefits received, percent. 0 = straight cumulative. */
  growthPct: number
  /** Highest age to chart (e.g. planning age). */
  throughAge: number
}

export interface BreakEvenPoint {
  age: number
  /** Cumulative value at this age, keyed by claim age. */
  cumulative: Record<number, number>
}

export interface BreakEvenCrossing {
  early: number
  late: number
  /** Age (to 0.1yr) the later claim's cumulative overtakes the earlier; null if not within throughAge. */
  age: number | null
}

export interface BreakEvenResult {
  series: BreakEvenPoint[]
  crossings: BreakEvenCrossing[]
  /** Benefit as a fraction of PIA, by claim age. */
  factors: Record<number, number>
}

const FIRST_AGE = 62

export function computeBreakEven(input: BreakEvenInput): BreakEvenResult {
  const { dob, piaMonthly, claimAges, colaPct, growthPct, throughAge } = input
  const cola = colaPct / 100
  const g = growthPct / 100

  const factors: Record<number, number> = {}
  for (const a of claimAges) {
    factors[a] = claimFactor(dob.year, dob.month, dob.day, { years: a, months: 0 })
  }

  /** Annual benefit received at `age` for a person who claimed at `a` (0 before claim). */
  const annualBenefit = (a: number, age: number): number =>
    age < a ? 0 : piaMonthly * factors[a]! * 12 * Math.pow(1 + cola, age - FIRST_AGE)

  const series: BreakEvenPoint[] = []
  const balance: Record<number, number> = {}
  for (const a of claimAges) balance[a] = 0

  for (let age = FIRST_AGE; age <= throughAge; age++) {
    const cumulative: Record<number, number> = {}
    for (const a of claimAges) {
      balance[a] = balance[a]! * (1 + g) + annualBenefit(a, age)
      cumulative[a] = Math.round(balance[a]!)
    }
    series.push({ age, cumulative })
  }

  const sorted = [...claimAges].sort((x, y) => x - y)
  const crossings: BreakEvenCrossing[] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const early = sorted[i]!
      const late = sorted[j]!
      let crossAge: number | null = null
      let prevDiff: number | null = null
      for (const pt of series) {
        // Before the earlier claim begins, both are $0 — nothing to compare yet.
        if (pt.cumulative[early]! <= 0) continue
        const diff = pt.cumulative[late]! - pt.cumulative[early]!
        if (diff >= 0) {
          crossAge =
            prevDiff !== null && prevDiff < 0
              ? pt.age - 1 + -prevDiff / (diff - prevDiff)
              : pt.age
          break
        }
        prevDiff = diff
      }
      crossings.push({ early, late, age: crossAge === null ? null : Math.round(crossAge * 10) / 10 })
    }
  }

  return { series, crossings, factors }
}
