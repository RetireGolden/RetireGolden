/**
 * What `optimizePlan` hands the solver and publishes from it (decision
 * D-OPTIMIZER-SOLVER-OUTPUT, parts 4 and 5): the objective deflated on the
 * engine's own dollar basis, and the projection's depletion year on a first
 * solve with no solution.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { projectionDollarBasis } from './dollarBasis.js'
import { buildOptimizerInput, optimizePlan } from './optimizePlan.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `solver-output-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }

/** One person born in 1956, planning to `planningAge`, at 2.5% inflation. */
function plan(options: { planningAge: number; spending: number; ira: number }): Plan {
  const p = createEmptyPlan({ newId: testIds, now: fixedNow })
  p.household.people[0] = {
    id: 'p1',
    name: 'Lee',
    dob: '1956-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: options.planningAge, source: 'manual' },
  }
  p.assumptions.inflationPct = 2.5
  p.assumptions.defaultReturnPct = 4
  p.expenses.baseAnnual = options.spending
  p.accounts = [
    { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: options.ira, annualContribution: 0 },
    { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 30_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(p)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('the objective\'s deflator', () => {
  it('is 1 / the last year\'s general-inflation factor the projection publishes, the same double', () => {
    const solvent = plan({ planningAge: 90, spending: 30_000, ira: 900_000 })
    const projection = simulatePlan(solvent, opts)
    const input = buildOptimizerInput(solvent, opts)
    expect(input.years).toHaveLength(projection.years.length)
    const last = projection.years[projection.years.length - 1]!
    // 2026 to 2046: the end of the last year is deflated over the 20 years
    // between the first and the last, as the projection's today's-dollar
    // figures for that year are, not over the 21 plan years.
    expect(input.years.length).toBe(21)
    expect(input.realDollarFactor).toBe(1 / last.inflationScale!)
    expect(input.realDollarFactor).toBe(1 / projectionDollarBasis(projection).factors[20]!)
    expect(input.realDollarFactor).not.toBe(1 / Math.pow(1.025, 21))
    expect(input.realDollarFactor).toBeCloseTo(1 / Math.pow(1.025, 20), 12)
  })

  it('is 1 for a one-year plan', () => {
    const oneYear = plan({ planningAge: 70, spending: 30_000, ira: 900_000 })
    const input = buildOptimizerInput(oneYear, opts)
    expect(input.years.map((year) => year.year)).toEqual([2026])
    expect(input.realDollarFactor).toBe(1)
  })
})

describe('a first solve with no solution', () => {
  it('publishes no figures, no schedule, and the projection\'s depletion year', async () => {
    // Spending the IRA and the cash cannot carry to 90.
    const short = plan({ planningAge: 90, spending: 90_000, ira: 400_000 })
    const projection = simulatePlan(short, opts)
    expect(projection.depletionYear).not.toBeNull()
    const { schedule } = await optimizePlan(short, opts)
    expect(schedule.status).toBe('infeasible')
    expect(schedule.endingAfterTax).toBeNull()
    expect(schedule.lifetimeTax).toBeNull()
    expect(schedule.schedule).toEqual([])
    expect(schedule.conversions).toEqual([])
    expect(schedule.conversionTotal).toBe(0)
    expect(schedule.projectionDepletionYear).toBe(projection.depletionYear)
  })

  it('leaves the field off a solve that has a solution', async () => {
    const solvent = plan({ planningAge: 90, spending: 30_000, ira: 900_000 })
    expect(simulatePlan(solvent, opts).depletionYear).toBeNull()
    const { schedule } = await optimizePlan(solvent, opts)
    expect(schedule.status).toBe('optimal')
    expect(schedule.endingAfterTax).not.toBeNull()
    expect('projectionDepletionYear' in schedule).toBe(false)
  })
})
