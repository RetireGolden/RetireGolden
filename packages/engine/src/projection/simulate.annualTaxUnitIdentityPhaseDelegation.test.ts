/**
 * Delegation and live-identity guard for the annual tax-unit identity phase.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 *
 * **What this one can and cannot assert with `toBe`.** The phase's result
 * object never reaches the published year by reference: `simulatePlan`
 * destructures it and hands the four answers to four different consumers, and
 * the ordinary-withdrawal boundary rebuilds the tax unit into the executor's
 * own snapshot shape. So the identity assertion here is on the *strings*. Each
 * pass injects a per-year sentinel into all three published identifiers, and
 * the year has to publish those exact strings — which a caller that re-derived
 * the unit inline, beside an orphaned helper, could not do.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualTaxUnitIdentityPhaseInput,
  AnnualTaxUnitIdentityPhaseResult,
} from './internal/annualTaxUnitIdentityPhase.js'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualTaxUnitIdentityPhaseInput,
      AnnualTaxUnitIdentityPhaseResult
    >(),
)

vi.mock('./internal/annualTaxUnitIdentityPhase.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/annualTaxUnitIdentityPhase.js')>(),
    'annualTaxUnitIdentityPhase',
    (natural, { ordinal }): AnnualTaxUnitIdentityPhaseResult => {
      const unit = natural.annualActionTaxUnit
      if (unit === null) return natural
      return {
        ...natural,
        annualActionTaxUnit: {
          ...unit,
          taxUnitId: `seam-tax-unit-${ordinal}`,
          taxUnitEvidenceId: `seam-tax-unit-evidence-${ordinal}`,
          stateFilingStatusId: `seam-state-filing-${ordinal}`,
        },
      }
    },
  ),
)

import {
  expectDistinctInjections,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import {
  parseRetirementActionRequest,
  type RetirementActionRequest,
} from '../actions/index.js'
import type { Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  singlePersonPlan,
  taxableAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2027

function namedTaxableWithdrawal(year: number): RetirementActionRequest {
  const parsed = parseRetirementActionRequest({
    actionId: `withdraw-taxable-${year}`,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year,
    executionSequence: 1,
    requestedAmount: 100_000,
    allocations: [{
      allocationId: `withdraw-taxable-${year}-allocation`,
      sourceAccountId: 'taxable-a',
      requestedAmount: 100_000,
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function twoYearPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 90 })
  plan.accounts = [{
    ...taxableAccount('taxable-a', 100_000, 40_000),
    ownerPersonId: 'p1',
  }]
  plan.strategies.retirementActions = [
    namedTaxableWithdrawal(START_YEAR),
    namedTaxableWithdrawal(END_YEAR),
  ]
  return validatePlan(plan)
}

describe('annual tax-unit identity delegation', () => {
  it('publishes the seam\'s own tax-unit identifiers, one distinct set per year', () => {
    seam.reset()
    const result = simulatePlan(twoYearPlan(), {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    // One pass per projected year, and no cached first-year answer.
    const calls = expectSeamRan(seam, END_YEAR - START_YEAR + 1)
    expectDistinctInjections(seam)

    for (const [index, call] of calls.entries()) {
      // The caller hands the phase this year's own facts, not a stale copy.
      expect(call.input.year).toBe(START_YEAR + index)
      expect(call.input.peopleStates.map((state) => state.personId))
        .toEqual(['p1'])

      const taxUnit =
        result.years[index]?.retirementActionExecution?.taxableBases?.[0]?.taxUnit
      if (taxUnit === undefined) throw new Error('expected a taxable basis row')
      expect(taxUnit.taxUnitId).toBe(`seam-tax-unit-${index}`)
      expect(taxUnit.taxUnitEvidenceId).toBe(`seam-tax-unit-evidence-${index}`)
      expect(taxUnit.stateFilingStatusId).toBe(`seam-state-filing-${index}`)

      // And the natural answer really was different, so the assertion above is
      // not passing on a value the phase would have produced anyway.
      expect(call.natural.annualActionTaxUnit?.taxUnitId)
        .not.toBe(`seam-tax-unit-${index}`)
    }
  })
})
