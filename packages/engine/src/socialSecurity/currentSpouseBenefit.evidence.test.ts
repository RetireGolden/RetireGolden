import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { claimFactor, spousalBenefitFactor } from './claimFactor.js'
import { ordinarySimultaneousEarlyCurrentSpouseComponents } from './currentSpouseBenefit.js'

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

/**
 * The worksheet's people, spelled as dates the guard accepts: a claimant born
 * 1960-03-15 has a 67y0m FRA, so a 65y0m claim is exactly 24 months early and
 * lands on the same day of month; the worker claims at their own FRA, earlier
 * in calendar time than the claimant, as the guard requires.
 */
const CLAIMANT_DOB = '1960-03-15'
const WORKER_DOB = '1955-03-15'
const CLAIMANT_CLAIM_AGE = { years: 65, months: 0 }
const WORKER_CLAIM_AGE = { years: 66, months: 2 }

describeCalculation(
  'current-spouse-excess-poms-order',
  {
    example: {
      inputs: {
        ownPiaMonthly: 1_000,
        ownRetirementClaimFactor: 13 / 15,
        ownActualMonthly: 2_600 / 3,
        workerPiaMonthly: 3_000,
        monthsBeforeClaimantFra: 24,
        spousalFactor: 5 / 6,
      },
      expected: { ownMonthly: 2_600 / 3, auxiliaryMonthly: 1_250 / 3, combinedMonthly: 3_850 / 3 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/social-security/current-spouse-excess-poms-order.md',
    mutation: 'DOCS/calculations/social-security/current-spouse-excess-poms-order.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    // Both factors come from the production claim-factor module, not from the
    // worksheet's fractions: the fixture's values are what those functions
    // must return for this claim.
    const spousalFactor = spousalBenefitFactor(1960, 3, 15, CLAIMANT_CLAIM_AGE)
    const ownFactor = claimFactor(1960, 3, 15, CLAIMANT_CLAIM_AGE)
    const ownActualMonthly = inputs.ownPiaMonthly! * ownFactor

    const components = () =>
      ordinarySimultaneousEarlyCurrentSpouseComponents({
        currentSpouseContext: true,
        bothAliveInPricedPeriod: true,
        spousalPayableMonths: 12,
        claimantDob: CLAIMANT_DOB,
        workerDob: WORKER_DOB,
        claimantClaimAge: CLAIMANT_CLAIM_AGE,
        workerClaimAge: WORKER_CLAIM_AGE,
        claimantSocialSecurityStreamCount: 1,
        workerSocialSecurityStreamCount: 1,
        claimantDisabilityDeclared: false,
        workerDisabilityDeclared: false,
        ownPiaMonthly: inputs.ownPiaMonthly!,
        ownActualMonthly,
        workerPiaMonthly: inputs.workerPiaMonthly!,
        spousalFactor,
      })

    it('reduces only the 500 excess, publishing 1,250/3 of auxiliary and 3,850/3 combined', () => {
      expectWithin(spousalFactor, inputs.spousalFactor!, example.tolerance, 'spousalFactor')
      expectWithin(ownFactor, inputs.ownRetirementClaimFactor!, example.tolerance, 'ownRetirementClaimFactor')
      expectWithin(ownActualMonthly, inputs.ownActualMonthly!, example.tolerance, 'ownActualMonthly')

      const result = components()
      expect(result).not.toBeNull()
      expectWithin(result!.ownMonthly, expected.ownMonthly!, example.tolerance, 'ownMonthly')
      expectWithin(result!.auxiliaryMonthly, expected.auxiliaryMonthly!, example.tolerance, 'auxiliaryMonthly')
      expectWithin(
        result!.ownMonthly + result!.auxiliaryMonthly,
        expected.combinedMonthly!,
        example.tolerance,
        'combinedMonthly',
      )
    })

    it('does not reduce half the worker PIA before subtracting', () => {
      // The first wrong reading: reduce-then-subtract gives 1,150/3 of
      // auxiliary and a combined 1,250.
      const result = components()
      const reduceThenSubtract = Math.max(
        0,
        0.5 * inputs.workerPiaMonthly! * spousalFactor - ownActualMonthly,
      )
      expect(result!.auxiliaryMonthly).toBeGreaterThan(reduceThenSubtract)
    })

    it('declines outside its guard rather than applying the POMS order anyway', () => {
      const outsideContext = ordinarySimultaneousEarlyCurrentSpouseComponents({
        currentSpouseContext: false,
        bothAliveInPricedPeriod: true,
        spousalPayableMonths: 12,
        claimantDob: CLAIMANT_DOB,
        workerDob: WORKER_DOB,
        claimantClaimAge: CLAIMANT_CLAIM_AGE,
        workerClaimAge: WORKER_CLAIM_AGE,
        claimantSocialSecurityStreamCount: 1,
        workerSocialSecurityStreamCount: 1,
        claimantDisabilityDeclared: false,
        workerDisabilityDeclared: false,
        ownPiaMonthly: inputs.ownPiaMonthly!,
        ownActualMonthly,
        workerPiaMonthly: inputs.workerPiaMonthly!,
        spousalFactor,
      })
      expect(outsideContext).toBeNull()
    })
  },
)
