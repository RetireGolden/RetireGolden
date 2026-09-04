/**
 * Malformed-direct-call guard for the annual tax-unit identity phase.
 *
 * The phase already omits tax-unit evidence, rather than throwing, when a
 * direct `simulatePlan` caller hands a person id that satisfies the Plan's
 * legacy string schema but not action identity's nonblank contract (see the
 * `asPersonId` catch in `annualTaxUnitIdentityPhase.ts`). This file pins the
 * matching guarantee for the household-state path: `deriveActionStructuralId`
 * throws a `TypeError` on a JSON-unserializable part (`undefined` included)
 * where the retired `JSON.stringify` minter would have silently coerced it.
 * A validated Plan can never reach this — `household.state` is a
 * length-2 string — so this is reachable only through a malformed direct
 * call, exactly the scenario the sibling catch already documents.
 */
import { describe, expect, it } from 'vitest'

import type { Household } from '../../model/plan.js'
import { annualTaxUnitIdentityPhase } from './annualTaxUnitIdentityPhase.js'

describe('annualTaxUnitIdentityPhase malformed direct input', () => {
  it('omits tax-unit evidence instead of throwing when household.state is not a string', () => {
    const household = {
      filingStatus: 'single',
      hasQualifyingDependent: false,
      state: undefined,
      stateMoves: [],
      capitalLossCarryforward: 0,
      people: [],
    } as unknown as Household

    const result = annualTaxUnitIdentityPhase({
      year: 2026,
      household,
      filingStatusForYear: 'single',
      peopleStates: [{ personId: 'p1', alive: true }],
      retirementActions: [],
    })

    expect(result.annualActionTaxUnit).toBeNull()
    expect(result.conversionFundingTaxUnitEvidence).toBeNull()
  })
})
