/**
 * Pins the ordinary-action alive-evidence identity the forced-distribution,
 * QCD and retirement-action phase mints.
 *
 * **Characterization, not oracle** ([DOCS/testing.md](../../../../../DOCS/testing.md)
 * taxonomy). The value pinned is a published identity, not a dollar figure.
 *
 * **Why a captured seam and not a direct call.** The phase mints this ID inside
 * a closure it hands to `annualOrdinaryWithdrawalBoundary`; nothing on the
 * phase's own input or result carries the minter. So this file intercepts the
 * boundary during a real `simulatePlan` run — the same `vi.mock` interception
 * the `simulate.*Delegation.test.ts` seam guards use — and invokes the captured
 * closure with fixed arguments.
 *
 * **Why the digest is written out.** The ID is consumed by
 * `strategies/accountEligibility.ts` as a per-action liveness gate and never
 * reaches the published ledger, so the differential equivalence dump is blind
 * to it: it reported IDENTICAL across the change that introduced this digest.
 * This literal is the only thing that fails when the minter or the part list
 * moves.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualOrdinaryWithdrawalBoundaryInput,
  AnnualOrdinaryWithdrawalBoundaryResult,
} from './annualOrdinaryWithdrawalBoundary.js'

const seam = vi.hoisted(() => ({
  inputs: [] as AnnualOrdinaryWithdrawalBoundaryInput[],
}))

vi.mock('./annualOrdinaryWithdrawalBoundary.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./annualOrdinaryWithdrawalBoundary.js')
  >()
  return {
    ...original,
    annualOrdinaryWithdrawalBoundary: (
      input: AnnualOrdinaryWithdrawalBoundaryInput,
    ): AnnualOrdinaryWithdrawalBoundaryResult => {
      seam.inputs.push(input)
      return original.annualOrdinaryWithdrawalBoundary(input)
    },
  }
})

import {
  asActionId,
  asPersonId,
  parseRetirementActionRequest,
  type RetirementActionRequest,
} from '../../actions/index.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import {
  singlePersonPlan,
  taxableAccount,
  validatePlan,
} from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'

const YEAR = 2026
const ACTION_ID = 'withdraw-taxable'
const PERSON_ID = 'p1'

/**
 * `deriveActionStructuralId('projection-alive',
 *   ['withdraw-taxable', 'p1', 2026, null])`.
 */
const ALIVE_DIGEST =
  '96d4d6e93b7baa50405b3035c9d4cc09cb443570c9d3c75475677517fabb9017'

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

function runOneYear(): AnnualOrdinaryWithdrawalBoundaryInput {
  const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 90 })
  plan.accounts = [{
    ...taxableAccount('taxable-a', 10_000, 4_000),
    ownerPersonId: 'p1',
  }]
  plan.strategies.retirementActions = [namedTaxableWithdrawal()]
  simulatePlan(validatePlan(plan), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  const captured = seam.inputs[0]
  if (captured === undefined) throw new Error('boundary was never called')
  return captured
}

describe('forced-distribution phase alive-evidence identity', () => {
  it('mints ordinary-action alive evidence with the hardened structural minter', () => {
    const boundaryInput = runOneYear()
    const evidence = boundaryInput.actionPersonAliveEvidence(
      asActionId(ACTION_ID),
      asPersonId(PERSON_ID),
      null,
    )

    expect(evidence.evidenceId).toBe(`projection-alive:${ALIVE_DIGEST}`)
    expect(evidence.actionId).toBe('withdraw-taxable')
    expect(evidence.personId).toBe('p1')
    expect(evidence.actionYear).toBe(YEAR)
    expect(evidence.actionDate).toBeNull()
    expect(evidence.alive).toBe(true)

    // The identity moves with the execution date: it is not a constant.
    const dated = boundaryInput.actionPersonAliveEvidence(
      asActionId(ACTION_ID),
      asPersonId(PERSON_ID),
      `${YEAR}-08-01`,
    )
    expect(dated.evidenceId).not.toBe(`projection-alive:${ALIVE_DIGEST}`)
  })
})
