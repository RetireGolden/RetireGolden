/**
 * Pins the three annual tax-unit identities `simulatePlan` mints.
 *
 * **Characterization, not oracle** ([DOCS/testing.md](../../../../DOCS/testing.md)
 * taxonomy): no expected value here comes from statute or a worksheet. What is
 * pinned is a published *identity*, and the reason it is written out rather
 * than recomputed is that these three strings leave the projection. They reach
 * the ordinary-withdrawal executor, the taxable basis and attribution chain,
 * and the conversion-linked funding runs, each of which folds them into its own
 * evidence ID. A silent change to the minter or to a part list therefore has to
 * fail in this file rather than surface as a moved digest somewhere downstream.
 *
 * All three are `deriveActionStructuralId(prefix, parts)` — `<prefix>` plus a
 * 64-hex SHA-256 of the canonical JSON of the parts — never an interpolated
 * `JSON.stringify` payload.
 */
import { describe, expect, it } from 'vitest'

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

const YEAR = 2026
const ACTION_ID = 'withdraw-taxable'
const PERSON_ID = 'p1'

/**
 * The fixture files single, resides in KY for the whole year and has one living
 * member `p1`, so the parts are exactly:
 *   tax unit          [2026, 'single', ['p1']]
 *   evidence + state  [2026, 'single', ['p1'], ['KY', [{ state: 'KY', months: 12 }]]]
 * The evidence and state-filing identities share their parts, so they share a
 * digest and only the prefix separates them.
 */
const TAX_UNIT_DIGEST =
  '77525117646b23745c4491519f23943bae27c65f44ff8e86a30e6999c9eeab73'
const STATE_FILING_DIGEST =
  '263e5f4d74096f9d9b898d039fa6eae5e8d11d371d27058fccc39a19f91c8ab4'

/** The year's one named ordinary withdrawal, parsed into its branded form. */
function namedTaxableWithdrawal(): RetirementActionRequest {
  const parsed = parseRetirementActionRequest({
    actionId: ACTION_ID,
    kind: 'ordinaryWithdrawal',
    personId: PERSON_ID,
    year: YEAR,
    executionSequence: 1,
    requestedAmount: 100_000,
    allocations: [{
      allocationId: 'withdraw-taxable-allocation',
      sourceAccountId: 'taxable-a',
      requestedAmount: 100_000,
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

/** One owned taxable account and one named withdrawal against it. */
function planWithTaxableWithdrawal(state?: Plan['household']['state']): Plan {
  const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 90 })
  if (state !== undefined) plan.household.state = state
  plan.accounts = [{
    ...taxableAccount('taxable-a', 10_000, 4_000),
    ownerPersonId: 'p1',
  }]
  plan.strategies.retirementActions = [namedTaxableWithdrawal()]
  return validatePlan(plan)
}

function taxUnitOf(plan: Plan) {
  const result = simulatePlan(plan, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  const basis = result.years[0]?.retirementActionExecution?.taxableBases?.[0]
  if (basis === undefined) throw new Error('expected a taxable basis row')
  return basis.taxUnit
}

describe('simulatePlan annual tax-unit identity', () => {
  it('mints the tax unit, its evidence, and the state filing status as digests', () => {
    const taxUnit = taxUnitOf(planWithTaxableWithdrawal())

    expect(taxUnit.taxUnitId).toBe(`projection-tax-unit:${TAX_UNIT_DIGEST}`)
    expect(taxUnit.taxUnitEvidenceId)
      .toBe(`projection-tax-unit-evidence:${STATE_FILING_DIGEST}`)
    expect(taxUnit.stateFilingStatusId)
      .toBe(`projection-state-filing-status:${STATE_FILING_DIGEST}`)
    expect(taxUnit.taxUnitMemberPersonIds).toEqual(['p1'])
  })

  it('separates the three identities by prefix, not by digest', () => {
    // The tax unit alone omits the annual state-filing inputs, so it carries a
    // different digest; the other two include them and therefore agree.
    expect(TAX_UNIT_DIGEST).not.toBe(STATE_FILING_DIGEST)
    expect(TAX_UNIT_DIGEST).toMatch(/^[0-9a-f]{64}$/)
    expect(STATE_FILING_DIGEST).toMatch(/^[0-9a-f]{64}$/)
  })

  it('moves only the state-aware identities when the household resides elsewhere', () => {
    // Residency is part of `annualStateFilingInputs` but not of the bare tax
    // unit, so exactly two of the three identities may move.
    const taxUnit = taxUnitOf(planWithTaxableWithdrawal('OH'))

    expect(taxUnit.taxUnitId).toBe(`projection-tax-unit:${TAX_UNIT_DIGEST}`)
    expect(taxUnit.stateFilingStatusId)
      .not.toBe(`projection-state-filing-status:${STATE_FILING_DIGEST}`)
    expect(taxUnit.taxUnitEvidenceId)
      .not.toBe(`projection-tax-unit-evidence:${STATE_FILING_DIGEST}`)
  })
})
