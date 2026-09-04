/**
 * Refusal fixture for the section 162(l) `outOfScope` record.
 *
 * The record registers the self-employed health-insurance deduction as absent
 * from the income model, and names the one place a caller can even mention it:
 * the ACA year contract's `selfEmployedHealthInsuranceDeduction` assertion,
 * which is a typed refusal for premium-tax-credit MAGI. Asserting anything but
 * `notApplicable` fails the credit closed rather than computing a 162(l)
 * figure, and this fixture drives that through the real projection.
 */
import { describe, expect, it } from 'vitest'

import { describeRefusal } from '../rules/describeRefusal.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026

function acaYear(
  selfEmployedHealthInsuranceDeduction: 'notApplicable' | 'unsupported',
) {
  const plan = singlePersonPlan({ dob: '1990-01-01', planningAge: 60 })
  plan.accounts = [cashAccount('cash', 200_000)]
  // Income above 100% of the federal poverty line, or the year is refused for
  // the eligibility floor instead and the fixture would pin the wrong code.
  plan.incomes = [recurringOrdinaryIncome('consulting', 40_000)]
  setAcaYearContract(plan, {
    year: YEAR,
    monthlyEnrollment: 1_000,
    monthlySlcsp: 1_100,
  })
  const contract = plan.expenses.healthcare.acaYears?.[0]
  if (contract === undefined) throw new Error('fixture lost its ACA year contract')
  contract.assertions = {
    ...contract.assertions,
    selfEmployedHealthInsuranceDeduction,
  }
  const result = simulatePlan(validatePlan(plan), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: { compute: () => 0 },
  })
  const aca = result.years[0]?.aca
  if (aca === undefined) throw new Error('fixture produced no ACA result')
  return aca
}

describe('outOfScope refusals reached through simulatePlan', () => {
  describeRefusal('irc-162-l-1-self-employed-health-insurance-not-modeled', {
    entryPoint: 'packages/engine/src/projection/simulate.ts#simulatePlan',
    outOfScopeInput:
      "an ACA year contract whose selfEmployedHealthInsuranceDeduction assertion is 'unsupported' — the only way to tell the engine a 162(l) deduction exists",
    refusal:
      "ACA support code 'self-employed-deduction-unsupported' with readiness 'nonActionable', so the premium tax credit fails closed and no 162(l) figure is produced",
  }, () => {
    it('fails the credit closed instead of computing a self-employed deduction', () => {
      const aca = acaYear('unsupported')

      expect(aca.supportCodes).toContain('self-employed-deduction-unsupported')
      expect(aca.readiness).toBe('nonActionable')
      expect(aca.modeledAllowablePtc).toBeNull()
      expect(aca.householdMagi).toBeNull()
      expect(aca.cliffState).toBe('unsupported')
    })

    it('prices the same year once the assertion is notApplicable, so the refusal is the deduction claim', () => {
      const aca = acaYear('notApplicable')

      expect(aca.supportCodes).not.toContain('self-employed-deduction-unsupported')
      expect(aca.readiness).toBe('actionable')
      expect(aca.modeledAllowablePtc).not.toBeNull()
    })
  })
})
