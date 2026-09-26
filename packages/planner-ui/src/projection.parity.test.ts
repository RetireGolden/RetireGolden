/**
 * B2-P1 slice 1 parity: the planner displays the engine's dollar basis
 * (family display-dollar-basis-conversion, owner decision R19). Every
 * ProjectionView converts with the factor the ledger itself published for the
 * year (`YearResult.inflationScale`), never a compounding of its own.
 *
 * For every example plan projected from 2026:
 * - `view.basis` is `projectionDollarBasis(view.result)`;
 * - `view.deflate` / `view.inflate` equal the engine's `toTodayDollars` /
 *   `toNominalDollars` bit for bit, for $1, $1,000,000 and the year's own
 *   investable total;
 * - the retired planner formula, `amount / Math.pow(1 + i/100, year - 2026)`,
 *   agrees to within a relative 1e-12 (the switch moves only the last binary
 *   digit);
 * - `planDollarBasis(i, 2026, endYear)` (the pages that hold no projection)
 *   reproduces the ledger's factors bit for bit.
 */
import { describe, expect, it } from 'vitest'

import {
  planDollarBasis,
  projectionDollarBasis,
  toNominalDollars,
  toTodayDollars,
} from '@retiregolden/engine/projection/dollarBasis'
import { EXAMPLE_PLANS } from './planner/examples/registry'
import { projectPlan } from './projection'

const START_YEAR = 2026

/** The retired planner conversion (projection.ts `inflationView` before slice 1), kept only as the reference. */
function retiredDeflate(inflationPct: number, year: number, amount: number): number {
  return amount / Math.pow(1 + inflationPct / 100, year - START_YEAR)
}

function retiredInflate(inflationPct: number, year: number, amount: number): number {
  return amount * Math.pow(1 + inflationPct / 100, year - START_YEAR)
}

function relativeGap(a: number, b: number): number {
  if (a === b) return 0
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b))
}

describe('ProjectionView reads the engine dollar basis (display-dollar-basis-conversion)', () => {
  it.each(EXAMPLE_PLANS.map((example) => [example.id, example] as const))('%s', (_id, example) => {
    const plan = example.build()
    const view = projectPlan(plan, START_YEAR)
    const inflationPct = plan.assumptions.inflationPct
    const engineBasis = projectionDollarBasis(view.result)

    expect(view.basis).toEqual(engineBasis)
    expect(view.basis.startYear).toBe(START_YEAR)
    expect(view.basis.factors).toHaveLength(view.result.years.length)

    const planned = planDollarBasis(inflationPct, START_YEAR, view.result.endYear)
    expect(planned.factors).toHaveLength(view.basis.factors.length)
    const factorMismatches = planned.factors.flatMap((factor, index) =>
      Object.is(factor, view.basis.factors[index]) ? [] : [`${START_YEAR + index}: ${factor} vs ${view.basis.factors[index]}`],
    )
    expect(factorMismatches).toEqual([])

    const mismatches: string[] = []
    for (const row of view.result.years) {
      for (const amount of [1, 1_000_000, row.investableTotal]) {
        const today = view.deflate(row.year, amount)
        const nominal = view.inflate(row.year, amount)
        if (!Object.is(today, toTodayDollars(engineBasis, row.year, amount))) mismatches.push(`deflate ${row.year} ${amount}`)
        if (!Object.is(nominal, toNominalDollars(engineBasis, row.year, amount))) mismatches.push(`inflate ${row.year} ${amount}`)
        if (relativeGap(today, retiredDeflate(inflationPct, row.year, amount)) > 1e-12) mismatches.push(`retired deflate ${row.year} ${amount}`)
        if (relativeGap(nominal, retiredInflate(inflationPct, row.year, amount)) > 1e-12) mismatches.push(`retired inflate ${row.year} ${amount}`)
      }
    }
    expect(mismatches).toEqual([])
  })
})
