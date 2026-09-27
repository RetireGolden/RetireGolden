import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { evaluateExactLedgerSchedule } from './optimizePlan.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult } from './types.js'

/**
 * PR #754 finding 5: the engine publishes whether a schedule executed without
 * a material shortfall (ExactLedgerValidation.executedWithoutMaterialShortfall),
 * so the Optimize page reads it instead of re-deriving the margins. The two
 * tests below sit at the band the engine decides on: a shortfall in total with
 * no short year, and a total shortfall exactly at its margin.
 */

/** A retiree with a large traditional IRA and no spending, 2030 to 2039. */
function plan(): Plan {
  let counter = 0
  const draft = createEmptyPlan({
    newId: () => `shortfall-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  draft.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 79, source: 'manual' },
  }
  draft.assumptions.inflationPct = 0
  draft.assumptions.healthcareExtraInflationPct = 0
  draft.assumptions.defaultReturnPct = 0
  draft.assumptions.stateEffectiveTaxPct = 0
  draft.expenses.baseAnnual = 0
  draft.accounts = [
    { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 1_000_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const years = Array.from({ length: 10 }, (_, i) => 2030 + i)
const requested = years.map((year) => ({ year, amount: 10_000 }))

/** The baseline ledger, and the same ledger with each requested year executing `executed`. */
function ledgers(executed: number): { base: Plan; baseline: ProjectionResult; candidate: ProjectionResult } {
  const base = plan()
  const baseline = simulatePlan(base, { startYear: 2030, taxCalculator: createFederalTaxCalculator() })
  const candidate = structuredClone(baseline)
  for (const row of candidate.years) if (years.includes(row.year)) row.rothConversion = executed
  return { base, baseline, candidate }
}

describe('ExactLedgerValidation.executedWithoutMaterialShortfall (PR #754 finding 5)', () => {
  it('is false when the whole schedule falls short by more than its margin though no year does', () => {
    // $9,100 of each $10,000: each year is $900 short, inside max($1,000, $500);
    // the schedule is $9,000 short of $100,000, beyond max($1,000, $5,000).
    const { base, baseline, candidate } = ledgers(9_100)
    const validation = evaluateExactLedgerSchedule(base, requested, baseline, candidate)
    expect(validation.requestedConversionTotal).toBe(100_000)
    expect(validation.executedConversionTotal).toBe(91_000)
    expect(validation.firstMateriallyUnexecutedYear).toBeNull()
    expect(validation.recommendationState).toBe('unexecutable')
    expect(validation.executedWithoutMaterialShortfall).toBe(false)
  })

  it('is true when the whole schedule falls short by exactly its margin', () => {
    // $9,500 of each $10,000: $5,000 short of $100,000, equal to the margin;
    // "more than" is strict, so the execution is not material.
    const { base, baseline, candidate } = ledgers(9_500)
    const validation = evaluateExactLedgerSchedule(base, requested, baseline, candidate)
    expect(validation.firstMateriallyUnexecutedYear).toBeNull()
    expect(validation.recommendationState).not.toBe('unexecutable')
    expect(validation.executedWithoutMaterialShortfall).toBe(true)
  })

  it('is false when one year is short by more than its own margin', () => {
    const { base, baseline, candidate } = ledgers(10_000)
    const row = candidate.years.find((y) => y.year === 2033)!
    row.rothConversion = 8_000
    const validation = evaluateExactLedgerSchedule(base, requested, baseline, candidate)
    expect(validation.firstMateriallyUnexecutedYear).toBe(2033)
    expect(validation.executedWithoutMaterialShortfall).toBe(false)
  })
})
